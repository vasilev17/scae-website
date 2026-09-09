import { SatelliteDish, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';
import { ExhibitDialog } from '@/components/ui/ExhibitDialog';

export type GroundSegmentCopy = {
  close: string;
  body: string;
  launchBody: string;
  expandPhoto: string;
  closePhoto: string;
};

export type GroundSegmentPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type GroundSegmentOverlayProps = {
  open: boolean;
  origin: { x: number; y: number };
  title: string;
  copy: GroundSegmentCopy;
  photos: GroundSegmentPhoto[];
  onClose: () => void;
};

export function GroundSegmentOverlay({
  open,
  origin,
  title,
  copy,
  photos,
  onClose,
}: GroundSegmentOverlayProps) {
  const [stand, pad] = photos;
  const [enlarged, setEnlarged] = useState<GroundSegmentPhoto | null>(null);
  if (!open && enlarged) setEnlarged(null);

  return (
    <ExhibitDialog
      open={open}
      origin={origin}
      title={title}
      closeLabel={copy.close}
      dialogId="ground-segment-dialog"
      titleId="ground-overlay-title"
      onClose={onClose}
    >
      <CardContainer containerClassName="mission-card-wrap py-0">
        <CardBody className="ground-card h-auto w-[min(64rem,94vw)] max-w-none">
          <div className="ground-card-copy">
            <CardItem translateZ={40} className="mission-card-icon-wrap">
              <SatelliteDish aria-hidden="true" className="mission-card-icon" />
            </CardItem>
            <CardItem translateZ={30} className="mission-card-rule" />
            <CardItem
              as="p"
              translateZ={55}
              className="mission-card-body w-full"
            >
              {copy.body}
            </CardItem>
            <CardItem
              as="p"
              translateZ={45}
              className="mission-card-body ground-card-launch w-full"
            >
              {copy.launchBody}
            </CardItem>
          </div>
          <div className="ground-card-media">
            {stand ? (
              <CardItem translateZ={80} className="ground-card-photo w-full">
                <PhotoTrigger
                  photo={stand}
                  expandLabel={copy.expandPhoto}
                  onOpen={setEnlarged}
                />
              </CardItem>
            ) : null}
            {pad ? (
              <CardItem translateZ={50} className="ground-card-photo w-full">
                <PhotoTrigger
                  photo={pad}
                  expandLabel={copy.expandPhoto}
                  onOpen={setEnlarged}
                />
              </CardItem>
            ) : null}
          </div>
        </CardBody>
      </CardContainer>
      {enlarged ? (
        <PhotoLightbox
          photo={enlarged}
          closeLabel={copy.closePhoto}
          onClose={() => setEnlarged(null)}
        />
      ) : null}
    </ExhibitDialog>
  );
}

function PhotoTrigger({
  photo,
  expandLabel,
  onOpen,
}: {
  photo: GroundSegmentPhoto;
  expandLabel: string;
  onOpen: (photo: GroundSegmentPhoto) => void;
}) {
  return (
    <button
      type="button"
      className="ground-card-photo-open"
      aria-label={`${expandLabel}: ${photo.alt}`}
      onClick={() => onOpen(photo)}
    >
      <img
        src={photo.src}
        alt=""
        width={photo.width}
        height={photo.height}
      />
    </button>
  );
}

function PhotoLightbox({
  photo,
  closeLabel,
  onClose,
}: {
  photo: GroundSegmentPhoto;
  closeLabel: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ground-photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
    >
      <button
        type="button"
        className="ground-photo-lightbox-scrim"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
      />
      <button
        ref={closeRef}
        type="button"
        className="ground-photo-lightbox-close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <X aria-hidden="true" className="ground-photo-lightbox-x" />
      </button>
    </div>,
    document.body,
  );
}
