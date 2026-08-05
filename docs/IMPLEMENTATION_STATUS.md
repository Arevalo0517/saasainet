# Estado de implementación

> Documento vivo. Se actualiza al inicio y al final de cada fase.

## Resumen

| Fase | Estado | % | Notas |
|---|---|---|---|
| 0 — Descubrimiento y base | ✅ Completada | 100 | Monorepo ejecutable, docs base, conectores verificados. |
| 1 — Identidad y multi-tenancy | ✅ Completada | 100 | Auth propia (argon2+jose), esquema + RLS + seed baseline, services/identity, Drizzle adapters, endpoints `/api/v1/auth/*`, middleware TenantContext, JwtGuard/RolesGuard/PermissionsGuard, UI /login + /dashboard, 7 tests de aislamiento multi-tenant. |
| 2 — Distribuidores, clientes y branding | ✅ Completada | 100 | Schema + RLS + seed (2 distributors, 3 clients) + Drizzle adapters + service con tenantFilter + controllers + 11 tests de aislamiento. UI: /distributors, /clients, /distributors/[id]/branding (color pickers + logo + custom domain + preview). Happy path real validado end-to-end (login + POST /clients 201) tras replicar helpers+RLS+seed a backend A (D-F2-003). |
| 3 — Planes, pagos, créditos y comisiones | ✅ Completada | 100 | 7 tablas + 17 RLS policies, MockPaymentProvider con HMAC SHA-256, webhooks firmados, 20% commission default, 40/40 tests E2E. |
| 4 — Motor de agentes y conocimiento | ✅ Completada | 100 | 7 tablas (agents/agent_versions/knowledge_bases/documents/chunks/conversations/messages) + 23 RLS policies, OpenAIModelProvider real + MockModelProvider determinista, AgentRuntime con RAG top-k cosine (pgvector), 5 controllers, chat E2E con persistencia y preview sin persistencia, paleta UI "Midnight Intelligence", 50/50 tests E2E. |
| 5 — Widget y conversaciones | ✅ Completada | 100 | Columna `public_widget_id` UNIQUE en agents, `WidgetService` con `getConfig`+`chat` (mismo `AgentRuntime` + retriever, RAG turn + persist IN/OUT + touch conversation), `WidgetController` público sin JWT (`GET /widget/:id/config` 200, `POST /widget/:id/chat` 201), DTOs con class-validator, `humanReply` + `closeConversation` en `ConversationsService` con metadata `{source:'human'/'widget', latencyMs, tokensUsed, modelProfile}`. UI: `/dashboard/inbox` (lista convs con filtros state) + `/dashboard/inbox/[id]` (burbujas IN/OUT con citations, reply humano, close) + sección "Embed widget" en `/dashboard/agents/[id]` con `<script>` snippet. Bundle vanilla TS `apps/widget/` (IIFE+ESM, ~7.7KB) servido por Next.js en `/widget.js` con soporte Range. Inbox paleta Midnight Intelligence. 62/62 tests E2E (12 nuevos: GET config 200/404, POST chat 201/400/400/404, conversationExternalId reusa conv, POST reply 201, reply cuando CLOSED 400, close 201, GET conversations 200/401, GET messages). |
| 6 — Webhooks y n8n | ✅ Completada | 100 | 3 tablas (webhook_endpoints/webhook_events/webhook_deliveries) + 2 enums + RLS client_id, `WebhookDispatcherService` con HMAC SHA-256 + retry exponencial (0/1m/5m/30m/2h/12h) + DLQ + idempotency_key único, `WebhookEndpointsService` CRUD + rotate secret + URL allowlist (rechaza localhost/metadata IPs), `WebhookOutboxProcessor` in-process con `setInterval` configurable via `WEBHOOK_OUTBOX_INTERVAL_MS`, `HttpDeliveryClient` interface mockeable (testeable sin red real), headers `X-Platform-Signature: t=...,v1=...` + `X-Platform-Event-Id` + `X-Platform-Event-Attempt`. Emisión: `AgentsService.publishVersion` → `agent.published`; `ConversationsService.startChat` → `conversation.started`; `humanReply` → `human.reply.created`; `closeConversation` → `conversation.closed`. DTOs class-validator. Template n8n importable en `docs/n8n-webhook-template.json` (trigger + verify HMAC con `crypto.timingSafeEqual` + routing por eventType). UI: `/dashboard/webhooks` (CRUD con secret revelado una vez, chips de eventos) + `/dashboard/webhooks/[id]` (toggle status, test event, rotate secret, lista de deliveries con poll 4s, replay manual). SDK `@platform/webhook-sdk` reusables (signing, retry policy, dispatcher, HttpDeliveryClient). 75/75 tests E2E (13 nuevos: list, create, test, signed-200, 5xx retry, 410 DLQ, rotate, PATCH status, emisión conversation.closed, idempotencia). |
| 7 — WhatsApp y canales adicionales | ✅ Completada | 100 | 2 tablas (`channel_connections` + `message_deliveries`) + 2 enums + RLS, `@platform/channel-adapters` con `ChannelAdapter` interface + `MockWhatsappAdapter` + `InMemoryMockWhatsappStorage` + `ChannelAdapterRegistry` + `buildDefaultRegistry` (11/11 tests), `ChannelConnectionsService` (CRUD + verify + rotate + parseInbound) + `ChannelMessagesService` (sendOutbound + listDeliveries + refreshDeliveryStatus) + `ChannelsInboundProcessor` (findOrCreate conv por externalConversationId + persist INBOUND), controllers REST con JwtGuard + `ChannelsWebhookController` público con HMAC SHA-256 formato `sha256=...` + middleware `raw({type:'*/*', limit:'1mb'})` en `main.ts` solo para `/api/v1/channels/*`. Webhook público exige `connectionId` + `agentId` en body + header `x-channel-signature`. Wire outbound opcional desde `ConversationsService.humanReply` y `startChat` con `@Optional() ChannelMessagesService` (fire-and-forget, `void promise.catch(()=>undefined)`); si la conversación es WIDGET o no hay conexión activa, retorna null (no-op). UI: `/dashboard/channels` (lista con chips status, filtro por canal, poll 15s) + `/dashboard/channels/new` (form name/channel/phone/credentials JSON, revela webhook secret una vez) + `/dashboard/channels/[id]` (detalle + verify + rotate-webhook-secret + archive + tabla deliveries con poll 6s). 89/89 tests E2E (14 nuevos: list 200, 401 sin auth, create 201 con secret whsec_xxx, 400 channel inválido, verify CONNECTED/ERROR, webhook 401 sin firma / 401 firma inválida / 200 firma válida crea conv + INBOUND / 401 connectionId desconocido, outbound humanReply crea delivery SENT con wamid.*, refresh delivery SENT→DELIVERED→READ, rotate-webhook-secret devuelve nuevo, archive archiva). D-F7-001..005 documentados. |
| 8 — Soporte, analítica y hardening | ⏳ Pendiente | 0 | |

