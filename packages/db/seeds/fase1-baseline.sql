-- ============================================================================
-- SEED: Fase 1 baseline (idempotent)
-- ============================================================================
-- Datos semilla reproducibles: 1 fabricante, 2 distribuidores (UUIDs placeholder
-- para Fase 2), 3 clientes (UUIDs placeholder), 16 roles, 25 permisos,
-- 9 usuarios con password 'AcmeTest2026!' (argon2id hash embebido).
--
-- Re-ejecutable: todos los INSERTs usan ON CONFLICT DO NOTHING. Si se desea
-- resetear, ejecutar TRUNCATE en las tablas Fase 1 antes (las políticas CASCADE
-- a role_permissions, user_roles).
--
-- Distribuidores y clientes: solo existen como UUIDs en user_roles.distributor_id
-- y user_roles.client_id. Las tablas `distributors` y `clients` se crearán en
-- Fase 2 con estos mismos UUIDs como PKs.
-- ============================================================================

-- 1. PLATAFORMA (Fabricante) ----------------------------------------------
INSERT INTO public.platforms (id, key, name, legal_name, default_locale, default_currency, white_label_enabled, active)
VALUES (
  'f0000001-0000-4000-8000-000000000001',
  'acme-fabricante',
  'Acme Fabricante',
  'Acme Fabricante de Software S.A. de C.V.',
  'es', 'mxn', false, true
)
ON CONFLICT (id) DO NOTHING;

-- 2. ROLES (16) -----------------------------------------------------------
-- 5 PLATFORM + 5 DISTRIBUTOR + 6 CLIENT
INSERT INTO public.roles (id, key, name, description, scope, is_system) VALUES
  -- PLATFORM (5)
  ('f0000001-0000-4000-b000-000000000001', 'platform_super_admin',    'Platform Super Admin',     'Acceso total a la plataforma',                'PLATFORM',    '1'),
  ('f0000001-0000-4000-b000-000000000002', 'platform_admin',          'Platform Admin',           'Administración diaria de la plataforma',      'PLATFORM',    '1'),
  ('f0000001-0000-4000-b000-000000000003', 'platform_support',        'Platform Support',         'Soporte técnico de la plataforma',            'PLATFORM',    '1'),
  ('f0000001-0000-4000-b000-000000000004', 'platform_billing',        'Platform Billing',         'Facturación y cobros a nivel plataforma',     'PLATFORM',    '1'),
  ('f0000001-0000-4000-b000-000000000005', 'platform_security',       'Platform Security',        'Auditoría y seguridad de la plataforma',      'PLATFORM',    '1'),
  -- DISTRIBUTOR (5)
  ('f0000001-0000-4000-b000-000000000010', 'distributor_owner',       'Distributor Owner',        'Propietario del distribuidor',                'DISTRIBUTOR', '1'),
  ('f0000001-0000-4000-b000-000000000011', 'distributor_admin',       'Distributor Admin',        'Administración del distribuidor',             'DISTRIBUTOR', '1'),
  ('f0000001-0000-4000-b000-000000000012', 'distributor_billing',     'Distributor Billing',      'Facturación del distribuidor',                'DISTRIBUTOR', '1'),
  ('f0000001-0000-4000-b000-000000000013', 'distributor_support',     'Distributor Support',      'Soporte técnico del distribuidor',            'DISTRIBUTOR', '1'),
  ('f0000001-0000-4000-b000-000000000014', 'distributor_sales',       'Distributor Sales',        'Ventas y adquisición de clientes',            'DISTRIBUTOR', '1'),
  -- CLIENT (6)
  ('f0000001-0000-4000-b000-000000000020', 'client_owner',            'Client Owner',             'Propietario de la cuenta cliente',            'CLIENT',      '1'),
  ('f0000001-0000-4000-b000-000000000021', 'client_admin',            'Client Admin',             'Administración del cliente',                  'CLIENT',      '1'),
  ('f0000001-0000-4000-b000-000000000022', 'client_agent_manager',    'Client Agent Manager',     'Gestiona agentes del cliente',                'CLIENT',      '1'),
  ('f0000001-0000-4000-b000-000000000023', 'client_agent_editor',     'Client Agent Editor',      'Edita contenido de agentes',                  'CLIENT',      '1'),
  ('f0000001-0000-4000-b000-000000000024', 'client_viewer',           'Client Viewer',            'Acceso de solo lectura',                      'CLIENT',      '1'),
  ('f0000001-0000-4000-b000-000000000025', 'end_user',                'End User',                 'Usuario final del chat',                      'CLIENT',      '1')
