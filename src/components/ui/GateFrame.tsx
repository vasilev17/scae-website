import type { CSSProperties, ReactNode, Ref } from 'react';

type GateFrameProps = {
  ref?: Ref<HTMLDivElement>;
  // Baked metal texture, laid over each pane's gradient.
  metalSrc: string;
  logoSrc: string;
  // Content carried by the top pane, e.g. the navbar.
  children?: ReactNode;
};

/**
 * Markup for the two hangar panes and the split logo. It carries no animation
 * of its own; whoever renders it drives the pane groups. Without scripting the
 * stylesheet parks the panes at their resting positions.
 */
export function GateFrame({
  ref,
  metalSrc,
  logoSrc,
  children,
}: GateFrameProps) {
  return (
    <div
      ref={ref}
      className="gate-reveal pointer-events-none fixed inset-0 z-50"
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
