-- ============================================================================
-- MIGRATION: Fase 2 — Distribuidores, clientes y branding
-- ============================================================================
-- Crea las tablas `distributors` y `clients` con los UUIDs que ya están
-- referenciados en user_roles.distributor_id / user_roles.client_id del seed
-- de Fase 1. Branding (white-label) vive en la propia tabla distributors
-- (logo_url, primary_color, secondary_color, custom_domain).
--
-- Las RLS policies reutilizan los helpers JWT de Fase 1 (current_platform_id,
-- current_distributor_id, current_client_id, is_platform_super_admin).
--
-- Idempotencia: CREATE TABLE IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1. ENUMS --------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distributor_status') THEN
    CREATE TYPE public.distributor_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    CREATE TYPE public.client_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
  END IF;
END $$;

-- 2. DISTRIBUTORS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.distributors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id         uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  key                 varchar(64) NOT NULL,
  name                varchar(200) NOT NULL,
  legal_name          varchar(250) NOT NULL,
  support_email       varchar(254),
  billing_email       varchar(254),
  default_locale      varchar(8) NOT NULL DEFAULT 'es',
  default_currency    varchar(8) NOT NULL DEFAULT 'mxn',
  white_label_enabled boolean NOT NULL DEFAULT false,
  logo_url            varchar(500),
  primary_color       varchar(16),
  secondary_color     varchar(16),
  custom_domain       varchar(253),
  status              public.distributor_status NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS distributors_platform_key_idx
  ON public.distributors(platform_id, key);
CREATE INDEX IF NOT EXISTS distributors_platform_idx
  ON public.distributors(platform_id);
CREATE INDEX IF NOT EXISTS distributors_status_idx
  ON public.distributors(status);
CREATE INDEX IF NOT EXISTS distributors_custom_domain_idx
  ON public.distributors(custom_domain);

-- 3. CLIENTS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id       uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id    uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  key               varchar(64) NOT NULL,
  name              varchar(200) NOT NULL,
  legal_name        varchar(250) NOT NULL,
  support_email     varchar(254),
  billing_email     varchar(254),
  default_locale    varchar(8) NOT NULL DEFAULT 'es',
  default_currency  varchar(8) NOT NULL DEFAULT 'mxn',
  status            public.client_status NOT NULL DEFAULT 'ACTIVE',
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_distributor_key_idx
  ON public.clients(distributor_id, key);
CREATE INDEX IF NOT EXISTS clients_platform_idx
  ON public.clients(platform_id);
CREATE INDEX IF NOT EXISTS clients_distributor_idx
  ON public.clients(distributor_id);
CREATE INDEX IF NOT EXISTS clients_status_idx
  ON public.clients(status);

-- 4. RLS — habilitación -------------------------------------------------
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;

-- 5. RLS — policies DISTRIBUTORS ----------------------------------------
DROP POLICY IF EXISTS distributors_select ON public.distributors;
DROP POLICY IF EXISTS distributors_insert ON public.distributors;
DROP POLICY IF EXISTS distributors_update ON public.distributors;
DROP POLICY IF EXISTS distributors_delete ON public.distributors;

CREATE POLICY distributors_select ON public.distributors
  FOR SELECT
  USING (
    public.is_platform_super_admin()
    OR platform_id = public.current_platform_id()
      AND (
        -- platform_support ve todos los de la plataforma
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = public.current_user_id()
                  AND ur.role_id = (SELECT id FROM public.roles WHERE key = 'platform_support')
                  AND ur.is_active)
        -- distributor users ven solo su distribuidor
        OR id = public.current_distributor_id()
      )
  );

CREATE POLICY distributors_insert ON public.distributors
  FOR INSERT
  WITH CHECK (
    public.is_platform_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = public.current_user_id()
                 AND ur.role_id = (SELECT id FROM public.roles WHERE key = 'platform_admin')
                 AND ur.is_active)
  );

CREATE POLICY distributors_update ON public.distributors
  FOR UPDATE
  USING (
    public.is_platform_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = public.current_user_id()
                 AND ur.role_id IN (SELECT id FROM public.roles WHERE key IN ('platform_admin', 'distributor_admin', 'distributor_owner'))
                 AND ur.is_active)
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = public.current_user_id()
                 AND ur.role_id IN (SELECT id FROM public.roles WHERE key IN ('platform_admin', 'distributor_owner'))
                 AND ur.is_active)
  );