ON CONFLICT (id) DO NOTHING;

-- 3. PERMISSIONS (25) ------------------------------------------------------
INSERT INTO public.permissions (id, key, description) VALUES
  -- platform (1)
  ('f0000001-0000-4000-c000-000000000001', 'platform:read',          'Ver configuración de plataforma'),
  -- distributor (4)
  ('f0000001-0000-4000-c000-000000000010', 'distributor:read',       'Ver distribuidores'),
  ('f0000001-0000-4000-c000-000000000011', 'distributor:create',     'Crear distribuidores'),
  ('f0000001-0000-4000-c000-000000000012', 'distributor:update',     'Editar distribuidores'),
  ('f0000001-0000-4000-c000-000000000013', 'distributor:delete',     'Eliminar distribuidores'),
  -- client (4)
  ('f0000001-0000-4000-c000-000000000020', 'client:read',            'Ver clientes'),
  ('f0000001-0000-4000-c000-000000000021', 'client:create',          'Crear clientes'),
  ('f0000001-0000-4000-c000-000000000022', 'client:update',          'Editar clientes'),
  ('f0000001-0000-4000-c000-000000000023', 'client:delete',          'Eliminar clientes'),
  -- user (4)
  ('f0000001-0000-4000-c000-000000000030', 'user:read',              'Ver usuarios'),
  ('f0000001-0000-4000-c000-000000000031', 'user:invite',            'Invitar usuarios'),
  ('f0000001-0000-4000-c000-000000000032', 'user:update',            'Editar usuarios'),
  ('f0000001-0000-4000-c000-000000000033', 'user:delete',            'Eliminar usuarios'),
  -- role (3)
  ('f0000001-0000-4000-c000-000000000040', 'role:read',              'Ver roles y permisos'),
  ('f0000001-0000-4000-c000-000000000041', 'role:assign',            'Asignar roles a usuarios'),
  ('f0000001-0000-4000-c000-000000000042', 'role:revoke',            'Revocar roles a usuarios'),
  -- agent (4)
  ('f0000001-0000-4000-c000-000000000050', 'agent:read',             'Ver agentes'),
  ('f0000001-0000-4000-c000-000000000051', 'agent:write',            'Crear/editar agentes'),
  ('f0000001-0000-4000-c000-000000000052', 'agent:publish',          'Publicar versiones de agentes'),
  ('f0000001-0000-4000-c000-000000000053', 'agent:delete',           'Eliminar agentes'),
  -- conversation (2)
  ('f0000001-0000-4000-c000-000000000060', 'conversation:read',      'Ver conversaciones'),
  ('f0000001-0000-4000-c000-000000000061', 'conversation:export',    'Exportar conversaciones'),
  -- billing (2)
  ('f0000001-0000-4000-c000-000000000070', 'billing:read',           'Ver facturación'),
  ('f0000001-0000-4000-c000-000000000071', 'billing:write',          'Gestionar facturación'),
  -- audit (1)
  ('f0000001-0000-4000-c000-000000000080', 'audit:read',             'Ver logs de auditoría')
ON CONFLICT (id) DO NOTHING;

-- 4. ROLE_PERMISSIONS -----------------------------------------------------
-- platform_super_admin: TODOS los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'platform_super_admin'
ON CONFLICT DO NOTHING;

-- platform_admin: igual que super_admin (sin platform:delete que no existe)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'platform_admin'
ON CONFLICT DO NOTHING;

-- platform_support: read-only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'platform:read','distributor:read','client:read','user:read','role:read',
  'agent:read','conversation:read','billing:read','audit:read'
)
WHERE r.key = 'platform_support'
ON CONFLICT DO NOTHING;

-- platform_billing
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('platform:read','distributor:read','billing:read','billing:write')
WHERE r.key = 'platform_billing'
ON CONFLICT DO NOTHING;

-- platform_security
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('platform:read','audit:read','user:read')
WHERE r.key = 'platform_security'
ON CONFLICT DO NOTHING;

