/**
 * Geometry and phase constants shared by the gate's opening animation and the
 * scroll choreography that follows it. The values are authored in `cqh` against
 * the gate overlay, which is exactly the viewport, so their numeric part can be
 * used directly as a GSAP `yPercent`.
 */

/**
 * Phase boundaries as fractions of the intro duration. The panes hold shut,
 * crack open fast as if unsticking, stall, then travel clear of the viewport at
 * a steady pace before easing back to their resting positions.
 */
export const GATE_PHASES = {
  crackStart: 0.06,
  crackDuration: 0.12,
  openStart: 0.25,
  openDuration: 0.37,
  settleStart: 0.67,
  settleDuration: 0.45,
} as const;

// Pause after the panes have parked, before interior cues (SEE MORE) fade in.
export const GATE_INTERIOR_DELAY = 0.5;

// How far the first fast crack travels, as a percentage of viewport height.
export const GATE_CRACK_TRAVEL = 8;

// Extra travel past the viewport edge, so each pane is fully out of sight.
const CLEARANCE = 4;

export type GateGeometry = {
  // `yPercent` that puts a pane fully outside the viewport.
  openTop: number;
  openBottom: number;
  // `yPercent` where a pane rests once the reveal has settled.
  restTop: number;
  restBottom: number;
};

function readCustomProperty(root: Element, name: string): number {
  return parseFloat(getComputedStyle(root).getPropertyValue(name));
}

export function readGateGeometry(root: Element): GateGeometry {
  const seam = readCustomProperty(root, '--gate-seam');
  const notch = readCustomProperty(root, '--gate-notch');
  const overlap = readCustomProperty(root, '--gate-seam-overlap');
  const restVisibleTop = readCustomProperty(root, '--gate-rest-visible-top');
  const restVisibleBottom = readCustomProperty(
    root,
    '--gate-rest-visible-bottom',
  );

  const paneDepthTop = seam + notch;
  const paneDepthBottom = seam - overlap + notch;

  return {
    openTop: -(paneDepthTop + CLEARANCE),
    openBottom: 100 - seam + CLEARANCE,
    restTop: restVisibleTop - paneDepthTop,
    restBottom: 100 - paneDepthBottom - restVisibleBottom,
  };
}

/**
 * Picks a value per pane without depending on paint order. Usable directly as a
 * GSAP function-based value.
 */
export function perGatePane<T>(top: T, bottom: T) {
  return (_index: number, pane: Element): T =>
    pane.classList.contains('gate-pane-group--top') ? top : bottom;
}

/**
 * Transform origin that makes a scaling pane grow away from the centre of the
 * viewport, like a frame passing the camera. Each pane group is viewport-sized
 * but sits translated by its resting `yPercent`, so the viewport centre lands
 * that far off the element's own centre.
 */
export function gateFlybyOrigin(geometry: GateGeometry) {
  return perGatePane(
    `50% ${50 - geometry.restTop}%`,
    `50% ${50 - geometry.restBottom}%`,
  );
}
