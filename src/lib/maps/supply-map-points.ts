/**
 * Geographic coordinates for the supply-map SVG overlay.
 * Run `npm run gen:world-map` after changing lon/lat values so projected
 * x/y positions in `world.generated.ts` stay in sync.
 */

export const ORIGIN = {
  lon: 49.4,
  lat: -18.15,
  label: "Toamasina",
};

export type Destination = {
  id: string;
  lon: number;
  lat: number;
  label: string;
  transitDays?: string;
  /** SVG textAnchor for the label — tune when ports cluster together */
  labelAnchor?: "start" | "middle" | "end";
};

export const DESTINATIONS: Destination[] = [
  { id: "rot", lon: 4.11, lat: 51.95, label: "Rotterdam", transitDays: "~35 days", labelAnchor: "end" },
  { id: "ham", lon: 9.93, lat: 53.54, label: "Hamburg", transitDays: "~37 days", labelAnchor: "start" },
  { id: "yok", lon: 139.68, lat: 35.45, label: "Yokohama", transitDays: "~32 days" },
  { id: "mum", lon: 72.95, lat: 18.95, label: "Mumbai (JNPT)", transitDays: "~12 days" },
  { id: "hou", lon: -94.98, lat: 29.68, label: "Houston", transitDays: "~42 days" },
  { id: "spo", lon: -46.33, lat: -23.93, label: "Santos (São Paulo)", transitDays: "~18 days" },
  { id: "pus", lon: 129.08, lat: 35.1, label: "Busan", transitDays: "~30 days" },
  { id: "hcm", lon: 106.77, lat: 10.76, label: "Ho Chi Minh (Cat Lai)", transitDays: "~25 days" },
  { id: "sgp", lon: 103.85, lat: 1.29, label: "Singapore", transitDays: "~12 days" },
  { id: "sav", lon: -81.14, lat: 32.12, label: "Savannah", transitDays: "~40 days" },
  { id: "det", lon: -83.04, lat: 42.33, label: "Detroit", transitDays: "~46 days" },
];

export const LATITUDE_GUIDES = [
  { value: 66.5, label: "66°N" },
  { value: 23.5, label: "23°N" },
  { value: 0, label: "0°" },
  { value: -23.5, label: "23°S" },
] as const;
