import { useEffect, useState } from 'react';

import { ElementsCollection } from '@/components/ui/elements/ElementsCollection';

import plateiaUrl from '@/assets/generated/plateia-bold.woff2?url';

type LightningTitleProps = {
  text: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function LightningTitle({ text }: LightningTitleProps) {
  const [motion, setMotion] = useState<'unknown' | 'reduce' | 'ok'>('unknown');
  const [fontFaceCss, setFontFaceCss] = useState('');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotion(media.matches ? 'reduce' : 'ok');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (motion !== 'ok') return undefined;
    let cancelled = false;

    void (async () => {
      const response = await fetch(plateiaUrl);
      const buffer = await response.arrayBuffer();
      if (cancelled) return;
      const face = `@font-face{font-family:'Plateia';src:url(data:font/woff2;base64,${bytesToBase64(new Uint8Array(buffer))}) format('woff2');font-weight:700;font-style:normal;}`;
      setFontFaceCss(face);
    })();

    return () => {
      cancelled = true;
    };
  }, [motion]);

  const showFx = motion === 'ok' && fontFaceCss.length > 0;
  const markText = text.toLocaleUpperCase();

  return (
    <div className="gallery-headline" data-fx={showFx ? 'on' : 'off'}>
      <h2 className="gallery-headline-text" id="gallery-title">
        {text}
      </h2>
      {showFx ? (
        <div className="gallery-headline-fx" aria-hidden="true">
          <ElementsCollection
            variant="lightning"
            speed={1}
            size={1.28}
            particleAmount={1}
            hue={0}
            saturation={1}
            brightness={1}
            opacity={1}
            markText={markText}
            fontFaceCss={fontFaceCss}
          />
        </div>
      ) : null}
    </div>
  );
}
