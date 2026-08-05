-- Fase 6 (channels) — backend A migration (channel_connections + message_deliveries)
-- Crea los enums y tablas que faltaban tras aplicar sólo fase6-webhooks.sql.

DO $$ BEGIN
  CREATE TYPE channel_connection_state AS ENUM (
    'NOT_CONFIGURED','PENDING','CONNECTED','DEGRADED','DISCONNECTED','ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_delivery_status AS ENUM (
    'QUEUED','SENT','DELIVERED','READ','FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  channel varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  status channel_connection_state NOT NULL DEFAULT 'NOT_CONFIGURED',
  credentials_ciphertext text NOT NULL DEFAULT '',
  phone_number varchar(32),
  webhook_secret_ciphertext text NOT NULL,
  last_verified_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS channel_connections_client_channel_idx
  ON public.channel_connections (client_id, channel);
CREATE INDEX IF NOT EXISTS channel_connections_status_idx
  ON public.channel_connections (client_id, status);

CREATE TABLE IF NOT EXISTS public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel varchar(32) NOT NULL,
  channel_connection_id uuid REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  provider_message_id varchar(128),
  status message_delivery_status NOT NULL DEFAULT 'QUEUED',
  error_code varchar(64),
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_message_uq
  ON public.message_deliveries (message_id);
CREATE INDEX IF NOT EXISTS message_deliveries_conversation_idx
  ON public.message_deliveries (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS message_deliveries_status_idx
  ON public.message_deliveries (status, attempted_at);
CREATE INDEX IF NOT EXISTS message_deliveries_provider_idx
  ON public.message_deliveries (channel_connection_id, provider_message_id);
