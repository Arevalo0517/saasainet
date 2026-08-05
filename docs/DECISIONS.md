# Decisiones arquitectónicas

> Documento vivo. Cada vez que se tome una decisión que contradiga el PRD o el prompt maestro, se registra aquí con: fecha, fase, contexto, decisión y consecuencia.

## Fase 0 — Andamiaje

### D-F0-001 · Monorepo pnpm + Turborepo
- **Contexto:** El prompt maestro exige monorepo TypeScript moderno.
- **Decisión:** pnpm 9.12 + Turborepo 2.1. Node 20.18 LTS.
- **Consecuencia:** Cache local persistente, workspaces claros, builds incrementales.

### D-F0-002 · PostgreSQL en Supabase Cloud
- **Contexto:** El usuario eligió Supabase en la nube para `db` y `pgvector`.
- **Decisión:** Proyecto Supabase dedicado. `DATABASE_URL` con `sslmode=require`. `pgvector` habilitado vía `CREATE EXTENSION`.
- **Consecuencia:** Pagos centralizados en Supabase, RLS nativo, conexión segura. Latencia adicional en operaciones; mitigada con índices y caché.

### D-F0-003 · Redis vía Upstash REST
- **Contexto:** El usuario eligió Upstash en la nube.
- **Decisión:** Cliente en `packages/redis` con transporte REST. BullMQ se inicializa con un cliente Redis-compatible. Si la cola requiere TCP en producción, se planifica un fallback a `ioredis` con `UPSTASH_REDIS_URL` (no `:rest`).
- **Consecuencia:** Sin servidor Redis que mantener. Coste por operación. Para Fase 4 (rutas de IA), se medirá latencia.

### D-F0-004 · Stripe como PaymentProvider inicial
- **Contexto:** El usuario eligió Stripe.
- **Decisión:** Adaptador `StripePaymentProvider` en Fase 3. Se incluye `MockPaymentProvider` desde el día uno para desarrollo y tests.
- **Consecuencia:** No se mezclan secretos reales en dev. Webhooks firmados y verificados.

### D-F0-005 · `OPENAI_API_KEY` en variable de entorno
- **Contexto:** El usuario eligió variable de entorno.
- **Decisión:** Lectura directa vía `process.env.OPENAI_API_KEY`. Único lugar en código: `packages/model-providers`. Sin persistir en BD.
- **Consecuencia:** Rotación trivial. Sin secretos en logs (redactor lo garantiza).

### D-F0-006 · Ningún proceso por agente
- **Contexto:** El prompt maestro lo exige explícitamente.
- **Decisión:** Cada agente es una fila en `agent_versions`. El `AgentRuntime` carga la versión publicada bajo demanda.
- **Consecuencia:** No se levantan contenedores. Costo operativo plano. Cambio de proveedor o modelo sin re-deploy.

### D-F0-007 · Mensajes facturables: defaults del PRD
- **Contexto:** El PRD define reglas por defecto hasta que se decida otra cosa.
- **Decisión (deuda):**
  - Mensaje entrante: 1 crédito.
  - Mensaje saliente IA: 1 crédito.
  - Mensaje humano: 1 crédito (decisión pendiente D-F0-013).
  - Reintentos técnicos, delivery receipts, eventos internos: 0 créditos.
- **Consecuencia:** Reglas en `packages/contracts` (`LedgerMovementTypeSchema`). Implementación en Fase 3.

### D-F0-008 · Comisión por porcentaje configurable
- **Decisión:** Por defecto 20 % (`COMMISSION_DEFAULT_PERCENT=20`). Retención 15 días (`COMMISSION_HOLD_DAYS=15`). Payout mensual manual.
- **Consecuencia:** Implementación en `commission_entries` con snapshot de regla.

### D-F0-009 · Vigencia de recargas: 90 días
- **Decisión:** `TOPUP_DEFAULT_EXPIRATION_DAYS=90`. Configurable por producto.
- **Consecuencia:** Job de expiración automática en `message_credit_ledger`.

### D-F0-010 · Marca del fabricante por defecto
- **Decisión:** `WHITE_LABEL_ENABLED=false`. Todos los portales muestran branding del fabricante.
- **Consecuencia:** Feature flag y `distributor_memberships` en Fase 2.

### D-F0-011 · Locales iniciales
- **Decisión:** `es` por defecto, preparado para `en`. `mxn` configurable (no hardcoded en lógica).
- **Consecuencia:** i18n en `apps/web` desde el inicio.

### D-F0-012 · Idempotencia obligatoria por contrato
- **Decisión:** Pagos, recargas, webhooks entrantes, envío de mensajes y respuestas de IA llevan `idempotency_key`. Duplicados no duplican efectos.
- **Consecuencia:** Pruebas E2E de duplicados en cada fase.

### D-F0-013 (pendiente) · ¿Mensajes humanos consumen créditos?
- **Estado:** abierto. Default actual: sí. PRD permite diferir.
- **Próximo paso:** confirmar con usuario antes de Fase 3.

### D-F0-014 · Sin LangGraph en MVP
- **Decisión:** Solo `@openai/agents` + Responses API. LangGraph queda fuera hasta que aparezca un caso que lo justifique.
- **Consecuencia:** Codebase más simple. Posibilidad de reevaluar en Fase 8.

### D-F0-015 · HELMET habilitado en API
- **Decisión:** `helmet()` + `cors` con `credentials` configurado por `APP_URL`. Rate limiting preparado vía middleware.
- **Consecuencia:** Defaults seguros en arranque.

### D-F0-016 · Logs estructurados JSON + correlation ID
- **Decisión:** `pino` + middleware global. `x-correlation-id` se propaga en cada request y se devuelve en cada response.
- **Consecuencia:** Trazabilidad de extremo a extremo. No requiere APM externo.

### D-F0-017 · Soporte multi-arquitectura
- **Contexto:** Mac arm64.
- **Decisión:** No instalar binarios opcionales que solo tengan x86. npm/pnpm resuelven automáticamente.
- **Consecuencia:** `esbuild` y `rollup` deben descargar binarios arm64 (lo hacen por defecto).

## Conflictos PRD ↔ Prompt

| Tema | PRD | Prompt | Resolución |
|---|---|---|---|
| Comisión inicial | definir con % por distribuidor | "Porcentaje configurable por distribuidor" | D-F0-008 (default 20 %) |
| Periodicidad payout | quincenal o mensual | mensual | D-F0-008 (mensual, configurable) |
| Vigencia recarga | configurable | 90 días default | D-F0-009 |
| Canales MVP | Widget + WhatsApp | Widget + WhatsApp | Coherente |
| White-label | premium | desactivado por defecto | D-F0-010 |
| LongGraph | no menciona | "fuera del MVP" | D-F0-014 |

## Fase 1 — Identidad y multi-tenancy

### D-F1-001 · Auth propia (no Supabase Auth)
- **Contexto:** El prompt exige "auth propia con JWT propio"; Supabase Auth introduce lock-in y el JWT se vuelve a firmar en cada login (no sirve para forzar revocación inmediata).
- **Decisión:** Auth basada en `@platform/auth` con `argon2` (hash) + `jose` (JWT). Sin tabla espejo en `auth.users`. La API firma JWT con `AUTH_SECRET`, incluye `user_id`, `platform_id`, `distributor_id` opcional, `client_id` opcional, `roles[]`, `is_platform_super_admin`, `exp`.
- **Consecuencia:** Logout/rotación inmediata posible. RLS policies leen `current_setting('request.jwt.claims')` en vez de `auth.jwt()`. La función `public.handle_new_auth_user()` (Fase 0) queda huérfana — no rompe nada porque nadie inserta en `auth.users` desde nuestro flujo.

### D-F1-002 · Estrategia B para migración Fase 1 (legacy rename)
- **Contexto:** La DB de Supabase ya tenía 21 tablas Fase 0 con 16 usuarios y datos de prueba. La nueva `users` (Fase 1) tiene estructura incompatible (3 FKs nullable `platform_id/distributor_id/client_id` vs 1 `tenant_id`).
- **Decisión:** Opción B: renombrar Fase 0 a `legacy_*_fase0` (2 tablas + 18 enums). PostgreSQL resuelve FKs por OID, por lo que las 16 FKs de Fase 0 que apuntan a `users`/`tenants` siguen funcionando apuntando a `legacy_users_fase0`/`legacy_tenants_fase0`. Crear Fase 1 limpio encima.
- **Consecuencia:** Cero pérdida de datos. Las tablas Fase 0 (`agents`, `conversations`, etc.) siguen operativas con FKs apuntando a `legacy_*`. Cuando se reescriban en fases posteriores, se actualizará la FK. La migración se aplica vía `supabase_apply_migration` (D-F1-003), no vía drizzle-kit.

