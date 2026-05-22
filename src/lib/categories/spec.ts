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

/** Standard mesh sizes for flake graphite. */
export const MESH_SIZES = [
  "+35",
  "+50",
  "+80",
  "+100",
  "+150",
  "-100",
] as const;
export type MeshSize = (typeof MESH_SIZES)[number];

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
 */
export const ListingSpecValuesSchema = z.object({
  /** Required when category.is_custom = true; otherwise inherited. */
  mesh_size: z.enum(MESH_SIZES).optional(),
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
  const mesh = overrides.mesh_size ?? spec.mesh_size ?? "—";
  const carbon =
    overrides.fixed_carbon?.trim() ||
    `${spec.fixed_carbon_min}–${spec.fixed_carbon_max}%`;
  const moisture =
    overrides.moisture?.trim() || `${spec.moisture_max}% max`;
  const sizeDistribution =
    overrides.size_distribution?.trim() ||
    `${spec.size_distribution_min_pct}% min on ${mesh} mesh`;
  return {
    mesh_size: mesh,
    fixed_carbon: carbon,
    moisture: moisture,
    size_distribution: sizeDistribution,
    additional_notes: overrides.additional_notes?.trim() || null,
  };
}
