-- ============================================================================
-- MIGRACIÓN: Fase 6 — Webhooks y n8n (endpoints, events, deliveries)
-- ============================================================================
-- 3 tablas + 2 enums. Sin extension (solo DDL base). RLS se aplica en script
-- aparte. Idempotente (CREATE ... IF NOT EXISTS / DO ... EXCEPTION).
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.webhook_endpoint_status AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.webhook_delivery_status AS ENUM ('PENDING', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'DLQ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla: webhook_endpoints
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  name varchar(120) NOT NULL,
  url varchar(2048) NOT NULL,
  secret varchar(64) NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.webhook_endpoint_status NOT NULL DEFAULT 'ACTIVE',
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_client_idx ON public.webhook_endpoints (client_id);
CREATE INDEX IF NOT EXISTS webhook_endpoints_status_idx ON public.webhook_endpoints (client_id, status);
CREATE INDEX IF NOT EXISTS webhook_endpoints_secret_idx ON public.webhook_endpoints (secret);

-- Tabla: webhook_events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  type varchar(80) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_events_client_type_idx ON public.webhook_events (client_id, type, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_idem_uq ON public.webhook_events (client_id, idempotency_key);

-- Tabla: webhook_deliveries
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
  status public.webhook_delivery_status NOT NULL DEFAULT 'PENDING',
  attempt_count text NOT NULL DEFAULT '0',
  max_attempts text NOT NULL DEFAULT '6',
  last_status_code text,
  last_error text,
  request_body text NOT NULL,
  request_signature varchar(128) NOT NULL,
  response_body text,
  next_retry_at timestamptz,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON public.webhook_deliveries (endpoint_id, created_at);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx ON public.webhook_deliveries (event_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx ON public.webhook_deliveries (status, next_retry_at);

-- Seed: 1 endpoint de demo
INSERT INTO public.webhook_endpoints (
  id, platform_id, distributor_id, client_id, name, url, secret, events, status, description
) VALUES (
  'a0000006-0000-4000-8000-000000000001',
  'f0000001-0000-4000-8000-000000000001',
  'f0000001-0000-4000-8000-0000000000a1',
  'f0000001-0000-4000-8000-0000000000c1',
  'n8n demo (placeholder)',
  'https://example.invalid/n8n/webhook/a1b2c3',
  'whsec_demo_secret_aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '["agent.published","conversation.started","conversation.closed","human.reply.created"]'::jsonb,
  'PAUSED',
  'Endpoint de demo. Reemplaza URL y rota el secret antes de activar.'
) ON CONFLICT (id) DO NOTHING;
