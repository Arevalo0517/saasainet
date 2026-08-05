-- ============================================================================
-- MIGRATION: Fase 3 — Planes, pagos, créditos y comisiones (subset MVP)
-- ============================================================================
-- Crea: plans, plan_versions, subscriptions, payment_customers, payments,
--       commission_entries, payouts.
-- Aplica RLS a las 5 tablas (las primeras 2: plans/plan_versions son públicas
-- para lectura; subscriptions/payments/commissions/payouts filtran por scope).
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS, INSERT ... ON CONFLICT.
-- ============================================================================

-- 1. TABLAS -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id         uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  code                varchar(64) NOT NULL,
  name                varchar(120) NOT NULL,
  description         text,
  is_public           boolean NOT NULL DEFAULT true,
  active              boolean NOT NULL DEFAULT true,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_platform_code_idx ON public.plans (platform_id, code);
CREATE INDEX IF NOT EXISTS plans_platform_idx ON public.plans (platform_id);
CREATE INDEX IF NOT EXISTS plans_active_idx ON public.plans (active);

CREATE TABLE IF NOT EXISTS public.plan_versions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                  uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  version                  integer NOT NULL,
  name                     varchar(120) NOT NULL,
  description              text,
  currency                 varchar(8) NOT NULL DEFAULT 'mxn',
  monthly_price_cents      integer NOT NULL,
  annual_price_cents       integer,
  included_message_credits integer NOT NULL DEFAULT 0,
  overage_unit_price_cents integer NOT NULL DEFAULT 0,
  features                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_versions_plan_version_idx ON public.plan_versions (plan_id, version);
CREATE INDEX IF NOT EXISTS plan_versions_plan_idx ON public.plan_versions (plan_id);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id          uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id       uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id            uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  plan_id              uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  plan_version_id      uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE RESTRICT,
  status               varchar(24) NOT NULL DEFAULT 'PENDING_ACTIVATION',
  billing_interval     varchar(16) NOT NULL DEFAULT 'MONTHLY',
  period_start         timestamptz NOT NULL,
  period_end           timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at         timestamptz,
  activated_at         timestamptz,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_client_idx ON public.subscriptions (client_id);
CREATE INDEX IF NOT EXISTS subscriptions_distributor_idx ON public.subscriptions (distributor_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_client_plan_idx ON public.subscriptions (client_id, status);

CREATE TABLE IF NOT EXISTS public.payment_customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id               uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id            uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id                 uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  provider                  varchar(32) NOT NULL,
  provider_customer_id      varchar(200) NOT NULL,
  default_payment_method_id varchar(200),
  metadata                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_customers_client_idx ON public.payment_customers (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_customers_provider_idx ON public.payment_customers (provider, provider_customer_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id         uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id      uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  payment_customer_id uuid NOT NULL REFERENCES public.payment_customers(id) ON DELETE RESTRICT,
  provider            varchar(32) NOT NULL,
  provider_payment_id varchar(200) NOT NULL,
  kind                varchar(24) NOT NULL DEFAULT 'SUBSCRIPTION',
  amount_cents        integer NOT NULL,
  currency            varchar(8) NOT NULL DEFAULT 'mxn',
  status              varchar(24) NOT NULL DEFAULT 'PENDING',
  description         text,
  idempotency_key     varchar(200),
  paid_at             timestamptz,
  failed_at           timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_client_idx ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_idx ON public.payments (provider, provider_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_idx ON public.payments (idempotency_key);

CREATE TABLE IF NOT EXISTS public.commission_entries (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id             uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id          uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  client_id               uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  payment_id              uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  currency                varchar(8) NOT NULL DEFAULT 'mxn',
  eligible_amount_cents   integer NOT NULL,
  commission_rate         varchar(8) NOT NULL DEFAULT '0.20',
  commission_amount_cents integer NOT NULL,
  status                  varchar(24) NOT NULL DEFAULT 'PENDING_AVAILABLE',
  available_at            timestamptz,
  paid_at                 timestamptz,
  payout_id               uuid,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commission_entries_distributor_idx ON public.commission_entries (distributor_id);
CREATE INDEX IF NOT EXISTS commission_entries_status_idx ON public.commission_entries (status);
CREATE UNIQUE INDEX IF NOT EXISTS commission_entries_payment_idx ON public.commission_entries (payment_id);
CREATE INDEX IF NOT EXISTS commission_entries_distributor_status_idx ON public.commission_entries (distributor_id, status);

CREATE TABLE IF NOT EXISTS public.payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id         uuid NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  distributor_id      uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  currency            varchar(8) NOT NULL DEFAULT 'mxn',
  total_amount_cents  integer NOT NULL DEFAULT 0,
  status              varchar(24) NOT NULL DEFAULT 'PENDING',
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  paid_at             timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payouts_distributor_idx ON public.payouts (distributor_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payouts (status);
CREATE UNIQUE INDEX IF NOT EXISTS payouts_distributor_period_idx ON public.payouts (distributor_id, period_start, period_end);

-- 2. RLS ----------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- plans: público para lectura, super_admin para escritura
DROP POLICY IF EXISTS plans_select_public ON public.plans;
CREATE POLICY plans_select_public ON public.plans FOR SELECT USING (is_public = true AND active = true);

DROP POLICY IF EXISTS plans_select_authenticated ON public.plans;
CREATE POLICY plans_select_authenticated ON public.plans FOR SELECT USING (
  is_platform_super_admin()
  OR (platform_id = current_platform_id())
);

DROP POLICY IF EXISTS plans_modify_super_admin ON public.plans;
CREATE POLICY plans_modify_super_admin ON public.plans FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- plan_versions: público para lectura (de plans public+active), super_admin para escritura
DROP POLICY IF EXISTS plan_versions_select_public ON public.plan_versions;
CREATE POLICY plan_versions_select_public ON public.plan_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.is_public = true AND p.active = true)
);

DROP POLICY IF EXISTS plan_versions_select_authenticated ON public.plan_versions;
CREATE POLICY plan_versions_select_authenticated ON public.plan_versions FOR SELECT USING (
  is_platform_super_admin()
  OR EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.platform_id = current_platform_id())
);

DROP POLICY IF EXISTS plan_versions_modify_super_admin ON public.plan_versions;
CREATE POLICY plan_versions_modify_super_admin ON public.plan_versions FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- subscriptions: scope por distributor/client o super_admin
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id = (SELECT id FROM roles WHERE key = 'platform_support') AND ur.is_active))
      OR (distributor_id = current_distributor_id())
      OR (client_id = current_client_id())))
);

DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
CREATE POLICY subscriptions_insert ON public.subscriptions FOR INSERT WITH CHECK (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (distributor_id = current_distributor_id())
    AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id IN (SELECT id FROM roles WHERE key = ANY(ARRAY['distributor_admin','distributor_owner'])) AND ur.is_active)))
);

DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
CREATE POLICY subscriptions_update ON public.subscriptions FOR UPDATE USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (distributor_id = current_distributor_id())
    AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id IN (SELECT id FROM roles WHERE key = ANY(ARRAY['distributor_admin','distributor_owner'])) AND ur.is_active)))
) WITH CHECK (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id()) AND (distributor_id = current_distributor_id()))
);

-- payment_customers: solo super_admin o distributor_owner
DROP POLICY IF EXISTS payment_customers_select ON public.payment_customers;
CREATE POLICY payment_customers_select ON public.payment_customers FOR SELECT USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id = (SELECT id FROM roles WHERE key = 'platform_support') AND ur.is_active))
      OR (distributor_id = current_distributor_id())
      OR (client_id = current_client_id())))
);

DROP POLICY IF EXISTS payment_customers_modify ON public.payment_customers;
CREATE POLICY payment_customers_modify ON public.payment_customers FOR ALL USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (distributor_id = current_distributor_id())
    AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id IN (SELECT id FROM roles WHERE key = ANY(ARRAY['distributor_admin','distributor_owner'])) AND ur.is_active)))
) WITH CHECK (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id()) AND (distributor_id = current_distributor_id()))
);

-- payments: scope por distributor/client
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id = (SELECT id FROM roles WHERE key = 'platform_support') AND ur.is_active))
      OR (distributor_id = current_distributor_id())
      OR (client_id = current_client_id())))
);

DROP POLICY IF EXISTS payments_modify ON public.payments;
CREATE POLICY payments_modify ON public.payments FOR ALL USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (distributor_id = current_distributor_id())
    AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id IN (SELECT id FROM roles WHERE key = ANY(ARRAY['distributor_admin','distributor_owner'])) AND ur.is_active)))
) WITH CHECK (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id()) AND (distributor_id = current_distributor_id()))
);

-- commission_entries: solo distributor_owner/admin ve las suyas, super_admin todas
DROP POLICY IF EXISTS commission_entries_select ON public.commission_entries;
CREATE POLICY commission_entries_select ON public.commission_entries FOR SELECT USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id = (SELECT id FROM roles WHERE key = 'platform_finance') AND ur.is_active))
      OR (distributor_id = current_distributor_id())))
);

DROP POLICY IF EXISTS commission_entries_modify ON public.commission_entries;
CREATE POLICY commission_entries_modify ON public.commission_entries FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- payouts: distributor_owner ve las suyas, super_admin todas
DROP POLICY IF EXISTS payouts_select ON public.payouts;
CREATE POLICY payouts_select ON public.payouts FOR SELECT USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = current_user_id() AND ur.role_id = (SELECT id FROM roles WHERE key = 'platform_finance') AND ur.is_active))
      OR (distributor_id = current_distributor_id())))
);

DROP POLICY IF EXISTS payouts_modify ON public.payouts;
CREATE POLICY payouts_modify ON public.payouts FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
