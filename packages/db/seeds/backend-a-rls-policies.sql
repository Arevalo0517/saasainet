-- Reconstrucción de helpers + RLS policies para backend A (driver directo).
-- Generado a partir de pg_proc + pg_policies de backend B (MCP).
-- Aplica solo a las 9 tablas Fase 1: invitations, mfa_methods, permissions, platforms, role_permissions, roles, sessions, user_roles, users.
-- Las policies de `distributors`/`clients` se aplican vía fase2-distributors-clients.sql.

-- === Helper functions ===
CREATE OR REPLACE FUNCTION public.jwt_claims() RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.jwt_claim_text(key text) RETURNS text LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT coalesce(public.jwt_claims() ->> key, '')
$$;

CREATE OR REPLACE FUNCTION public.jwt_claim_uuid(key text) RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT nullif(public.jwt_claims() ->> key, '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.jwt_claim_bool(key text) RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT coalesce((public.jwt_claims() ->> key)::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT public.jwt_claim_uuid('sub')
$$;

CREATE OR REPLACE FUNCTION public.current_platform_id() RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT public.jwt_claim_uuid('platform_id')
$$;

CREATE OR REPLACE FUNCTION public.current_distributor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT public.jwt_claim_uuid('distributor_id')
$$;

CREATE OR REPLACE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT public.jwt_claim_uuid('client_id')
$$;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
SELECT public.jwt_claim_bool('is_platform_super_admin')
$$;

-- === Habilitar RLS en las 9 tablas Fase 1 ===
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- === Policies recreated from backend B (Fase 1) ===
-- platforms
CREATE POLICY platforms_modify_super_admin ON public.platforms FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY platforms_select ON public.platforms FOR SELECT USING (is_platform_super_admin() OR (id = current_platform_id()));

-- users
CREATE POLICY users_select_platform ON public.users FOR SELECT USING (is_platform_super_admin() OR (platform_id = current_platform_id()));
CREATE POLICY users_insert_admin_only ON public.users FOR INSERT WITH CHECK (is_platform_super_admin());
CREATE POLICY users_modify_self_or_admin ON public.users FOR UPDATE USING (is_platform_super_admin() OR (id = current_user_id())) WITH CHECK (is_platform_super_admin() OR (id = current_user_id()));
CREATE POLICY users_delete_admin_only ON public.users FOR DELETE USING (is_platform_super_admin());

-- roles
CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT USING (is_platform_super_admin() OR (current_platform_id() IS NOT NULL));
CREATE POLICY roles_modify_super_admin ON public.roles FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- permissions
CREATE POLICY permissions_select_authenticated ON public.permissions FOR SELECT USING (is_platform_super_admin() OR (current_platform_id() IS NOT NULL));
CREATE POLICY permissions_modify_super_admin ON public.permissions FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- role_permissions
CREATE POLICY role_permissions_select_authenticated ON public.role_permissions FOR SELECT USING (is_platform_super_admin() OR (current_platform_id() IS NOT NULL));
CREATE POLICY role_permissions_modify_super_admin ON public.role_permissions FOR ALL USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());

-- user_roles
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT USING (
  is_platform_super_admin()
  OR (user_id = current_user_id())
  OR ((platform_id = current_platform_id())
    AND ((current_distributor_id() IS NULL) OR (distributor_id IS NULL) OR (distributor_id = current_distributor_id()))
    AND ((current_client_id() IS NULL) OR (client_id IS NULL) OR (client_id = current_client_id())))
);
CREATE POLICY user_roles_modify_admin ON public.user_roles FOR ALL USING (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (((distributor_id IS NULL) AND (current_distributor_id() IS NULL)) OR (distributor_id = current_distributor_id()))
    AND (((client_id IS NULL) AND (current_client_id() IS NULL)) OR (client_id = current_client_id())))
) WITH CHECK (
  is_platform_super_admin()
  OR ((platform_id = current_platform_id())
    AND (((distributor_id IS NULL) AND (current_distributor_id() IS NULL)) OR (distributor_id = current_distributor_id()))
    AND (((client_id IS NULL) AND (current_client_id() IS NULL)) OR (client_id = current_client_id())))
);

-- invitations
CREATE POLICY invitations_select_admin ON public.invitations FOR SELECT USING (is_platform_super_admin() OR (platform_id = current_platform_id()));
CREATE POLICY invitations_insert_admin ON public.invitations FOR INSERT WITH CHECK (is_platform_super_admin() OR (platform_id = current_platform_id()));
CREATE POLICY invitations_update_admin ON public.invitations FOR UPDATE USING (is_platform_super_admin() OR (platform_id = current_platform_id())) WITH CHECK (is_platform_super_admin() OR (platform_id = current_platform_id()));
CREATE POLICY invitations_delete_admin ON public.invitations FOR DELETE USING (is_platform_super_admin() OR (platform_id = current_platform_id()));

-- sessions
CREATE POLICY sessions_select_own ON public.sessions FOR SELECT USING (is_platform_super_admin() OR (user_id = current_user_id()));
CREATE POLICY sessions_insert_own ON public.sessions FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY sessions_update_own ON public.sessions FOR UPDATE USING (is_platform_super_admin() OR (user_id = current_user_id())) WITH CHECK (is_platform_super_admin() OR (user_id = current_user_id()));
CREATE POLICY sessions_delete_own ON public.sessions FOR DELETE USING (is_platform_super_admin() OR (user_id = current_user_id()));

-- mfa_methods
CREATE POLICY mfa_methods_select_own ON public.mfa_methods FOR SELECT USING (is_platform_super_admin() OR (user_id = current_user_id()));
CREATE POLICY mfa_methods_insert_own ON public.mfa_methods FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY mfa_methods_update_own ON public.mfa_methods FOR UPDATE USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
CREATE POLICY mfa_methods_delete_own ON public.mfa_methods FOR DELETE USING (is_platform_super_admin() OR (user_id = current_user_id()));
