# Prompt maestro para MiniMax — Plataforma SaaS de Chatbots con IA para Distribuidores

## Cómo utilizar este archivo

Copia el contenido completo de la sección **PROMPT PARA MINIMAX** y entrégalo a MiniMax dentro del repositorio donde se desarrollará el sistema. También puedes adjuntar el archivo `PRD_Plataforma_Chatbots_AI_Distribuidores.md` como documento de referencia.

El prompt está diseñado para que MiniMax actúe como arquitecto y desarrollador principal, construya el producto por fases y mantenga trazabilidad de decisiones, tareas, migraciones y pruebas.

---

# PROMPT PARA MINIMAX

Actúa como **arquitecto de software, product engineer y desarrollador full-stack senior**. Debes diseñar e implementar una plataforma SaaS B2B2B, multi-tenant, segura y escalable para comercializar chatbots con inteligencia artificial mediante una red de distribuidores.

No quiero únicamente mockups, pantallas estáticas o pseudocódigo. Quiero una aplicación funcional, ejecutable localmente, con arquitectura mantenible, migraciones, datos de prueba, pruebas automatizadas, documentación y separación clara entre frontend, API, workers e integraciones.

Si existe en el repositorio un documento llamado `PRD_Plataforma_Chatbots_AI_Distribuidores.md`, léelo primero y considéralo la fuente principal de requisitos. Si alguna instrucción de este prompt parece entrar en conflicto con el PRD, documenta el conflicto en `docs/DECISIONS.md` y sigue la opción más segura y coherente con el modelo de negocio.

No hagas preguntas por decisiones menores. Usa los defaults definidos en este prompt y registra cada supuesto. Solo pregunta cuando exista un bloqueo real que impida ejecutar o proteger datos.

---

## 1. Objetivo del producto

Construir una plataforma central para que:

1. La empresa fabricante sea dueña de la tecnología, marca, infraestructura, configuración global, cobros y soporte de segundo nivel.
2. Los distribuidores puedan registrar clientes, crear agentes de IA, conectar canales, cargar conocimiento, configurar webhooks y dar soporte de primer nivel.
3. Los clientes finales puedan consultar conversaciones, responder desde una bandeja omnicanal, revisar métricas, consultar consumo, comprar recargas y cambiar de plan.
4. Los usuarios humanos del cliente puedan atender conversaciones transferidas por la IA.
5. El fabricante pueda ver toda la estructura y entrar en modo soporte sin conocer contraseñas.
6. El cliente final pague directamente al fabricante.
7. El sistema calcule la comisión del distribuidor asociado al cliente.
8. Los planes sean vendidos por paquetes de mensajes.
9. Cuando el saldo se agote, el cliente pueda comprar mensajes adicionales o subir de plan.
10. Las integraciones iniciales se realicen mediante webhooks y acciones HTTP, especialmente para conectarse con n8n.
11. El sistema utilice inicialmente la marca del fabricante.
12. El white-label se habilite únicamente como membresía premium para distribuidores elegibles.

---

## 2. Jerarquía obligatoria

```text
Fabricante / Superadministrador
│
├── Distribuidor A
│   ├── Cliente A1
│   │   ├── Agente 1
│   │   ├── Agente 2
│   │   └── Usuarios del cliente
│   └── Cliente A2
│       └── Agente 1
│
├── Distribuidor B
│   └── Cliente B1
│
└── Distribuidor C
    └── Cliente C1
```

Reglas no negociables:

- El fabricante puede ver todo.
- Un distribuidor solo puede ver sus clientes.
- Un cliente solo puede ver su propia organización.
- Un usuario humano solo puede ver los módulos y conversaciones permitidos.
- No debe existir ninguna ruta, endpoint, exportación o consulta que permita mezclar tenants.
- Todo registro de negocio debe incluir los identificadores de tenant necesarios.
- Ningún `distributor_id` o `client_id` recibido desde el navegador debe confiarse sin validación contra la sesión.

---

## 3. Roles requeridos

Implementa RBAC con permisos granulares.

### Fabricante

- `PLATFORM_SUPER_ADMIN`.
- `PLATFORM_SUPPORT`.
- `PLATFORM_FINANCE`.
- `PLATFORM_ANALYST`.

### Distribuidor

- `DISTRIBUTOR_ADMIN`.
- `DISTRIBUTOR_IMPLEMENTER`.
- `DISTRIBUTOR_SUPPORT`.
- `DISTRIBUTOR_SALES`.
- `DISTRIBUTOR_ANALYST`.
- `DISTRIBUTOR_READ_ONLY`.

### Cliente

- `CLIENT_ADMIN`.
- `CLIENT_MANAGER`.
- `CLIENT_HUMAN_AGENT`.
- `CLIENT_ANALYST`.
- `CLIENT_READ_ONLY`.

Crea una matriz de permisos en `docs/PERMISSIONS.md` y agrega pruebas automáticas para los permisos críticos.

---

## 4. Stack técnico recomendado

Utiliza un monorepo TypeScript moderno y mantenible.

### Monorepo

- `pnpm`.
- Turborepo.
- TypeScript estricto.
- ESLint.
- Prettier.
- Husky y lint-staged si no complican el entorno.

### Aplicaciones

```text
apps/
  web/       Portal web Next.js
  api/       API NestJS
  worker/    Procesamiento asíncrono y colas
  widget/    Widget embebible de chat
```

### Paquetes compartidos

```text
packages/
  db/
  auth/
  contracts/
  ui/
  config/
  observability/
  channel-adapters/
  agent-runtime/
  model-providers/
  payment-providers/
  webhook-sdk/
```

### Frontend

- Next.js con App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form.
- Zod.
- TanStack Query.
- Internacionalización preparada; español como idioma inicial.
- Diseño responsive y profesional de SaaS empresarial.

### Backend

