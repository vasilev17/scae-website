import { Orbit, Target } from 'lucide-react';

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';
import { ExhibitDialog } from '@/components/ui/ExhibitDialog';

export type MissionConceptCopy = {
  close: string;
  missionTitle: string;
  missionBody: string;
  conceptTitle: string;
  conceptBody: string;
};

type MissionConceptOverlayProps = {
  open: boolean;
  origin: { x: number; y: number };
  title: string;
  copy: MissionConceptCopy;
  onClose: () => void;
};

type BriefCardProps = {
  icon: typeof Target;
  title: string;
  body: string;
};

function BriefCard({ icon: Icon, title, body }: BriefCardProps) {
  return (
    <CardContainer
      containerClassName="mission-card-wrap py-0"
      hoverScale={0.625}
    >
      <CardBody className="mission-card h-auto w-[min(28rem,92vw)] max-w-none">
        <CardItem translateZ={40} className="mission-card-icon-wrap">
          <Icon aria-hidden="true" className="mission-card-icon" />
        </CardItem>
        <CardItem as="h3" translateZ={50} className="mission-card-title w-full">
          {title}
        </CardItem>
        <CardItem translateZ={30} className="mission-card-rule" />
        <CardItem as="p" translateZ={60} className="mission-card-body w-full">
          {body}
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}

export function MissionConceptOverlay({
  open,
  origin,
  title,
  copy,
  onClose,
}: MissionConceptOverlayProps) {
  return (
    <ExhibitDialog
      open={open}
      origin={origin}
      title={title}
      closeLabel={copy.close}
      dialogId="mission-concept-dialog"
      titleId="mission-overlay-title"
      onClose={onClose}
    >
      <BriefCard
        icon={Target}
        title={copy.missionTitle}
        body={copy.missionBody}
      />
      <BriefCard
        icon={Orbit}
        title={copy.conceptTitle}
        body={copy.conceptBody}
      />
    </ExhibitDialog>
  );
}
