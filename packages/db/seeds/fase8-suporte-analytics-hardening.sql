-- ============================================================================
-- MIGRACIÓN: Fase 8 — Soporte, analítica y hardening
-- ============================================================================
-- Cambios:
--   1. `webhook_endpoints`: añade `secret_ciphertext` (text) — Fase 8a (encryption)
--   2. `channel_connections`: añade `credentials_ciphertext` + `webhook_secret_ciphertext` (text) — Fase 8a
--   3. `clients`: añade `webhook_allowed_hosts` (text[]) — Fase 8b
--   4. `messages`: añade `external_message_id` (text) + `provider_event_id` (text) + UNIQUE(conversation_id, external_message_id) — Fase 8d
--   5. Tabla nueva `audit_events` — Fase 8e
--   6. Tabla nueva `usage_events` — Fase 8f
-- Idempotente (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- ============================================================================

-- 1. webhook_endpoints.secret_ciphertext
ALTER TABLE public.webhook_endpoints
  ADD COLUMN IF NOT EXISTS secret_ciphertext text;

-- 2. channel_connections.credentials_ciphertext + webhook_secret_ciphertext
ALTER TABLE public.channel_connections
  ADD COLUMN IF NOT EXISTS credentials_ciphertext text,
  ADD COLUMN IF NOT EXISTS webhook_secret_ciphertext text;

-- 3. clients.webhook_allowed_hosts
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS webhook_allowed_hosts text[] NOT NULL DEFAULT '{}'::text[];

-- 4. messages.external_message_id + provider_event_id + unique
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS provider_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_external_uq
  ON public.messages (conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_provider_event_idx
  ON public.messages (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- 5. Tabla audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  actor_user_id uuid,
  actor_role varchar(64),
  action varchar(80) NOT NULL,
  resource_type varchar(64) NOT NULL,
  resource_id varchar(64) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address varchar(64),
  user_agent varchar(512),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_client_action_idx
  ON public.audit_events (client_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_resource_idx
  ON public.audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON public.audit_events (actor_user_id, created_at DESC);

-- 6. Tabla usage_events
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  agent_id uuid,
  conversation_id uuid,
  metric varchar(40) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  cost_cents bigint NOT NULL DEFAULT 0,
  model_profile varchar(40),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_client_metric_idx
  ON public.usage_events (client_id, metric, occurred_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_agent_idx
  ON public.usage_events (agent_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_occurred_idx
  ON public.usage_events (occurred_at DESC);
