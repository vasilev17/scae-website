import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

import { getQualityTier, qualityBudget } from '@/lib/quality';

export type SpecularButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
  // Glass fill behind the label.
  tint?: string;
  tintOpacity?: number;
  // Backdrop blur in pixels.
  blur?: number;
  textColor?: string;
  // Colour of the specular streak that tracks the pointer.
  lineColor?: string;
  // Colour of the static stroke hugging the edge under the streak.
  baseColor?: string;
  intensity?: number;
  // Angular size of each streak, in degrees.
  shineSize?: number;
  // How gradually a streak fades out at its ends, in degrees.
  shineFade?: number;
  // Width of the streak, in pixels.
  thickness?: number;
  // Pointer distance in pixels at which the streak reaches full brightness.
  proximity?: number;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  // Set when the label alone does not name the control, e.g. icon-only.
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-haspopup'?: 'dialog';
  'aria-pressed'?: boolean;
};

type ShaderProps = Required<
  Pick<
    SpecularButtonProps,
    | 'lineColor'
    | 'baseColor'
    | 'intensity'
    | 'shineSize'
    | 'shineFade'
    | 'thickness'
    | 'proximity'
  >
>;

// Slack around the button so the streak can bloom past the border.
const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  // Dark base stroke hugging the edge for a sense of thickness
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  // Symmetric specular: the edges facing toward/away from the light both
  // catch a streak. The angular window (size + fade) is measured with an
  // elliptical normal so it varies continuously along straight edges.
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

/**
 * Glass button whose edge catches a specular highlight that follows the
 * pointer. Defaults are tuned for the dark controls the gate navbar carries
 * over brushed metal. The box metrics (padding, font, corner radius) belong to the
 * class passed in `className`.
 */
export function SpecularButton({
  ref,
  children,
  tint = '#26262b',
  tintOpacity = 0.72,
  blur = 8,
  textColor = '#f4f4f5',
  lineColor = '#eaf4ff',
  baseColor = '#16161a',
  intensity = 1.15,
  shineSize = 12,
  shineFade = 34,
  thickness = 1.2,
  proximity = 220,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  'aria-haspopup': ariaHaspopup,
  'aria-pressed': ariaPressed,
}: SpecularButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  // The shader needs the element too, so a caller's ref is merged in rather
  // than handed the node exclusively.
  const setButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      btnRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  // The render loop reads its parameters through a ref so that retuning them
  // never has to tear down the GL context.
  const propsRef = useRef<ShaderProps>({
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    proximity,
  });

  useEffect(() => {
    propsRef.current = {
      lineColor,
      baseColor,
      intensity,
      shineSize,
      shineFade,
      thickness,
      proximity,
    };
  }, [
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    proximity,
  ]);

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // One WebGL2 context per button is a `high` luxury. Lower tiers keep the
    // CSS glass and the static stroke from the stylesheet.
    if (!qualityBudget(getQualityTier()).specular) return;

    const dpr = window.devicePixelRatio || 1;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr,
      });
    } catch {
      // No WebGL2: the button keeps its CSS appearance, minus the highlight.
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const box = { w: 1, h: 1, radius: 0 };
    let dead = false;
    const resize = (entry?: ResizeObserverEntry) => {
      if (dead) return;
      // Layout box only. getBoundingClientRect includes ancestor scale
      // (gate flyby, intro), which made the SDF stroke a huge stale rect
      // after reload while the pill itself stayed correct.
      const size = entry?.contentBoxSize?.[0];
      const w = size?.inlineSize ?? btn.offsetWidth;
      const h = size?.blockSize ?? btn.offsetHeight;
      if (w < 2 || h < 2) return;
      box.w = w;
      box.h = h;
      // The stylesheet owns the corner radius, so read it back rather than
      // asking the caller to keep a prop in sync with the CSS.
      box.radius = Math.min(
        parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 0,
        Math.min(w, h) / 2,
      );
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';
      program.uniforms.uCenter.value = [
        (PAD + w / 2) * dpr,
        (PAD + h / 2) * dpr,
      ];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
      wake();
    };

    let pointerAngle: number | null = null;
    let proximityT = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      // Over the button itself the light settles on the diagonal (framing the
      // corners) and gently sways with the cursor position within the button.
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
      wake();
    };

    let angle = 2.4;
    let bright = 0;
    let last = performance.now();
    let raf = 0;

    const lineC = new Color();
    const baseC = new Color();

    const update = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      if (pointerAngle != null) {
        const diff =
          ((pointerAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += diff * (1 - Math.exp(-dt * 7));
      }
      bright += (proximityT - bright) * (1 - Math.exp(-dt * 8));

      lineC.set(p.lineColor);
      baseC.set(p.baseColor);
      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value = box.radius * dpr;
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      program.uniforms.uIntensity.value = p.intensity * bright;
      program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = p.thickness * dpr;
      renderer.render({ scene: mesh });

      // Out of range and fully faded: the frame just drawn is the resting one,
      // so stop burning frames until the pointer comes back.
      if (proximityT === 0 && bright < 0.002) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(update);
    };

    function wake() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(update);
    }

    const ro = new ResizeObserver((entries) => {
      resize(entries[0]);
    });
    ro.observe(btn);
    resize();
    const settle = () => resize();
    void document.fonts?.ready.then(settle);
    const late = window.setTimeout(settle, 0);
    requestAnimationFrame(() => requestAnimationFrame(settle));
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('load', settle);

    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.clearTimeout(late);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('load', settle);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <button
      ref={setButtonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-haspopup={ariaHaspopup}
      aria-pressed={ariaPressed}
      className={`relative cursor-pointer border-none transition-transform duration-150 outline-none active:scale-[0.97] disabled:cursor-default disabled:opacity-55 disabled:active:scale-100 ${className}`}
      style={
        {
          color: textColor,
          background: `color-mix(in srgb, ${tint} ${tintOpacity * 100}%, transparent)`,
          backdropFilter: `blur(${blur}px)`,
        } as CSSProperties
      }
    >
      <span
        ref={fxRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-5 z-[1] [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
      />
      {/* Picks up the button's own gap so callers can lay out label and icon
          with a single class on the button. */}
      <span className="relative z-[2] inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </button>
  );
}