- NestJS.
- API REST versionada: `/api/v1`.
- OpenAPI/Swagger.
- Validación con Zod o DTOs tipados, pero evita duplicar contratos.
- Servicios organizados por dominio.
- Transacciones en operaciones financieras y de uso.

### Datos

- PostgreSQL 16, preferentemente Supabase Postgres.
- Drizzle ORM y migraciones versionadas.
- Extensión `pgvector` para RAG y búsqueda semántica.
- Supabase Auth para identidad.
- Supabase Storage o almacenamiento S3 compatible.
- Row Level Security cuando aplique.
- El backend debe aplicar además autorización por tenant; RLS no reemplaza las verificaciones del API.

### Procesamiento asíncrono

- Redis.
- BullMQ.
- Colas separadas para mensajes, IA, webhooks, documentos, pagos y notificaciones.
- Dead-letter queues.
- Reintentos con backoff.

### Pruebas

- Vitest o Jest para unitarias.
- Supertest para API.
- Playwright para E2E.
- Pruebas de integración con una base de datos de prueba.
- Fixtures y seeds reproducibles.

### Observabilidad

- Logs estructurados JSON.
- Correlation IDs.
- OpenTelemetry preparado.
- Sentry opcional mediante feature flag.
- Health checks para API, base de datos, Redis, storage y proveedores.

No agregues dependencias innecesarias. Documenta por qué se selecciona cada dependencia importante.

---

## 5. Arquitectura obligatoria

Utiliza un **monolito modular** para el MVP, con procesos separados para API, worker y widget. Evita microservicios prematuros.

Dominios mínimos:

```text
identity
platform
organizations
permissions
distributors
clients
agents
knowledge
channels
conversations
messages
contacts
inbox
usage
plans
subscriptions
payments
commissions
payouts
webhooks
audit
support
notifications
branding
```

Usa arquitectura hexagonal o una separación equivalente:

- Dominio.
- Casos de uso.
- Repositorios.
- Adaptadores externos.
- Controladores.
- Jobs.

Ningún dominio debe llamar directamente al SDK de un proveedor desde reglas de negocio. Define interfaces para:

- `AgentRuntime`.
- `ModelProvider`.
- `EmbeddingProvider`.
- `ChannelAdapter`.
- `PaymentProvider`.
- `StorageProvider`.
- `EmailProvider`.
- `WebhookDispatcher`.

---

## 6. Seguridad multi-tenant

Esta es una prioridad crítica.

Implementa:

1. `TenantContext` en cada request autenticado.
2. Resolución de `platform_id`, `distributor_id`, `client_id`, usuario y roles desde la sesión.
3. Repositorios que requieran explícitamente `TenantContext`.
4. RLS para tablas expuestas a clientes Supabase.
5. Pruebas de aislamiento entre distribuidores.
6. Pruebas de aislamiento entre clientes del mismo distribuidor.
7. Prohibición de confiar en IDs enviados por el frontend.
8. Auditoría de accesos y cambios críticos.
9. MFA obligatorio para roles del fabricante y administradores de distribuidores.
10. Rate limiting por IP, usuario y tenant.
11. Cifrado de tokens de canales y secretos de webhooks.
12. Secretos únicamente en servidor.
13. Rotación de secretos.
14. Protección CSRF, XSS, SQL injection, SSRF y abuso de webhooks.
15. Validación especial de URLs para acciones HTTP: bloquear loopback, metadata cloud, redes privadas y protocolos no permitidos, salvo allowlist aprobada por el fabricante.

Crea pruebas específicas que intenten:

- Cambiar `client_id` en la URL.
- Consultar un agente de otro distribuidor.
- Exportar conversaciones de otro tenant.
- Reutilizar una invitación de otro cliente.
- Forzar un webhook hacia una IP privada.

---

## 7. Modelo de cobro

El cliente final paga directamente al fabricante. El distribuidor no recibe el pago del cliente dentro del flujo principal.

Flujo:

```text
Cliente final -> checkout del fabricante -> pago confirmado
              -> suscripción o recarga activada
              -> créditos otorgados
              -> comisión generada para el distribuidor
```

Reglas:

- Cada cliente pertenece a un distribuidor.
- El checkout, la factura y el descriptor deben identificar correctamente a la entidad legal del fabricante.
- El cliente no puede ver la comisión del distribuidor.
- El distribuidor puede ver ingresos atribuidos, comisión y payout.
- El fabricante puede crear planes, precios, recargas, cupones y reglas de comisión.
- La lógica financiera no debe estar acoplada a un proveedor específico.
- Implementa una interfaz `PaymentProvider`.
- Incluye un adaptador inicial para un proveedor de pagos ampliamente soportado, usando su SDK oficial y sus webhooks verificados.
- También incluye `MockPaymentProvider` para desarrollo local y pruebas.

No inventes una respuesta exitosa del proveedor. En modo local, etiqueta claramente los pagos simulados.

---

## 8. Comisiones del distribuidor

Implementa un ledger de comisiones auditable.

Fórmula default:

```text
eligible_amount = amount_before_tax
                  - eligible_discounts
                  - refunds
                  - chargebacks

commission_amount = eligible_amount * commission_rate
```

La comisión debe guardar un snapshot de:

- Distribuidor.
- Cliente.
- Pago.
- Plan o recarga.
- Importe elegible.
- Porcentaje aplicado.
- Importe de comisión.
- Moneda.
- Regla de comisión utilizada.
- Fecha.

Estados:

- `ESTIMATED`.
- `PENDING`.
- `AVAILABLE`.
- `PAID`.
- `REVERSED`.
- `ON_HOLD`.

Defaults:

- Retención: 15 días.
- Payout: mensual.
- Payout manual en MVP.
- Transferencia bancaria registrada por el fabricante.

Funciones:

- Estado de cuenta del distribuidor.
- Filtros por periodo, cliente y estado.
- Exportación CSV.
- Payout con múltiples partidas.
- Evidencia o referencia de transferencia.
- Reverso proporcional ante reembolso.
- Historial inmutable.

Pruebas obligatorias:

