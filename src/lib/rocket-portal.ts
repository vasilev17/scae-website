/**
 * Scroll portal that punches a hole through the flyby into the exhibit.
 * Flip `ROCKET_PORTAL` to remove overlay + exhibit without touching explode.
 */

export const ROCKET_PORTAL = true;

export type PortalState = {
  dissolve: number;
};

export const REST_PORTAL: PortalState = { dissolve: 0 };