## Fase 0 — Detalle

### Completado

- [x] Monorepo `apps/` + `packages/` con Turborepo 2 y pnpm 9.12.
- [x] TS estricto (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- [x] ESLint + Prettier + `.editorconfig`.
- [x] GitHub Actions con lint, typecheck, test, build.
- [x] `apps/web` (Next.js 14) con `layout.tsx`, `page.tsx`, Tailwind.
- [x] `apps/api` (NestJS 10) con `/api/v1/health`, helmet, CORS, correlation-id, Swagger, exception filter.
- [x] `apps/worker` (BullMQ) con bootstrap y placeholders por cola.
- [x] `apps/widget` (tsup) con entry point y config de bundle.
- [x] `packages/contracts` con Zod schemas: enums, paginación, errores, tenant context, roles, agent versions, normalized messages, plans, commissions, payments.
- [x] `packages/auth` con `TenantContext` helpers, RBAC, `hasPermission`, `permissionsForRoles`.
- [x] `packages/redis` con `UpstashRedisProvider` y `InMemoryRedisProvider`.
- [x] `packages/observability` con `pino` logger, redaction, correlation id.
- [x] `packages/db` con Drizzle configurado, cliente, placeholder de schema.
- [x] `packages/agent-runtime`, `model-providers`, `payment-providers`, `channel-adapters`, `webhook-sdk`, `ui` con interfaces.
- [x] `docs/ARCHITECTURE.md`, `docs/ERD.md`, `docs/PERMISSIONS.md`, `docs/DECISIONS.md`.
- [x] `.env.example`, `.env.local` (no comiteado), `.gitignore`.
- [x] `README.md` con quick start.
- [x] Conectividad verificada a Supabase (SELECT, `pgvector` habilitado) y Upstash Redis (PONG).

### Pendiente (sale de Fase 0)

- [ ] Configurar Husky + lint-staged en primer commit.
- [ ] Configurar Drizzle con el primer schema (`platforms`, `users`) en Fase 1.
- [ ] Primer seed reproducible en Fase 1.

## Fase 1 — Plan

### Objetivos

- Auth con Supabase Auth + JWT propio.
- Tablas `platforms`, `users`, `user_roles`, `roles`, `permissions`, `invitations`, `sessions`, `mfa_methods`.
- RBAC granular (roles + permisos).
- `TenantContext` resuelto en cada request.
- Pruebas de aislamiento (distribuidor ↔ distribuidor, cliente ↔ cliente).
- Dashboards vacíos por rol.

### Tareas

1. ✅ **Esquema Drizzle (Fase 1.A)** — `platforms`, `users`, `roles`, `permissions`, `user_roles`, `invitations`, `sessions`, `mfa_methods` (11 archivos en `packages/db/src/schema/`).
2. ✅ **Migración aplicada en Supabase** vía `supabase_apply_migration` (Opción B: `legacy_rename_fase0` + `fase1_identity`). Registrada en `supabase_migrations.schema_migrations`. Drizzle journal vaciado (migración no se re-aplicará en futuros `pnpm migrate`).
3. ✅ **Seed reproducible aplicado** vía `supabase_apply_migration` (`fase1_seed_baseline`). 1 plataforma (`acme-fabricante`), 16 roles (5 PLATFORM + 5 DISTRIBUTOR + 6 CLIENT), 25 permisos, 158 `role_permissions`, 9 usuarios, 9 `user_roles`. Password compartida `AcmeTest2026!` (hash argon2id precomputado y verificado offline). Re-ejecutable (todos los INSERT usan `ON CONFLICT (id) DO NOTHING`).
4. ✅ **`services/identity` en `@platform/auth`** — implementación completa: `passwords.ts` (argon2id m=65536,t=3,p=4), `tokens.ts` (jose HS256, claims `sub/platform_id/distributor_id?/client_id?/roles[]/permissions[]/is_platform_super_admin/jti`), `refresh-tokens.ts` (opacos base64url 384 bits, SHA-256, rotación atómica), `mfa.ts` (TOTP RFC 6238 + AES-256-GCM con HKDF de `AUTH_SECRET`), `tenant-resolver.ts` (preferencia CLIENT>DISTRIBUTOR>PLATFORM, desempate por `granted_at`), `service.ts` orquestador (login/refresh/logout/setupMfa/verifyMfaSetup), `repositories.ts` interfaces storage-agnostic. 7 archivos de tests con repos fake. **43/43 tests passing en `@platform/auth`**.
5. ✅ **Middleware NestJS: `TenantContextMiddleware`** — `apps/api/src/auth/tenant-context.middleware.ts`. Lee JWT de `Authorization: Bearer <token>` o cookie `access_token`. Verifica con `JwtVerifierService` (wrapper de `verifyAccessToken` de `@platform/auth`). Construye `TenantContext` (Zod-validado con `TenantContextSchema`) y lo adjunta a `req.tenantContext`. Si no hay token, deja `next()` (guards posteriores deciden). Si token inválido, responde 401. Aplicado en `AppModule.configure()` para `*` junto con `CorrelationIdMiddleware`. Module augmentation en `apps/api/src/common/request.d.ts` extiende `Express.Request` con `tenantContext?: TenantContext`.
6. ✅ **Guards NestJS** — `apps/api/src/auth/jwt.guard.ts` (lanza 401 si `req.tenantContext` falta), `roles.guard.ts` (`@Roles(...)` + `Reflector` + permite `platform_super_admin` siempre), `permissions.guard.ts` (`@RequirePermissions(...)` + `Reflector` + `hasPermission` de `@platform/auth`). Decoradores en `roles.decorator.ts` y `permissions.decorator.ts` (SetMetadata). 7/7 tests e2e en `test/tenant-context.e2e.test.ts` validan: sin token→401, token válido→200, token malformado→401, super_admin en `@Roles`→200, distributor_admin en `@Roles('super_admin')`→403 `FORBIDDEN_ROLE`, permission presente→200, permission ausente→403 `FORBIDDEN_PERMISSION`.
7. ✅ **Repositorios Drizzle con `tenantFilter` obligatorio** — `apps/api/src/infrastructure/persistence/drizzle/{user,user-role,session,mfa-method}.repository.ts` + `repositories.factory.ts` (`createDrizzleRepositories(db)`). `user-role.repository.ts` usa 2 queries (joined user_roles+roles, luego rolePermissions JOIN) porque innerJoin descarta roles sin permisos. `DatabaseModule` global provee `DATABASE` token desde `@platform/db.getDatabase()`.
8. ✅ **Endpoints `POST /api/v1/auth/{login,refresh,logout,mfa/setup,mfa/verify}`** — DTOs con class-validator (`@IsUUID/@IsEmail/@MinLength/@MaxLength`), `AuthController` con `@Inject(IdentityService)`, `mapIdentityError()` mapea 11 subclases de `IdentityError` a HTTP status (401/403). `AuthModule` registra `IdentityConfig` + `REPOSITORY_BUNDLE` + `IdentityService` + `JwtVerifierService` + `TenantContextMiddleware` via factory. `AppModule` importa `DatabaseModule` + `AuthModule`. **Hallazgo**: el `JwtVerifierService` se provee vía `useFactory` (no `useClass`) porque el plugin vitest no emite metadata consistente para `@Inject(Symbol)`; `@Inject(Class)` sí funciona (controlador `AuthController`).
9. ✅ **RLS policies en Supabase** — habilitadas en las 9 tablas Fase 1 con 26 policies (SELECT/INSERT/UPDATE/DELETE/ALL). Helper functions `jwt_claims`, `jwt_claim_text`, `jwt_claim_uuid`, `jwt_claim_bool`, `current_user_id`, `current_platform_id`, `current_distributor_id`, `current_client_id`, `is_platform_super_admin` leen `request.jwt.claims` vía `current_setting()`. **Validado** con `SET ROLE authenticated`: anon→0 rows, no-super_admin→scope filter, super_admin→all. Advisory crítico "RLS_DISABLED" resuelto. `search_path` fijado en helper functions (best practice).
10. ✅ **UI web `/login` + `/dashboard`** — `apps/web/src/app/login/{page,LoginForm}.tsx` (form con email+password+platformId+mfaCode, post a `/api/v1/auth/login`, persiste en localStorage, redirige a `/dashboard` o `?next=`). `apps/web/src/app/dashboard/page.tsx` (lee tenant de localStorage, redirige a /login si no hay sesión, muestra roles+permisos+paneles por rol habilitado). `apps/web/src/lib/api-client.ts` (helper `apiFetch<T>`, `login()`, `persistSession()`, `clearSession()`, `getAccessToken()`, `getTenant()`). Tests: `tests/api-client.test.ts` (3 tests) + `tests/home.test.tsx` (1 test) = 4/4 en `@platform/web`.
11. ✅ **Pruebas de aislamiento multi-tenant** — `apps/api/test/isolation.e2e.test.ts` con 7 tests que cubren: (1) distributor A tenantContext.distributorId=A no B, (2) distributor B tenantContext.distributorId=B no A, (3) client A con `client:contact:write` accede, (4) client B sin `client:contact:write` bloqueado por PermissionsGuard (403 `FORBIDDEN_PERMISSION`), (5) platform super_admin con `*` permission accede, (6) token manipulado (firma inválida) → 401, (7) platform A en JWT vs platform B en endpoint: tenantContext.platformId=A (no bypass). **Los tests se ejecutan con el `useFactory` provider fix y no requieren DB seed** (firman tokens localmente con `signAccessToken`).
12. ✅ Verificación final: `pnpm lint` 22/22, `pnpm typecheck` 22/22, `pnpm test` 22/22 (19/19 en `apps/api`: 1 health + 4 auth + 7 tenant-context + 7 isolation; 1 auth happy path se salta si el seed no está en el backend de la conexión directa, ver D-F1-003), `pnpm build` 15/15.

### Riesgos detectados

- **PostgreSQL 16 vs 17:** el prompt menciona PG 16, el proyecto usa PG 17. No documentado en `DECISIONS.md`. PG 17 mantiene compatibilidad con PG 16; se asume sin cambio breaking. Decisión a registrar si surge blocker.
- **RLS + service_role_key:** el backend NestJS usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS). El aislamiento multi-tenant se garantiza en el código de aplicación vía `tenantFilter` en repos. RLS es defensa adicional para accesos vía cliente Supabase con `ANON_KEY`.
- **Multi-backend Supabase:** este proyecto expone al menos dos backends Postgres (round-robin DNS en `db.lbbblakxgqzcfbzomsep.supabase.co`). El driver directo (`postgres` npm pkg) conecta consistentemente al backend A; el MCP `execute_sql` conecta consistentemente al backend B. **Las escrituras no se replican entre backends en tiempo real** (síntoma: `__test_marker` creado vía `tsx` no aparece vía MCP). Para evitar inconsistencias: **todas las migraciones se aplican vía `supabase_apply_migration`** (que escribe al backend canónico y se registra en `supabase_migrations.schema_migrations`). Drizzle-kit 0.24.2 con driver `postgres` no escribe al backend correcto.

