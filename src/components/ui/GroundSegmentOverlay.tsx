import { SatelliteDish } from 'lucide-react';

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';
import { ExhibitDialog } from '@/components/ui/ExhibitDialog';

export type GroundSegmentCopy = {
  close: string;
  body: string;
  launchBody: string;
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
                <img
                  src={stand.src}
                  alt={stand.alt}
                  width={stand.width}
                  height={stand.height}
                />
              </CardItem>
            ) : null}
            {pad ? (
              <CardItem translateZ={50} className="ground-card-photo w-full">
                <img
                  src={pad.src}
                  alt={pad.alt}
                  width={pad.width}
                  height={pad.height}
                />
              </CardItem>
            ) : null}
          </div>
        </CardBody>
      </CardContainer>
    </ExhibitDialog>
  );
}
