-- =====================================================================
-- Mada Graphite — Seed product categories from Etablissements Gallois
-- standard grade list.
-- Safe to re-run: uses ON CONFLICT DO NOTHING on name.
-- =====================================================================

-- Temporary unique constraint helper (if needed)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_categories_name_key'
  ) then
    alter table public.product_categories add constraint product_categories_name_key unique (name);
  end if;
end $$;

insert into public.product_categories (name, description, spec_schema, is_active)
values
  (
    'MADA1 — +35 Mesh',
    'MADA1 brand, +35 mesh grade. Fixed carbon 75–99%, +35MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)", "placeholder": "e.g. 94–96"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",         "placeholder": "+35MESH"},
      "moisture":     {"type": "string", "label": "Moisture",          "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",             "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA1 — +50 Mesh',
    'MADA1 brand, +50 mesh grade. Fixed carbon 75–99%, +50MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+50MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA1 — +80 Mesh',
    'MADA1 brand, +80 mesh grade. Fixed carbon 75–99%, +80MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+80MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA1 — +100 Mesh',
    'MADA1 brand, +100 mesh grade. Fixed carbon 75–99%, +100MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+100MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA1 — +150 Mesh',
    'MADA1 brand, +150 mesh grade. Fixed carbon 75–99%, +150MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+150MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA1 — -100 Mesh',
    'MADA1 brand, -100 mesh (fine) grade. Fixed carbon 75–99%, -100MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "-100MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA1"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — +35 Mesh',
    'MADA2 brand (industrial grade), +35 mesh. Fixed carbon 75–99%, +35MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+35MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — +50 Mesh',
    'MADA2 brand (industrial grade), +50 mesh. Fixed carbon 75–99%, +50MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+50MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — +80 Mesh',
    'MADA2 brand (industrial grade), +80 mesh. Fixed carbon 75–99%, +80MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+80MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — +100 Mesh',
    'MADA2 brand (industrial grade), +100 mesh. Fixed carbon 75–99%, +100MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+100MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — +150 Mesh',
    'MADA2 brand (industrial grade), +150 mesh. Fixed carbon 75–99%, +150MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "+150MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'MADA2 — -100 Mesh',
    'MADA2 brand (industrial grade), -100 mesh (fine). Fixed carbon 75–99%, -100MESH 80% MIN, moisture 0.5% MAX.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",    "placeholder": "-100MESH"},
      "moisture":     {"type": "string", "label": "Moisture",     "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",        "placeholder": "MADA2"}
    }'::jsonb,
    true
  ),
  (
    'Custom Grade',
    'Custom specification: carbon content 80–99%, any mesh size. Contact sales for exact spec.',
    '{
      "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)", "placeholder": "e.g. 95"},
      "mesh_size":    {"type": "string", "label": "Mesh Size",         "placeholder": "e.g. +80MESH"},
      "moisture":     {"type": "string", "label": "Moisture",          "placeholder": "0.5% MAX"},
      "brand":        {"type": "string", "label": "Brand",             "placeholder": "MADA1 or MADA2"},
      "other_specs":  {"type": "text",   "label": "Additional Specs"}
    }'::jsonb,
    true
  )
on conflict (name) do nothing;