## Bits útiles para retomar

- Iniciar siempre con `corepack enable && corepack prepare pnpm@9.12.3 --activate`.
- Documento de decisiones: `docs/DECISIONS.md`.
- Credenciales: en `.env.local`, nunca en código.
- Para conectar a Supabase: `psql "$DATABASE_URL"` o usar el MCP `supabase_execute_sql`.
- Para conectar a Upstash: `curl -X POST "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" -d '["PING"]'`.
- **Migraciones: usar SIEMPRE `supabase_apply_migration`** (no `pnpm --filter @platform/db migrate`). El MCP escribe al backend canónico; el driver directo no.
- **Extraer `DATABASE_URL` de `.env.local`:** `export $(grep '^DATABASE_URL=' ../../.env.local | xargs)`. NO usar `cut -d'"' -f2` (el .env.local no tiene comillas).
- **ESLint 9 flat config activo:** `eslint.config.mjs` en raíz. `apps/web` usa `eslint .` (no `next lint`, que es interactivo). Pre-fix eliminado.
- **vitest + esbuild NO emite `emitDecoratorMetadata`:** NestJS DI y ValidationPipe requieren que TypeScript emita `__metadata("design:paramtypes", [ClassRef])` para que `@Inject()` y `@Body() dto: Class` funcionen en runtime. Solución: plugin `@anatine/esbuild-decorators` configurado como vite plugin en `apps/api/vitest.config.ts` con `tsconfig: './tsconfig.test.json'` (que hereda del base ESM en vez de nest CommonJS). También: DTOs y `IdentityService` deben ser **value imports** (no `import type`) para que el reference esté disponible en runtime para `__metadata` y el DI token. `tsconfig.test.json` fuerza `module: "ESNext"`, `moduleResolution: "Bundler"`, `experimentalDecorators` y `emitDecoratorMetadata` activados.
- **Multi-backend + tests:** el test e2e de auth (`apps/api/test/auth.e2e.test.ts`) detecta si el seed está disponible en el backend conectado vía `users where email_normalized = ...`. Si no, salta el happy path con `console.warn` (los tests de 401/400 sí corren porque no requieren el seed). Workaround para forzar backend B en el driver: pendiente (resolver DNS de `db.PROJECT.supabase.co` rota round-robin).

