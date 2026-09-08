// Source: https://threeui.com/source-code/elemental-lightning.json  Adapted: 2026-09-08
// Host boundary around elemental-marks.html. Renderer stays authored; this file
// focuses one panel, applies the registered detail patches, and can swap the
// lightning mark for rasterized title text.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { cn } from '@/lib/utils';

import { DETAIL_PATCHES } from './detail-patches';
import elementalMarksSource from './sources/elemental-marks.html?raw';

export const ELEMENT_VARIANTS = ['water', 'lightning', 'fire'] as const;

export type ElementVariant = (typeof ELEMENT_VARIANTS)[number];

export type ElementsBackgroundProps = {
  variant?: ElementVariant;
  speed?: number;
  size?: number;
  particleAmount?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
  // Rasterize this string as the lightning SDF instead of the Anthropic mark.
  markText?: string;
  // @font-face CSS injected into the iframe so markText can use Plateia.
  fontFaceCss?: string;
};

export const ELEMENTS_DEFAULTS = {
  variant: 'water' as ElementVariant,
  speed: 1,
  size: 1,
  particleAmount: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

const VARIANT_LABELS: Record<ElementVariant, string> = {
  water: 'Water',
  lightning: 'Lightning',
  fire: 'Fire',
};

const BASE_ZOOM: Record<ElementVariant, number> = {
  water: 1.56,
  lightning: 1.66,
  fire: 1.82,
};

const SOURCE_ZOOM: Record<ElementVariant, string> = {
  water: '1.06',
  lightning: '1.10',
  fire: '1.16',
};

const BASE_PARTICLES: Record<ElementVariant, number> = {
  water: 160,
  lightning: 360,
  fire: 560,
};

const SOURCE_PARTICLES: Record<ElementVariant, number> = {
  water: 160,
  lightning: 240,
  fire: 420,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function applyDetailPatches(source: string) {
  return DETAIL_PATCHES.reduce(
    (document, [original, enhanced]) => document.replace(original, enhanced),
    source,
  );
}

function applyMarkText(source: string, markText: string) {
  const rasterize = `function rasterizeText(text) {
  const c = document.createElement('canvas');
  c.width = c.height = SDF_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return rasterizeLogo(LOGO_PATHS.anthropic);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = SDF_SIZE * 0.17;
  const maxW = SDF_SIZE * 0.9;
  ctx.font = '700 ' + size + 'px Plateia, sans-serif';
  while (ctx.measureText(text).width > maxW && size > 18) {
    size -= 2;
    ctx.font = '700 ' + size + 'px Plateia, sans-serif';
  }
  ctx.fillText(text, SDF_SIZE / 2, SDF_SIZE / 2);
  return ctx.getImageData(0, 0, SDF_SIZE, SDF_SIZE);
}
const MARK_TEXT = ${JSON.stringify(markText)};
`;

  return source
    .replace(
      'function buildLogo(path) {',
      `${rasterize}function buildLogo(path) {`,
    )
    .replace(
      'const logos = {',
      `Promise.resolve(document.fonts.load('700 72px Plateia')).catch(function () {}).then(function () {
return document.fonts.ready;
}).then(function () {
const logos = {`,
    )
    .replace(
      'anthropic: buildLogo(LOGO_PATHS.anthropic),',
      `anthropic: (function () {
  var img = rasterizeText(MARK_TEXT);
  return { sdf: buildSDF(img), edges: edgePoints(img) };
})(),`,
    )
    .replace(
      'else for (const p of panels) p.draw(0.001);',
      'else for (const p of panels) p.draw(0.001);\n});',
    );
}

function buildFocusedDocument(
  variant: ElementVariant,
  size: number,
  particleAmount: number,
  markText: string | undefined,
  fontFaceCss: string | undefined,
) {
  const zoom = BASE_ZOOM[variant] / clamp(size, 0.65, 1.5);
  const particleCount = Math.max(
    0,
    Math.round(BASE_PARTICLES[variant] * clamp(particleAmount, 0, 2)),
  );
  const focusStyles = `
html, body, main { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
body { background: transparent !important; }
header, .hint, .info, .kanji { display: none !important; }
main { display: block; }
.panel { display: none; }
.panel[data-fx="${variant}"] {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  opacity: 1;
  transform: none;
  animation: none;
}
.panel[data-fx="${variant}"] canvas { width: 100%; height: 100%; }
${fontFaceCss ?? ''}
`;
  const controls = `
(function () {
  var nativeNow = performance.now.bind(performance);
  var last = nativeNow();
  var virtual = last;
  var state = { speed: 1, paused: false };
  window.__ELEMENTS_PAUSED = false;
  performance.now = function () {
    var real = nativeNow();
    if (!state.paused) virtual += (real - last) * state.speed;
    last = real;
    return virtual;
  };
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'elements-controls') return;
    var next = event.data.controls || {};
    if (Number.isFinite(next.speed)) state.speed = Math.max(0, Math.min(3, next.speed));
    state.paused = Boolean(next.paused);
    window.__ELEMENTS_PAUSED = state.paused;
  });
})();
`;

  let documentSource = applyDetailPatches(elementalMarksSource)
    .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]+fonts\.gstatic\.com[^>]*>/gi, '')
    .replace(
      '</head>',
      `<style>${focusStyles}</style><script>${controls}</script></head>`,
    )
    .replace(
      `{ alpha: false, antialias: false }`,
      `{ alpha: true, antialias: false }`,
    )
    .replace(
      new RegExp(`count: ${SOURCE_PARTICLES[variant]}`),
      `count: ${particleCount}`,
    )
    .replace(`zoom: ${SOURCE_ZOOM[variant]}`, `zoom: ${zoom.toFixed(4)}`)
    .replace(
      'for (const p of panels) p.draw(t);',
      'if (!window.__ELEMENTS_PAUSED) for (const p of panels) p.draw(t);',
    );

  if (markText) documentSource = applyMarkText(documentSource, markText);
  return documentSource;
}