-- distributor_owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'distributor:read','distributor:create','distributor:update','distributor:delete',
  'client:read','client:create','client:update','client:delete',
  'user:read','user:invite','user:update','user:delete',
  'role:read','role:assign','role:revoke',
  'agent:read','agent:write','agent:publish','agent:delete',
  'billing:read'
)
WHERE r.key = 'distributor_owner'
ON CONFLICT DO NOTHING;

-- distributor_admin (sin distributor:delete, sin agent:delete)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'distributor:read','distributor:update',
  'client:read','client:create','client:update','client:delete',
  'user:read','user:invite','user:update',
  'role:read','role:assign',
  'agent:read','agent:write','agent:publish',
  'billing:read'
)
WHERE r.key = 'distributor_admin'
ON CONFLICT DO NOTHING;

-- distributor_billing
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('distributor:read','client:read','billing:read','billing:write')
WHERE r.key = 'distributor_billing'
ON CONFLICT DO NOTHING;

-- distributor_support
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('distributor:read','client:read','user:read','conversation:read','billing:read')
WHERE r.key = 'distributor_support'
ON CONFLICT DO NOTHING;

-- distributor_sales
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('distributor:read','client:read','client:create','user:read')
WHERE r.key = 'distributor_sales'
ON CONFLICT DO NOTHING;

-- client_owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'client:read','client:create','client:update','client:delete',
  'user:read','user:invite','user:update','user:delete',
  'role:read','role:assign','role:revoke',
  'agent:read','agent:write','agent:publish','agent:delete',
  'conversation:read','conversation:export',
  'billing:read'
)
WHERE r.key = 'client_owner'
ON CONFLICT DO NOTHING;

-- client_admin (sin client:delete, agent:delete)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'client:read','client:update',
  'user:read','user:invite','user:update',
  'role:read',
  'agent:read','agent:write',
  'conversation:read'
)
WHERE r.key = 'client_admin'
ON CONFLICT DO NOTHING;

-- client_agent_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('client:read','user:read','role:read','agent:read','agent:write','agent:publish','conversation:read')
WHERE r.key = 'client_agent_manager'
ON CONFLICT DO NOTHING;

-- client_agent_editor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('client:read','agent:read','agent:write','conversation:read')
WHERE r.key = 'client_agent_editor'
ON CONFLICT DO NOTHING;

-- client_viewer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('client:read','user:read','agent:read','conversation:read','billing:read')
WHERE r.key = 'client_viewer'
ON CONFLICT DO NOTHING;

-- end_user
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('conversation:read')
WHERE r.key = 'end_user'
ON CONFLICT DO NOTHING;

-- 5. USERS (9) ------------------------------------------------------------
-- Password de todos: AcmeTest2026!
-- Hash argon2id precomputado y verificado con argon2.verify(hash, 'AcmeTest2026!')
-- Si se rota el password, regenerar el hash con packages/auth.
-- Hash placeholder para usuarios no críticos (se sobreescribirá en primer login en Fase 1.B).
INSERT INTO public.users (id, platform_id, email, email_normalized, password_hash, full_name, locale, status, email_verified_at, is_platform_super_admin) VALUES
  -- Fabricante: 1 platform_super_admin
  ('f0000001-0000-4000-a000-000000000001', 'f0000001-0000-4000-8000-000000000001',
   'super@acme-fabricante.test', 'super@acme-fabricante.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Acme Super Admin', 'es', 'ACTIVE', now(), true),

  -- Distribuidor A: owner + admin
  ('f0000001-0000-4000-a000-0000000000a1', 'f0000001-0000-4000-8000-000000000001',
   'owner@dist-a.test', 'owner@dist-a.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Dist A Owner', 'es', 'ACTIVE', now(), false),
  ('f0000001-0000-4000-a000-0000000000a2', 'f0000001-0000-4000-8000-000000000001',
   'admin@dist-a.test', 'admin@dist-a.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Dist A Admin', 'es', 'ACTIVE', now(), false),

  -- Distribuidor B: owner + admin
  ('f0000001-0000-4000-a000-0000000000b1', 'f0000001-0000-4000-8000-000000000001',
   'owner@dist-b.test', 'owner@dist-b.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Dist B Owner', 'es', 'ACTIVE', now(), false),
  ('f0000001-0000-4000-a000-0000000000b2', 'f0000001-0000-4000-8000-000000000001',
   'admin@dist-b.test', 'admin@dist-b.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Dist B Admin', 'es', 'ACTIVE', now(), false),

  -- Cliente 1 (bajo Dist A): owner + admin
  ('f0000001-0000-4000-a000-0000000000c1', 'f0000001-0000-4000-8000-000000000001',
   'owner@cliente-1.test', 'owner@cliente-1.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Cliente 1 Owner', 'es', 'ACTIVE', now(), false),
  ('f0000001-0000-4000-a000-0000000000c2', 'f0000001-0000-4000-8000-000000000001',
   'admin@cliente-1.test', 'admin@cliente-1.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Cliente 1 Admin', 'es', 'ACTIVE', now(), false),

  -- Cliente 2 (bajo Dist A): owner
  ('f0000001-0000-4000-a000-0000000000c3', 'f0000001-0000-4000-8000-000000000001',
   'owner@cliente-2.test', 'owner@cliente-2.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Cliente 2 Owner', 'es', 'ACTIVE', now(), false),

  -- Cliente 3 (bajo Dist B): owner
  ('f0000001-0000-4000-a000-0000000000c4', 'f0000001-0000-4000-8000-000000000001',
   'owner@cliente-3.test', 'owner@cliente-3.test',
   '$argon2id$v=19$m=65536,p=4,t=3$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
   'Cliente 3 Owner', 'es', 'ACTIVE', now(), false)