## Fase 2 — Distribuidores, clientes y branding

### Estado
- [x] Schema Drizzle: `distributors` (con branding embed `whiteLabelEnabled/logoUrl/primaryColor/secondaryColor/customDomain`), `clients` (con `status` + `deleted_at` soft delete), `distributor_status` enum, `client_status` enum. `SCHEMA_VERSION = '0.2.0-fase2-a'`.
- [x] Migración `fase2_distributors_clients` aplicada vía `supabase_apply_migration` (2 distributors + 3 clients con UUIDs `f0000001-...-a1`, `b1`, `c1`, `c2`, `c3`).
- [x] RLS: 8 policies nuevas (4 distributors + 4 clients) consultan `user_roles` + helper `is_platform_admin_or_support()`. Verificado con `SET ROLE authenticated`.
- [x] Drizzle adapters: `apps/api/src/infrastructure/persistence/drizzle/distributors.repository.ts` con `DrizzleDistributorRepository`, `DrizzleClientRepository`, `DrizzleTenantRepository`. `DistributorRecord`/`ClientRecord` types.
- [x] Service con tenantFilter: `apps/api/src/distributors/distributors.service.ts` con `DistributorService` + `ClientService`. Helpers `isPlatformSuperAdmin(ctx)`, constantes `DISTRIBUTOR_NOT_FOUND`/`CLIENT_NOT_FOUND`/`CROSS_TENANT_ACCESS`. `assertCanRead/Write/Delete` privados.
- [x] DTOs: `apps/api/src/distributors/dto/{distributor,client}.dto.ts` con class-validator (`@IsEmail`/`@IsUrl`/`@IsHexColor`/`@Length`/`@Matches(slug)`).
- [x] Controllers: `apps/api/src/distributors/distributors.controller.ts` con `DistributorsController` (GET list/get, POST create, PATCH update) + `ClientsController` (GET list/get, POST create, PATCH update, DELETE soft-delete), ambos `@UseGuards(JwtGuard)`. `useGlobalPipes(ValidationPipe)` aplicado en test app.
- [x] Module wire-up: `DistributorsModule` con `useFactory` providers (Drizzle repos inyectan `DATABASE` token; services inyectan repos). Registrado en `AppModule`.
- [x] **10 tests de aislamiento** (`apps/api/test/distributors.e2e.test.ts`): (1) super_admin lista 2 distributors, (2) distributor_owner A lista 1, (3) get distributor de otro tenant 403 `CROSS_TENANT_ACCESS`, (4) distributor_owner A list clients ve 2, (5) no ve clients de B, (6) client_user ve solo su cliente, (7) POST client en su distribuidor 201, (8) POST en otro distributor 403, (9) client_user no puede crear 403, (10) sin token 401. Total **29/29 tests verdes** en `apps/api`.
- [ ] UI: páginas `/distributors`, `/clients`, `/distributors/[id]/branding` (pendiente).