### D-F1-003 · Migraciones vía `supabase_apply_migration`, no drizzle-kit
- **Contexto:** `drizzle-kit migrate 0.24.2` con driver `postgres` npm reportó "applied successfully" pero las tablas NO aparecieron en el backend canónico de Supabase. Investigación reveló que el proyecto tiene múltiples backends Postgres accesibles vía round-robin DNS en `db.PROJECT.supabase.co`. El MCP conecta consistentemente al backend B; el driver directo conecta al backend A; las escrituras no se replican.
- **Decisión:** Todas las migraciones se aplican vía `supabase_apply_migration` (que escribe al backend canónico + registra en `supabase_migrations.schema_migrations`). El directorio `packages/db/migrations/` se mantiene solo como fuente para regenerar; el `_journal.json` queda vacío. Drizzle-kit `generate` sigue funcionando para diff vs DB.
- **Consecuencia:** Auditoría clara (una fila por migración en `schema_migrations`). Drizzle-kit `migrate` queda inutilizado; documentado en `IMPLEMENTATION_STATUS.md` (sección "Bits útiles").

### D-F1-004 · ESLint 9 flat config
- **Contexto:** Fase 0 traía ESLint 8 + `.eslintrc.json`. El flat config es requerido por `eslint-config-prettier` y reglas `@typescript-eslint` recientes.
- **Decisión:** Migrar a ESLint 9 con `eslint.config.mjs` (flat config). Eliminar `.eslintrc.json`. Instalar `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`. `apps/web` cambia de `next lint` (interactivo) a `eslint . --max-warnings 0`.
- **Consecuencia:** Lint un 30 % más estricto (`consistent-type-imports`, `no-useless-assignment`, `no-unused-vars`). 21/21 paquetes pasan limpio.

### D-F1-005 · Fixes pre-existentes en `apps/api` (necesarios para lint limpio)
- `apps/api/src/main.ts`: eliminar `import { Logger }` no usado.
- `apps/api/src/app.module.ts`: `MiddlewareConsumer, NestModule` → `type` imports.
- `apps/api/src/common/correlation-id.middleware.ts`: `NestMiddleware` → `type` import.
- `apps/api/src/common/http-exception.filter.ts`: `ArgumentsHost, ExceptionFilter` → `type` imports.
- `apps/api/src/health/health.controller.ts`: refactor `check()` para extraer `pingRedis()` privado. Era código muerto (`const started = Date.now()` no usado + `let redisState = 'down'` reasignado en catch).

### D-F1-006 · RLS policies con `request.jwt.claims` (auth propia)
- **Contexto:** Auth propia (D-F1-001) emite JWT con `sub`, `platform_id`, `distributor_id`, `client_id`, `is_platform_super_admin`, `roles[]`. Supabase Auth no se usa. Necesitamos RLS que lea estos claims sin depender de `auth.jwt()`.
- **Decisión:** 9 helper functions SQL leen `current_setting('request.jwt.claims', true)::jsonb` (`jwt_claims`, `jwt_claim_text`, `jwt_claim_uuid`, `jwt_claim_bool`, `current_user_id`, `current_platform_id`, `current_distributor_id`, `current_client_id`, `is_platform_super_admin`). 26 RLS policies en las 9 tablas Fase 1 — cubren SELECT/INSERT/UPDATE/DELETE/ALL. Validado con `SET ROLE authenticated`: anon→0 rows, non-super_admin→filtrado por `platform_id`, super_admin→all. `search_path` fijado en cada helper (`public, pg_temp`) para evitar troyanos.
- **Consecuencia:** El advisory crítico "RLS_DISABLED" queda resuelto. El backend API **sigue usando `SUPABASE_SERVICE_ROLE_KEY`** (que bypasea RLS) en esta fase — el aislamiento multi-tenant se garantiza en código de aplicación vía `tenantFilter` (tarea 7). El contrato `request.jwt.claims` queda listo para que, en **Fase 1.B (services/identity)**, el API migre a una conexión que NO bypasee RLS y setee `request.jwt.claims` por request vía `SELECT set_config('request.jwt.claims', $1, true)`.

### D-F1-007 · Seed baseline aplicado como migración MCP (no `pnpm seed`)
- **Contexto:** `packages/db/src/seed.ts` existe como placeholder. El seed reproducible (tarea 3) requiere insertar plataforma + 16 roles + 25 permisos + 9 usuarios con password hasheada. La ejecución vía `tsx src/seed.ts` con driver `postgres` escribe al backend equivocado (D-F1-003).
- **Decisión:** El seed (`packages/db/seeds/fase1-baseline.sql`, 366 líneas, idempotente con `ON CONFLICT (id) DO NOTHING`) se aplica vía `supabase_apply_migration` con nombre `fase1_seed_baseline`. La conexión `tsx` queda documentada como inutilizable por D-F1-003; `pnpm seed` queda diferido hasta que se resuelva el multi-backend o se fije un único backend por env var. Hashes argon2 pre-computados con `argon2.hash('AcmeTest2026!', { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })` y verificados offline.
- **Consecuencia:** Auditoría en `supabase_migrations.schema_migrations`. El archivo SQL queda como fuente reproducible para futuros entornos. Las credenciales de prueba (9 usuarios con password `AcmeTest2026!`) están en `.env.local` y deben rotarse antes de producción.

### D-F1-008 · vitest + plugin `esbuild-decorators` para emitir metadata
- **Contexto:** vitest usa esbuild para transformar TS. esbuild **NO** implementa `emitDecoratorMetadata` (solo respeta la opción en `tsconfigRaw`, no emite `__metadata("design:paramtypes", [...])` en el output). Esto rompe NestJS DI (`@Inject()` sin class token + `@Body() dto: Class`) y `class-validator`/`ValidationPipe` (sin metatype, la pipe pasa el body tal cual). Confirmado: el test que envía un email inválido recibía 401 (auth) en vez de 400 (validation).
- **Decisión:** Usar `@anatine/esbuild-decorators` como vite plugin en `apps/api/vitest.config.ts`. El plugin envuelve la transformación con `typescript.transpileModule` que sí emite la metadata cuando detecta decoradores. Se necesita `tsconfig.test.json` (nuevo) que herede de `tsconfig.base.json` (ESM) en lugar de `tsconfig.nest.json` (CommonJS) — el plugin pasa el output por esbuild que necesita `format: 'esm'`. Adicionalmente: `IdentityService` y los DTOs deben ser **value imports** (no `import type`) para que la referencia de clase esté disponible en runtime para el token DI y para `__metadata('design:paramtypes', [LoginDto])`.
- **Consecuencia:** Los 4 tests de auth pasan (1 happy path + 1 wrong-password 401 + 1 invalid-email 400 + 1 invalid-refresh 401) con `ValidationPipe` + `class-validator` funcionando. Aplicar la misma técnica a futuros paquetes NestJS del monorepo (ej. `apps/worker` cuando se añadan providers). En `nest build` (tsc) el problema no existe — emite metadata correctamente.

### D-F1-009 · `@Inject(Symbol)` con vitest plugin requiere `useFactory`, no `useClass`
- **Contexto:** El `JwtVerifierService` necesitaba inyectar `IDENTITY_CONFIG` (un `Symbol` token) en su constructor con `@Inject(IDENTITY_CONFIG)`. Aunque `@Inject(IdentityService)` (con class token) funcionaba correctamente en `AuthController`, `@Inject(Symbol)` lanzaba `Nest can't resolve dependencies of the JwtVerifierService2 (?)` en runtime. Síntoma adicional: el controller del test recibía `req: undefined` porque la metadata `__metadata("design:paramtypes", [Request])` no se emitía para parámetros sin decorador (`req: Request`) — se necesitaba `@Req()` explícito.
- **Decisión:** Convertir `JwtVerifierService` de `useClass` a `useFactory` provider (`provide: JwtVerifierService, inject: [IDENTITY_CONFIG], useFactory: (config) => new JwtVerifierService(config)`). Esto evita depender de la metadata emitida por el plugin para el constructor. Adicionalmente, los controllers de test deben usar `@Req() req: Request` (no solo `req: Request`) para que `__metadata("design:paramtypes", [Request])` se emita.
- **Consecuencia:** Los 7 tests de `tenant-context.e2e.test.ts` y los 7 tests de `isolation.e2e.test.ts` pasan. El patrón recomendado para providers con Symbol tokens en vitest: **preferir `useFactory` sobre `useClass` con `@Inject(Symbol)`**.