- Un pago crea una sola comisión.
- Un webhook duplicado no duplica comisión.
- Un reembolso genera reverso.
- Una comisión pagada queda vinculada al payout.
- Un distribuidor no puede editar porcentajes ni estados.

---

## 9. Planes por mensajes

La unidad comercial es el **crédito de mensaje**.

### Definición default

Consume un crédito:

- Un mensaje entrante del usuario final aceptado por la plataforma.
- Un mensaje saliente generado por IA y entregado o aceptado por el canal.
- Un mensaje humano enviado desde la bandeja y entregado o aceptado por el canal.

No consume crédito:

- Delivery receipts.
- Read receipts.
- Eventos internos.
- Notas internas.
- Duplicados.
- Reintentos técnicos.
- Mensajes rechazados antes de su aceptación por el canal.

Registra por separado:

- Tipo de mensaje.
- Canal.
- Agente.
- Conversación.
- Tokens de entrada y salida.
- Costo estimado de IA.
- Costo estimado de canal.
- Estado de entrega.

### Ledger de créditos

Debe ser inmutable y usar movimientos con cantidad positiva o negativa.

Tipos:

- `PLAN_GRANT`.
- `PLAN_RENEWAL`.
- `TOPUP_GRANT`.
- `PROMOTIONAL_GRANT`.
- `ADMIN_ADJUSTMENT`.
- `MESSAGE_DEBIT`.
- `EXPIRATION`.
- `REFUND_REVERSAL`.
- `CORRECTION`.

Cada movimiento incluye saldo posterior y una referencia idempotente.

### Alertas

Genera alertas al:

- 70%.
- 80%.
- 90%.
- 100%.

Canales de alerta:

- Notificación dentro del portal.
- Correo.
- Evento webhook.

### Saldo agotado

Default de MVP:

1. Guardar mensajes entrantes.
2. No ejecutar la respuesta automática de IA.
3. No permitir saldo negativo.
4. Emitir `usage.exhausted`.
5. Mostrar CTA para recarga o upgrade.
6. Permitir un mensaje de contingencia configurable, solo una vez por conversación o ventana definida.
7. Reactivar al confirmar nuevos créditos.
8. Permitir créditos de emergencia únicamente al fabricante y con auditoría.

### Renovaciones y cambios

- Sin rollover mensual por defecto.
- Recargas con vigencia default de 90 días, configurable.
- Upgrade inmediato.
- Downgrade en la siguiente renovación.
- Versionado de planes para no alterar contratos existentes.

Pruebas obligatorias:

- El saldo nunca se descuenta dos veces por el mismo mensaje.
- Un mensaje duplicado no consume.
- Una recarga se acredita una sola vez.
- Al llegar a cero se pausa IA.
- Al comprar créditos se reactiva.
- El saldo calculado coincide con el ledger.

---

## 10. White-label

Todos los distribuidores usan inicialmente la marca del fabricante.

Implementa:

- `DistributorMembership`.
- Elegibilidad por clientes activos, MRR, antigüedad y estado.
- Membresía white-label mensual o anual.
- Feature flag `white_label_enabled`.

Cuando está activo, permitir:

- Logo.
- Colores.
- Favicon.
- Nombre comercial.
- Dominio personalizado.
- Remitente de correos.
- Información de soporte.
- Reportes con branding.

Reglas:

- White-label deshabilitado por defecto.
- La personalización se resuelve por dominio y distribuidor.
- Nunca crear copias separadas del código por distribuidor.
- White-label no cambia automáticamente la entidad de cobro.
- Si la membresía expira, conservar configuración pero regresar al branding del fabricante después de un periodo de gracia configurable.

---

## 11. Constructor de agentes

El distribuidor puede crear agentes para sus clientes.

Campos mínimos:

- Nombre.
- Descripción.
- Cliente.
- Idioma.
- Zona horaria.
- Objetivo.
- Personalidad.
- Tono.
- Prompt del sistema.
- Mensaje de bienvenida.
- Mensaje fuera de horario.
- Reglas permitidas.
- Reglas prohibidas.
- Datos que puede solicitar.
- Datos sensibles que no debe solicitar.
- Modelo de IA.
- Parámetros del modelo.
- Base de conocimiento.
- Herramientas HTTP.
- Reglas de transferencia.
- Canales asignados.

Estados:

- `DRAFT`.
- `TESTING`.
- `PUBLISHED`.
- `PAUSED`.
- `ARCHIVED`.

Versionado obligatorio:

- Cada cambio crea versión.
- Una versión publicada es inmutable.
- Permitir comparar versiones.
- Permitir rollback.
- Permitir probar borrador sin afectar producción.
- Registrar autor y comentario de publicación.

Plantillas iniciales:

- Atención al cliente.
- Ventas.
- Generación de leads.
- Reservaciones.
- Seguimiento.
- Cobranza.
- FAQ.
- Soporte técnico.

El cliente final no debe ver el prompt completo salvo permiso explícito.

### Implementación obligatoria del motor de agentes

Para el MVP, implementa los agentes en **Node.js/TypeScript** mediante el paquete oficial **`@openai/agents`** y utiliza **OpenAI Responses API** como integración principal del modelo.

No construyas un workflow de n8n por cada agente y no levantes un contenedor, servicio o proceso por agente. Cada agente debe ser una configuración versionada en PostgreSQL que el worker carga dinámicamente al procesar un turno.

Crea el paquete:

```text
packages/agent-runtime/
  src/
    application/
    domain/
    openai/
    sessions/
    context/
    guardrails/
    tools/
    tracing/
```

Responsabilidades mínimas del runtime:

1. Resolver `TenantContext`, conversación y versión publicada.
2. Verificar estado del agente, saldo y ownership de la conversación.
3. Cargar instrucciones, perfil de modelo, herramientas, guardrails y reglas de handoff.
4. Obtener historial reciente y resumen persistido.
5. Recuperar fragmentos RAG autorizados en pgvector.
6. Crear dinámicamente un `Agent` de `@openai/agents`.
7. Convertir acciones permitidas en function tools con schemas Zod estrictos.
8. Ejecutar el turno mediante `run()` o Runner equivalente.
9. Manejar tool calls, aprobaciones, errores y transferencia a humano.
10. Validar el resultado antes de enviarlo al canal.
11. Guardar respuesta, uso, costo, fuentes, pasos y auditoría.

El OpenAI Agents SDK proporciona el loop de agente, tools, handoffs, guardrails, sesiones, streaming y tracing. No reimplementes esas capacidades sin una razón documentada.

No uses LangGraph en el MVP. Déjalo como decisión futura para workflows durables o grafos complejos que realmente lo justifiquen. No combines ambos frameworks por defecto.

### Definición dinámica de un agente

Una versión publicada debe permitir construir en runtime un objeto equivalente a:

```ts
const runtimeAgent = new Agent<PlatformAgentContext>({
  name: agentVersion.name,
  instructions: compiledInstructions,
  model: resolvedModel,
  modelSettings: resolvedModelSettings,
  tools: resolvedTools,
  handoffs: resolvedHandoffs,
  inputGuardrails: resolvedInputGuardrails,
  outputGuardrails: resolvedOutputGuardrails,
});
```

No guardes objetos serializados del SDK en la base de datos. Guarda configuración neutral y compílala a objetos del SDK al ejecutar.

### Memoria y sesiones

PostgreSQL de la plataforma es la fuente de verdad. Implementa un `PostgresAgentSession` compatible con la interfaz Session del SDK o una capa equivalente que:

- Recupere historial por `conversation_id`.
- Guarde mensajes, tool calls y resultados permitidos.
- Mantenga un resumen acumulado para conversaciones largas.
- Aplique límites de contexto.
- Respete retención y eliminación.
- Nunca mezcle tenants.

No dependas únicamente de memoria en proceso ni de IDs de conversación administrados por un proveedor. No guardes chain-of-thought.

### Separación de responsabilidades

El runtime decide cómo ejecutar el agente. El dominio de negocio sigue siendo responsable de:

- Tenant y permisos.
- Estados de conversación.
- Créditos y consumo.
- Facturación.
- Auditoría.
- Handoff a humanos.
- Idempotencia.

n8n se utiliza únicamente detrás de herramientas HTTP y webhooks para automatizaciones externas.

---

## 12. Base de conocimiento

Fuentes iniciales:

- Texto manual.
- FAQ.
- PDF.
- DOCX.
- CSV.
- URLs.

Funciones:

- Upload.
- Validación de tipo y tamaño.
- Antivirus o scanning hook preparado.
- Extracción de texto.
- Chunking.
- Embeddings mediante `EmbeddingProvider`.
- Almacenamiento en Supabase Postgres con `pgvector`.
- Consultas vectoriales filtradas obligatoriamente por tenant, cliente y base de conocimiento.
- Perfil y dimensión del embedding versionados.
- Índice HNSW cuando el volumen y las pruebas lo justifiquen.
- Estado de indexación.
- Reintentos.
- Versionado.
- Eliminación.
- Asignación a agentes del mismo cliente.

Reglas:

- Nunca mezclar documentos o vectores de clientes diferentes.
- Toda consulta RAG debe filtrar por `client_id` y `knowledge_base_id`.
- Agrega una prueba que intente recuperar contenido de otro tenant.
- No envíes documentos completos al modelo cuando no sea necesario.
- Guarda referencias de las fuentes utilizadas en una respuesta.

---

## 13. Canales

Objetivo final:

- WhatsApp.
- Instagram.
- Facebook Messenger.
- Telegram.
- Widget web.

Orden de implementación:

1. Widget web funcional.
2. WhatsApp.
3. Telegram.
4. Messenger.
5. Instagram.

Crea una interfaz común `ChannelAdapter` con métodos equivalentes a:

```ts
interface ChannelAdapter {
  verifyConnection(input: VerifyConnectionInput): Promise<ConnectionStatus>;
  parseInboundEvent(input: RawProviderEvent): Promise<NormalizedInboundEvent[]>;
  sendMessage(input: SendChannelMessageInput): Promise<SendChannelMessageResult>;
  downloadMedia(input: DownloadMediaInput): Promise<DownloadedMedia>;
  getDeliveryStatus(input: DeliveryStatusInput): Promise<DeliveryStatus>;
}
```

Modelo normalizado mínimo:

```ts
type NormalizedMessage = {
  id: string;
  providerEventId: string;
  platformId: string;
  distributorId: string;
  clientId: string;
  channelConnectionId: string;
  externalConversationId: string;
  externalMessageId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sender: NormalizedParty;
  recipient: NormalizedParty;
  messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'INTERACTIVE';
  text?: string;
  attachments: NormalizedAttachment[];
  occurredAt: string;
  rawPayloadReference: string;
};
```

Requisitos:

- Idempotencia por evento y mensaje externo.
- Guardar payload crudo de forma segura con retención limitada.
- Validar firma de webhooks de cada proveedor.
- Responder rápidamente y enviar procesamiento a cola.
- Manejar estados de entrega.
- Reconexión y expiración de credenciales.
- Panel de salud por conexión.

No simules que un canal está conectado cuando faltan credenciales. Usa estados reales:

- `NOT_CONFIGURED`.
- `PENDING`.
- `CONNECTED`.
- `DEGRADED`.
- `DISCONNECTED`.
- `ERROR`.

---

## 14. Widget web

Construye un widget embebible real para el MVP.

Debe incluir:

- Script de instalación.
- Identificador público del widget.
- Dominio permitido.
- Tema configurable.
- Botón flotante.
- Ventana de chat.
- Mensaje de bienvenida.
- Estado en línea o fuera de horario.
- Persistencia de conversación anónima.
- Conversión a contacto cuando se solicite nombre, correo o teléfono.
- Archivos opcionales según configuración.
- Protección contra abuso.
- Rate limiting.
- CAPTCHA opcional por feature flag.
- Comunicación con backend mediante API segura o WebSocket/SSE.

