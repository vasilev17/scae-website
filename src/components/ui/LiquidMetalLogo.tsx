// Shader: paper.design Liquid Metal (MIT). Host rewritten for SCAE.  Adapted: 2026-09-08
// https://framer.com/m/LiquidMetal-7nNZ.js@NbxdDP6uG73LOOi54hYX

import { useEffect, useRef, useState } from 'react';

import { processLiquidMetalImage } from '@/components/ui/liquid-metal-preprocess';
import {
  LIQUID_METAL_FRAG,
  LIQUID_METAL_VERT,
} from '@/components/ui/liquid-metal-shader';

type LiquidMetalLogoProps = {
  src: string;
  alt: string;
};

type UniformMap = Record<string, WebGLUniformLocation>;

const DEFAULTS = {
  speed: 0.3,
  refraction: 0.015,
  edge: 0.4,
  patternBlur: 0.005,
  liquid: 0.07,
  patternScale: 2,
} as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function LiquidMetalLogo({ src, alt }: LiquidMetalLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setFailed(true);
      return undefined;
    }

    let disposed = false;
    let frame = 0;
    let texture: WebGLTexture | null = null;
    const vertexShader = compile(gl, gl.VERTEX_SHADER, LIQUID_METAL_VERT);
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, LIQUID_METAL_FRAG);
    if (!vertexShader || !fragmentShader) {
      setFailed(true);
      return undefined;
    }

    const program = gl.createProgram();
    if (!program) {
      setFailed(true);
      return undefined;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return undefined;
    }

    const uniforms: UniformMap = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      const location = gl.getUniformLocation(program, info.name);
      if (location) uniforms[info.name] = location;
    }

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(2, Math.round(Math.min(rect.width, rect.height) * dpr));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      gl.viewport(0, 0, size, size);
    };

    const draw = (time: number) => {
      const uTime = uniforms.u_time;
      if (uTime) gl.uniform1f(uTime, time);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const observer = new ResizeObserver(() => {
      setSize();
      if (reduce) draw(0);
    });
    observer.observe(canvas);

    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      elapsed += now - last;
      last = now;
      draw(elapsed % 10000);
      frame = requestAnimationFrame(loop);
    };

    void processLiquidMetalImage(src)
      .then((imageData) => {
        if (disposed) return;
        setSize();
        const uRatio = uniforms.u_ratio;
        const uImgRatio = uniforms.u_img_ratio;
        const uPatternScale = uniforms.u_patternScale;
        const uRefraction = uniforms.u_refraction;
        const uEdge = uniforms.u_edge;
        const uPatternBlur = uniforms.u_patternBlur;
        const uLiquid = uniforms.u_liquid;
        const uImage = uniforms.u_image_texture;
        if (uRatio) gl.uniform1f(uRatio, 1);
        if (uImgRatio) gl.uniform1f(uImgRatio, imageData.width / imageData.height);
        if (uPatternScale) gl.uniform1f(uPatternScale, DEFAULTS.patternScale);
        if (uRefraction) gl.uniform1f(uRefraction, DEFAULTS.refraction);
        if (uEdge) gl.uniform1f(uEdge, DEFAULTS.edge);
        if (uPatternBlur) gl.uniform1f(uPatternBlur, DEFAULTS.patternBlur);
        if (uLiquid) gl.uniform1f(uLiquid, DEFAULTS.liquid);

        texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          imageData.width,
          imageData.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          imageData.data,
        );
        if (uImage) gl.uniform1i(uImage, 0);

        setReady(true);
        if (reduce) {
          draw(0);
          return;
        }
        last = performance.now();
        frame = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (texture) gl.deleteTexture(texture);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [src]);

  return (
    <div className="gallery-logo-metal" data-ready={ready && !failed}>
      <img src={src} alt={alt} width={150} height={150} />
      {failed ? null : (
        <canvas ref={canvasRef} aria-hidden="true" className="gallery-logo-canvas" />
      )}
    </div>
  );
}
