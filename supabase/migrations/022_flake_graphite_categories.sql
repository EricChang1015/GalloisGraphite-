-- =====================================================================
-- Restructure product categories
--
-- Goals
--   * Drop the "MADA1 / MADA2" brand/mine-region naming. The mining
--     region is an internal concept; product categories should be
--     specified by physical product attributes only.
--   * Keep Flake Graphite as the only currently active product type,
--     but model spec_schema as a structured JSON so future product
--     types (spherical graphite, expandable graphite, etc.) plug in
--     the same way.
--   * One category per mesh size + a single "Custom Grade" entry.
--
-- New spec_schema shape (jsonb):
--   {
--     "product_type":           "flake_graphite",   -- enum string
--     "mesh_size":              "+100",              -- one of +35/+50/+80/+100/+150/-100, null for custom
--     "fixed_carbon_min":       75,                  -- percent
--     "fixed_carbon_max":       99,                  -- percent
--     "moisture_max":           0.5,                 -- percent
--     "size_distribution_min_pct": 80,               -- "80% MIN of particles match the mesh"
--     "is_custom":              false                -- if true, seller overrides everything
--   }
--
-- Safe to re-run: every update is gated on a name match; new rows use
-- ON CONFLICT DO NOTHING against the unique name index.
-- =====================================================================

-- ---------- Rename + restructure the 6 MADA1 mesh entries ------------
update public.product_categories
   set name        = 'Flake Graphite +35 Mesh',
       description = 'Natural flake graphite, +35 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +35 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '+35',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — +35 Mesh';

update public.product_categories
   set name        = 'Flake Graphite +50 Mesh',
       description = 'Natural flake graphite, +50 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +50 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '+50',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — +50 Mesh';

update public.product_categories
   set name        = 'Flake Graphite +80 Mesh',
       description = 'Natural flake graphite, +80 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +80 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '+80',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — +80 Mesh';

update public.product_categories
   set name        = 'Flake Graphite +100 Mesh',
       description = 'Natural flake graphite, +100 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +100 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '+100',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — +100 Mesh';

update public.product_categories
   set name        = 'Flake Graphite +150 Mesh',
       description = 'Natural flake graphite, +150 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +150 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '+150',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — +150 Mesh';

update public.product_categories
   set name        = 'Flake Graphite -100 Mesh',
       description = 'Natural flake graphite, -100 mesh (fine) standard grade. Fixed carbon 75–99%, ≥80% of particles passing through 100 mesh, moisture 0.5% max.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 '-100',
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 false
       ),
       is_active   = true
 where name = 'MADA1 — -100 Mesh';

-- ---------- Update Custom Grade to the structured spec ---------------
update public.product_categories
   set description = 'Custom flake graphite specification. Seller defines mesh size, fixed carbon range, moisture, and size distribution per buyer requirement.',
       spec_schema = jsonb_build_object(
         'product_type',              'flake_graphite',
         'mesh_size',                 null,
         'fixed_carbon_min',          75,
         'fixed_carbon_max',          99,
         'moisture_max',              0.5,
         'size_distribution_min_pct', 80,
         'is_custom',                 true
       ),
       is_active   = true
 where name = 'Custom Grade';

-- ---------- Make sure all 7 standard rows exist ----------------------
-- (Idempotent insert in case any of the above updates matched zero rows.)
insert into public.product_categories (name, description, spec_schema, is_active)
values
  ('Flake Graphite +35 Mesh',
   'Natural flake graphite, +35 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +35 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','+35','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Flake Graphite +50 Mesh',
   'Natural flake graphite, +50 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +50 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','+50','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Flake Graphite +80 Mesh',
   'Natural flake graphite, +80 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +80 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','+80','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Flake Graphite +100 Mesh',
   'Natural flake graphite, +100 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +100 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','+100','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Flake Graphite +150 Mesh',
   'Natural flake graphite, +150 mesh standard grade. Fixed carbon 75–99%, ≥80% of particles retained on +150 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','+150','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Flake Graphite -100 Mesh',
   'Natural flake graphite, -100 mesh (fine) standard grade. Fixed carbon 75–99%, ≥80% of particles passing through 100 mesh, moisture 0.5% max.',
   jsonb_build_object('product_type','flake_graphite','mesh_size','-100','fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',false),
   true),
  ('Custom Grade',
   'Custom flake graphite specification. Seller defines mesh size, fixed carbon range, moisture, and size distribution per buyer requirement.',
   jsonb_build_object('product_type','flake_graphite','mesh_size',null,'fixed_carbon_min',75,'fixed_carbon_max',99,'moisture_max',0.5,'size_distribution_min_pct',80,'is_custom',true),
   true)
on conflict (name) do nothing;

-- ---------- Deactivate the legacy MADA brand / region entries --------
update public.product_categories
   set is_active = false
 where name in (
   'MADA1 Flake Graphite',
   'MADA2 Flake Graphite',
   'MADA1 — +35 Mesh',
   'MADA1 — +50 Mesh',
   'MADA1 — +80 Mesh',
   'MADA1 — +100 Mesh',
   'MADA1 — +150 Mesh',
   'MADA1 — -100 Mesh',
   'MADA2 — +35 Mesh',
   'MADA2 — +50 Mesh',
   'MADA2 — +80 Mesh',
   'MADA2 — +100 Mesh',
   'MADA2 — +150 Mesh',
   'MADA2 — -100 Mesh',
   'MADA123 — +80 Mesh'
 )
   -- only if they didn't already get renamed by the updates above
   and id not in (
     select id from public.product_categories
      where name like 'Flake Graphite %'
   );
