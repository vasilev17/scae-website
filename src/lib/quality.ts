/**
 * Runtime quality policy. Pure functions, no React.
 *
 * The device is scored once from cheap signals, the score picks a tier, and
 * every GPU / DOM surface reads its budget from that tier. A later FPS probe
 * may drop one tier. Nothing ever upgrades, so the page cannot oscillate.
 *
 * `?tier=` and sessionStorage win over detection so a phone can be forced
 * into any tier for a demo or a measurement run. `?tier=auto` clears both.
 */

export type QualityTier = 'high' | 'medium' | 'low' | 'fallback';

export const QUALITY_TIERS = ['high', 'medium', 'low', 'fallback'] as const;

export type QualitySignals = {
  narrow: number;
  coarse: number;
  memoryGb: number | null;
  cores: number | null;
  slowNet: number;
  softwareGl: number;
  smallTexture: number;
};

export type QualitySource = 'query' | 'session' | 'auto' | 'runtime';

export type QualityResolution = {
  tier: QualityTier;
  score: number;
  signals: QualitySignals;
  source: QualitySource;
  renderer: string | null;
  fps: number | null;
};

export type QualityBudget = {
  webgl: boolean;
  dpr: [number, number];
  antialias: boolean;
  frameloop: 'always' | 'demand';
  // Exhibit Environment + Lightformers (a PMREM pass on top of the lights).
  environment: boolean;
  shadows: boolean;
  // Second WebGL context for the portal hole. Off = CSS crossfade.
  dissolve: boolean;
  exhibitFx: boolean;
  ripple: boolean;
  // Particles in the landing field. 0 = frozen field, painted once.
  starfield: number;
  // Second void field behind the partners panel.
  voidStars: number;
  specular: boolean;
  lanyard: boolean;
  flicker: boolean;
  pixelLoop: boolean;
};

const BUDGETS: Record<QualityTier, QualityBudget> = {
  high: {
    webgl: true,
    dpr: [1, 2],
    antialias: true,
    frameloop: 'always',
    environment: true,
    shadows: true,
    dissolve: true,
    exhibitFx: true,
    ripple: true,
    starfield: 400,
    voidStars: 320,
    specular: true,
    lanyard: true,
    flicker: true,
    pixelLoop: true,
  },
  medium: {
    webgl: true,
    dpr: [1, 1.25],
    antialias: false,
    frameloop: 'always',
    environment: false,
    shadows: false,
    dissolve: false,
    exhibitFx: false,
    ripple: false,
    starfield: 160,
    voidStars: 140,
    specular: false,
    lanyard: false,
    flicker: true,
    pixelLoop: false,
  },
  low: {
    webgl: true,
    dpr: [1, 1],
    antialias: false,
    frameloop: 'demand',
    environment: false,
    shadows: false,
    dissolve: false,
    exhibitFx: false,
    ripple: false,
    starfield: 80,
    voidStars: 80,
    specular: false,
    lanyard: false,
    flicker: false,
    pixelLoop: false,
  },
  fallback: {
    webgl: false,
    dpr: [1, 1],
    antialias: false,
    frameloop: 'demand',
    environment: false,
    shadows: false,
    dissolve: false,
    exhibitFx: false,
    ripple: false,
    starfield: 0,
    voidStars: 0,
    specular: false,
    lanyard: false,
    flicker: false,
    pixelLoop: false,
  },
};

export function qualityBudget(tier: QualityTier): QualityBudget {
  return BUDGETS[tier];
}

export const QUALITY_STORAGE_KEY = 'scae-quality-tier';

// Score thresholds. A Moto-class Android (narrow, coarse, 4 GB) lands `low`,
// a current iPhone (narrow, coarse, memory hidden) lands `medium`, a laptop
// on a software rasteriser lands `medium` unless it is also short on RAM.
const LOW_AT = 4;
const MEDIUM_AT = 2;

// Runtime probe: below this many frames per second the tier drops once.
export const FPS_FLOOR = 28;
export const FPS_SAMPLE_MS = 2500;
const FPS_WINDOW_MS = 500;

const SOFTWARE_GL = /swiftshader|llvmpipe|microsoft basic|software/i;

export function isQualityTier(value: unknown): value is QualityTier {
  return (
    typeof value === 'string' &&
    (QUALITY_TIERS as readonly string[]).includes(value)
  );
}

