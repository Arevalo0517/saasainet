-- ============================================================================
-- RLS POLICIES: Fase 6 — Webhooks y n8n
-- ============================================================================
-- Aislamiento por client_id (mismo patrón que agents/conversations):
-- service_role bypassa; usuarios con JWT normal solo ven sus propios rows.
-- ============================================================================

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- webhook_endpoints
DROP POLICY IF EXISTS webhook_endpoints_select ON public.webhook_endpoints;
DROP POLICY IF EXISTS webhook_endpoints_modify ON public.webhook_endpoints;
CREATE POLICY webhook_endpoints_select ON public.webhook_endpoints
  FOR SELECT TO authenticated
  USING (
    client_id::text = coalesce(
      current_setting('request.jwt.claims.client_id', true),
      current_setting('request.jwt.claims.clientid', true)
    )
    OR coalesce(
      current_setting('request.jwt.claims.is_platform_super_admin', true),
      'false'
    )::boolean = true
  );
CREATE POLICY webhook_endpoints_modify ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (
    client_id::text = coalesce(
      current_setting('request.jwt.claims.client_id', true),
      current_setting('request.jwt.claims.clientid', true)
    )
    OR coalesce(
      current_setting('request.jwt.claims.is_platform_super_admin', true),
      'false'
    )::boolean = true
  )
  WITH CHECK (
    client_id::text = coalesce(
      current_setting('request.jwt.claims.client_id', true),
      current_setting('request.jwt.claims.clientid', true)
    )
    OR coalesce(
      current_setting('request.jwt.claims.is_platform_super_admin', true),
      'false'
    )::boolean = true
  );

-- webhook_events
DROP POLICY IF EXISTS webhook_events_select ON public.webhook_events;
DROP POLICY IF EXISTS webhook_events_modify ON public.webhook_events;
CREATE POLICY webhook_events_select ON public.webhook_events
  FOR SELECT TO authenticated
  USING (
    client_id::text = coalesce(
      current_setting('request.jwt.claims.client_id', true),
      current_setting('request.jwt.claims.clientid', true)
    )
    OR coalesce(
      current_setting('request.jwt.claims.is_platform_super_admin', true),
      'false'
    )::boolean = true
  );
CREATE POLICY webhook_events_modify ON public.webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- webhook_deliveries
DROP POLICY IF EXISTS webhook_deliveries_select ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_deliveries_modify ON public.webhook_deliveries;
CREATE POLICY webhook_deliveries_select ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    client_id::text = coalesce(
      current_setting('request.jwt.claims.client_id', true),
      current_setting('request.jwt.claims.clientid', true)
    )
    OR coalesce(
      current_setting('request.jwt.claims.is_platform_super_admin', true),
      'false'
    )::boolean = true
  );
CREATE POLICY webhook_deliveries_modify ON public.webhook_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
