/**
 * Product category spec_schema — typed contract and helpers.
 *
 * `product_categories.spec_schema` (jsonb) now follows a structured
 * shape rather than a freeform "field descriptor" map. Centralising
 * the type + helpers here keeps the admin form, listing form and
 * listing detail page in sync.
 */

import { z } from "zod";

/** Product types currently supported. Add more as new product lines launch. */
export const PRODUCT_TYPES = ["flake_graphite"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  flake_graphite: "Flake Graphite",
};

/**
 * Standard mesh sizes for flake graphite. The order here is canonical:
 * coarsest (+35) → finest (-100). `formatMeshSelection` uses the index to
 * detect contiguous ranges for compact rendering.
 */
export const MESH_SIZES = [
  "+35",
  "+50",
  "+80",
  "+100",
  "+150",
  "-100",
] as const;
export type MeshSize = (typeof MESH_SIZES)[number];

const MESH_INDEX: Record<MeshSize, number> = MESH_SIZES.reduce(
  (acc, m, idx) => {
    acc[m] = idx;
    return acc;
  },
  {} as Record<MeshSize, number>
);

/**
 * Stored on `product_categories.spec_schema`. Describes the *category
 * defaults* — what a typical listing in this category looks like. The
 * seller picks values within / overrides these defaults at listing time.
 */
export const CategorySpecSchema = z.object({
  product_type: z.enum(PRODUCT_TYPES).default("flake_graphite"),
  /** Null when `is_custom = true` (seller picks the mesh per listing). */
  mesh_size: z.enum(MESH_SIZES).nullable().default(null),
  fixed_carbon_min: z.number().min(0).max(100).default(75),
  fixed_carbon_max: z.number().min(0).max(100).default(99),
  moisture_max: z.number().min(0).max(100).default(0.5),
  /** "80% MIN of particles match the mesh" — almost always 80. */
  size_distribution_min_pct: z.number().min(0).max(100).default(80),
  /** If true, the listing form unlocks every override field. */
  is_custom: z.boolean().default(false),
});

export type CategorySpec = z.infer<typeof CategorySpecSchema>;

export function parseCategorySpec(raw: unknown): CategorySpec {
  const result = CategorySpecSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  // Graceful fallback for legacy / malformed rows: return sane defaults
  // rather than crash the page. Admin can re-edit the category to fix.
  return CategorySpecSchema.parse({});
}

/**
 * Stored on `listings.specs`. Sellers may override category defaults
 * here, and add a free-form note. All fields are optional — empty
 * means "inherit from the category".
 *
 * `mesh_size` accepts either a single value (standard categories /
 * legacy listings) or an array (Custom Grade listings declaring a
 * mesh range or sparse selection). `parseListingSpecs` / `resolveListingSpecs`
 * / `formatMeshSelection` all handle both shapes.
 */
export const ListingSpecValuesSchema = z.object({
  /**
   * Required when category.is_custom = true; otherwise inherited.
   * Custom Grade listings may persist an array such as
   *   ["+35","+50","+80","+100","+150","-100"]
   * meaning "anywhere in the range +35 to -100 mesh".
   */
  mesh_size: z
    .union([
      z.enum(MESH_SIZES),
      z.array(z.enum(MESH_SIZES)).min(1).max(MESH_SIZES.length),
    ])
    .optional(),
  /** Free string so "94", "94-96", "≥95" all work. */
  fixed_carbon: z.string().max(40).optional(),
  moisture: z.string().max(40).optional(),
  /** "≥80% of particles match the mesh" override. */
  size_distribution: z.string().max(40).optional(),
  additional_notes: z.string().max(2000).optional(),
});

export type ListingSpecValues = z.infer<typeof ListingSpecValuesSchema>;

export function parseListingSpecs(raw: unknown): ListingSpecValues {
  const result = ListingSpecValuesSchema.safeParse(raw ?? {});
  return result.success ? result.data : {};
}

/** Short "+100 Mesh · 75–99% C" label for select dropdowns / chips. */
export function describeCategorySpec(spec: CategorySpec): string {
  const parts: string[] = [];
  if (spec.is_custom) {
    parts.push("Custom mesh");
  } else if (spec.mesh_size) {
    parts.push(`${spec.mesh_size} Mesh`);
  }
  parts.push(`${spec.fixed_carbon_min}–${spec.fixed_carbon_max}% C`);
  parts.push(`moisture ≤ ${spec.moisture_max}%`);
  return parts.join(" · ");
}

/**
 * Render a mesh selection compactly:
 *   ["+100"]                                        → "+100 Mesh"
 *   ["+35","+50","+80","+100","+150","-100"]        → "+35 to -100 Mesh"
 *   ["+35","+80","-100"]                            → "+35, +80, -100 Mesh"
 *
 * Single string inputs pass through unchanged. The canonical ordering
 * (`MESH_SIZES`) is used to detect contiguity, so caller order is
 * irrelevant.
 */
