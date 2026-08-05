# Arquitectura — Plataforma SaaS de Chatbots con IA para Distribuidores

> Versión: Fase 0 — andamiaje inicial.
> Última actualización: ver `IMPLEMENTATION_STATUS.md`.

## 1. Principios rectores

1. **Multi-tenant estricto.** Una sola instalación sirve a fabricante, distribuidores y clientes. El aislamiento se garantiza en tres capas: sesión (`TenantContext`), repositorios (filtros en código) y base de datos (RLS).
2. **Monolito modular.** Un solo proceso de API y uno de worker. No se introducen microservicios. Los workers se separan por responsabilidad (mensajes, IA, webhooks, pagos, documentos) pero comparten runtime.
3. **Configuración dinámica, no instancia.** Cada agente es una versión publicada en la base de datos. No se levanta un contenedor/proceso por agente. Un `AgentRuntime` central carga la versión y la ejecuta.
4. **Idempotencia obligatoria.** Pagos, webhooks, recargas, mensajes y respuestas de IA deben ser idempotentes. Claves, locks y eventos `outbox` lo garantizarán.
5. **Secretos fuera del código.** Variables de entorno + lectura centralizada. Nunca en logs, jamás en respuestas.
6. **Proveedor detrás de interfaz.** `AgentRuntime`, `ModelProvider`, `EmbeddingProvider`, `ChannelAdapter`, `PaymentProvider`, `StorageProvider`, `WebhookDispatcher`, `EmailProvider` son interfaces. Cambiar de OpenAI a Anthropic o de Stripe a MercadoPago no toca el dominio.
7. **Auditoría por defecto.** Todo lo crítico (login, RBAC, pagos, créditos, agentes, soporte, webhooks) produce un registro `audit_logs` append-only.

## 2. Vista de componentes

```text
                ┌──────────────────────────────────────────────┐
                │           Portales web (Next.js)             │
                │   fabricante  ·  distribuidor  ·  cliente   │
                └──────────────────────┬───────────────────────┘
                                       │ HTTPS / fetch / SSE
                                       ▼
                ┌──────────────────────────────────────────────┐
                │                  API REST                    │
                │        NestJS · /api/v1 · Swagger            │
                │  ┌─────────┬─────────┬─────────┬─────────┐    │
                │  │ identity │  orgs   │ agents  │ billing │    │
                │  └─────────┴─────────┴─────────┴─────────┘    │
                └──────────────────────┬───────────────────────┘
                                       │
              ┌───────────────┬────────┴───────────┬───────────────┐
              ▼               ▼                    ▼               ▼
    ┌──────────────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐
    │ Worker BullMQ    │ │ Worker IA    │ │ Worker Pagos   │ │ Worker Docs  │
    │ mensajes         │ │ AgentRuntime │ │ webhooks PSP   │ │ embeddings   │
    │ colas: incoming  │ │ @openai/     │ │ Stripe / Mock  │ │ pgvector     │
    │ outgoing         │ │ agents       │ │                │ │              │
    └────────┬─────────┘ └──────┬───────┘ └────────┬───────┘ └──────┬───────┘
             │                  │                  │                │
             └──────────────────┴────────┬─────────┴────────────────┘
                                        ▼
                              ┌──────────────────────┐
                              │   PostgreSQL 17      │
                              │   Supabase + pgvector│
                              │   RLS habilitado     │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   Upstash Redis REST │
                              │   BullMQ + cache     │
                              └──────────────────────┘
```

## 3. Capas y dominios

Cada dominio (carpeta en `apps/api/src/`) sigue la separación:

- **domain** — entidades, enums, value objects, eventos de dominio.
- **application** — casos de uso (`XxxService`). Solo orquestan repos y dependencias.
- **infrastructure** — implementaciones de repositorios, integraciones con Postgres, Redis y proveedores externos.
- **interfaces** — controllers REST, validadores Zod, mapeos a DTOs.
- **jobs** — procesadores BullMQ (en `apps/worker`).

Dominios planificados (Fase 1+):

```
identity · platform · organizations · permissions · distributors
clients · agents · knowledge · channels · conversations · messages · contacts
inbox · usage · plans · subscriptions · payments · commissions · payouts
webhooks · audit · support · notifications · branding
```

## 4. Multi-tenancy

Tres capas de defensa:

1. **Sesión.** Toda request autenticada lleva un `TenantContext` resuelto por middleware a partir del JWT.
2. **Repositorios.** Toda query pasa por repositorios que reciben `TenantContext` y aplican filtros obligatorios. Está prohibido usar `db.query.t` directo desde controllers.
3. **RLS.** Tablas expuestas al cliente vía Supabase llevan políticas por `platform_id`, `distributor_id`, `client_id`.