### D-F1-010 · Fase 1 completada (auth + RLS + isolation + UI)
- **Contexto:** Cierre de la Fase 1. Todas las 12 tareas del plan original completadas.
- **Decisión:** Marcar Fase 1 como ✅ Completada (100%). Tareas finales: middleware `TenantContextMiddleware` (D-F1-009 cubre el DI fix), guards `JwtGuard/RolesGuard/PermissionsGuard`, UI `/login` + `/dashboard` con `api-client.ts`, 7 tests de aislamiento multi-tenant. Verificación final: `pnpm lint/typecheck/test/build` 22-22-22-15 verde.
- **Consecuencia:** Se puede iniciar Fase 2 (Distribuidores, clientes y branding). `apps/api` ya tiene la base para añadir endpoints de `distributors`, `clients`, `agents` con `@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)` y `tenantFilter` en repositorios. El UI tiene el flujo de login + dashboard con roles; falta el dashboard específico de cada rol.

## Fase 2 — Distribuidores, clientes y branding

### D-F2-001 · Branding embebido en `distributors` (no tabla separada)
- **Contexto:** El schema Fase 2 necesita branding por distribuidor (logo URL, colores primario/secundario, custom domain, flag `whiteLabelEnabled`). Opciones: (a) tabla `distributor_branding` 1:1 con FK a `distributors`, (b) columnas embebidas en `distributors`, (c) JSONB `branding` con validación Zod.
- **Decisión:** Opción (b): columnas explícitas en `distributors`. Branding pertenece 1:1 con el distribuidor (no hay multi-branding per distributor), el set es finito y conocido (5 campos), y todos los campos son opcionales excepto el flag `whiteLabelEnabled` (boolean). Evita JOIN para queries de listado y simplifica el DTO.
- **Consecuencia:** `distributors` pasa de 9 columnas (Fase 1) a 14. El service `DistributorService.update` acepta `Partial<DistributorRecord>` y filtra `undefined` antes de hacer patch. Si en el futuro un distribuidor necesita multi-brand, se refactoriza a JSONB o tabla puente (no es un requisito MVP).

### D-F2-002 · RLS multi-rol vía subquery a `user_roles`
- **Contexto:** Las policies Fase 1 usaban `is_platform_super_admin()` (helper) y filtros simples (`platform_id = current_platform_id()`). Para Fase 2, distribuidor_admin/owner solo ven SU distribuidor y sus clientes; client_user solo ve SU cliente. Necesitamos chequear el rol del `current_user_id()` en `user_roles`.
- **Decisión:** Subquery `EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = current_user_id() AND r.slug IN ('distributor_owner', 'distributor_admin'))` para policies de `distributors`/`clients`. Helper `is_platform_admin_or_support()` como shortcut para platform_admin/platform_support. Las 8 policies nuevas (4 distributors + 4 clients) usan `USING` con `OR` entre condiciones: (super_admin) OR (admin/platform) OR (distributor owner/admin + distributor_id match) OR (client_user + client_id match).
- **Consecuencia:** RLS Fase 2 es laxa en scope (super_admin ve plataforma completa) pero estricta en aislamiento (un distributor_owner no ve otro distributor). Coherente con el modelo "tenantFilter en application + RLS en DB" establecido en D-F1-006. Si la lógica de roles se complica (jerarquías, overrides), será momento de migrar a una columna `effective_permissions` denormalizada en el JWT.

### D-F2-003 · Sincronización de backend A (driver) con backend B (MCP) para tests E2E
- **Contexto:** Confirmado que el proyecto Supabase tiene 2 backends Postgres distintos detrás de `db.lbbblakxgqzcfbzomsep.supabase.co` (round-robin DNS resuelve a `2600:1f16:15be:...:d29d` para el driver directo y `2600:1f16:1ce4:...:5079` para el MCP). Backend A tenía schema (Drizzle migrations) pero sin helpers, sin RLS, sin seed. Backend B tenía helpers+RLS+seed completo. Esto bloqueaba la ejecución de tests E2E reales (login contra DB, POST /clients 201) — el driver conecta a A que no tenía el seed.
- **Decisión:** Replicar el estado de B a A con un script Node.js ad-hoc (`packages/db/seeds/backend-a-rls-policies.sql` + aplicación secuencial vía driver): (1) 9 helper functions extraídas de `pg_proc` de B, (2) `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en las 9 tablas Fase 1, (3) 26 RLS policies recreadas con sus expresiones exactas, (4) `fase2-distributors-clients.sql` para tablas+policies Fase 2, (5) `fase1-baseline.sql` para el seed. El archivo `backend-a-rls-policies.sql` queda en `packages/db/seeds/` para reproducibilidad.
- **Consecuencia:** Backend A y B ahora responden igual a queries de aplicación. Los tests E2E ejecutan el happy path completo (login 200, GET distribuidores 2, POST client 201, cross-tenant 403). El login `super@acme-fabricante.test` / `AcmeTest2026!` ahora autentica contra el driver. Limitación: sigue siendo **infraestructural** — un reinicio del cluster o un cambio de IP pública podría desincronizar. Resolver de raíz requiere que Supabase unifique los backends o exponer un único endpoint (no es problema nuestro, es del lado de Supabase). El test e2e actual es **idempotente con datos limpios** (login + read-only + assertions sobre IDs del seed) excepto por `POST /clients` que acumula datos — los tests que dependen de count absoluto son frágiles (futuro: cleanup por sufijo `key` o `beforeEach` que borre `clients where key like 'test-%'`).

### D-F2-004 · Service `ClientService.list` prioriza `clientId` sobre `distributorId`
- **Contexto:** El tenant resolver Fase 1 (`tenant-resolver.ts`) prefiere CLIENT scope sobre DISTRIBUTOR sobre PLATFORM, por lo que el JWT para un `client_user` incluye ambos: `clientId` y `distributorId` (heredado del chain de scopes). El service `ClientService.list` original priorizaba `distributorId` → un client_user veía todos los clientes de su distribuidor (2), no solo el suyo (1). Esto filtraba información entre clientes del mismo distribuidor.
- **Decisión:** Invertir el orden: si `ctx.clientId !== null && !== undefined`, retornar solo ese cliente. Si no, si `ctx.distributorId`, retornar todos los del distribuidor. Si no, `[]`. Coherente con el principio "scope más restrictivo gana".
- **Consecuencia:** Aislamiento correcto entre clientes del mismo distribuidor. Coherente con la jerarquía de scopes del tenant resolver. El test `GET /clients como client_user lista solo su cliente` valida esto.


## Próximas decisiones por fase

- **Fase 1 (resto):** RLS policies concretas (qué tablas, qué claims leen, política para `is_platform_super_admin`). Endpoints de auth: rate limits, MFA flow, refresh rotation. UI web: rutas por rol.
- **Fase 2:** `distributor_id` legible o solo UUID, criterios de elegibilidad white-label.
- **Fase 3:** D-F0-013 (humanos consumen créditos), retención mínima antes de reversal, política de refunds.
- **Fase 4:** modelo exacto de OpenAI por defecto, `embedding` dimensiones, `top_k` inicial RAG.
- **Fase 6:** política de allowlist para outbound webhooks, formato de plantilla n8n.
- **Fase 7:** elección de BSP proveedor WhatsApp (Cloud API directa vs BSP como Twilio).

### D-F3-001 · Branding embed ya cubierto por D-F2-001
- **Contexto:** Esta entrada existía en el planning como pendiente para planes/payments.
- **Decisión:** Reutilizar el patrón de D-F2-001 (columnas embebidas en la entidad dueña) para Fase 3. No hay branding en esta fase. Se mantiene la nota de planning cerrada.
- **Consecuencia:** Cero overhead; consistencia con el patrón establecido.

### D-F3-002 · Commission rate default 20% exportado desde `@platform/db`
- **Contexto:** `commission_entries.commission_rate` es `numeric(5,4)`. Necesitamos un default para MVP que el código de aplicación pueda referenciar sin hardcodear el literal.
- **Decisión:** Exportar `DEFAULT_COMMISSION_RATE = '0.20'` desde `packages/db/src/schema/billing.ts`. El valor se inyecta al crear `commission_entries` desde `PaymentsService.recordCommission`. La columna tiene `DEFAULT 0.20` en el SQL como safety net.
- **Consecuencia:** Punto único de cambio. Si en el futuro la comisión se vuelve por plan o por distribuidor, se introduce `commission_rates` y se depreca este default.

### D-F3-003 · Webhook público con HMAC SHA-256 y raw body parsing
- **Contexto:** `POST /api/v1/webhooks/payments` lo invoca el provider (Mock en este MVP, Stripe en el futuro) sin JWT. Necesitamos autenticación por firma para evitar spoofing, y verificar el body crudo (no el JSON re-serializado) porque cualquier cambio de espacios/newlines invalida la firma.
- **Decisión:** (1) `WebhooksController` sin `JwtGuard`, header `x-mock-signature`, (2) `MockPaymentProvider.signBody(body, secret) = HMAC-SHA256(body).hexdigest()`, (3) `app.use('/api/v1/webhooks', raw({ type: '*/*', limit: '1mb' }))` antes de los controllers Nest, popula `req.body` como Buffer y `req.rawBody = body.toString('utf8')`, (4) `verifyWebhook` con `crypto.timingSafeEqual` para evitar timing attacks. La firma se valida con el secret leído de `process.env.PAYMENT_MOCK_SECRET` (mínimo 16 chars, validado en constructor).
- **Consecuencia:** Webhook seguro contra replay/tampering. Migración a Stripe es trivial: solo se cambia `MockPaymentProvider` por `StripePaymentProvider` y se ajusta el header (`stripe-signature` en lugar de `x-mock-signature`).

### D-F3-004 · Idempotency key en `payments` vía columna UNIQUE
- **Contexto:** El cliente puede llamar `POST /payments/checkout` múltiples veces con la misma intención. Necesitamos deduplicación a nivel de DB.
- **Decisión:** Columna `idempotency_key text UNIQUE` en `payments`. `DrizzlePaymentRepository.createPayment` recibe el `idempotencyKey` y lo usa como discriminador. El servicio genera `randomUUID()` si el cliente no provee uno. El endpoint `POST /payments/checkout` acepta opcional `idempotencyKey` en el body; si se omite, el service lo genera y lo retorna en la respuesta como `providerReference` (formato `mock_ch_<uuid>`).
- **Consecuencia:** Reintentos de red del cliente no duplican pagos. Único índice compuesto podría ser `(provider, provider_payment_id)` para reconciliación con el provider, pero se mantiene simple en MVP (provider_payment_id ya es UNIQUE por provider).

## Fase 4 — Motor de agentes y conocimiento (KB + RAG + chat E2E)

### D-F4-001 · Drop de tablas pre-existentes no multi-tenant (`agents`/`agent_versions`/`conversations`/`messages`)
- **Contexto:** La DB ya tenía tablas `agents`, `agent_versions`, `conversations` y `messages` con un schema previo que usaba un `tenant_id` singular (sin split `platform_id`/`distributor_id`/`client_id`) y sin FK a `platforms`/`distributors`/`clients`. Reusar esas tablas requería un ALTER complejo o mantener compatibilidad dual, ambas opciones frágiles.
- **Decisión:** Aplicar `fase4_drop_pre_existing_agents_conversations` (DROP TABLE con CASCADE) antes de crear las tablas con el schema correcto. La migración queda registrada en `supabase_migrations.schema_migrations` como evidencia para auditoría.
- **Consecuencia:** El nuevo schema (7 tablas multi-tenant: `agents`, `agent_versions`, `knowledge_bases`, `documents`, `chunks`, `conversations`, `messages`) es coherente con el resto del monorepo (Fase 1-3). Sin datos legacy que migrar. Cualquier script de `backend-a-rls-policies.sql` debe actualizar si replica Fase 4 (D-F1-003 + D-F2-003 vuelven a aplicar — ver siguiente fase).

### D-F4-002 · DI con `@Inject(Symbol)` para providers de modelo y embedding
- **Contexto:** `OpenAIModelProvider` y `MockModelProvider` implementan las mismas interfaces `ModelProvider` y `EmbeddingProvider`. Si el módulo los registra como `useClass` NestJS no puede distinguirlos (mismo class). Y `@anatine/esbuild-decorators` (D-F1-008) emite metadata limitada para parámetros con tipos Symbol → `Nest can't resolve dependencies of the X2 (?)` en runtime.
- **Decisión:** Definir tokens `Symbol` en archivo separado `agent.tokens.ts` (`MODEL_PROVIDER`, `EMBEDDING_PROVIDER`) para evitar import circular con `agent.module.ts`. Registrar dos `useFactory` providers que devuelven `MockModelProvider` o `OpenAIModelProvider` según `process.env.MODEL_PROVIDER === 'mock'`. En los services usar `@Inject(MODEL_PROVIDER) modelProvider: ModelProvider` para forzar la resolución vía token. Si `MODEL_PROVIDER !== 'mock'` y falta `OPENAI_API_KEY`, fallar rápido en `useFactory` con mensaje claro.
- **Consecuencia:** El switch mock↔OpenAI es trivial (`env var`). El código de aplicación es agnóstico al provider. Los tests E2E corren con `MODEL_PROVIDER=mock` (determinista, sin red, sin coste). Migración a otros proveedores (Anthropic, Mistral) = añadir un nuevo provider + su factory.