export function formatMeshSelection(
  mesh: MeshSize | MeshSize[] | null | undefined
): string {
  if (mesh == null) return "";
  if (typeof mesh === "string") return `${mesh} Mesh`;
  if (mesh.length === 0) return "";
  // Dedupe and order canonically.
  const ordered = Array.from(new Set(mesh)).sort(
    (a, b) => MESH_INDEX[a] - MESH_INDEX[b]
  );
  if (ordered.length === 1) return `${ordered[0]} Mesh`;
  // Detect contiguous range against canonical index.
  const indices = ordered.map((m) => MESH_INDEX[m]);
  const contiguous = indices.every(
    (idx, i) => i === 0 || idx === indices[i - 1] + 1
  );
  if (contiguous) {
    return `${ordered[0]} to ${ordered[ordered.length - 1]} Mesh`;
  }
  return `${ordered.join(", ")} Mesh`;
}

/**
 * Project the effective specs for a listing by overlaying seller
 * overrides on top of category defaults. Used by the listing detail
 * page so buyers always see concrete values.
 */
export function resolveListingSpecs(
  spec: CategorySpec,
  overrides: ListingSpecValues
): {
  mesh_size: string;
  fixed_carbon: string;
  moisture: string;
  size_distribution: string;
  additional_notes: string | null;
} {
  const overrideMeshLabel =
    overrides.mesh_size != null ? formatMeshSelection(overrides.mesh_size) : "";
  const defaultMeshLabel = spec.mesh_size ? `${spec.mesh_size} Mesh` : "—";
  const meshLabel = overrideMeshLabel || defaultMeshLabel;
  const carbon =
    overrides.fixed_carbon?.trim() ||
    `${spec.fixed_carbon_min}–${spec.fixed_carbon_max}%`;
  const moisture =
    overrides.moisture?.trim() || `${spec.moisture_max}% max`;
  const sizeDistribution =
    overrides.size_distribution?.trim() ||
    `${spec.size_distribution_min_pct}% min on ${meshLabel.replace(/ Mesh$/, "")} mesh`;
  return {
    mesh_size: meshLabel,
    fixed_carbon: carbon,
    moisture: moisture,
    size_distribution: sizeDistribution,
    additional_notes: overrides.additional_notes?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// buildListingTitle — auto-suggest a listing title from category + specs.
//
// Examples:
//   Standard +100, 94% C, 50 MT
//     → "Flake Graphite +100 Mesh · 94% C · 50 MT"
//   Custom Grade, +35..-100, "90-95" C, 25 MT
//     → "Flake Graphite Custom · +35 to -100 Mesh · 90-95% C · 25 MT"
//   No quantity yet:
//     → "Flake Graphite +100 Mesh · 94% C"
// ---------------------------------------------------------------------------

/** Strip the trailing " Mesh" suffix when present (we re-add it via helpers). */
function stripCategoryPrefix(categoryName: string): string {
  // For "Flake Graphite +100 Mesh" we want the category name verbatim;
  // for "Custom Grade" we replace with "Flake Graphite Custom".
  if (/^custom\s+grade$/i.test(categoryName.trim())) {
    return "Flake Graphite Custom";
  }
  return categoryName.trim();
}

export interface BuildListingTitleInput {
  categoryName: string;
  categorySpec: CategorySpec;
  overrides: ListingSpecValues;
  quantity?: number | null;
  unit?: string | null;
}

export function buildListingTitle(input: BuildListingTitleInput): string {
  const { categoryName, categorySpec, overrides, quantity, unit } = input;
  const base = stripCategoryPrefix(categoryName);

  const parts: string[] = [base];

  // For Custom Grade, append the seller's mesh selection (if any) to
  // give the buyer a real signal — the category name alone says "Custom".
  if (categorySpec.is_custom) {
    const meshLabel =
      overrides.mesh_size != null ? formatMeshSelection(overrides.mesh_size) : "";
    if (meshLabel) parts.push(meshLabel);
  }

  // Fixed carbon — prefer the seller override, fall back to category default.
  const fcRaw = overrides.fixed_carbon?.trim();
  if (fcRaw) {
    parts.push(`${fcRaw}% C`);
  } else if (
    categorySpec.fixed_carbon_min != null &&
    categorySpec.fixed_carbon_max != null &&
    categorySpec.fixed_carbon_min !== categorySpec.fixed_carbon_max
  ) {
    parts.push(
      `${categorySpec.fixed_carbon_min}–${categorySpec.fixed_carbon_max}% C`
    );
  } else if (categorySpec.fixed_carbon_min != null) {
    parts.push(`${categorySpec.fixed_carbon_min}% C`);
  }

  if (
    quantity != null &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    unit
  ) {
    const qtyStr = Number.isInteger(quantity)
      ? quantity.toLocaleString()
      : quantity.toString();
    parts.push(`${qtyStr} ${unit}`);
  }

  return parts.join(" · ");
}