Jerarquía:

```
platform_id       (siempre presente)
└── distributor_id (nullable si es plataforma)
    └── client_id  (nullable si es plataforma o distribuidor)
```

## 5. Modelo de cobro

```
                  ┌──────────────┐
                  │  Cliente     │
                  │  final       │
                  └──────┬───────┘
                         │ checkout
                         ▼
              ┌─────────────────────┐
              │  Fabricante (PSP)   │
              │  Stripe / Mock      │
              └──────┬──────────────┘
                     │ webhook verified
                     ▼
        ┌──────────────────────────┐
        │  Ledger de créditos       │
        │  plan + topup + consumos  │
        └──────────────┬───────────┘
                       │ comisión
                       ▼
              ┌─────────────────────┐
              │  Distribuidor       │
              │  ledger comisiones  │
              └─────────────────────┘
```

- Idempotency key por pago.
- Comisión solo tras pago confirmado.
- Reembolso reversa comisión.
- Retención configurable antes de liberar.

## 6. Motor de agentes

Pipeline por mensaje entrante:

```
[Canal] → ChannelAdapter.parseInboundEvent
       → NormalizedMessage persistido (idempotente)
       → BullMQ encola AgentTurnRequested
       → AgentRuntime.executeTurn
            ├── carga TenantContext + AgentVersion publicada
            ├── PostgresAgentSession (historial + resumen)
            ├── RAG con pgvector (filtrado por client_id)
            ├── compila tools tipadas (Zod)
            ├── invoca OpenAI Agents SDK
            ├── ejecuta tools vía SecureToolExecutor
            └── persiste AgentRun + UsageEvent
       → respuesta validada
       → ChannelAdapter.sendMessage
```

- Runtime central: **un solo proceso Node.js**, varios workers en paralelo.
- Agentes: **configuraciones versionadas**, nunca instancias separadas.
- Catálogo de modelos administrado por el fabricante.
- Secrets resueltos fuera del contexto del modelo.
- `chain-of-thought` **nunca** se persiste.

## 7. Canales

- **MVP:** Widget web + WhatsApp.
- **Fase 2:** Telegram, Messenger, Instagram.
- Interfaz común `ChannelAdapter` normaliza todos los eventos a `NormalizedMessage`.
- Estado de conexión real: `NOT_CONFIGURED | PENDING | CONNECTED | DEGRADED | DISCONNECTED | ERROR`.

## 8. Webhooks salientes

- Firma HMAC + timestamp + `event_id` + `idempotency_key`.
- Reintentos: inmediato, 1m, 5m, 30m, 2h, 12h. Después, DLQ.
- Manual replay sólo para usuarios con permiso.
- UI: crear endpoint, ver entregas, redactar request/response, enviar evento de prueba.

## 9. Modo soporte

- Sesión temporal con motivo obligatorio.
- Banner permanente en la UI.
- Auditoría completa (actor, cuenta, motivo, inicio, fin, IP, acciones).
- Reautenticación para acciones sensibles.
- Secretos nunca se muestran.

## 10. Stack tecnológico

| Capa | Elección |
|---|---|
| Lenguaje | TypeScript 5.5 estricto |
| Monorepo | pnpm + Turborepo 2 |
| Front | Next.js 14 (App Router), Tailwind, shadcn/ui |
| API | NestJS 10 |
| Worker | BullMQ |
| DB | PostgreSQL 17 (Supabase) |
| ORM | Drizzle |
| Vector | pgvector |
| Cache/Queue | Upstash Redis REST |
| Auth | Supabase Auth + JWT propio |
| IA | `@openai/agents` + Responses API |
| Pagos | Stripe + `MockPaymentProvider` |
| Tests | Vitest + Supertest + Playwright |
| CI | GitHub Actions |

## 11. Estructura del monorepo

```
apps/
  web/      Next.js App Router
  api/      NestJS REST /api/v1
  worker/   BullMQ workers
  widget/   Bundle embebible (tsup)
packages/
  config/             tsconfig presets
  contracts/          Zod schemas + DTOs
  ui/                 shared components
  observability/      logger, correlation, redaction
  redis/              Upstash provider + in-memory
  db/                 Drizzle ORM + schema
  auth/               TenantContext helpers + RBAC
  channel-adapters/   ChannelAdapter (Fase 5-7)
  agent-runtime/      AgentRuntime (Fase 4)
  model-providers/    OpenAI + mocks (Fase 4)
  payment-providers/  Stripe + Mock (Fase 3)
  webhook-sdk/        signing + dispatch (Fase 6)
docs/
.github/workflows/
```

## 12. Decisiones de Fase 0

Ver [`docs/DECISIONS.md`](./DECISIONS.md) para la lista completa y su justificación.
