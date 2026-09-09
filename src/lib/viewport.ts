/**
 * Viewport classes shared by the stylesheet and the islands. The px values
 * mirror the rem breakpoints in global.css (47.9375rem = 767px), so a JS
 * branch and its CSS rule always flip together.
 */

// Phone-width viewport, either orientation: stacked HUD, compact chrome,
// shorter pin, band-sized exhibit stage.
export const PHONE_QUERY = '(max-width: 767px)';

// Portrait phone: the exhibit rocket stands nose-up inside its band.
export const EXHIBIT_PORTRAIT_QUERY =
  '(max-width: 767px) and (orientation: portrait)';

// A real pointer that can hover. Touch fires emulated mouse events, so
// hover-driven effects tilt on tap and then stick until the next tap.
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