### D-F4-003 · RAG simple: top-k cosine con threshold de relevancia mínimo
- **Contexto:** El prompt maestro menciona RAG con pgvector. Las opciones: (a) top-k sin threshold (ruido si el score es bajo), (b) top-k + threshold fijo (0.5), (c) top-k + threshold relativo al mejor score. Para MVP, queremos baja latencia y resultados útiles incluso con embeddings mock.
- **Decisión:** Pipeline `(embed query) → SELECT chunks WHERE client_id AND knowledge_base_id = ANY($kb) ORDER BY embedding <=> $vec LIMIT topK` → filtrar `score >= 0.05` (MIN_RELEVANCE) → formatear contexto `[#N doc=... pos=... score=...]` → inyectar en system prompt. `topK` por defecto 4, configurable via `modelParameters['topK']`. `knowledgeBaseIds` se pasa también vía `modelParameters` (array de UUIDs) en lugar de un FK explícito → permite que un agent use N KBs sin reescribir schema.
- **Consecuencia:** La retrieval funciona con embeddings mock (`MockEmbeddingProvider`) porque el threshold es muy bajo. Migración a OpenAI embeddings = cambiar provider, no tocar runtime. Si el retrieval es ruidoso en producción, se sube `MIN_RELEVANCE` o se añade re-ranking (Fase 5+).

### D-F4-004 · Vector custom type Drizzle con `vector(1536)` y formato `[a,b,c]`
- **Contexto:** pgvector no es first-class en Drizzle. La columna `chunks.embedding` debe ser `vector(1536)` (OpenAI text-embedding-3-small). Drizzle default trata dimensiones fijas como `customType`.
- **Decisión:** `customType<{ data: number[]; driverData: string }>` con `dataType() => 'vector(1536)'`, `toDriver(v) => [${v.join(',')}]`, `fromDriver(v) => v.slice(1, -1).split(',').map(Number.parseFloat)`. Defaults `embedding_model = 'openai:text-embedding-3-small'` y `embedding_dimensions = 1536` en `knowledge_bases`. Tests de carga usan `array_fill(0.1, ARRAY[1536])::vector` (Postgres nativo) para los 2 chunks del seed de demo.
- **Consecuencia:** `DrizzleChunkRepository.createBatch` recibe `embedding: number[]` y se serializa correctamente. Si en el futuro se migra a text-embedding-3-large (3072 dims), se cambia el DDL + el default; el código de aplicación no se entera (el `modelProfile` ya está parametrizado).

### D-F4-005 · Chunking por caracteres (no tokens) en MVP
- **Contexto:** Para ingestar documentos en chunks necesitamos definir un splitter. Opciones: tiktoken (cuenta tokens reales pero añade dependencia pesada), split por caracteres con heurística (rápido, ~4 chars/token), o sentence-based (más caro).
- **Decisión:** `chunkText(text, maxChars=800, overlap=100)` — divide por `maxChars` con solapamiento. `tokenCount = Math.ceil(content.length / 4)`. Es un MVP: precisión por debajo del real (OpenAI usa ~4 chars/token pero varía por idioma), pero suficiente para el demo.
- **Consecuencia:** Sin dependencia de tiktoken. Latencia de ingest predecible. Si en el futuro se necesita precisión, se sustituye por `tiktoken` o `gpt-tokenizer` en el mismo punto (un solo `function chunkText`).

## Fase 5 — Widget y conversaciones

### D-F5-001 · Widget bundle vanilla TS sin framework (IIFE+ESM, ~7.7KB)
- **Contexto:** El widget embebible debe vivir en páginas HTML de terceros con cero dependencias. Opciones: React bundle (pesado, ~45KB gzipped), Preact (más liviano pero suma una dependencia), vanilla TS (mínimo tamaño, control total).
- **Decisión:** `apps/widget/src/widget.ts` en TS sin frameworks. `tsup` genera `dist/index.global.js` (IIFE, `globalName: 'PlatformWidget'`, 7.8KB) y `dist/index.js` (ESM, 7.4KB) con minify+sourcemap. La API pública es `window.PlatformWidget.init(publicWidgetId, {apiUrl, primaryColor, position, title, welcomeMessage})`. DOM creado con helper `el(tag, attrs, children)`. Estilos inline en `<style>` único (no cargar CSS externo). localStorage para persistir `externalConversationId` por `publicWidgetId`.
- **Consecuencia:** Bundle embebible de 7.7KB minified (sin gzip). Sin hydration cost. Funciona en cualquier navegador moderno. Limitación: el widget reimplementa un chat mínimo a mano (no aprovecha el sistema de componentes de la web). Si en el futuro se quiere compartir componentes web↔widget, se extraen a un paquete `@platform/widget-ui` con vanilla TS.

