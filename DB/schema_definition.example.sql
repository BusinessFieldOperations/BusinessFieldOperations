INSERT INTO public.states (name) VALUES
  ('Aragua'),
  ('Carabobo'),
  ('Miranda'),
  ('Distrito Capital'),
  ('Zulia')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.clients (name, rif) VALUES
  ('Alimentos Polar', 'J-00009736-0'),
  ('Nestlé Venezuela', 'J-00013346-4'),
  ('Pepsico Alimentos', 'J-30137013-9')
ON CONFLICT (name) DO NOTHING;

-- Link Alimentos Polar to Aragua and Carabobo
INSERT INTO public.clients_states (client_id, state_id)
SELECT c.id, s.id FROM public.clients c CROSS JOIN public.states s
WHERE c.name = 'Alimentos Polar' AND s.name IN ('Aragua', 'Carabobo')
ON CONFLICT DO NOTHING;

-- Link Nestlé to Miranda and Distrito Capital
INSERT INTO public.clients_states (client_id, state_id)
SELECT c.id, s.id FROM public.clients c CROSS JOIN public.states s
WHERE c.name = 'Nestlé Venezuela' AND s.name IN ('Miranda', 'Distrito Capital')
ON CONFLICT DO NOTHING;

-- Link Pepsico to Aragua and Zulia
INSERT INTO public.clients_states (client_id, state_id)
SELECT c.id, s.id FROM public.clients c CROSS JOIN public.states s
WHERE c.name = 'Pepsico Alimentos' AND s.name IN ('Aragua', 'Zulia')
ON CONFLICT DO NOTHING;


INSERT INTO public.products (name, client_id, units_per_package)
SELECT 'Harina P.A.N. Blanca 1kg', id, 20 FROM public.clients WHERE name = 'Alimentos Polar'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, client_id, units_per_package)
SELECT 'Margarina Mavesa 500g', id, 24 FROM public.clients WHERE name = 'Alimentos Polar'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, client_id, units_per_package)
SELECT 'Cerelac 400g', id, 12 FROM public.clients WHERE name = 'Nestlé Venezuela'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, client_id, units_per_package)
SELECT 'Samba de Chocolate', id, 20 FROM public.clients WHERE name = 'Nestlé Venezuela'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, client_id, units_per_package)
SELECT 'Doritos Queso Atrevido 150g', id, 16 FROM public.clients WHERE name = 'Pepsico Alimentos'
ON CONFLICT (name) DO NOTHING;

-- This will only insert if there is at least ONE user with the 'merchant' role in public.profiles.
INSERT INTO public.merchant_reports (state_id, salesman_name, merchant_id, zone, stablishment, client_id)
SELECT 
    (SELECT id FROM public.states WHERE name = 'Aragua' LIMIT 1),
    'Carlos Perez',
    (SELECT id FROM public.profiles WHERE role = 'merchant' LIMIT 1),
    'Maracay Centro',
    'Supermercado San Diego',
    (SELECT id FROM public.clients WHERE name = 'Alimentos Polar' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.profiles WHERE role = 'merchant');

-- Insert Merchant Report Details (Linked to the report we just created above)
INSERT INTO public.merchant_report_details (report_id, product_id, salesfloor_inventory, stockroom_inventory, total_units)
SELECT 
    (SELECT id FROM public.merchant_reports WHERE salesman_name = 'Carlos Perez' ORDER BY submitted_at DESC LIMIT 1),
    (SELECT id FROM public.products WHERE name = 'Harina P.A.N. Blanca 1kg' LIMIT 1),
    50,   -- salesfloor_inventory
    150,  -- stockroom_inventory
    200   -- total_units (Must equal 50 + 150 because of the check constraint)
WHERE EXISTS (SELECT id FROM public.merchant_reports WHERE salesman_name = 'Carlos Perez');

INSERT INTO public.merchant_report_details (report_id, product_id, salesfloor_inventory, stockroom_inventory, total_units)
SELECT 
    (SELECT id FROM public.merchant_reports WHERE salesman_name = 'Carlos Perez' ORDER BY submitted_at DESC LIMIT 1),
    (SELECT id FROM public.products WHERE name = 'Margarina Mavesa 500g' LIMIT 1),
    20,   -- salesfloor_inventory
    80,   -- stockroom_inventory
    100   -- total_units 
WHERE EXISTS (SELECT id FROM public.merchant_reports WHERE salesman_name = 'Carlos Perez');

-- This will only insert if there is at least ONE user with the 'promoter' role in public.profiles.
INSERT INTO public.promoter_reports (state_id, salesman_name, promoter_id, zone, stablishment, client_id)
SELECT 
    (SELECT id FROM public.states WHERE name = 'Miranda' LIMIT 1),
    'Maria Gomez',
    (SELECT id FROM public.profiles WHERE role = 'promoter' LIMIT 1),
    'Altamira',
    'Gama Express',
    (SELECT id FROM public.clients WHERE name = 'Nestlé Venezuela' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.profiles WHERE role = 'promoter');

-- Insert Promoter Report Details
INSERT INTO public.promoter_report_details (report_id, product_id, initial_inventory, final_inventory, total_sales)
SELECT
    (SELECT id FROM public.promoter_reports WHERE salesman_name = 'Maria Gomez' ORDER BY submitted_at DESC LIMIT 1),
    (SELECT id FROM public.products WHERE name = 'Cerelac 400g' LIMIT 1),
    100,  -- initial_inventory
    75,   -- final_inventory
    25    -- total_sales (Must equal 100 - 75 because of the check constraint)
WHERE EXISTS (SELECT id FROM public.promoter_reports WHERE salesman_name = 'Maria Gomez');

INSERT INTO public.promoter_report_details (report_id, product_id, initial_inventory, final_inventory, total_sales)
SELECT
    (SELECT id FROM public.promoter_reports WHERE salesman_name = 'Maria Gomez' ORDER BY submitted_at DESC LIMIT 1),
    (SELECT id FROM public.products WHERE name = 'Samba de Chocolate' LIMIT 1),
    200,  -- initial_inventory
    110,  -- final_inventory
    90    -- total_sales 
WHERE EXISTS (SELECT id FROM public.promoter_reports WHERE salesman_name = 'Maria Gomez');