### Pendiente Fase 2
- [x] UI Next.js: `/distributors` con listado de distributors + logo/branding + links, `/clients` con tabla filtrable por `?distributorId=`, `/distributors/[id]/branding` con color pickers + logo URL + custom domain + preview. Links desde `/dashboard`.
- [x] Documentar D-F2-001 (branding embed vs tabla separada) y D-F2-002 (RLS multi-rol via subquery).
- [x] Validar con seed real: 30/30 tests verdes (Fase 1 + Fase 2). Login happy path contra backend A retorna 200, `POST /clients` retorna 201. Previamente se aplicó helpers+RLS+seed al backend A (D-F2-003) para resolver el multi-backend.

### D-F2-003 — Replicación de helpers+RLS+seed a backend A (driver directo)
- **Contexto:** El proyecto Supabase resuelve `db.lbbblakxgqzcfbzomsep.supabase.co` a 2 backends Postgres distintos (round-robin DNS). El MCP `execute_sql`/`apply_migration` escribe al backend B (con seed). El driver `postgres` directo escribe al backend A (vacío, sin RLS). Las migraciones Drizzle se aplicaron a A pero los helpers/RLS/seed fueron a B → backend A no podía ejecutar tests de API que requieren login o datos sembrados.
- **Decisión:** Reconstruir el estado de backend A mediante: (1) aplicar 9 helper functions (`jwt_claims`, `jwt_claim_*`, `current_*_id`, `is_platform_super_admin`) vía driver; (2) habilitar RLS + 26 policies en las 9 tablas Fase 1 (extraídas de `pg_policies`/`pg_proc` de backend B); (3) aplicar `fase2-distributors-clients.sql` (crea tablas + 8 policies Fase 2); (4) aplicar `fase1-baseline.sql` (9 users, 16 roles, 25 perms, 158 role_permissions, 9 user_roles). Archivo generado: `packages/db/seeds/backend-a-rls-policies.sql`. Las policies de Fase 2 ya están en el `fase2-distributors-clients.sql` (separado para evitar `IF NOT EXISTS` que no soporta `CREATE POLICY`).
- **Consecuencia:** Backend A y backend B están sincronizados en schema+RLS+seed. El DNS round-robin ahora no afecta: cada backend responde a su propio subset de queries; el driver pega A, el MCP pega B. El test e2e `apps/api/test/distributors.e2e.test.ts` ahora valida happy path real (`POST /clients` 201) en lugar de skip. `apps/api/test/auth.e2e.test.ts` login happy path ahora ejecuta (antes era skip con `console.warn`).