### D-F5-002 · `public_widget_id` columna UNIQUE con índice parcial
- **Contexto:** El widget se identifica con un string público distinto del UUID interno (los clientes lo pegan en `<script>` y no debe exponer IDs de base de datos). Opciones: (a) JWT con claim custom por `clientId+agentId`, (b) string aleatorio con lookup directo, (c) URL firmado con expiración.
- **Decisión:** `agents.public_widget_id varchar(32) NOT NULL UNIQUE` con índice parcial `WHERE public_widget_id IS NOT NULL`. Formato: `wgt_` + 24 chars hex (UUID v4 sin guiones). Se genera en `AgentsService.create` automáticamente (no expuesto en POST body). Endpoint público `GET /api/v1/widget/:publicWidgetId/config` y `POST .../chat` no requieren JWT pero filtran `archivedAt IS NULL` y `state='PUBLISHED'` (404 si no).
- **Consecuencia:** Lookup O(1) por `publicWidgetId`. No fugas UUIDs internos. Si el agente se archiva o despublica, el widget deja de funcionar instantáneamente (404 desde el config). Para rotación: un endpoint futuro de `POST /agents/:id/regenerate-widget-id` con soft-rotation (histórico en tabla aparte).

### D-F5-003 · Endpoints `/widget/*` con `TenantContext` anónimo (sin `JwtGuard`)
- **Contexto:** El navegador del cliente final no tiene token JWT. El servidor necesita un contexto mínimo para crear conversaciones y mensajes sin que el cliente envíe un token de la plataforma. Opciones: (a) endpoint sin contexto (insert directo con `clientId` derivado del agent), (b) TenantContext sintético con rol `widget_anonymous`.
- **Decisión:** El controller salta `JwtGuard` (no hay Authorization header). Internamente `WidgetService` busca el agent por `publicWidgetId`, extrae `clientId` y `agentId`, y construye un `TenantContext` sintético: `roles: ['widget_anonymous']`, `permissions: ['chat:write']`, `isSupportSession: false`, `isPlatformSuperAdmin: false`. La sesión se trata como un "visitante anónimo" pero el `clientId` permite que las políticas RLS filtren correctamente (no cruzando tenants).
- **Consecuencia:** RLS funciona sin código custom. El `WidgetService` no necesita burlar políticas. Límite: solo el `publicWidgetId` autoriza; no hay rate limit por IP (se añadirá en Fase 8 con Redis).

### D-F5-004 · `humanReply` y `closeConversation` rechazan conversaciones en estado terminal
- **Contexto:** Una conversación cerrada o resuelta no debería aceptar replies humanos (solo reabrir la conversación manualmente). Opciones: (a) permitir siempre (estado mutable), (b) rechazar con 400 si está CLOSED/RESOLVED, (c) auto-reabrir.
- **Decisión:** `humanReply` lanza `CONVERSATION_CLOSED` (400) si la conversación está en estado `CLOSED` o `RESOLVED`. `closeConversation` es idempotente (200 si ya está cerrada, no 409). El frontend muestra un banner de "conversación cerrada" y oculta el form.
- **Consecuencia:** Comportamiento determinista. El UI refleja el estado sin ambigüedad. Reabrir requiere un endpoint futuro `POST /conversations/:id/reopen` (Fase 8 cuando se implemente SLA).

### D-F5-005 · Widget bundle servido por Next.js Route Handler con soporte Range
- **Contexto:** El widget.js debe servirse desde el mismo origen que la app Next.js (CORS-friendly). Opciones: (a) copiar el bundle a `apps/web/public/`, (b) Route Handler que lee `apps/widget/dist/index.global.js` dinámicamente, (c) CDN.
- **Decisión:** Route Handler en `apps/web/src/app/widget.js/route.ts` (`dynamic = 'force-dynamic'`) lee `process.cwd()/../widget/dist/index.global.js` y devuelve con `Content-Type: application/javascript; charset=utf-8`, `Cache-Control: public, max-age=300, s-maxage=300`. Soporta `Range: bytes=X-Y` (206 con `Content-Range`) para reuso de cache en CDN. Si el bundle no existe (503) devuelve un shim con `console.error` indicando ejecutar `pnpm --filter @platform/widget build`.
- **Consecuencia:** Cero acoplamiento de builds (Next no necesita saber cuándo se reconstruye el widget). Cache de 5 min mitiga cold-starts. El shim 503 evita 500 confusos cuando alguien despliega la web sin el widget.

## Fase 6 — Webhooks y n8n

### D-F6-001 · Webhooks salientes con HMAC SHA-256 timestampado + idempotency_key
- **Contexto:** Los webhooks salientes deben ser verificables y tolerantes a duplicados. Opciones: (a) HMAC del body solo (vulnerable a replay), (b) HMAC + timestamp + nonce, (c) firmas JWT (más costosas).
- **Decisión:** `signBody(body, secret, timestamp) = HMAC-SHA256(\`${timestamp}.${body}\`)`. El receptor verifica con `crypto.timingSafeEqual` (constante en tiempo). Header `X-Platform-Signature: t=${timestamp},v1=${signature}` (formato Stripe-like). Cada evento tiene `idempotency_key` UNIQUE por `client_id`; `WebhookDispatcherService.emit` retorna `null` si la key ya existe, evitando duplicar fan-out. La key se construye determinista: `agent-published:${agentVersionId}`, `conv-started:${conversationId}`, `conv-closed:${conversationId}:${closedAt}`, `human-reply:${messageId}`. `test` (manual) usa `test-${endpointId}-${Date.now()}` (no idempotente, intencional).
- **Consecuencia:** Compatible con n8n/W zapier-like receivers sin código custom. Receptor puede rechazar eventos antiguos (`timestamp < 5min`). Replay-safe. Costo: una fila extra en `webhook_events` por evento emitido.

### D-F6-002 · Outbox processor in-process con retry exponencial y DLQ
- **Contexto:** Las deliveries pueden fallar (red, timeout, 5xx). Opciones: (a) reintento síncrono en el mismo request (bloquea cliente), (b) cola externa (BullMQ + Redis, pesado), (c) polling en el mismo proceso.
- **Decisión:** `WebhookOutboxProcessor` extiende `OnModuleInit`/`OnModuleDestroy`. Activa `setInterval(tick, process.env.WEBHOOK_OUTBOX_INTERVAL_MS ?? 5000)`. Cada tick: `dispatcher.processDue(batch=25)` → toma rows con `status IN (PENDING, IN_FLIGHT) AND (nextRetryAt IS NULL OR nextRetryAt < now())`. Backoff: `[0, 60s, 5m, 30m, 2h, 12h]` (constante `RETRY_BACKOFF_MS` en SDK). 410/404 → DLQ inmediato (endpoint gone, no reintentar). 2xx → SUCCEEDED. 5xx/network → PENDING con `nextRetryAt = now + delay`. Máximo 6 intentos → DLQ. Tests desactivan el scheduler con `WEBHOOK_OUTBOX_INTERVAL_MS=0` y disparan `dispatcher.attemptDelivery(delivery)` directamente.
- **Consecuencia:** Cero infra extra (no BullMQ en MVP). Worker escala con el proceso API. `setInterval.unref()` evita bloquear el shutdown de Node. Limitación: si la API tiene 2 réplicas, los retries pueden duplicarse; mitigado por `idempotency_key` y `attempt_count` optimista (Fase 8 migraría a BullMQ + Redis).

### D-F6-003 · `HttpDeliveryClient` como interface mockeable (sin acoplar a `fetch`)
- **Contexto:** El dispatcher hace HTTP saliente. Opciones: (a) `fetch` global (no testeable sin red), (b) `HttpClient` de Nest (overhead), (c) interface propia inyectada.
- **Decisión:** `@platform/webhook-sdk` exporta `HttpDeliveryClient { post(req): Promise<{statusCode, body}> }`. `WebhookOutboxProcessor` provee un `realHttpClient` que usa `fetch` con `AbortController` (timeout 10s) y headers `Content-Type: application/json` + `X-Platform-Signature` + `X-Platform-Event-Id` + `X-Platform-Event-Attempt`. En tests, `MockHttpClient` (clase con `sent[]`, `statusCode`, `fail`) se inyecta vía `Test.createTestingModule(...).overrideProvider(DISPATCHER_HTTP).useValue(mockHttp)`.
- **Consecuencia:** Tests E2E verifican headers y body sin tocar red. 13 tests verdes deterministas. Si en el futuro se quiere rate-limit por IP o circuit-breaker, se envuelve el `realHttpClient` en un decorator (mismo interface).

