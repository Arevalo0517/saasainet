-- ============================================================================
-- SEED: Fase 3 — 2 planes de catálogo para plataforma acme-fabricante
-- ============================================================================
-- Idempotente: usa ON CONFLICT (id) DO NOTHING.

-- Plans
INSERT INTO public.plans (id, platform_id, code, name, description, is_public, active, metadata)
VALUES
  ('a0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-000000000001', 'starter', 'Starter', 'Plan inicial para clientes pequeños', true, true, '{"target":"smb"}'::jsonb),
  ('a0000001-0000-4000-8000-000000000002', 'f0000001-0000-4000-8000-000000000001', 'pro', 'Pro', 'Plan profesional con funciones avanzadas', true, true, '{"target":"midmarket"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Plan versions (v1 cada uno)
INSERT INTO public.plan_versions (id, plan_id, version, name, description, currency, monthly_price_cents, annual_price_cents, included_message_credits, overage_unit_price_cents, features, active)
VALUES
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 1, 'Starter v1', 'Plan Starter versión 1', 'mxn', 9900, 99000, 1000, 50, '["widget","whatsapp","kb_100"]'::jsonb, true),
  ('b0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000002', 1, 'Pro v1', 'Plan Pro versión 1', 'mxn', 49900, 499000, 10000, 20, '["widget","whatsapp","kb_unlimited","whitelabel","priority_support"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Subscription de prueba para CLIENT_A1 (con plan Starter)
INSERT INTO public.subscriptions (id, platform_id, distributor_id, client_id, plan_id, plan_version_id, status, billing_interval, period_start, period_end, activated_at, metadata)
VALUES
  ('c0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'ACTIVE', 'MONTHLY', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z', '{"seed":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
