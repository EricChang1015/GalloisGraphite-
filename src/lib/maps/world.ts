import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

/**
 * Shared world-map primitives for SVG rendering.
 *
 * Data: Mike Bostock's `world-atlas` package, 110m Natural Earth derivative.
 * Country `id` is the ISO 3166-1 numeric code (string), e.g. "450" for Madagascar.
 *
 * Projection: `geoNaturalEarth1` — a balanced compromise projection commonly
 * used for thematic world maps. Tuned to fit the VIEW_W × VIEW_H viewBox
 * with a small downward translate so polar regions don't crowd the legend.
 */

export const VIEW_W = 1000;
export const VIEW_H = 500;
export const VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;

export const projection = geoNaturalEarth1()
  .scale(190)
  .translate([VIEW_W / 2, VIEW_H / 2 + 10]);

export const pathGen = geoPath(projection);

type CountryProps = { name?: string };

const topo = worldData as unknown as Topology<{
  countries: GeometryCollection<CountryProps>;
}>;

const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<
  Geometry,
  CountryProps
>;

export const COUNTRIES: Feature<Geometry, CountryProps>[] = fc.features;

/** ISO 3166-1 numeric code for Madagascar (highlighted on the supply map). */
export const MADAGASCAR_ID = "450";

/**
 * Project a (lon, lat) pair into the shared SVG coordinate space.
 * Returns [0, 0] for points the projection cannot resolve (extreme polar).
 */
export function project(lon: number, lat: number): [number, number] {
  return projection([lon, lat]) ?? [0, 0];
}