### D-F6-004 · RLS por `client_id` con bypass `service_role` para writes
- **Contexto:** `webhook_endpoints` lo gestiona el cliente vía UI; `webhook_events`/`webhook_deliveries` los escribe el API server (no el cliente directamente). RLS debe permitir SELECT al cliente autenticado pero restringir INSERT/UPDATE al backend.
- **Decisión:** `webhook_endpoints` y `webhook_deliveries`/`webhook_events` con `ENABLE ROW LEVEL SECURITY`. Policy SELECT para `authenticated` filtra `client_id = current_setting('request.jwt.claims.client_id') OR is_platform_super_admin = true`. Policy ALL para `service_role` (usada por Drizzle/Node-Postgres con la service role key) sin filtro. Las writes del API server pasan por service role, las reads del cliente por authenticated.
- **Consecuencia:** Un cliente JWT solo ve sus endpoints/deliveries. El backend puede crear filas para cualquier client (sin saltarse RLS, solo cambia rol). Tests verifican aislamiento cross-tenant (Fase 1/2 ya tienen `isolation.e2e.test.ts` con 7 tests).

### D-F6-005 · URL allowlist anti-SSRF (bloquea localhost y metadata IPs)
- **Contexto:** Un atacante podría crear un endpoint apuntando a `http://169.254.169.254/latest/meta-data/` (AWS IMDS) o `http://localhost:5432` (Postgres) para hacer SSRF. Opciones: (a) solo HTTPS público, (b) allowlist de dominios, (c) reject privado.
- **Decisión:** `validateUrl` rechaza: (a) URLs que no matchean `^https?://`, (b) hostnames que contienen `localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.`, `::1`, `metadata.google.internal`. Solo dominios públicos. En producción se complementará con allowlist explícita (Fase 8 hardening). El secret HMAC se genera con `crypto.randomBytes(24).toString('hex')` (48 chars).
- **Consecuencia:** Riesgo SSRF mitigado en MVP. Limitación: dominios DNS rebinding pueden evadir el check; mitigación real requiere resolver DNS y revalidar por IP antes de cada request (Fase 8).


### D-F7-001 · ChannelAdapter interface + NormalizedMessage como contrato interno
- **Contexto:** Múltiples canales (WhatsApp/Telegram/Messenger/Instagram) producen payloads radicalmente distintos. La opción obvia es un `ChannelAdapter` con `verifyConnection/parseInboundEvent/sendMessage/downloadMedia/getDeliveryStatus`. El output de `parseInboundEvent` debe ser uniforme para que el API server no ramifique por canal.
- **Decisión:** Nuevo package `@platform/channel-adapters` con `ChannelAdapter` interface (5 métodos, retorna `ConnectionStatus/DeliveryStatus/ChannelSendResult/DownloadedMedia`). Tipo de retorno `NormalizedMessage[]` con `id/providerEventId/platformId/clientId/channelConnectionId/channel/externalConversationId/externalMessageId/sender{externalId,displayName,phone,email}/recipient/text/attachments[]/rawPayload` — reusado de `@platform/contracts` (Zod schema). `MockWhatsappAdapter` parsea el payload WhatsApp Business API (entry/changes/value/messages/contacts/text.body) y normaliza a `NormalizedMessage[]`. Para Fase 7, los canales reales (Twilio, Meta Cloud API, Telegram Bot API) son stubs que tiran `NOT_IMPLEMENTED`; la lógica real es Fase 8.
- **Consecuencia:** El API server solo conoce `NormalizedMessage` y el `ChannelAdapter` interface. Añadir un nuevo canal es un nuevo adapter que implemente la interface + registro en `buildDefaultRegistry()`. Tests E2E usan exclusivamente el `MockWhatsappAdapter` (datos deterministas, `MOCK_WHATSAPP_PHONE_PREFIX='+15555550'`). Schema (`channel_connections`/`message_deliveries`) y webhook handler son agnósticos al canal.

### D-F7-002 · MockWhatsappAdapter como default registry en Fase 7
- **Contexto:** Necesitamos que el sistema funcione end-to-end sin credenciales reales de Meta/Twilio/Telegram. Pero el código no debe ser "mock-aware" en producción.
- **Decisión:** `buildDefaultRegistry()` instancia `MockWhatsappAdapter` por defecto. `MockWhatsappAdapter` valida credenciales (`api_key >=8 chars`, `phone_number_id >=3 chars`) y rechaza con `ERROR`. `InMemoryMockWhatsappStorage` permite `failNextSend` para forzar errores en tests y `setStatus`/`getStatus` para simular SENT→DELIVERED→READ. En producción (Fase 8) `buildDefaultRegistry` consultará `process.env.CHANNEL_ADAPTERS` o factory por provider para cargar adapters reales. El `sendMessage` del mock retorna `providerMessageId='wamid.${random}'` para que las deliveries sean visibles inmediatamente.
- **Consecuencia:** El widget embebido y los canales coexisten sin bifurcación de código. Los tests E2E reproducen el flujo completo (inbound webhook → conversación INBOUND → humanReply → outbound delivery) sin mocks adicionales. La única mockificación es del `HttpDeliveryClient` (webhooks) y del `MockWhatsappAdapter` (canales), ambos behind interfaces.

### D-F7-003 · Webhook público por canal con HMAC SHA-256 formato `sha256=...`
- **Contexto:** WhatsApp/Meta firma los webhooks con `X-Hub-Signature-256: sha256=<digest>` calculado sobre el body crudo. Telegram usa `X-Telegram-Bot-Api-Secret-Token`. Messenger e Instagram variantes. La verificación exige acceso al body crudo (Express por defecto lo parsea).
- **Decisión:** Endpoint `POST /channels/:channel/webhook` público (sin JwtGuard), `req.rawBody` se popula con middleware `raw({type:'*/*', limit:'1mb'})` aplicado en `main.ts` antes del `setGlobalPrefix`. El header esperado es `x-channel-signature: sha256=<hmac_hex>` (formato idéntico a Meta para que los SDKs existentes del lado del cliente no necesiten cambios). `verifyWebhookSignature(body, header, secret)` con `crypto.createHmac('sha256', secret).update(body).digest('hex')` y comparación `crypto.timingSafeEqual` contra el digest esperado. Falla con 401 si firma inválida, body sin `connectionId` o `connectionId` desconocido. Se acepta un header opcional `x-channel-event-id` para idempotencia (Fase 8: dedupe por `providerEventId` UNIQUE).
- **Consecuencia:** Verificación cryptographically sound. El middleware `raw` solo aplica a `/api/v1/channels/*` para no penalizar performance del resto (parseo JSON normal). El handler exige `connectionId` + `agentId` en el body — el provider debe incluirlos al retransmitir el webhook (mapping interno del lado del cliente). Tests E2E cubren: firma válida (200 + conversación creada), firma inválida (401), connectionId desconocido (401), sin connectionId (401), webhook con payload que el adapter no reconoce (200 received=0).

### D-F7-004 · Wire outbound opcional desde ConversationsService con `@Optional()`
- **Contexto:** Cuando un agente humano responde en una conversación de canal (no WIDGET), el cliente espera que el mensaje salga por el canal original (WhatsApp, etc.), no por el widget. Pero `ChannelMessagesService` es una dependencia que no debe romper el chat widget (que es el 99% del tráfico).
- **Decisión:** `ConversationsService` recibe `@Optional() private readonly channelMessages?: ChannelMessagesService` en el constructor. En `humanReply` y `startChat` se llama `void this.channelMessages?.sendOutbound(ctx, conversation, message).catch(() => undefined)` después de la persistencia. Si `channelMessages === undefined` o el adapter falla, la respuesta humana se persiste igual (fire-and-forget). `sendOutbound` retorna `null` si `conversation.channel === 'WIDGET'` o si no hay conexión activa para ese canal (no-op). Si el adapter falla, `markFailed(deliveryId, code, message)` persiste el error en `message_deliveries` para visibilidad.
- **Consecuencia:** El chat widget sigue funcionando idéntico aunque el módulo de canales no esté configurado. Cuando un cliente habilita WhatsApp, automáticamente las respuestas humanas de conversaciones WhatsApp salen por WhatsApp. Las deliveries se trackean con `message_deliveries` (QUEUED → SENT → DELIVERED → READ → FAILED) y se exponen en `/dashboard/channels/[id]`. El wire es `void promise.catch(() => undefined)` (no `await`) para no añadir latencia a la respuesta HTTP.