El script no debe exponer secretos ni IDs internos sensibles.

Incluye una página de demostración y documentación de instalación.

---

## 15. Bandeja omnicanal

Crea una bandeja funcional, no solo una tabla.

Funciones:

- Lista de conversaciones.
- Vista de mensajes.
- Búsqueda.
- Filtros por canal, agente, estado, etiqueta y asignado.
- Respuesta humana.
- Notas internas.
- Etiquetas.
- Asignación.
- Transferencia.
- Datos del contacto.
- Resumen generado por IA, detrás de feature flag.
- Indicador de quién está escribiendo.
- Actualización en tiempo real.
- Estados de entrega.
- Historial de auditoría.

Estados de conversación:

- `NEW`.
- `AI_ACTIVE`.
- `WAITING_CUSTOMER`.
- `HUMAN_REQUIRED`.
- `ASSIGNED`.
- `FOLLOW_UP`.
- `RESOLVED`.
- `CLOSED`.

Transferencia a humano por:

- Solicitud del usuario.
- Falta de confianza.
- Tema restringido.
- Sentimiento negativo.
- Error de herramienta.
- Regla configurada.

Evita que IA y humano respondan simultáneamente. Implementa un lock o estado de ownership de la conversación.

---

## 16. Webhooks y n8n

Esta es la integración principal del MVP.

Eventos salientes mínimos:

- `conversation.started`.
- `conversation.updated`.
- `conversation.closed`.
- `message.received`.
- `message.sent`.
- `lead.created`.
- `handoff.requested`.
- `contact.updated`.
- `agent.published`.
- `usage.threshold_reached`.
- `usage.exhausted`.
- `subscription.created`.
- `subscription.updated`.
- `payment.succeeded`.
- `payment.failed`.
- `topup.completed`.

Cada evento debe contener:

- `event_id`.
- `event_type`.
- `occurred_at`.
- `platform_id`.
- `distributor_id`.
- `client_id`.
- `api_version`.
- `data`.

Seguridad:

- Firma HMAC.
- Timestamp.
- Tolerancia de reloj configurable.
- Secretos rotables.
- Idempotency key.
- Allowlist opcional.

Reintentos default:

- Inmediato.
- 1 minuto.
- 5 minutos.
- 30 minutos.
- 2 horas.
- 12 horas.

Después, dead-letter queue.

UI requerida:

- Crear endpoint.
- Seleccionar eventos.
- Mostrar secreto una sola vez.
- Rotar secreto.
- Activar/desactivar.
- Ver entregas.
- Ver request y response redacted.
- Reintentar.
- Filtrar errores.
- Enviar evento de prueba.

Crea documentación y un workflow de ejemplo para n8n en formato JSON que reciba `lead.created` y escriba la información en un endpoint de prueba. No incluyas credenciales reales.

---

## 17. Acciones HTTP para agentes

Permite que un agente invoque APIs externas mediante herramientas configuradas.

Campos:

- Nombre.
- Descripción para el modelo.
- Método.
- URL.
- Headers.
- Tipo de autenticación.
- Referencia de secreto.
- JSON Schema de entrada.
- JSON Schema de salida.
- Timeout.
- Reintentos.
- Ambiente `TEST` o `PRODUCTION`.
- Requiere aprobación humana sí/no.

Seguridad:

- Evitar SSRF.
- Bloquear protocolos no HTTP/HTTPS.
- No enviar secretos al modelo.
- Redactar secretos en logs.
- Limitar tamaño de respuesta.
- Limitar redirects.
- Validar schemas.
- Registrar cada ejecución.
- Permitir prueba manual desde el portal.

---

## 18. Modo soporte

El fabricante puede entrar a la cuenta de un distribuidor o cliente sin conocer su contraseña.

Flujo:

1. Seleccionar cuenta.
2. Escribir motivo obligatorio.
3. Reautenticación si la acción es sensible.
4. Crear `SupportSession` temporal.
5. Mostrar banner permanente.
6. Registrar acciones.
7. Expirar automáticamente.
8. Permitir terminar manualmente.

Registra:

- Usuario del fabricante.
- Cuenta visitada.
- Motivo.
- IP.
- User agent.
- Inicio y fin.
- Acciones.
- Cambios antes/después.

No muestres contraseñas, tokens o secretos completos durante modo soporte.

---

## 19. Auditoría

Crea un sistema de auditoría append-only.

Eventos auditables mínimos:

- Login y logout.
- MFA.
- Invitaciones.
- Cambios de roles.
- Alta y suspensión de distribuidor.
- Alta y suspensión de cliente.
- Cambios de agente.
- Publicación y rollback.
- Conexión de canal.
- Cambio de plan.
- Recarga.
- Ajuste de créditos.
- Reembolso.
- Cambio de comisión.
- Creación y pago de payout.
- Cambio de branding.
- Inicio y fin de soporte.
- Webhook creado, eliminado o replay.

Campos:

- Actor.
- Tenant.
- Acción.
- Recurso.
- Antes.
- Después.
- IP.
- User agent.
- Correlation ID.
- Fecha.

Redacta secretos y PII sensible.

---

## 20. Paneles requeridos

### Fabricante

- Dashboard global.
- Distribuidores.
- Clientes.
- Agentes.
- Canales.
- Conversaciones.
- Planes.
- Suscripciones.
- Pagos.
- Recargas.
- Comisiones.
- Payouts.
- Costos y margen.
- White-label.
- Webhooks.
- Salud del sistema.
- Auditoría.
- Soporte.
- Configuración.

### Distribuidor

- Dashboard.
- Clientes.
- Agentes.
- Plantillas.
- Canales.
- Bandeja.
- Contactos.
- Conocimiento.
- Webhooks.
- Consumo.
- Comisiones.
- Payouts.
- Equipo.
- Branding.
- Soporte.