type Stored = { tier: QualityTier; source: QualitySource };

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(QUALITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'tier' in parsed &&
      isQualityTier(parsed.tier)
    ) {
      const source =
        'source' in parsed && parsed.source === 'query' ? 'query' : 'session';
      return { tier: parsed.tier, source };
    }
  } catch {
    // Storage blocked (private mode, disabled). Detect on every load instead.
  }
  return null;
}

function writeStored(tier: QualityTier, source: QualitySource) {
  try {
    window.sessionStorage.setItem(
      QUALITY_STORAGE_KEY,
      JSON.stringify({ tier, source }),
    );
  } catch {
    // Same as above. A reload re-detects, which is still deterministic.
  }
}

function clearStored() {
  try {
    window.sessionStorage.removeItem(QUALITY_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

type GlProbe = {
  ok: boolean;
  renderer: string | null;
  maxTexture: number;
  maxRenderbuffer: number;
};

const NO_GL: GlProbe = {
  ok: false,
  renderer: null,
  maxTexture: 0,
  maxRenderbuffer: 0,
};

/** One throwaway context. Lost right away so it never counts as live. */
function probeWebGl(): GlProbe {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) {
    return NO_GL;
  }
  const canvas = document.createElement('canvas');
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  } catch {
    gl = null;
  }
  if (!gl) return NO_GL;

  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererValue: unknown = gl.getParameter(
    debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  );
  const maxTextureValue: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxRenderbufferValue: unknown = gl.getParameter(
    gl.MAX_RENDERBUFFER_SIZE,
  );
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  return {
    ok: true,
    renderer: typeof rendererValue === 'string' ? rendererValue : null,
    maxTexture: typeof maxTextureValue === 'number' ? maxTextureValue : 0,
    maxRenderbuffer:
      typeof maxRenderbufferValue === 'number' ? maxRenderbufferValue : 0,
  };
}

type NetworkInfo = {
  saveData?: boolean;
  effectiveType?: string;
};

// `navigator.connection`, `deviceMemory` and `hardwareConcurrency` are not in
// every browser's lib.dom, so they are read off an untyped view of navigator.
function navigatorField(key: string): unknown {
  const nav: unknown = navigator;
  if (!nav || typeof nav !== 'object' || !(key in nav)) return undefined;
  return (nav as Record<string, unknown>)[key];
}

function readNetwork(): NetworkInfo | null {
  const connection = navigatorField('connection');
  if (connection && typeof connection === 'object') {
    return connection as NetworkInfo;
  }
  return null;
}

function readNumber(
  key: 'deviceMemory' | 'hardwareConcurrency',
): number | null {
  const value = navigatorField(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readQualitySignals(probe: GlProbe): QualitySignals {
  const net = readNetwork();
  const slowNet =
    net?.saveData === true ||
    net?.effectiveType === '2g' ||
    net?.effectiveType === 'slow-2g' ||
    net?.effectiveType === '3g';

  const smallTexture =
    probe.ok && (probe.maxTexture < 4096 || probe.maxRenderbuffer < 4096);

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  // A phone turned sideways is still a phone: on touch screens the short
  // side of the screen counts, not the current viewport width.
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const narrow =
    window.matchMedia('(max-width: 767px)').matches ||
    (coarse && shortSide <= 767);

  return {
    narrow: narrow ? 1 : 0,
    coarse: coarse ? 1 : 0,
    memoryGb: readNumber('deviceMemory'),
    cores: readNumber('hardwareConcurrency'),
    slowNet: slowNet ? 1 : 0,
    softwareGl: probe.renderer && SOFTWARE_GL.test(probe.renderer) ? 1 : 0,
    smallTexture: smallTexture ? 1 : 0,
  };
}

/**
 * Pressure score. Positive = weaker device. The two negative adjustments only
 * apply to fine-pointer machines: phone SoCs report 8 cores too, and that
 * number says nothing about their GPU.
 */
export function scoreQuality(signals: QualitySignals): number {
  let score = 0;
  score += signals.narrow;
  score += signals.coarse;
  if (signals.memoryGb !== null) {
    if (signals.memoryGb <= 4) score += 2;
    else if (signals.memoryGb >= 8 && !signals.coarse) score -= 1;
  }
  if (signals.cores !== null) {
    if (signals.cores <= 4) score += 1;
    else if (signals.cores >= 8 && !signals.coarse) score -= 1;
  }
  score += signals.slowNet * 2;
  score += signals.softwareGl * 3;
  score += signals.smallTexture * 2;
  return score;
}

export function tierFromScore(score: number): QualityTier {
  if (score >= LOW_AT) return 'low';
  if (score >= MEDIUM_AT) return 'medium';
  return 'high';
}

function readQueryTier(): QualityTier | 'auto' | null {
  const value = new URLSearchParams(window.location.search).get('tier');
  if (value === 'auto') return 'auto';
  return isQualityTier(value) ? value : null;
}

/** Classify. Order: query, session, detection. Runs once per page load. */
export function resolveQualityTier(): QualityResolution {
  const probe = probeWebGl();
  const signals = readQualitySignals(probe);
  const score = scoreQuality(signals);
  const base = {
    score,
    signals,
    renderer: probe.renderer,
    fps: null,
  };

  const query = readQueryTier();
  if (query === 'auto') {
    clearStored();
  } else if (query) {
    writeStored(query, 'query');
    return { ...base, tier: query, source: 'query' };
  }

  const stored = readStored();
  if (stored) return { ...base, tier: stored.tier, source: stored.source };

  const tier = probe.ok ? tierFromScore(score) : 'fallback';
  writeStored(tier, 'auto');
  return { ...base, tier, source: 'auto' };
}

type Listener = (tier: QualityTier) => void;

const SERVER_RESOLUTION: QualityResolution = {
  tier: 'high',
  score: 0,
  signals: {
    narrow: 0,
    coarse: 0,
    memoryGb: null,
    cores: null,
    slowNet: 0,
    softwareGl: 0,
    smallTexture: 0,
  },
  source: 'auto',
  renderer: null,
  fps: null,
};

let resolution: QualityResolution | null = null;
const listeners = new Set<Listener>();

/** Lazily resolved, so the first caller (leaf effect or hero) pays once. */
export function getQualityResolution(): QualityResolution {
  if (typeof window === 'undefined') return SERVER_RESOLUTION;
  resolution ??= resolveQualityTier();
  return resolution;
}

export function getQualityTier(): QualityTier {
  return getQualityResolution().tier;
}

export function subscribeQualityTier(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The runtime probe's only move. Never lands on `fallback`, and never
 * overrides an explicit `?tier=`: a forced tier is a measurement
 * instrument, so a slow frame must not silently retune it.
 */
export function downgradeQualityTier(fps: number): QualityTier | null {
  const current = getQualityResolution();
  if (current.source === 'query') return null;
  const next: QualityTier | null =
    current.tier === 'high'
      ? 'medium'
      : current.tier === 'medium'
        ? 'low'
        : null;
  if (!next) return null;
  resolution = { ...current, tier: next, source: 'runtime', fps };
  writeStored(next, 'runtime');
  for (const listener of listeners) listener(next);
  return next;
}

/**
 * Median frames-per-second over `sampleMs`, measured in short windows so one
 * long frame (shader compile, GC) cannot sink the whole sample. Resolves null
 * when the tab was hidden, which stalls rAF and is not a slow GPU.
 */
export function sampleFps(sampleMs = FPS_SAMPLE_MS): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || document.hidden) {
      resolve(null);
      return;
    }
    const windows: number[] = [];
    let frames = 0;
    let windowStart = performance.now();
    const start = windowStart;
    let hidden = false;

    const onVisibility = () => {
      if (document.hidden) hidden = true;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const finish = (value: number | null) => {
      document.removeEventListener('visibilitychange', onVisibility);
      resolve(value);
    };

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= FPS_WINDOW_MS) {
        windows.push((frames * 1000) / elapsed);
        frames = 0;
        windowStart = now;
      }
      if (hidden) {
        finish(null);
        return;
      }
      if (now - start < sampleMs) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = [...windows].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const upper = sorted[mid];
      if (upper === undefined) {
        finish(null);
        return;
      }
      const lower = sorted[mid - 1];
      finish(
        sorted.length % 2 === 0 && lower !== undefined
          ? (lower + upper) / 2
          : upper,
      );
    };
    requestAnimationFrame(tick);
  });
}
