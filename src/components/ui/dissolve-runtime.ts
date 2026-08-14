import type { RefObject } from 'react';
import {
  LinearFilter,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from 'three';

import { type PortalState } from '@/lib/rocket-portal';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uDissolve;
  uniform vec2 uCenter;
  uniform float uGrayscale;
  uniform float uEdgeIntensity;
  uniform float uEdgeBrightness;
  varying vec2 vUv;

  mat3 sobelX = mat3(
    -1.0, 0.0, 1.0,
    -2.0, 0.0, 2.0,
    -1.0, 0.0, 1.0
  );
  mat3 sobelY = mat3(
    -1.0, -2.0, -1.0,
     0.0,  0.0,  0.0,
     1.0,  2.0,  1.0
  );

  float getLuminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  float sobel(sampler2D tex, vec2 uv, vec2 texelSize) {
    float gx = 0.0;
    float gy = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 offset = vec2(float(i), float(j)) * texelSize;
        float lum = getLuminance(texture2D(tex, uv + offset).rgb);
        gx += lum * sobelX[i + 1][j + 1];
        gy += lum * sobelY[i + 1][j + 1];
      }
    }
    return sqrt(gx * gx + gy * gy);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    float gray = getLuminance(texColor.rgb);
    texColor.rgb = mix(texColor.rgb, vec3(gray), uGrayscale);

    vec2 centeredUv = vUv - uCenter;
    float aspect = uResolution.x / uResolution.y;
    centeredUv.x *= aspect;
    float dist = length(centeredUv);

    float noiseScale = 1.0;
    vec2 pixelatedUv = floor(vUv * uResolution / noiseScale) * noiseScale / uResolution;
    float blockNoise = fbm(pixelatedUv * 100.0) * 0.15;
    float angle = atan(centeredUv.y, centeredUv.x);
    float angularNoise = fbm(vec2(angle * 5.0, 0.0)) * 0.15;
    float noisyDist = dist + blockNoise + angularNoise;

    float maxDist = length(vec2(aspect * 0.5, 0.5));
    float normalizedDist = noisyDist / maxDist;
    float dissolveThreshold = uDissolve * 1.5;

    vec2 texelSize = 1.0 / uResolution;
    float edge = clamp(pow(sobel(uTexture, vUv, texelSize), 0.7) * 2.0, 0.0, 1.0);

    float dissolveMask = smoothstep(dissolveThreshold - 0.03, dissolveThreshold, normalizedDist);

    vec3 baseColor = mix(texColor.rgb, vec3(0.0), uGrayscale);
    vec3 finalColor = baseColor;
    finalColor += vec3(1.0) * edge * uEdgeIntensity * 2.0 * (1.0 + uGrayscale * 3.0) * uEdgeBrightness;

    float edgeZoneWidth = 0.15 * (1.0 - uDissolve) + 0.02;
    float edgeZone =
      smoothstep(dissolveThreshold - edgeZoneWidth, dissolveThreshold - edgeZoneWidth + 0.04, normalizedDist) *
      smoothstep(dissolveThreshold + 0.02, dissolveThreshold - 0.02, normalizedDist);
    float sparkle = hash(floor(gl_FragCoord.xy)) * edgeZone;
    float edgeBrightness = (1.0 - uDissolve) * uEdgeBrightness * (1.0 + uGrayscale * 2.0);
    finalColor += vec3(sparkle * 3.0 * edgeBrightness);

    gl_FragColor = vec4(finalColor, dissolveMask * texColor.a);
  }
`;

type MountArgs = {
  container: HTMLElement;
  dissolveRef: RefObject<PortalState>;
  root: HTMLElement;
};

export function mountDissolve({
  container,
  dissolveRef,
  root,
}: MountArgs): () => void {
  const capture = document.createElement('canvas');
  const captureCtx = capture.getContext('2d');
  if (!captureCtx) return () => {};

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const texture = new Texture(capture);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uResolution: { value: new Vector2(1, 1) },
      uDissolve: { value: 0 },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uGrayscale: { value: 0 },
      uEdgeIntensity: { value: 0 },
      uEdgeBrightness: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const buf = new Vector2();
  const sizeTo = (width: number, height: number) => {
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.getDrawingBufferSize(buf);
    capture.width = buf.x;
    capture.height = buf.y;
    material.uniforms.uResolution.value.copy(buf);
  };

  sizeTo(container.clientWidth, container.clientHeight);

  const onResize = () => sizeTo(container.clientWidth, container.clientHeight);
  window.addEventListener('resize', onResize);

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const dissolve = dissolveRef.current.dissolve;
    const progress = Number.isFinite(dissolve) ? dissolve : 0;

    const star = root.querySelector<HTMLCanvasElement>('section canvas');
    const rocket = root.querySelector<HTMLCanvasElement>('.hero-rocket canvas');
    captureCtx.fillStyle = '#000';
    captureCtx.fillRect(0, 0, capture.width, capture.height);
    if (star) captureCtx.drawImage(star, 0, 0, capture.width, capture.height);
    if (rocket) captureCtx.drawImage(rocket, 0, 0, capture.width, capture.height);
    texture.needsUpdate = true;

    material.uniforms.uDissolve.value = progress;
    material.uniforms.uGrayscale.value = Math.min(1, progress / 0.4);
    material.uniforms.uEdgeIntensity.value = progress * 0.5;
    material.uniforms.uEdgeBrightness.value = 1 - progress;

    renderer.render(scene, camera);
  };
  tick();

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
    material.dispose();
    mesh.geometry.dispose();
    texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