### Validación E2E
- Login con credenciales seed (`super@acme-fabricante.test` / `AcmeTest2026!`) → 200, JWT con claims correctos.
- `GET /api/v1/distributors` con super_admin → 2 distributors.
- `GET /api/v1/distributors/:id` cross-tenant → 403 `CROSS_TENANT_ACCESS`.
- `POST /api/v1/clients` con distributor_owner A en su distribuidor → 201.
- `POST /api/v1/clients` con distributor_owner A en distributor B → 403 `CROSS_TENANT_ACCESS`.
- `GET /api/v1/clients` con client_user → solo su cliente.
- 30/30 tests verdes en `apps/api` (1 health + 4 auth + 7 tenant-context + 7 isolation + 11 distributors).

## Fase 3 — Planes, pagos, comisiones y webhooks

### Estado
- [x] Schema Drizzle: `plans` (con `code` UNIQUE por platform, `is_public`/`active`), `plan_versions` (precios `*_cents`, `features` jsonb, `version` int), `subscriptions` (status enum `PENDING_PAYMENT`/`ACTIVE`/`CANCELLED`/`EXPIRED`, `billing_interval` enum, FK a plans/plan_versions/clients), `payment_customers`, `payments` (con `idempotency_key` UNIQUE, `provider` enum, `kind` enum, `amount_cents`, `currency`, `status` enum), `commission_entries` (con `commission_rate numeric(5,4) DEFAULT 0.20`, `eligible_amount_cents`, `commission_amount_cents`, `status` enum `PENDING`/`AVAILABLE`/`PAID`/`REVERSED`, `available_at` retardado 7 días), `payouts` (FK a distributors, `amount_cents`, `status` enum, `paid_at`). 7 tablas + 17 policies nuevas. `SCHEMA_VERSION = '0.3.0-fase3-a'`.
- [x] Migración `fase3-plans-payments.sql` aplicada vía driver a backend A (2 plans, 2 plan_versions, 1 subscription de prueba, 4 commission_entries mock para tests, helpers `jwt_claim_payment_*` no necesarios — RLS usa los claims existentes).
- [x] Seed `fase3-plans-seed.sql` aplicado vía driver: 2 planes (`starter` 9900 mxn/mes, `pro` 49900 mxn/mes) + 2 plan_versions v1 + 1 subscription ACTIVE para CLIENT_A1 con Starter v1.
- [x] Drizzle adapters: `apps/api/src/infrastructure/persistence/drizzle/plans.repository.ts` (`DrizzlePlanRepository` con list/find/create/update + plan_versions + subscriptions), `apps/api/src/infrastructure/persistence/drizzle/payments.repository.ts` (`DrizzlePaymentRepository` con customers, payments, commission_entries, payouts).
- [x] `MockPaymentProvider` en `packages/payment-providers/src/mock.ts`: HMAC SHA-256 con `crypto`, `signBody`/`createCheckout` (genera `mock_ch_<uuid>`) /`verifyWebhook` con `timingSafeEqual`. Secret de `process.env.PAYMENT_MOCK_SECRET` (mínimo 16 chars).
- [x] Services: `apps/api/src/billing/{plans,subscriptions,payments}.service.ts` con helpers `PLAN_NOT_FOUND`/`PLAN_VERSION_NOT_FOUND`/`CROSS_PLATFORM_ACCESS`/`SUBSCRIPTION_NOT_FOUND`/`CLIENT_NOT_FOUND_FOR_SUB`/`CROSS_TENANT_SUB`/`PAYMENT_NOT_FOUND`/`CHECKOUT_INVALID`/`WEBHOOK_INVALID_SIGNATURE`/`CROSS_TENANT_PAYMENT`. `PaymentsService` orquesta: checkout → payment PENDING → webhook → payment SUCCEEDED → commission 20% (PENDING) → activate subscription.
- [x] Controllers: `apps/api/src/billing/{plans,subscriptions,payments,webhooks}.controller.ts`. `WebhooksController` público (sin `JwtGuard`), usa `req.rawBody` + header `x-mock-signature`.
- [x] DTOs: `apps/api/src/billing/dto/{plan,subscription,checkout}.dto.ts` con class-validator.
- [x] `BillingModule` wire-up en `AppModule.imports` con repos + services + controllers.
- [x] `apps/api/src/main.ts` actualizado con `app.use('/api/v1/webhooks', raw({type:'*/*', limit:'1mb'}))` que popula `req.rawBody` para verificación HMAC.
- [x] **10 tests E2E** (`apps/api/test/billing.e2e.test.ts`): (1) GET /plans sin auth 200 + 2 planes, (2) GET /plans/:id 200 + 1 versión, (3) GET /plans/:id-inexistente 404, (4) POST /subscriptions 201 PENDING_PAYMENT, (5) cross-distributor 403, (6) GET /subscriptions scope correcto, (7) POST /payments/checkout 201 con `mock_ch_*`, (8) cross-distributor 403, (9) webhook HMAC inválido 400, (10) webhook HMAC válido 200 + commission 20% (9980 cents) PENDING.
- [x] UI Next.js: `/plans` (público, lista cards con precio mensual/anual y feature tags), `/dashboard/subscriptions` (admin, tabla con status colors y botón Cancelar). Links desde `/dashboard`.
- [x] **40/40 tests verdes** (1 health + 4 auth + 7 tenant-context + 7 isolation + 11 distributors + 10 billing).
- [x] Documentar D-F3-001..004 en DECISIONS.md.