ON CONFLICT (id) DO NOTHING;

-- 6. USER_ROLES -----------------------------------------------------------
-- Asocia cada usuario a su rol con el scope correcto
INSERT INTO public.user_roles (id, user_id, role_id, platform_id, distributor_id, client_id, is_active, granted_at) VALUES
  -- platform_super_admin: solo platform_id
  ('f0000001-0000-4000-d000-000000000001',
   'f0000001-0000-4000-a000-000000000001',
   (SELECT id FROM public.roles WHERE key = 'platform_super_admin'),
   'f0000001-0000-4000-8000-000000000001',
   NULL, NULL, true, now()),

  -- Dist A: owner + admin con distributor_id
  ('f0000001-0000-4000-d000-0000000000a1',
   'f0000001-0000-4000-a000-0000000000a1',
   (SELECT id FROM public.roles WHERE key = 'distributor_owner'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1', NULL, true, now()),
  ('f0000001-0000-4000-d000-0000000000a2',
   'f0000001-0000-4000-a000-0000000000a2',
   (SELECT id FROM public.roles WHERE key = 'distributor_admin'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1', NULL, true, now()),

  -- Dist B: owner + admin
  ('f0000001-0000-4000-d000-0000000000b1',
   'f0000001-0000-4000-a000-0000000000b1',
   (SELECT id FROM public.roles WHERE key = 'distributor_owner'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000b1', NULL, true, now()),
  ('f0000001-0000-4000-d000-0000000000b2',
   'f0000001-0000-4000-a000-0000000000b2',
   (SELECT id FROM public.roles WHERE key = 'distributor_admin'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000b1', NULL, true, now()),

  -- Cliente 1 (bajo Dist A): owner + admin con client_id
  ('f0000001-0000-4000-d000-0000000000c1',
   'f0000001-0000-4000-a000-0000000000c1',
   (SELECT id FROM public.roles WHERE key = 'client_owner'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1',
   'f0000001-0000-4000-8000-0000000000c1', true, now()),
  ('f0000001-0000-4000-d000-0000000000c2',
   'f0000001-0000-4000-a000-0000000000c2',
   (SELECT id FROM public.roles WHERE key = 'client_admin'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1',
   'f0000001-0000-4000-8000-0000000000c1', true, now()),

  -- Cliente 2 (bajo Dist A): owner
  ('f0000001-0000-4000-d000-0000000000c3',
   'f0000001-0000-4000-a000-0000000000c3',
   (SELECT id FROM public.roles WHERE key = 'client_owner'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000a1',
   'f0000001-0000-4000-8000-0000000000c2', true, now()),

  -- Cliente 3 (bajo Dist B): owner
  ('f0000001-0000-4000-d000-0000000000c4',
   'f0000001-0000-4000-a000-0000000000c4',
   (SELECT id FROM public.roles WHERE key = 'client_owner'),
   'f0000001-0000-4000-8000-000000000001',
   'f0000001-0000-4000-8000-0000000000b1',
   'f0000001-0000-4000-8000-0000000000c3', true, now())
ON CONFLICT (id) DO NOTHING;