import { useEffect, useState } from 'react';

import { getQualityResolution } from '@/lib/quality';
import { useQualityTier } from '@/lib/use-quality-tier';

const FPS_EVERY_MS = 500;

/**
 * Corner readout for measurement runs: tier, score, how the tier was chosen
 * and a rolling frame rate. Mounted only behind `flags.qualityDebug`.
 */
export function QualityBadge() {
  const tier = useQualityTier();
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= FPS_EVERY_MS) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { score, source, renderer } = getQualityResolution();

  return (
    <output className="quality-badge" aria-live="off">
      <strong>{tier}</strong>
      <span>score {score}</span>
      <span>{source}</span>
      <span>{fps} fps</span>
      {renderer ? <span className="quality-badge-gpu">{renderer}</span> : null}
    </output>
  );
}