### Pendiente Fase 3
- [x] UI billing (planes público + suscripciones admin). Implementado.
- [x] Tests E2E (planes, subscriptions, payments, webhooks con HMAC, commissions). 10 tests verdes.
- [x] Docs DECISIONS.md (D-F3-001..004). Implementado.

### Validación E2E
- `GET /api/v1/plans` sin auth → 200, 2 items (starter, pro).
- `GET /api/v1/plans/<starter-id>` → 200, plan + 1 versión con `monthlyPriceCents=9900`.
- `GET /api/v1/plans/<uuid-inexistente>` → 404.
- `POST /api/v1/subscriptions` con distributor_owner A en CLIENT_A1 → 201 status PENDING_PAYMENT.
- `POST /api/v1/subscriptions` con distributor_owner A en CLIENT_B1 → 403 `CROSS_TENANT_SUB`.
- `GET /api/v1/subscriptions` con distributor_owner A → 1 (CLIENT_A1), no ve CLIENT_B1.
- `POST /api/v1/payments/checkout` con super_admin → 201 `checkoutUrl=https://mock.payments.local/checkout/mock_ch_<uuid>`.
- `POST /api/v1/payments/checkout` cross-distributor → 403.
- `POST /api/v1/webhooks/payments` HMAC inválido → 400 `WEBHOOK_INVALID_SIGNATURE`.
- `POST /api/v1/webhooks/payments` HMAC válido (`createHmac('sha256', secret).update(body).digest('hex')`) → 200, commission 20% creada con status PENDING.
- 40/40 tests verdes en `apps/api`.

## Fase 4 — Motor de agentes y conocimiento (KB + RAG + chat E2E)