CREATE POLICY distributors_delete ON public.distributors
  FOR DELETE
  USING (
    public.is_platform_super_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = public.current_user_id()
                 AND ur.role_id = (SELECT id FROM public.roles WHERE key = 'platform_admin')
                 AND ur.is_active)
  );

-- 6. RLS — policies CLIENTS --------------------------------------------
DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_insert ON public.clients;
DROP POLICY IF EXISTS clients_update ON public.clients;
DROP POLICY IF EXISTS clients_delete ON public.clients;

CREATE POLICY clients_select ON public.clients
  FOR SELECT
  USING (
    public.is_platform_super_admin()
    OR platform_id = public.current_platform_id()
      AND (
        -- platform_support ve todos
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = public.current_user_id()
                  AND ur.role_id = (SELECT id FROM public.roles WHERE key = 'platform_support')
                  AND ur.is_active)
        -- distributor users ven sus clientes
        OR distributor_id = public.current_distributor_id()
        -- client users ven solo su cliente
        OR id = public.current_client_id()
      )
  );

CREATE POLICY clients_insert ON public.clients
  FOR INSERT
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      platform_id = public.current_platform_id()
      AND distributor_id = public.current_distributor_id()
      AND EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = public.current_user_id()
                    AND ur.role_id IN (SELECT id FROM public.roles WHERE key IN ('distributor_admin', 'distributor_owner'))
                    AND ur.is_active)
    )
  );

CREATE POLICY clients_update ON public.clients
  FOR UPDATE
  USING (
    public.is_platform_super_admin()
    OR distributor_id = public.current_distributor_id()
       AND EXISTS (SELECT 1 FROM public.user_roles ur
                   WHERE ur.user_id = public.current_user_id()
                     AND ur.role_id IN (SELECT id FROM public.roles WHERE key IN ('distributor_admin', 'distributor_owner'))
                     AND ur.is_active)
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      platform_id = public.current_platform_id()
      AND distributor_id = public.current_distributor_id()
    )
  );

CREATE POLICY clients_delete ON public.clients
  FOR DELETE
  USING (
    public.is_platform_super_admin()
    OR distributor_id = public.current_distributor_id()
       AND EXISTS (SELECT 1 FROM public.user_roles ur
                   WHERE ur.user_id = public.current_user_id()
                     AND ur.role_id = (SELECT id FROM public.roles WHERE key = 'distributor_owner')
                     AND ur.is_active)
  );

-- 7. SEED — distribuidores y clientes con los UUIDs ya usados en user_roles ---------
INSERT INTO public.distributors (id, platform_id, key, name, legal_name, support_email, default_locale, default_currency, white_label_enabled, logo_url, primary_color, custom_domain, status)
VALUES
  ('f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-000000000001',
   'dist-a', 'Distribuidor A', 'Distribuidor A S.A. de C.V.', 'ops@dist-a.test',
   'es', 'mxn', true, 'https://cdn.dist-a.test/logo.png', '#0EA5E9', 'app.dist-a.com', 'ACTIVE'),
  ('f0000001-0000-4000-8000-0000000000b1', 'f0000001-0000-4000-8000-000000000001',
   'dist-b', 'Distribuidor B', 'Distribuidor B S.A. de C.V.', 'ops@dist-b.test',
   'es', 'mxn', false, NULL, NULL, NULL, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clients (id, platform_id, distributor_id, key, name, legal_name, support_email, default_locale, default_currency, status)
VALUES
  ('f0000001-0000-4000-8000-0000000000c1', 'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1', 'cliente-1', 'Cliente 1', 'Cliente 1 S.C.', 'contacto@cliente-1.test',
   'es', 'mxn', 'ACTIVE'),
  ('f0000001-0000-4000-8000-0000000000c2', 'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1', 'cliente-2', 'Cliente 2', 'Cliente 2 S.C.', 'contacto@cliente-2.test',
   'es', 'mxn', 'ACTIVE'),
  ('f0000001-0000-4000-8000-0000000000c3', 'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000b1', 'cliente-3', 'Cliente 3', 'Cliente 3 S.C.', 'contacto@cliente-3.test',
   'es', 'mxn', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
