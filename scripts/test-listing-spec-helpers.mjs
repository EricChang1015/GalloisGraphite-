#!/usr/bin/env node
/**
 * Unit-ish tests for the pure helpers in src/lib/categories/spec.ts:
 *   - formatMeshSelection: single / contiguous / sparse
 *   - buildListingTitle:   standard / custom / no-qty cases
 *   - parseListingSpecs:   accepts both string and string[] mesh shapes
 *
 * Run:
 *   node scripts/test-listing-spec-helpers.mjs
 *
 * Exit 0 on all pass, 1 on first failure (prints both expected/actual).
 */

import {
  buildListingTitle,
  formatMeshSelection,
  parseListingSpecs,
  parseCategorySpec,
} from "../src/lib/categories/spec.ts";

let pass = 0;
let fail = 0;
const failures = [];

function eq(actual, expected, label) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${label}`);
    return;
  }
  fail++;
  failures.push({ label, expected, actual });
  console.log(`  ✗ ${label}`);
  console.log(`      expected: ${JSON.stringify(expected)}`);
  console.log(`      actual:   ${JSON.stringify(actual)}`);
}

function deepEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✓ ${label}`);
    return;
  }
  fail++;
  failures.push({ label, expected, actual });
  console.log(`  ✗ ${label}`);
  console.log(`      expected: ${e}`);
  console.log(`      actual:   ${a}`);
}

console.log("=== formatMeshSelection ===");
eq(formatMeshSelection(undefined), "", "undefined -> empty");
eq(formatMeshSelection(null), "", "null -> empty");
eq(formatMeshSelection("+100"), "+100 Mesh", "single string");
eq(formatMeshSelection(["+100"]), "+100 Mesh", "single-element array");
eq(
  formatMeshSelection(["+35", "+50", "+80", "+100", "+150", "-100"]),
  "+35 to -100 Mesh",
  "full contiguous range"
);
eq(
  formatMeshSelection(["+80", "+100", "+150"]),
  "+80 to +150 Mesh",
  "partial contiguous range"
);
eq(
  formatMeshSelection(["+35", "+80", "-100"]),
  "+35, +80, -100 Mesh",
  "sparse selection"
);
eq(
  // canonical order is +35 / +50 / +80 / +100 / +150 / -100, so
  // ["-100","+50","+80"] sorts to ["+50","+80","-100"] which is *sparse*
  // (skips +100 and +150). Confirms the sort is canonical, not insertion.
  formatMeshSelection(["-100", "+50", "+80"]),
  "+50, +80, -100 Mesh",
  "unsorted sparse (canonical order)"
);
eq(
  // Contiguous after sorting.
  formatMeshSelection(["+150", "+50", "+80", "+100"]),
  "+50 to +150 Mesh",
  "unsorted contiguous"
);
eq(
  formatMeshSelection(["+50", "+50", "+80"]),
  "+50 to +80 Mesh",
  "duplicates deduped, contiguous"
);

console.log("\n=== buildListingTitle ===");
const flakeSpec = parseCategorySpec({
  product_type: "flake_graphite",
  mesh_size: "+100",
  fixed_carbon_min: 75,
  fixed_carbon_max: 99,
  moisture_max: 0.5,
  size_distribution_min_pct: 80,
  is_custom: false,
});
eq(
  buildListingTitle({
    categoryName: "Flake Graphite +100 Mesh",
    categorySpec: flakeSpec,
    overrides: { fixed_carbon: "94" },
    quantity: 50,
    unit: "MT",
  }),
  "Flake Graphite +100 Mesh · 94% C · 50 MT",
  "standard +100 with carbon override + qty"
);
eq(
  buildListingTitle({
    categoryName: "Flake Graphite +100 Mesh",
    categorySpec: flakeSpec,
    overrides: {},
    quantity: null,
    unit: null,
  }),
  "Flake Graphite +100 Mesh · 75–99% C",
  "standard +100, no overrides / qty -> uses default carbon range"
);
const customSpec = parseCategorySpec({
  product_type: "flake_graphite",
  mesh_size: null,
  fixed_carbon_min: 75,
  fixed_carbon_max: 99,
  moisture_max: 0.5,
  size_distribution_min_pct: 80,
  is_custom: true,
});
eq(
  buildListingTitle({
    categoryName: "Custom Grade",
    categorySpec: customSpec,
    overrides: {
      mesh_size: ["+35", "+50", "+80", "+100", "+150", "-100"],
      fixed_carbon: "90-95",
    },
    quantity: 25,
    unit: "MT",
  }),
  "Flake Graphite Custom · +35 to -100 Mesh · 90-95% C · 25 MT",
  "custom full range + carbon range"
);
eq(
  buildListingTitle({
    categoryName: "Custom Grade",
    categorySpec: customSpec,
    overrides: { mesh_size: ["+35"], fixed_carbon: "95" },
    quantity: 10,
    unit: "MT",
  }),
  "Flake Graphite Custom · +35 Mesh · 95% C · 10 MT",
  "custom single mesh"
);

console.log("\n=== parseListingSpecs ===");
deepEq(
  parseListingSpecs({ mesh_size: "+100", fixed_carbon: "94" }),
  { mesh_size: "+100", fixed_carbon: "94" },
  "string mesh_size accepted"
);
deepEq(
  parseListingSpecs({
    mesh_size: ["+35", "+80"],
    fixed_carbon: "90-95",
  }),
  { mesh_size: ["+35", "+80"], fixed_carbon: "90-95" },
  "array mesh_size accepted"
);
deepEq(
  parseListingSpecs({ mesh_size: "garbage" }),
  {},
  "invalid value -> empty (graceful fallback)"
);

console.log(`\n==== ${pass} passed · ${fail} failed ====`);
if (fail > 0) {
  process.exit(1);
}