export function ElementsBackground({
  variant = ELEMENTS_DEFAULTS.variant,
  speed = ELEMENTS_DEFAULTS.speed,
  size = ELEMENTS_DEFAULTS.size,
  particleAmount = ELEMENTS_DEFAULTS.particleAmount,
  opacity = ELEMENTS_DEFAULTS.opacity,
  hue = ELEMENTS_DEFAULTS.hue,
  saturation = ELEMENTS_DEFAULTS.saturation,
  brightness = ELEMENTS_DEFAULTS.brightness,
  className = '',
  style,
  markText,
  fontFaceCss,
}: ElementsBackgroundProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hostVisible, setHostVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  const safeVariant = ELEMENT_VARIANTS.includes(variant)
    ? variant
    : ELEMENTS_DEFAULTS.variant;
  const safeSpeed = clamp(speed, 0, 3);
  const paused = !hostVisible || !documentVisible;
  const waitingOnFont = Boolean(markText) && !fontFaceCss;
  const source = useMemo(
    () =>
      waitingOnFont
        ? ''
        : buildFocusedDocument(
            safeVariant,
            size,
            particleAmount,
            markText,
            fontFaceCss,
          ),
    [
      fontFaceCss,
      markText,
      particleAmount,
      safeVariant,
      size,
      waitingOnFont,
    ],
  );

  const postControls = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'elements-controls',
        controls: { speed: safeSpeed, paused },
      },
      '*',
    );
  }, [paused, safeSpeed]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setHostVisible(entry?.isIntersecting ?? true),
    );
    observer.observe(iframe);
    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    postControls();
  }, [postControls, source]);

  if (!source) return null;

  return (
    <div
      className={cn('threeui-background', 'elements', className)}
      data-element={safeVariant}
      style={style}
    >
      <iframe
        ref={iframeRef}
        title={`${VARIANT_LABELS[safeVariant]} element background`}
        srcDoc={source}
        sandbox="allow-scripts"
        onLoad={postControls}
        aria-hidden="true"
        tabIndex={-1}
        className="threeui-background-frame"
        style={{
          opacity: clamp(opacity, 0.05, 1),
          filter: `hue-rotate(${clamp(hue, -180, 180)}deg) saturate(${clamp(saturation, 0, 2)}) brightness(${clamp(brightness, 0.35, 1.8)})`,
        }}
      />
    </div>
  );
}