### Cliente

- Dashboard.
- Bandeja.
- Contactos.
- Agentes contratados.
- Conocimiento, si tiene permiso.
- Analítica.
- Consumo.
- Plan.
- Recargas.
- Pagos y facturas.
- Usuarios.
- Soporte.

El menú debe generarse según rol y permisos, no únicamente ocultarse con CSS.

---

## 21. Modelo de datos mínimo

Crea tablas y relaciones para:

### Identidad

- `platforms`.
- `users`.
- `roles`.
- `permissions`.
- `user_roles`.
- `invitations`.
- `sessions`.

### Distribuidores

- `distributors`.
- `distributor_members`.
- `distributor_branding`.
- `distributor_memberships`.
- `commission_rules`.
- `distributor_payout_accounts`.

### Clientes

- `clients`.
- `client_members`.
- `client_settings`.
- `contacts`.
- `tags`.
- `contact_tags`.

### Agentes

- `agents`.
- `agent_versions`.
- `agent_templates`.
- `agent_tools`.
- `agent_channel_assignments`.
- `agent_test_sessions`.

### Conocimiento

- `knowledge_bases`.
- `knowledge_documents`.
- `knowledge_chunks`.
- `knowledge_jobs`.

### Canales y conversaciones

- `channel_connections`.
- `conversations`.
- `conversation_assignments`.
- `messages`.
- `message_deliveries`.
- `attachments`.
- `internal_notes`.

### Planes y uso

- `plans`.
- `plan_versions`.
- `subscriptions`.
- `usage_events`.
- `message_credit_ledger`.
- `topup_products`.
- `topup_purchases`.
- `usage_notifications`.

### Finanzas

- `payment_customers`.
- `payment_methods`.
- `payments`.
- `invoices`.
- `refunds`.
- `chargebacks`.
- `commission_entries`.
- `payouts`.
- `payout_items`.

### Integraciones

- `webhook_endpoints`.
- `webhook_events`.
- `webhook_deliveries`.
- `http_actions`.
- `secret_references`.

### Seguridad

- `audit_logs`.
- `support_sessions`.
- `security_events`.
- `api_keys`.

Incluye:

- UUIDs.
- Índices.
- Uniques para idempotencia.
- Foreign keys.
- Soft delete donde sea apropiado.
- Timestamps UTC.
- Columnas de tenant.
- Checks para estados y saldos.

Genera un ERD en Mermaid dentro de `docs/ERD.md`.

---

## 22. API mínima

Diseña rutas REST coherentes. Ejemplos:

```text
/api/v1/auth/*
/api/v1/platform/distributors
/api/v1/platform/clients
/api/v1/platform/plans
/api/v1/platform/payments
/api/v1/platform/commissions
/api/v1/platform/payouts
/api/v1/platform/audit
/api/v1/distributor/clients
/api/v1/distributor/agents
/api/v1/distributor/commissions
/api/v1/clients/:clientId/agents
/api/v1/clients/:clientId/conversations
/api/v1/clients/:clientId/contacts
/api/v1/clients/:clientId/knowledge-bases
/api/v1/clients/:clientId/channel-connections
/api/v1/clients/:clientId/webhooks
/api/v1/clients/:clientId/usage
/api/v1/clients/:clientId/subscription
/api/v1/clients/:clientId/topups
/api/v1/widget/:publicWidgetId/*
/api/v1/providers/payments/webhook
/api/v1/providers/channels/:provider/webhook
```

No uses rutas con `clientId` sin validar que el usuario tiene acceso. Considera rutas contextuales cuando reduzcan riesgo.

Incluye:

- OpenAPI.
- Errores tipados.
- Paginación cursor-based para mensajes y auditoría.
- Idempotency headers para operaciones críticas.
- Rate limits.
- Correlation ID.

---

## 23. Eventos internos

Implementa un event bus interno y patrón outbox para eventos críticos.

Eventos:

- `DistributorCreated`.
- `ClientCreated`.
- `AgentCreated`.
- `AgentVersionPublished`.
- `ChannelConnected`.
- `MessageReceived`.
- `MessageSent`.
- `ConversationStarted`.
- `HandoffRequested`.
- `UsageRecorded`.
- `UsageThresholdReached`.
- `CreditsExhausted`.
- `PaymentConfirmed`.
- `CreditsGranted`.
- `CommissionCreated`.
- `RefundConfirmed`.
- `CommissionReversed`.
- `PayoutApproved`.
- `PayoutCompleted`.
- `WhiteLabelEnabled`.

Asegura entrega at-least-once y consumidores idempotentes.

---

## 24. Motor de agentes e interfaces de IA

Crea abstracciones propias para que el dominio no dependa directamente de OpenAI, aunque la primera implementación use su SDK oficial.

```ts
interface AgentRuntime {
  executeTurn(input: ExecuteAgentTurnInput): Promise<ExecuteAgentTurnResult>;
  executeTestTurn(input: ExecuteTestTurnInput): Promise<ExecuteAgentTurnResult>;
}

interface ModelProvider {
  resolveModel(input: ResolveModelInput): Promise<ResolvedModel>;
  summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationResult>;
}

interface EmbeddingProvider {
  generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingResult>;
}
```

Implementaciones mínimas:

- `OpenAIAgentRuntime`, basado en `@openai/agents`.
- `OpenAIModelProvider`, basado en Responses API.
- `OpenAIEmbeddingProvider`.
- `MockAgentRuntime` y providers mock para pruebas.
- `PostgresAgentSession` para historial y memoria.
- `SecureToolExecutor` para ejecutar herramientas fuera del modelo.

Requisitos:

