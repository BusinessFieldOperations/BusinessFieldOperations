-- =====================================================================
-- SEED DATA (Catalogs, Brands, Clients, Products)
-- Idempotent: Safe to run on a fresh or existing database.
-- =====================================================================

-- 1. BRANDS
INSERT INTO public.brands (name) VALUES 
  ('Polar'),
  ('Kraft'),
  ('Nestlé'),
  ('Procter & Gamble'),
  ('Coca-Cola'),
  ('PepsiCo')
ON CONFLICT (name) DO NOTHING;


-- 2. CATEGORIES
INSERT INTO public.categories (name) VALUES 
  ('Alimentos'),
  ('Bebidas'),
  ('Limpieza'),
  ('Cuidado Personal'),
  ('Golosinas')
ON CONFLICT (name) DO NOTHING;


-- 3. STATES
INSERT INTO public.states (name) VALUES 
  ('Aragua'),
  ('Carabobo'),
  ('Distrito Capital'),
  ('Miranda'),
  ('Zulia')
ON CONFLICT (name) DO NOTHING;


-- 4. CLIENTS
-- We use hardcoded UUIDs so we can reliably link products and states to them later
INSERT INTO public.clients (id, name, rif) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Supermercados Forum', 'J-12345678-9'),
  ('22222222-2222-2222-2222-222222222222', 'Automercados Plaza''s', 'J-98765432-1'),
  ('33333333-3333-3333-3333-333333333333', 'Red Vital', 'J-45678901-2'),
  ('44444444-4444-4444-4444-444444444444', 'Distribuidora Central', 'J-33333333-3')
ON CONFLICT (name) DO NOTHING;


-- 5. CLIENTS <-> STATES RELATIONSHIP
-- Because states use an auto-incrementing INTEGER ID, we look up the ID by name
INSERT INTO public.clients_states (client_id, state_id)
SELECT c.id, s.id
FROM public.clients c, public.states s
WHERE 
  -- Forum is in Aragua and Carabobo
  (c.name = 'Supermercados Forum' AND s.name IN ('Aragua', 'Carabobo'))
  OR 
  -- Plaza's is in Caracas and Miranda
  (c.name = 'Automercados Plaza''s' AND s.name IN ('Distrito Capital', 'Miranda'))
  OR 
  -- Red Vital is everywhere
  (c.name = 'Red Vital' AND s.name IN ('Aragua', 'Carabobo', 'Distrito Capital', 'Miranda', 'Zulia'))
  OR 
  -- Distribuidora Central is only in Aragua
  (c.name = 'Distribuidora Central' AND s.name IN ('Aragua'))
ON CONFLICT DO NOTHING;


-- 6. PRODUCTS
-- Hardcoded UUIDs since `id` is now a UUID. 
-- Using the exact brand/category names created above, and assigning them to our client UUIDs.
INSERT INTO public.products (
  id, 
  name, 
  client_id, 
  units_per_package, 
  brand, 
  category, 
  display_quantity, 
  sku
) VALUES
(
  'aaaa0000-aaaa-0000-aaaa-000000000001',
  'Harina Precocida P.A.N. Blanca',
  '11111111-1111-1111-1111-111111111111', -- Forum
  20, 
  'Polar', 
  'Alimentos', 
  '1 kg', 
  'POL-PAN-001'
),
(
  'aaaa0000-aaaa-0000-aaaa-000000000002',
  'Mayonesa Kraft',
  '11111111-1111-1111-1111-111111111111', -- Forum
  12, 
  'Kraft', 
  'Alimentos', 
  '500 g', 
  'KRF-MAY-500'
),
(
  'aaaa0000-aaaa-0000-aaaa-000000000003',
  'Nestea Durazno',
  '22222222-2222-2222-2222-222222222222', -- Plaza's
  24, 
  'Nestlé', 
  'Bebidas', 
  '450 g', 
  'NST-DUR-450'
),
(
  'aaaa0000-aaaa-0000-aaaa-000000000004',
  'Detergente en Polvo Ariel',
  '33333333-3333-3333-3333-333333333333', -- Red Vital
  10, 
  'Procter & Gamble', 
  'Limpieza', 
  '1.2 kg', 
  'PG-ARI-1200'
),
(
  'aaaa0000-aaaa-0000-aaaa-000000000005',
  'Margarina Mavesa',
  '44444444-4444-4444-4444-444444444444', -- Distribuidora Central
  24, 
  'Polar', 
  'Alimentos', 
  '500 g', 
  'POL-MAV-500'
),
(
  'aaaa0000-aaaa-0000-aaaa-000000000006',
  'Gatorade Frutas Tropicales',
  '11111111-1111-1111-1111-111111111111', -- Forum
  12, 
  'PepsiCo', 
  'Bebidas', 
  '500 ml', 
  'PEP-GAT-500'
)
ON CONFLICT (name) DO NOTHING;