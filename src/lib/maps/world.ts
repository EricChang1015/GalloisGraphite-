/**
 * Runtime map constants and pre-computed SVG geometry.
 *
 * Country paths and projected coordinates are generated at build time by
 * `scripts/gen-world-map.mjs` (d3-geo + world-atlas stay in devDependencies).
 */

export {
  VIEW_W,
  VIEW_H,
  VIEW_BOX,
  MADAGASCAR_ID,
  COUNTRY_PATHS,
  PROJECTED_ORIGIN,
  PROJECTED_DESTINATIONS,
  LATITUDE_GUIDE_LINES,
  type CountryPath,
  type LatitudeGuideLine,
} from "./world.generated";