- Versiones de dependencias fijadas en lockfile.
- Catálogo de modelos administrado por fabricante.
- Configuración y allowlist por modelo.
- Límites de tokens y contexto.
- Streaming cuando el canal lo soporte.
- Timeouts y reintentos controlados.
- Registro de tokens, latencia y costos.
- Fallback opcional y explícito.
- Redacción de secretos y datos sensibles.
- Input/output guardrails.
- Tool calling mediante contratos Zod tipados.
- Aprobaciones humanas reanudables para acciones sensibles.
- Tracing del SDK más registro interno `AgentRun`.
- No guardar chain-of-thought.
- Guardar únicamente inputs, outputs, fuentes, tool calls y metadatos permitidos según retención.
- Nunca permitir que el modelo seleccione arbitrariamente URLs, secretos, tenant IDs o herramientas no publicadas.

### Flujo requerido de `executeTurn`

```text
NormalizedInboundEvent
  -> persistencia e idempotencia
  -> validación de créditos y estado
  -> AgentTurnRequested en BullMQ
  -> carga de AgentVersion publicada
  -> PostgresAgentSession
  -> recuperación RAG en pgvector
  -> compilación de tools y guardrails
  -> OpenAIAgentRuntime.executeTurn
  -> validación del resultado
  -> persistencia de AgentRun y UsageEvent
  -> envío por ChannelAdapter
```

El worker debe poder escalar horizontalmente. Usa locks e idempotency keys para impedir respuestas dobles a un mismo mensaje.

---

## 25. UX y diseño

El producto debe sentirse como una plataforma empresarial moderna.

Requisitos:

- Español por defecto.
- Preparado para inglés.
- Dark mode opcional.
- Responsive.
- Navegación por rol.
- Breadcrumbs.
- Estados de loading, empty, error y success.
- Confirmaciones para acciones destructivas.
- Formularios accesibles.
- Tablas con filtros y paginación.
- Dashboards con métricas reales del seed.
- No usar lorem ipsum.
- No mostrar datos de otros tenants ni siquiera en selectores.
- Banner visible en modo soporte.
- Indicador claro de créditos restantes.
- CTA de recarga al acercarse al límite.

Crea un sistema de design tokens compatible con branding del fabricante y white-label.

---

## 26. Datos de prueba

Crea un seed reproducible con:

### Fabricante

- Un superadministrador.
- Un usuario de soporte.
- Un usuario de finanzas.

### Distribuidor A

- Administrador.
- Implementador.
- Dos clientes.
- Comisión de ejemplo.

### Distribuidor B

- Administrador.
- Un cliente.
- Comisión diferente.

### Clientes

- Usuarios administradores.
- Usuarios humanos.
- Agentes.
- Conversaciones.
- Mensajes.
- Contactos.
- Planes y saldos.
- Pagos.
- Comisiones.

Incluye credenciales de desarrollo únicamente en `.env.example` o documentación local, nunca credenciales reales.

---

## 27. Pruebas de aceptación obligatorias

Automatiza como mínimo:

1. Distribuidor A no puede ver clientes de Distribuidor B.
2. Cliente A1 no puede ver Cliente A2.
3. Usuario humano no puede editar prompts.
4. Fabricante puede ver toda la plataforma.
5. Modo soporte requiere motivo y genera auditoría.
6. Pago duplicado no duplica créditos.
7. Pago duplicado no duplica comisión.
8. Mensaje duplicado no consume dos créditos.
9. Al llegar a cero, IA no responde.
10. Recarga reactiva el servicio.
11. Refund reversa comisión.
12. Payout suma exactamente sus partidas.
13. White-label no aparece sin membresía activa.
14. Webhook saliente lleva firma válida.
15. Webhook fallido se reintenta.
16. Replay manual no duplica efectos del receptor interno.
17. RAG no recupera documentos de otro cliente.
18. Acciones HTTP bloquean destinos privados no autorizados.
19. Un evento de canal duplicado no crea dos mensajes.
20. El saldo mostrado coincide con el ledger.

---

## 28. Fases de implementación

No intentes construir todo en una sola operación desordenada. Trabaja por fases y deja el repositorio ejecutable al final de cada una.

### Fase 0 — Descubrimiento y base

- Inspeccionar repositorio.
- Crear `docs/ARCHITECTURE.md`.
- Crear `docs/ERD.md`.
- Crear `docs/PERMISSIONS.md`.
- Crear `docs/DECISIONS.md`.
- Crear `docs/IMPLEMENTATION_STATUS.md`.
- Configurar monorepo.
- Configurar lint, format, test y CI.
- Crear `.env.example`.
- Crear Docker Compose o instrucciones locales.

### Fase 1 — Identidad y multi-tenancy

- Auth.
- Organizaciones.
- Roles.
- Permisos.
- Tenant context.
- RLS.
- Invitaciones.
- Dashboards vacíos por rol.
- Pruebas de aislamiento.

### Fase 2 — Distribuidores, clientes y branding

- CRUD de distribuidores.
- CRUD de clientes.
- Equipos.
- Suspensiones.
- Branding del fabricante.
- Estructura white-label detrás de feature flag.
- Auditoría inicial.

### Fase 3 — Planes, pagos, créditos y comisiones

- Planes y versiones.
- Suscripciones.
- MockPaymentProvider.
- Adaptador de proveedor real.
- Webhooks de pago.
- Ledger de créditos.
- Recargas.
- Alertas.
- Comisiones.
- Payouts manuales.
- Pruebas financieras.

### Fase 4 — Motor de agentes y conocimiento

- Paquete `agent-runtime`.
- `OpenAIAgentRuntime` con `@openai/agents` y Responses API.
- `PostgresAgentSession`.
- `SecureToolExecutor`.
- Registros `AgentRun`, pasos, costos y fuentes.
- Constructor de agentes.
- Versionado.
- Plantillas.
- Guardrails.
- Ambiente de prueba.
- Base de conocimiento con pgvector.
- Providers mock.
- Providers OpenAI detrás de configuración.
- Pruebas de tool calling, memoria y RAG multi-tenant.
- Pruebas de concurrencia e idempotencia para evitar respuestas duplicadas.