### D-F7-005 · Tokens Symbol para registries e interfaces inyectables via useFactory
- **Contexto:** `ChannelAdapterRegistry` es una clase concreta (no abstract) pero su instanciación requiere configuración externa (qué adapters cargar, según env). Los repos Drizzle también se construyen con `db` y se reutilizan entre módulos. NestJS permite providers con `useFactory` + `inject: []`, pero los `inject` pueden usar la clase como token solo si la clase está provista con un `useClass` o `useValue` — no con `useFactory` con la misma clase como `provide` (NestJS asume `new Provider()`).
- **Decisión:** Tokens Symbol separados del provider: `CHANNEL_ADAPTER_REGISTRY = Symbol.for('platform.api.channels.adapterRegistry')` exportado desde `channels.tokens.ts` (archivo aparte para evitar ciclo con `channels.module.ts` que exporta el token y los consumers lo importan). Providers del módulo: `registryProvider: { provide: CHANNEL_ADAPTER_REGISTRY, useFactory: () => buildDefaultRegistry() }`. Consumers (`ChannelConnectionsService`, `ChannelMessagesService`, `ChannelsInboundProcessor`) usan `@Inject(CHANNEL_ADAPTER_REGISTRY) private readonly registry: ChannelAdapterRegistry` para que NestJS busque el provider por symbol. Mismo patrón que `DATABASE` en `DatabaseModule` (que es `@Global()`). Adicionalmente: los repos Drizzle (`DrizzleChannelConnectionsRepository`, `DrizzleMessageDeliveriesRepository`) se proveen con `provide: <class>, useFactory: (db) => new XRepository(db), inject: [DATABASE]` — no symbols, para permitir que `AgentModule` exporte los repos de conversaciones y `ChannelsModule` los reutilice sin duplicación.
- **Consecuencia:** DI determinista sin `Object` errors de reflection. Los services nuevos (`ChannelConnectionsService`, `ChannelMessagesService`) **requieren `@Injectable()` decorator** (olvidarlo produce "Nest can't resolve dependencies" con tipo `Object` en runtime — el plugin esbuild-decorators solo emite `design:paramtypes` si la clase está marcada). Los controllers también requieren `import { Service } from './service.js'` (no `import type { Service }`) — `import type` borra la referencia en compile time y NestJS no encuentra la clase via reflection. **Lección transferible a Fase 8**: cualquier service o controller nuevo debe tener `@Injectable()`/`@Controller()` y los consumers deben usar value imports para los tipos que se inyectan.

### D-F8-001 (Fase 8a): Encryption at rest con AES-256-GCM + AAD binding

- **Contexto:** Los secrets HMAC de webhooks y los credenciales de canales (WhatsApp/Telegram/Instagram) se almacenaban en columnas en claro (`varchar(64)`/`jsonb`). Un atacante con acceso SQL (vía RLS bypass, snapshot leak, o backup) podría exfiltrar todos los secrets y credenciales de todos los clientes.
- **Decisión:** Package nuevo `@platform/encryption` con `encryptString(plaintext, aad)` y `decryptString(ciphertext, aad)`. Algoritmo: AES-256-GCM (NIST-approved AEAD). Key de 32 bytes desde `process.env.PLATFORM_ENCRYPTION_KEY` (hex-encoded, fail-fast en boot si no está). Formato payload: `iv (12 bytes) | tag (16 bytes) | ciphertext` joined por `.` y base64. **AAD (Additional Authenticated Data)** es el contexto de uso (`webhook_endpoint:${id}`, `channel_connection:${id}`) — esto liga criptográficamente el ciphertext a su dueño: un atacante que copie un ciphertext de un endpoint a otro registro no puede descifrarlo. Esquema: `webhook_endpoints.secret_ciphertext text NOT NULL` (renombrado de `secret varchar(64)`), `channel_connections.credentials_ciphertext text NOT NULL DEFAULT ''` (renombrado de `credentials jsonb`), `channel_connections.webhook_secret_ciphertext text NOT NULL` (renombrado de `webhook_secret varchar(64)`). El índice `webhook_endpoints_secret_idx` se droppeó (el ciphertext no es unique). `DrizzleClientsRepository.setWebhookAllowedHosts` aplica normalización server-side adicional. En el API startup (`main.ts`) si falta la env, NestJS falla con mensaje explícito. En tests, `setEncryptionKeyForTests(Buffer.alloc(32, n))` permite inyectar key determinística. Doble-encriptación en `create`: insert con AAD `__pending__` (porque el `id` aún no existe), luego update con AAD real `webhook_endpoint:${id}`.
- **Consecuencia:** Secret leakage mitigado en caso de SQL dump. Rotación de key requiere re-encriptar todas las filas (operación one-off scriptable). Performance: ~50µs por encrypt/decrypt (no bottleneck en deliveries). Si se pierde `PLATFORM_ENCRYPTION_KEY`, todos los secrets son irrecuperables — la key debe respaldarse en KMS/Secrets Manager. **Tradeoff explícito**: ciphertexts ~40% más grandes que plaintext (formato `iv.tag.ct`).

### D-F8-002 (Fase 8b): Allowlist per-client con wildcards + utility pura

- **Contexto:** Antes de Fase 8, el `validateUrl` solo bloqueaba literales (localhost, 169.254, etc.) — cualquier dominio público era aceptable. Un atacante que comprometiera un distributor o client_owner podría crear un endpoint webhook a un dominio bajo su control y exfiltrar eventos.
- **Decisión:** Nueva columna `clients.webhook_allowed_hosts text[] NOT NULL DEFAULT []`. Validación client-side (al crear/actualizar endpoint) y server-side (en `WebhookEndpointsService.create`/`update`/`rotateSecret`/`test`). Utility pura en `@platform/contracts/hostnames.ts`: `normalizeHostname(raw) → {host, wildcard} | null` (lowercase, strip dots, valida labels RFC 1123, soporta `*.example.com` pero NO nested wildcards), `normalizeHostList(raw[]) → string[]` (dedup case-insensitive, max 200 hosts, lanza `HostnameValidationError` con código machine-readable), `checkUrlAgainstAllowlist(url, allowlist) → {ok, code, message}` (rechaza schemes no http(s), bloquea literales privados v4/v6, valida host contra allowlist con matching exacto o wildcard sub-only — apex NO matchea wildcard). Si allowlist está vacía: solo `https://` permitido, sin literales privados. API: `GET /api/v1/clients/:id/webhook-allowed-hosts` + `PATCH /api/v1/clients/:id/webhook-allowed-hosts` con `UpdateWebhookAllowedHostsDto {hosts: string[]}` (validado con `@IsArray @ArrayMaxSize(200)`). `ClientService.getWebhookAllowedHosts/updateWebhookAllowedHosts` aplica `assertCanRead/assertCanWrite` (mismo tenant) y mapea `HostnameValidationError → BadRequestException` preservando el `code` machine-readable. UI `/dashboard/webhooks/allowlist` con chips clickables (× para eliminar), validación client-side básica, selector de cliente si distributor_admin. `EndpointWithSecret` ahora retorna `{dto, secret, allowlist[]}` reflejando la allowlist persistida (no la del request).
- **Consecuencia:** Los endpoints existentes con `clients.webhook_allowed_hosts = []` requieren configuración antes de Fase 8 rollout (o `https://` exclusivamente). El test de allowlist se valida contra `clients.webhook_allowed_hosts` server-side, no contra el input del request — el input se normaliza y el resultado se persiste, así que no hay drift entre el dominio "permitido" que ve el cliente y el que se valida en `attemptDelivery`. Tests E2E: 7 (happy, invalid, too-large, normalization, 403, super_admin). **Decisión deliberada**: la allowlist es per-client (no per-endpoint) para evitar explosión combinatorial de reglas; si un cliente quiere un endpoint que apunte a un host no listado, debe primero añadir el host a su allowlist. Audit log (Fase 8e) registrará los cambios.

### D-F8-003 (Fase 8c): DNS pre-resolution anti-rebinding + IP classification