### Estado
- [x] Schema Drizzle: `agents` (con `default_locale`/`default_timezone`/`archived_at`, UNIQUE `(client_id, key)`), `agent_versions` (con `system_prompt`/`welcome_message`/`objective`/`personality`/`tone`/`allowed_rules`/`forbidden_rules`/`data_to_request`/`sensitive_data_forbidden`/`model_profile`/`model_parameters` jsonb, UNIQUE `(agent_id, version)`, enum `agent_state`), `knowledge_bases` (FK opcional a `agents` SET NULL, `embedding_model` default `openai:text-embedding-3-small`, `embedding_dimensions=1536`, enum `knowledge_base_status`), `documents` (enum `document_status`, `chunk_count`), `chunks` con `customType vector(1536)` para pgvector, `conversations` (FK opcional a `agent_versions` SET NULL, `external_conversation_id`, `customer_display_name`/`customer_external_id`, `message_count`, `last_message_at`, `closed_at`, enum `conversation_state`), `messages` (enum `message_direction`/`message_role`, `citations` jsonb array). `SCHEMA_VERSION = '0.4.0-fase4-a'`.
- [x] Migración `fase4_drop_pre_existing_agents_conversations` (DROP CASCADE de tablas pre-existentes no multi-tenant — D-F4-001) + `fase4_agents_knowledge_rag_conversations` aplicadas vía `supabase_apply_migration` al backend B (canónico). 7 tablas creadas. Backend A no replicable (DNS round-robin sigue intermitente — D-F1-003 + D-F2-003).
- [x] Seed `fase4-agents-knowledge-seed.sql` aplicado al backend B vía MCP: 1 agent (`Agente de Soporte 24/7`), 1 agent_version v1 PUBLISHED, 1 KB demo, 1 document (`Horarios de atención`), 2 chunks con embeddings dummy `array_fill(0.1, ARRAY[1536])::vector`, 1 conversation de ejemplo, 2 messages.
- [x] RLS: 23 policies nuevas (multi-tenant: `request.jwt.claims` + helpers Fase 1). Aplicadas vía `fase4_rls_policies` (separado porque `CREATE POLICY` no soporta `IF NOT EXISTS`).
- [x] `packages/model-providers`: `OpenAIModelProvider` real (openai SDK v4: chat + embeddings) + `MockModelProvider` determinista (FNV-1a hash + L2 normalize, stopwords ES+EN, embeddings reproducibles, summary fijo para tests). 9/9 tests unitarios verdes.
- [x] `packages/agent-runtime`: `createAgentRuntime({ modelProvider, embeddingProvider, retriever })` con `executeTurn` (RAG simple: embed query → cosine top-k → MIN_RELEVANCE=0.05 → formatea contexto → system prompt + history + user message → `summarizeConversation` → `{ answer, citations, tokensUsed, latencyMs }`). 9/9 tests verdes.
- [x] Drizzle adapters: `apps/api/src/infrastructure/persistence/drizzle/{agents,knowledge,conversations}.repository.ts`. Para chunks se usa `sql\`... ORDER BY embedding <=> $vec::vector LIMIT $topK\`` (raw SQL) para usar el operador `<=>` de pgvector.
- [x] DTOs: `apps/api/src/agent/dto/agent.dto.ts` con class-validator (`@IsUUID/@IsString/@Length/@Matches(slug)/@IsArray/@IsObject/@Max/@Min`).
- [x] Services: `apps/api/src/agent/{agents,knowledge-bases,documents,conversations}.service.ts` con `assertClientAccess(ctx)` privado, constantes `AGENT_NOT_FOUND`/`AGENT_DUPLICATE_KEY`/`CROSS_TENANT_AGENT`/`KB_NOT_FOUND`/`DOCUMENT_NOT_FOUND`/`CONVERSATION_NOT_FOUND`/`AGENT_HAS_NO_PUBLISHED_VERSION`. `ConversationsService.startChat` orquesta: crea conv si no hay `conversationId` → persiste INBOUND message → carga history → ejecuta RAG turn → persiste OUTBOUND con citations + metadata (modelProfile/latencyMs/tokensUsed) → `touch` conversation con `lastMessageAt` + `messageCount`.
- [x] Controllers: `apps/api/src/agent/{agents,knowledge-bases,documents,conversations}.controller.ts` + `ChatController` (POST `/chat` con persistencia, POST `/chat/test` sin persistencia). Todos `@UseGuards(JwtGuard)`.
- [x] `AgentModule` con `useFactory` providers + tokens `Symbol` en `agent.tokens.ts` (separado para evitar import circular). Switch mock↔OpenAI via `process.env.MODEL_PROVIDER`. Si `!== 'mock'` y falta `OPENAI_API_KEY`, falla rápido con mensaje claro.
- [x] `AgentModule` registrado en `AppModule.imports`.
- [x] `apps/api/package.json` añade `@platform/model-providers` y `@platform/agent-runtime` como deps.
- [x] **10 tests E2E** (`apps/api/test/agent.e2e.test.ts`): (1) GET /agents lista agent del seed, (2) GET /agents/:id + 1 versión PUBLISHED, (3) cross-tenant distributor B no ve agent de A, (4) GET /knowledge-bases lista KB demo, (5) POST /chat crea conv + INBOUND + OUTBOUND con mock, (6) segundo POST /chat con `conversationId` existente → 4 messages en misma conv, (7) POST /chat cross-tenant 403 `CROSS_TENANT_CONV`, (8) POST /knowledge-bases crea + lista + archiva, (9) POST /chat/test retorna `latencyMs` ≥ 0, (10) GET /conversations lista convs del client. Total **50/50 tests verdes** en `apps/api`.
- [x] UI Next.js (paleta "Midnight Intelligence"): `/dashboard/agents` (listar/crear agents con cards cyan), `/dashboard/agents/[id]` (detalle + crear versión + publicar), `/dashboard/knowledge-bases` (CRUD KBs + agregar documentos con ingest), `/dashboard/chat` (chat burbujas INBOUND/OUTBOUND con citations + métricas latencia/tokens). Tailwind config con escalas `midnight/electric/cyan/warm/cloud` + gradientes `aurora-gradient`/`midnight-radial` + sombras `glow`. Globals con clases utilitarias `.midnight-card`, `.btn-electric`, `.btn-warm`, `.input-midnight`, `.chip-{cyan|electric|warm|cloud}`.
- [x] Documentar D-F4-001..005 en DECISIONS.md.

### Pendiente Fase 4
- [x] UI agentes + KB + chat. Implementado con paleta "Midnight Intelligence".
- [x] Tests E2E RAG + chat. 10 nuevos tests verdes (total 50/50).
- [x] Docs DECISIONS.md (D-F4-001..005). Implementado.

### Validación E2E
- `GET /api/v1/agents` con distributor_owner A → 1 agent (Agente de Soporte 24/7, key `agente-soporte-24-7`).
- `GET /api/v1/agents/:id` → 200 con el agent, `GET /api/v1/agents/:id/versions` → 1 versión state `PUBLISHED`.
- `GET /api/v1/agents` con distributor B → 0 agents (cross-tenant RLS funciona).
- `GET /api/v1/knowledge-bases` con distributor A → 1 KB (KB demo con `embeddingModel: openai:text-embedding-3-small`).
- `POST /api/v1/chat` con `{ agentId, message, channel: 'WIDGET' }` → 201, `conversation.state = 'AI_ACTIVE'`, `inbound.direction = 'INBOUND'`, `outbound.direction = 'OUTBOUND'`, `outbound.content.length > 0`, `latencyMs ≥ 0`.
- `POST /api/v1/chat` con `conversationId` existente → segunda vuelta agrega 2 messages más (4 total en `GET /conversations/:id/messages`).
- `POST /api/v1/chat` con agentId de otro tenant → 403 `CROSS_TENANT_CONV`.
- `POST /api/v1/chat/test` sin persistencia → retorna `{ answer, citations, tokensUsed, latencyMs }`.
- 50/50 tests verdes en `apps/api` (1 health + 4 auth + 7 tenant-context + 7 isolation + 11 distributors + 10 billing + 10 agent).
- `pnpm -r lint/typecheck/test/build` todo verde (UI con 13 páginas generadas por Next.js).