### Fase 5 — Widget y conversaciones

- Widget embebible.
- Conexión pública segura.
- Conversaciones.
- Mensajes.
- Contactos.
- Bandeja omnicanal.
- Handoff.
- Actualización en tiempo real.
- Consumo de créditos.

### Fase 6 — Webhooks y n8n

- Endpoints.
- Firmas.
- Entregas.
- Reintentos.
- Dead-letter.
- Replay.
- Acciones HTTP.
- Workflow de ejemplo n8n.

### Fase 7 — WhatsApp y canales adicionales

- Adaptador WhatsApp.
- Salud de conexión.
- Mensajes entrantes y salientes.
- Delivery status.
- Telegram.
- Messenger.
- Instagram.

### Fase 8 — Soporte, analítica y hardening

- Modo soporte.
- Dashboards reales.
- Costos y margen.
- Seguridad.
- Observabilidad.
- Backups y retención.
- Pruebas E2E.
- Documentación operativa.

---

## 29. Forma de trabajo esperada

Antes de escribir código:

1. Inspecciona el repositorio.
2. Resume lo existente.
3. Identifica riesgos.
4. Define la fase actual.
5. Escribe o actualiza `docs/IMPLEMENTATION_STATUS.md`.

Durante la implementación:

- Haz cambios completos y coherentes.
- No dejes imports rotos.
- No dejes rutas falsas como si fueran funcionales.
- No hardcodees IDs de tenants.
- No uses `any` salvo justificación.
- Usa transacciones.
- Añade migraciones.
- Añade pruebas.
- Actualiza documentación.
- Ejecuta lint, typecheck y tests.
- Corrige errores antes de declarar una fase terminada.

Al terminar cada fase, reporta:

1. Qué se implementó.
2. Archivos principales modificados.
3. Migraciones creadas.
4. Comandos ejecutados.
5. Resultado de pruebas.
6. Limitaciones reales.
7. Próxima fase recomendada.

No afirmes que una integración funciona si solamente existe una interfaz o mock.

---

## 30. Reglas de calidad

- Código legible y tipado.
- Nombres de dominio claros.
- Sin lógica financiera en controladores.
- Sin acceso directo a base de datos desde componentes de UI.
- Sin secretos en logs.
- Sin datos cross-tenant en cache.
- Cache keys siempre con tenant.
- Jobs idempotentes.
- Webhooks idempotentes.
- Operaciones financieras atómicas.
- Fechas almacenadas en UTC.
- Zona horaria aplicada solo en presentación y reglas del cliente.
- Importes almacenados en unidades menores enteras.
- Moneda explícita.
- Porcentajes almacenados con precisión decimal apropiada.
- Soft delete solo donde preserve integridad; datos financieros nunca se eliminan físicamente.
- PII con retención y eliminación controladas.

---

## 31. Defaults de producto

Utiliza estos defaults hasta que se configuren otros:

- Idioma: español.
- Moneda inicial: configurable, sin hardcodear en lógica.
- Comisión: porcentaje configurable por distribuidor.
- Retención de comisión: 15 días.
- Payout: mensual y manual.
- Rollover mensual: desactivado.
- Vigencia de recarga: 90 días.
- Upgrade: inmediato.
- Downgrade: siguiente renovación.
- Política al agotar créditos: hard stop para IA, conservar inbound.
- Branding: fabricante.
- White-label: desactivado.
- Integración externa: webhooks y n8n.
- Runtime de agentes: TypeScript con `@openai/agents`.
- API inicial de modelos: OpenAI Responses API.
- Historial: PostgreSQL propio mediante `PostgresAgentSession`.
- RAG: Supabase Postgres con pgvector.
- n8n no aloja ni orquesta el loop principal del agente.
- LangGraph fuera del MVP salvo decisión arquitectónica documentada.
- Canales iniciales: widget y WhatsApp.
- Multi-tenancy: base compartida con aislamiento lógico y RLS.

Haz que todos estos valores sean configurables y no constantes dispersas.

---

## 32. Criterio de finalización del MVP

El MVP solo se considera terminado cuando:

- La aplicación inicia localmente con instrucciones reproducibles.
- Existe un seed funcional.
- Los tres portales muestran información según rol.
- El aislamiento multi-tenant está probado.
- El fabricante puede crear distribuidores.
- El distribuidor puede crear clientes y agentes.
- Un agente publicado puede responder mediante el runtime central sin desplegar infraestructura individual.
- Un turno crea un `AgentRun` auditable y registra modelo, tokens, costo, fuentes y herramientas.
- La memoria persiste entre turnos y permanece aislada por tenant.
- El cliente puede ver conversaciones y consumo.
- El widget puede iniciar una conversación real contra el backend.
- Los mensajes consumen créditos correctamente.
- El cliente puede simular o completar una recarga mediante el proveedor configurado.
- El pago genera comisión.
- El fabricante puede crear un payout manual.
- Los webhooks pueden enviarse, firmarse, reintentarse y reproducirse.
- El modo soporte está auditado.
- Lint, typecheck, unit tests, integration tests y E2E críticos pasan.
- La documentación de instalación, arquitectura, API y operaciones está actualizada.

---

## 33. Primera tarea

Comienza ahora con la **Fase 0**.

1. Inspecciona el repositorio completo.
2. No borres código existente sin justificarlo.
3. Crea o actualiza la documentación de arquitectura.
4. Propón la estructura exacta del monorepo.
5. Identifica qué componentes ya existen y cuáles faltan.
6. Configura la base del proyecto.
7. Deja comandos reproducibles para ejecutar desarrollo, pruebas y migraciones.
8. Ejecuta las verificaciones disponibles.
9. Entrega un resumen preciso de resultados y continúa con la Fase 1 cuando la base esté estable.

Recuerda: prioriza seguridad multi-tenant, exactitud financiera, idempotencia y una experiencia clara para fabricante, distribuidor y cliente.

# FIN DEL PROMPT PARA MINIMAX