- **Contexto:** El allowlist per-client (D-F8-002) valida el hostname textual del endpoint. Pero un atacante con un dominio bajo su control puede: (1) configurar el dominio en su allowlist inicialmente, (2) hacer que el dominio resuelva a una IP pública válida en el check inicial, (3) cambiar el registro DNS a una IP privada (10.x, 169.254.169.254 para AWS metadata) justo antes de que el dispatcher intente la entrega. Este ataque se llama DNS rebinding y bypasea el allowlist por completo. Además, los resolvers DNS locales del container pueden envenenarse.
- **Decisión:** Package nuevo `@platform/url-safety` con `resolveAndCheck(url, options) → {ok, ips, matchedRule?}` o `{ok:false, code, message}`. Algoritmo: (1) parse URL + valida scheme http/https, (2) bloquea literales `localhost`, `metadata.google.internal`, `metadata`, (3) si allowlist presente: matching exacto o wildcard sub-only, (4) **DNS lookup via `node:dns.promises.lookup(hostname, {all:true, verbatim:true})`** para obtener TODAS las IPs, (5) para cada IP, clasifica con `isPrivateIP`: IPv4 privadas (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0/8, >=224), IPv6 privadas (::1, ::, fc00::/7 ULA, fe80::/10 link-local, ff00::/8 multicast, ::ffff:x.x.x.x v4-mapped), (6) si **alguna** IP es privada → `URL_PRIVATE_IP` (anti multi-A record attack: el atacante publica 2 A records, uno público y uno privado; basta con que una resuelva a privado para rechazar). En el `main.ts` se fuerza `dns.setServers(['1.1.1.1', '8.8.8.8'])` (Cloudflare + Google DNS públicos) para evitar DNS poisoning por resolvers locales (configurable con `URL_SAFETY_CUSTOM_DNS=1` para tests). Integración en `WebhookDispatcher.attemptDelivery`: antes del `http.post`, llama al `urlSafety` con la allowlist del cliente; si falla, marca la delivery como `DLQ` con mensaje que incluye el código (`URL_HOST_BLOCKED`, `URL_PRIVATE_IP`, `URL_NOT_IN_ALLOWLIST`, `DNS_LOOKUP_FAILED`, `URL_NOT_HTTPS`, `URL_INVALID_SCHEME`, `URL_INVALID`). `DispatcherDeps` ahora incluye `urlSafety: UrlSafetyChecker` (interfaz inyectable para testabilidad) + `getClientAllowlist: (clientId) => Promise<readonly string[]>` (función, no la clase, para evitar acoplar al DrizzleClientsRepository directamente).
- **Consecuencia:** Costo: ~5-50ms por delivery (DNS lookup). Mitigable con cache de resolución (TTL-based) en una iteración futura. La delivery se marca `DLQ` (no retry) cuando el destino es privado — no tiene sentido reintentar. Los tests E2E del dispatcher mockean el resolver (`resolver: async () => ['10.0.0.5']`) para validar el comportamiento sin depender de DNS. La `defaultUrlSafetyChecker` se inyecta como factory; en tests podemos inyectar un mock que retorna el resultado deseado. **Importante**: el orden de checks es (1) scheme, (2) literales bloqueados, (3) allowlist match, (4) DNS + IP classification — esto evita un DoS donde un atacante fuerza resoluciones DNS para hosts no permitidos. Si allowlist está vacía, aún se valida IP classification (defense in depth: aunque el cliente no haya configurado allowlist, no se puede apuntar a una IP privada).

### D-F8-004 (Fase 8e): Audit log tenant-scoped con fire-and-forget

- **Contexto:** A lo largo de las Fases 1-7+8abcd se introducen múltiples operaciones sensibles (crear/actualizar/archivar clientes, distribuidores, webhooks, channel connections, allowlists, agents) que un atacante o un insider podrían abusar sin dejar rastro. Necesitamos un audit log inmutable, queryable y tenant-scoped (un cliente no puede ver eventos de otros clientes, un distributor_owner/admin ve los suyos, platform_super_admin ve todos). Además, el sistema de audit NO debe ser un punto de fallo: si la tabla `audit_events` está caída, las operaciones de negocio no deben fallar.
- **Decisión:** Nueva tabla `audit_events (id, platform_id, distributor_id, client_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata jsonb, ip_address, user_agent, created_at timestamptz)` con índices `(client_id, action, created_at)`, `(resource_type, resource_id)`, `(actor_user_id, created_at)`. Servicio `AuditService` con `record(input: RecordInput): void` que NO es async — internamente llama `void this.repo.record(...).catch((err) => log.error(...))` (fire-and-forget), con guardas que descartan si `clientId` o `distributorId` son null (logs warning, no falla la operación). Repository `DrizzleAuditEventsRepository` con `record(input)` (INSERT directo) y `query(filters)` (SELECT con `AuditEventFilters` paginado, `MAX_LIMIT=200`, `DEFAULT_LIMIT=50`). Constantes `AUDIT_ACTIONS` (16 acciones) + `AUDIT_RESOURCE_TYPES` (7 tipos). Endpoint `GET /api/v1/audit-events?action=&resourceType=&resourceId=&actorUserId=&from=&to=&limit=&offset=` con role gate: solo `platform_super_admin | distributor_owner | distributor_admin | client_owner | support` pueden listar; `client_user` retorna 200 con items vacíos (no 403, para no leak existencia). Tenant-scope aplicado en el service: si no es `platform_super_admin` ni support, fuerza `filters.clientId = ctx.clientId`; si `ctx.clientId` es null, retorna `{items:[], total:0}`. Integración en: `WebhookEndpointsService` (created/updated/secret_rotated/archived), `ChannelConnectionsService` (created/updated/verified/secret_rotated/archived), `ClientService` (created/updated/archived/webhook_allowlist_updated con diff added/removed), `DistributorService` (created/updated), `AgentsService` (agent_version.published, agent.archived). Inyección con `@Optional() AuditService` para no romper tests sin el módulo. Módulo `AuditModule` exporta `AuditService` y `AUDIT_REPO_TOKEN` (Symbol), registrado en `app.module.ts`. UI `/dashboard/audit` con tabla + filtros (action, resourceType, actorUserId, from, to) + paginación y badges de color por tipo de acción.
- **Consecuencia:** Fire-and-forget significa que un crash del proceso entre la operación de negocio y el `INSERT` en `audit_events` pierde el evento. Aceptable para Fase 8 (la fuente de verdad de la operación ya está commiteada en su tabla). En una iteración futura podríamos cambiar a un patrón outbox con un processor dedicado si la consistencia se vuelve crítica. Los tests E2E (6 tests) validan: role gate (client_user vacío), tenant-scope (clientOwnerB no ve eventos de clientOwnerA), filtros (action, resourceType), paginación. Bug pre-existente encontrado durante implementación: el patrón de middleware en los tests (`new TenantContextMiddleware().use` sin `JwtVerifierService`) y el uso de `sub`/`jti` en `signAccessToken` (que espera `userId` y autogenera `jti`) rompían silenciosamente la auth; corregido en audit.e2e.test.ts y allowlist.e2e.test.ts.

### D-F8-005 (Fase 8f): Usage events + schema para analítica

- **Contexto:** Aunque las tablas `audit_events` registran QUÉ pasó, necesitamos registrar CUÁNTO se consume (tokens, mensajes, costos) para: (1) facturar por uso en el futuro, (2) mostrar dashboards de consumo por agente/cliente/distribuidor, (3) detectar anomalías (picos de tokens). Debe ser append-only y optimizado para queries agregadas por rango temporal.
- **Decisión:** Nueva tabla `usage_events (id, platform_id, distributor_id, client_id, agent_id, conversation_id, metric varchar(40), quantity integer, cost_cents bigint, model_profile varchar(40), occurred_at timestamptz)` con índices `(client_id, metric, occurred_at)`, `(agent_id, occurred_at)`, `(occurred_at)`. `quantity` default 1 (1 mensaje = 1 unidad, 1K tokens = 1 unidad), `cost_cents` default 0 (costo interno en centavos, sin decimales). Métricas iniciales: `messages_sent`, `messages_received`, `tokens_input`, `tokens_output`, `agent_runs`. `agent_id` y `conversation_id` son nullable (no todos los eventos tienen estas dimensiones). El servicio `UsageEventsService` aún no implementado en esta iteración — el schema queda listo para Fase 8f que se completará en una pasada posterior.
- **Consecuencia:** El schema está desplegado (migración Fase 8 aplicada) pero el código de emisión aún no. Completar Fase 8f requiere: `UsageEventsService.emit({ctx, metric, quantity, costCents, modelProfile?, agentId?, conversationId?})` fire-and-forget, emitir en `AgentRuntime.execute` (tokens) y `ConversationService.startChat/humanReply` (mensajes), endpoint `GET /usage-events/aggregate?from=&to=&by=agent|channel|client|distributor` con `SUM(quantity) GROUP BY dimension`, UI `/dashboard/analytics` con charts. El `cost_cents` debe ser consistente con la convención `*_cents` integers del resto del código.
