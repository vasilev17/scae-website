import type { CSSProperties, ReactNode, Ref } from 'react';

type GateFrameProps = {
  ref?: Ref<HTMLDivElement>;
  // Baked metal texture, laid over each pane's gradient.
  metalSrc: string;
  logoSrc: string;
  // Content carried by the top pane, e.g. the navbar.
  children?: ReactNode;
  // Sits between the panes: above the bottom metal, under the top bar.
  stage?: ReactNode;
};

export function GateFrame({
  ref,
  metalSrc,
  logoSrc,
  children,
  stage,
}: GateFrameProps) {
  return (
    <div
      ref={ref}
      className="gate-reveal pointer-events-none fixed inset-0"
      style={{ '--gate-metal': `url("${metalSrc}")` } as CSSProperties}
    >
      <div
        className="gate-pane-group gate-pane-group--bottom"
        aria-hidden="true"
      >
        <div className="gate-pane-shadow">
          <div className="gate-pane gate-pane--bottom"></div>
        </div>
        <img src={logoSrc} alt="" className="gate-logo gate-logo--bottom" />
      </div>
      {stage}
      <div className="gate-pane-group gate-pane-group--top">
        <div className="gate-pane-shadow" aria-hidden="true">
          <div className="gate-pane gate-pane--top"></div>
        </div>
        <img
          src={logoSrc}
          alt=""
          className="gate-logo gate-logo--top"
          fetchPriority="high"
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}
