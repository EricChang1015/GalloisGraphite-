/**
 * Geographic coordinates for the supply-map SVG overlay.
 * Edit `supply-map-points.json`, then run `npm run gen:world-map` so projected
 * x/y positions in `world.generated.ts` stay in sync.
 */

import points from "./supply-map-points.json";

export const ORIGIN = points.origin;

export type Destination = {
  id: string;
  lon: number;
  lat: number;
  label: string;
  transitDays?: string;
  /** SVG textAnchor for the label — tune when ports cluster together */
  labelAnchor?: "start" | "middle" | "end";
};

export const DESTINATIONS = points.destinations as Destination[];

export const LATITUDE_GUIDES = points.latitudeGuides as ReadonlyArray<{
  value: number;
  label: string;
}>;
