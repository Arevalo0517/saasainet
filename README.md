# Plataforma SaaS de Chatbots con IA para Distribuidores

Plataforma SaaS B2B2B multi-tenant y white-label-ready para vender, configurar y operar chatbots con IA en WhatsApp, Instagram, Messenger, Telegram y widget web, mediante una red de distribuidores.

## Documentación

- [PRD](./PRD_Plataforma_Chatbots_AI_Distribuidores(1).md) — Requisitos del producto.
- [Prompt maestro](./Prompt_MiniMax_Plataforma_Chatbots_AI(1).md) — Instrucciones de construcción.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Arquitectura del sistema.
- [docs/ERD.md](./docs/ERD.md) — Modelo de datos.
- [docs/PERMISSIONS.md](./docs/PERMISSIONS.md) — Matriz de permisos.
- [docs/DECISIONS.md](./docs/DECISIONS.md) — Decisiones tomadas durante el desarrollo.
- [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) — Estado de implementación por fase.

## Stack

- TypeScript estricto, Node.js 20 LTS.
- Monorepo: pnpm + Turborepo.
- Apps: `web` (Next.js), `api` (NestJS), `worker` (BullMQ), `widget` (bundle standalone).
- Datos: PostgreSQL 17 (Supabase) + pgvector, Redis (Upstash REST).
- IA: OpenAI Agents SDK + Responses API (Fase 4).
- Pagos: Stripe + `MockPaymentProvider` (Fase 3).

## Estructura

```
apps/
  web/       Portal Next.js App Router
  api/       API REST NestJS /api/v1
  worker/    Workers BullMQ
  widget/    Widget embebible standalone
packages/
  config/            tsconfig, eslint, prettier compartidos
  contracts/         Zod schemas y DTOs
  ui/                shadcn/ui + design tokens
  observability/     logger, correlation ID
  db/                Drizzle ORM + migrations
  auth/              sesiones, RBAC, tenant context
  redis/             cliente Redis (Upstash REST)
  channel-adapters/  adaptadores multi-canal
  agent-runtime/     runtime de agentes IA
  model-providers/   OpenAI y mocks
  payment-providers/ Stripe + Mock
  webhook-sdk/       firma HMAC y dispatcher
docs/
docker/
.github/workflows/
```

## Requisitos

- Node.js >= 20.18 (ver `.nvmrc`).
- pnpm >= 9.12 (`corepack enable && corepack prepare pnpm@9.12.3 --activate`).
- PostgreSQL con pgvector (Supabase provee esto).
- Redis accesible vía Upstash REST.

## Inicio rápido

```bash
# 1. Habilitar pnpm
corepack enable
corepack prepare pnpm@9.12.3 --activate

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores reales

# 4. Verificar build
pnpm build

# 5. Verificar lint, typecheck y tests
pnpm lint
pnpm typecheck
pnpm test

# 6. Levantar todas las apps en modo dev
pnpm dev
```

En modo dev:

- `web` → http://localhost:3000
- `api` → http://localhost:3001
- `widget` → http://localhost:3002

## Scripts útiles

```bash
pnpm build          # Compila todo el monorepo
pnpm dev            # Levanta API + Web + Worker + Widget en paralelo
pnpm lint           # Lint global
pnpm typecheck      # TypeScript check global
pnpm test           # Tests unitarios
pnpm format         # Formatea con Prettier
pnpm db:generate    # Genera migraciones Drizzle
pnpm db:migrate     # Aplica migraciones
pnpm db:push        # Aplica schema directo (solo dev)
pnpm db:seed        # Ejecuta seeds
pnpm db:studio      # Abre Drizzle Studio
```

## Variables de entorno

Ver [`.env.example`](./.env.example). Nunca commitees `.env.local` ni secretos.

## Fases de implementación

| Fase | Estado | Descripción |
|---|---|---|
| 0 | ✅ En curso | Descubrimiento y base del monorepo |
| 1 | ⏳ Pendiente | Identidad y multi-tenancy |
| 2 | ⏳ Pendiente | Distribuidores, clientes y branding |
| 3 | ⏳ Pendiente | Planes, pagos, créditos y comisiones |
| 4 | ⏳ Pendiente | Motor de agentes y base de conocimiento |
| 5 | ⏳ Pendiente | Widget y bandeja omnicanal |
| 6 | ⏳ Pendiente | Webhooks y n8n |
| 7 | ⏳ Pendiente | WhatsApp y canales adicionales |
| 8 | ⏳ Pendiente | Soporte, analítica y hardening |

Ver [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) para el detalle.

## Seguridad

- Toda credencial se carga desde variables de entorno, nunca del código.
- Row Level Security (RLS) en Supabase para tablas expuestas al cliente.
- Aislamiento multi-tenant verificado por pruebas automáticas.
- Auditoría append-only para acciones críticas.
- Webhooks firmados con HMAC.
- Reportar vulnerabilidades a `security@example.com`.

## Licencia

Propietario — todos los derechos reservados.
