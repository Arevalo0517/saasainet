-- ============================================================================
-- MIGRACIÓN: Fase 4 — Agentes, knowledge base, RAG, conversaciones
-- ============================================================================
-- Tablas nuevas: agents, agent_versions, knowledge_bases, documents, chunks,
-- conversations, messages. Enums: agent_state, knowledge_base_status,
-- document_status, conversation_state, message_direction, message_role.
-- Extensión pgvector (ya habilitada en Fase 0). Chunks.embedding vector(1536).
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.agent_state AS ENUM ('DRAFT', 'TESTING', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.knowledge_base_status AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_state AS ENUM (
    'NEW', 'AI_ACTIVE', 'WAITING_CUSTOMER', 'HUMAN_REQUIRED',
    'ASSIGNED', 'FOLLOW_UP', 'RESOLVED', 'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_role AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla: agents
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  key varchar(64) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  default_locale varchar(8) NOT NULL DEFAULT 'es',
  default_timezone varchar(64) NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS agents_platform_idx ON public.agents (platform_id);
CREATE INDEX IF NOT EXISTS agents_client_idx ON public.agents (client_id);
CREATE INDEX IF NOT EXISTS agents_distributor_idx ON public.agents (distributor_id);
CREATE UNIQUE INDEX IF NOT EXISTS agents_client_key_uq ON public.agents (client_id, key);

-- Tabla: agent_versions
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  state public.agent_state NOT NULL DEFAULT 'DRAFT',
  name varchar(120) NOT NULL,
  description text,
  language varchar(8) NOT NULL DEFAULT 'es',
  timezone varchar(64) NOT NULL DEFAULT 'UTC',
  objective text,
  personality text,
  tone varchar(500),
  system_prompt text NOT NULL,
  welcome_message text,
  out_of_hours_message text,
  allowed_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  forbidden_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_to_request jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitive_data_forbidden jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_profile varchar(64) NOT NULL DEFAULT 'openai:gpt-4o-mini',
  model_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_versions_agent_idx ON public.agent_versions (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_versions_agent_version_uq ON public.agent_versions (agent_id, version);

-- Tabla: knowledge_bases
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  name varchar(200) NOT NULL,
  description text,
  embedding_model varchar(64) NOT NULL DEFAULT 'openai:text-embedding-3-small',
  embedding_dimensions integer NOT NULL DEFAULT 1536,
  status public.knowledge_base_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS kb_client_idx ON public.knowledge_bases (client_id);
CREATE INDEX IF NOT EXISTS kb_agent_idx ON public.knowledge_bases (agent_id);

-- Tabla: documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  source_type varchar(32) NOT NULL DEFAULT 'TEXT',
  source_url text,
  mime_type varchar(128),
  size_bytes integer,
  status public.document_status NOT NULL DEFAULT 'PENDING',
  error_message text,
  chunk_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_kb_idx ON public.documents (knowledge_base_id);
CREATE INDEX IF NOT EXISTS documents_client_idx ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents (status);

-- Tabla: chunks (con pgvector embedding)
CREATE TABLE IF NOT EXISTS public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  content text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_document_idx ON public.chunks (document_id);
CREATE INDEX IF NOT EXISTS chunks_kb_idx ON public.chunks (knowledge_base_id);
CREATE INDEX IF NOT EXISTS chunks_client_idx ON public.chunks (client_id);

-- Tabla: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  agent_version_id uuid REFERENCES public.agent_versions(id) ON DELETE SET NULL,
  channel varchar(16) NOT NULL DEFAULT 'WIDGET',
  external_conversation_id varchar(256),
  state public.conversation_state NOT NULL DEFAULT 'NEW',
  customer_display_name varchar(200),
  customer_external_id varchar(256),
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS conversations_client_idx ON public.conversations (client_id);
CREATE INDEX IF NOT EXISTS conversations_agent_idx ON public.conversations (agent_id);
CREATE INDEX IF NOT EXISTS conversations_state_idx ON public.conversations (state);
CREATE INDEX IF NOT EXISTS conversations_last_msg_idx ON public.conversations (last_message_at);

-- Tabla: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  role public.message_role NOT NULL DEFAULT 'USER',
  content text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS messages_client_idx ON public.messages (client_id);
