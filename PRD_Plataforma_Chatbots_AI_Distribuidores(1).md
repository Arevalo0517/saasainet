# PRD — Plataforma SaaS de Chatbots con IA para Distribuidores

**Versión:** 1.1  
**Fecha:** 31 de julio de 2026  
**Estado:** Borrador funcional para validación y desarrollo  
**Propietario del producto:** Empresa fabricante / operador de la plataforma

---

## 1. Resumen ejecutivo

Se desarrollará una plataforma SaaS B2B2B, multi-tenant y preparada para white-label, que permita comercializar, configurar y operar agentes conversacionales con inteligencia artificial en los siguientes canales:

- WhatsApp.
- Instagram.
- Facebook Messenger.
- Telegram.
- Widget web.

La empresa fabricante será dueña de la tecnología, infraestructura, marca principal, relación de cobro con el cliente final y administración global del sistema.

Los distribuidores funcionarán como socios comerciales e implementadores. Tendrán acceso a un portal desde el cual podrán:

- Registrar a sus clientes.
- Crear y configurar agentes de IA.
- Conectar canales.
- Cargar bases de conocimiento.
- Crear automatizaciones mediante webhooks.
- Consultar conversaciones y consumo.
- Dar soporte de primer nivel.
- Consultar sus comisiones y pagos.

Los clientes finales pagarán directamente a la empresa fabricante. Cada cliente permanecerá asociado al distribuidor que lo registró o vendió, y el sistema calculará automáticamente la comisión correspondiente al distribuidor. De esta manera, el fabricante recibe el dinero directamente y no depende de que el distribuidor transfiera posteriormente los fondos.

El cliente no necesita conocer el porcentaje o acuerdo de comisión del distribuidor. Sin embargo, los términos, comprobantes de pago, facturas y descriptores de cobro deberán identificar correctamente a la entidad legal que presta y cobra el servicio.

Los planes comerciales se medirán por paquetes de mensajes. Cuando un cliente agote su paquete podrá:

1. Comprar una recarga de mensajes.
2. Cambiar a un plan superior.
3. Esperar la renovación de su ciclo, según las reglas de su suscripción.

---

## 2. Visión del producto

Crear una plataforma central que permita a la empresa fabricante escalar una red de distribuidores sin perder control sobre:

- Clientes.
- Agentes.
- Consumo.
- Cobros.
- Comisiones.
- Costos de IA.
- Seguridad.
- Soporte.
- Marca.
- Calidad de implementación.

La plataforma deberá evitar que cada distribuidor opere herramientas aisladas o instalaciones distintas. Todos utilizarán la misma aplicación y la misma infraestructura lógica, con aislamiento estricto de información por distribuidor y cliente.

---

## 3. Objetivos del negocio

### 3.1 Objetivos principales

1. Permitir que distribuidores autorizados vendan e implementen chatbots de IA bajo la marca del fabricante.
2. Cobrar directamente al cliente final para mejorar flujo de efectivo y reducir riesgo de cobranza.
3. Calcular y pagar comisiones a distribuidores de forma auditable.
4. Comercializar planes por consumo de mensajes.
5. Mantener control global sobre clientes, agentes, configuraciones, uso y costos.
6. Permitir soporte técnico del fabricante sin compartir contraseñas.
7. Escalar el producto a múltiples canales y clientes desde una sola plataforma.
8. Ofrecer white-label como beneficio o membresía premium para distribuidores de alto desempeño.
9. Integrarse inicialmente con sistemas externos mediante webhooks y n8n.

### 3.2 Resultados esperados

- Menor tiempo para dar de alta a un nuevo cliente.
- Ingreso centralizado y predecible para el fabricante.
- Mayor capacidad de expansión mediante distribuidores.
- Control del margen real por cliente, agente y canal.
- Menos errores de configuración y soporte.
- Experiencia uniforme para todos los clientes.

---

## 4. Modelo de negocio

### 4.1 Relación comercial

```text
Cliente final
    │
    │ paga plan o recarga
    ▼
Empresa fabricante / operador
    │
    │ registra comisión y realiza pago
    ▼
Distribuidor
```

El distribuidor vende, configura y atiende comercialmente al cliente. El fabricante cobra al cliente, opera la plataforma y paga la comisión al distribuidor.

### 4.2 Principios del modelo

- El fabricante es el receptor principal de los pagos.
- Cada cliente debe estar asociado a un distribuidor.
- Las reglas de comisión pueden variar por distribuidor, plan o campaña.
- Las comisiones deben calcularse desde pagos efectivamente cobrados.
- Reembolsos y contracargos deben reversar la comisión correspondiente.
- El distribuidor no podrá modificar registros contables ni comisiones ya generadas.
- El cliente no verá el margen o porcentaje de comisión del distribuidor.
- El fabricante podrá suspender pagos al distribuidor cuando existan contracargos, fraude, incumplimiento contractual o revisión pendiente.

### 4.3 Base recomendada para comisiones

Por defecto:

```text
Ingreso elegible = importe cobrado sin impuestos
                   - descuentos aplicables
                   - reembolsos
                   - contracargos

Comisión = ingreso elegible × porcentaje del distribuidor
```

Las tarifas del proveedor de pagos serán costo del fabricante, salvo que el contrato específico del distribuidor indique lo contrario.

### 4.4 Estados de una comisión

- `ESTIMATED`: generada, pero el pago todavía no está confirmado.
- `PENDING`: pago confirmado, dentro del periodo de retención.
- `AVAILABLE`: disponible para incluirse en un pago al distribuidor.
- `PAID`: pagada al distribuidor.
- `REVERSED`: reversada por reembolso, contracargo o corrección.
- `ON_HOLD`: retenida por revisión.

### 4.5 Pagos al distribuidor

Para el MVP se recomienda:

- Cálculo automático de comisiones.
- Revisión y conciliación desde el portal del fabricante.
- Pago manual por transferencia bancaria.
- Generación de estado de cuenta descargable.
- Periodicidad configurable: quincenal o mensual.
- Periodo de retención configurable antes de liberar la comisión.

En una fase posterior se podrán automatizar los pagos mediante un proveedor que soporte cuentas conectadas, validación de identidad y transferencias a terceros.

---

## 5. Modelo jerárquico y multi-tenant

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

### 5.1 Reglas de aislamiento

- El fabricante puede consultar toda la plataforma.
- Un distribuidor solo puede consultar sus clientes.
- Un cliente solo puede consultar su propia organización.
- Un usuario humano solo puede consultar conversaciones y módulos autorizados.
- Ninguna búsqueda, exportación, reporte o API deberá mezclar información de diferentes tenants.
- Las validaciones deberán realizarse tanto en la aplicación como en la base de datos.

### 5.2 Identificadores obligatorios

Los registros de negocio deberán incluir, cuando aplique:

- `platform_id`.
- `distributor_id`.
- `client_id`.
- `agent_id`.
- `channel_connection_id`.
- `conversation_id`.

---

## 6. Tipos de usuario y permisos

### 6.1 Fabricante / Superadministrador

Puede:

- Crear, editar, suspender y eliminar distribuidores.
- Consultar todos los clientes, agentes y usuarios.
- Asignar planes, límites, comisiones y funciones.
- Consultar pagos, facturas, recargas y suscripciones.
- Consultar comisiones y generar pagos a distribuidores.
- Consultar costo real de IA, canales e infraestructura.
- Crear plantillas globales de agentes.
- Activar o desactivar funciones por distribuidor.
- Consultar errores, webhooks, auditoría y salud del sistema.
- Ingresar en modo soporte a una cuenta.
- Administrar branding y white-label.
- Suspender clientes o agentes.
- Otorgar créditos manuales o ajustes autorizados.

### 6.2 Administrador del distribuidor

Puede:

- Crear y administrar clientes propios.
- Invitar empleados del distribuidor.
- Asignar roles internos.
- Crear agentes para sus clientes.
- Conectar canales.
- Cargar bases de conocimiento.
- Configurar webhooks y automatizaciones.
- Consultar conversaciones y consumo.
- Consultar sus comisiones.
- Consultar estado de pagos del fabricante.
- Dar soporte de primer nivel.
- Solicitar ayuda al fabricante.

No puede:

- Ver otros distribuidores.
- Ver costos globales del fabricante.
- Modificar el porcentaje de su comisión.
- Modificar registros contables.
- Consultar secretos de otros tenants.

### 6.3 Roles internos del distribuidor

- Administrador.
- Implementador de agentes.
- Soporte técnico.
- Ejecutivo comercial.
- Analista.
- Solo lectura.

Los permisos deberán ser configurables mediante RBAC.

### 6.4 Administrador del cliente

Puede:

- Consultar sus agentes.
- Consultar y responder conversaciones.
- Crear usuarios internos.
- Consultar contactos y leads.
- Consultar métricas y consumo.
- Comprar recargas.
- Cambiar de plan.
- Consultar facturas y pagos.
- Subir documentos a una base de conocimiento si el distribuidor lo autoriza.
- Solicitar modificaciones al agente.

Por defecto no puede:

- Ver el prompt completo del sistema.
- Ver API keys.
- Ver costos mayoristas.
- Ver comisiones.
- Modificar herramientas críticas.
- Publicar cambios sin aprobación del distribuidor.

### 6.5 Agente humano del cliente

Puede:

- Ver conversaciones asignadas.
- Responder mensajes.
- Agregar notas internas.
- Cambiar estados.
- Agregar etiquetas.
- Transferir conversaciones.
- Marcar conversaciones como resueltas.

---

## 7. Programa de marca y white-label

### 7.1 Modelo inicial

Todos los distribuidores venderán inicialmente el servicio bajo la marca del fabricante.

Esto permite:

- Mantener confianza y uniformidad.
- Reducir complejidad técnica.
- Controlar la reputación del producto.
- Acelerar lanzamientos.
- Centralizar marketing, cobros y soporte.

### 7.2 White-label premium

Cuando un distribuidor alcance un nivel definido de clientes activos, facturación o permanencia, podrá contratar una membresía white-label.

Criterios configurables:

- Número mínimo de clientes activos.
- MRR mínimo atribuido al distribuidor.
- Antigüedad mínima.
- Historial de pagos y cumplimiento.
- Membresía mensual o anual.

### 7.3 Funciones white-label

- Dominio personalizado.
- Logo.
- Colores.
- Nombre comercial.
- Favicon.
- Portal de acceso personalizado.
- Correos transaccionales con branding propio.
- Datos de soporte del distribuidor.
- PDFs y reportes con marca propia.
- Ocultamiento parcial o total de la marca del fabricante.

### 7.4 Regla legal y financiera

El white-label no cambia automáticamente a la entidad que cobra, factura o presta legalmente el servicio. Cualquier cambio de merchant, facturación o responsabilidad contractual deberá definirse mediante un acuerdo separado.

---

## 8. Planes, mensajes y recargas

### 8.1 Unidad comercial

Los planes serán vendidos por cantidad de mensajes incluidos en cada ciclo de facturación.

Nombre recomendado de la unidad:

> Crédito de mensaje

### 8.2 Definición recomendada de mensaje facturable

Por defecto, se contará un crédito por cada mensaje que la plataforma procese o entregue:

- Mensaje entrante de un usuario final.
- Mensaje saliente generado por IA.
- Mensaje saliente enviado por un agente humano desde la bandeja.

No se contarán:

- Confirmaciones de entrega.
- Confirmaciones de lectura.
- Eventos internos.
- Notas internas.
- Reintentos duplicados.
- Mensajes rechazados antes de ser entregados.
- Eventos técnicos del proveedor.

Reglas adicionales:

- Si un canal divide un mensaje largo en varias entregas, cada entrega confirmada puede contar como un mensaje.
- Un archivo, imagen, audio o documento cuenta inicialmente como un mensaje; análisis avanzado de medios podrá consumir unidades adicionales en el futuro.
- El backend deberá registrar también tokens, costo de IA y costo del canal, aunque el cliente sea cobrado por mensajes.

### 8.3 Ciclo de consumo

Orden recomendado de consumo:

1. Créditos incluidos en el plan mensual.
2. Créditos promocionales con fecha de expiración próxima.
3. Créditos de recarga.
4. Créditos de cortesía.

El orden deberá ser configurable.

### 8.4 Alertas de consumo

Enviar alertas al cliente y distribuidor en:

- 70%.
- 80%.
- 90%.
- 100%.

Las alertas deberán aparecer en:

- Portal.
- Correo.
- Webhook opcional.

### 8.5 Comportamiento al llegar al 100%

Configuración recomendada para el MVP:

- Continuar recibiendo y almacenando mensajes entrantes.
- Pausar las respuestas automáticas del agente de IA.
- Mostrar un aviso visible en el portal.
- Permitir que agentes humanos respondan únicamente si existe una política de gracia o créditos disponibles.
- Enviar una sola respuesta de contingencia configurable al usuario final, evitando mensajes repetitivos.
- Permitir compra inmediata de recarga o cambio de plan.
- Permitir al fabricante otorgar créditos de emergencia auditados.

Se deberá soportar posteriormente una modalidad de excedentes automáticos.

### 8.6 Recargas

Una recarga:

- Es una compra única.
- Agrega créditos inmediatamente después del pago confirmado.
- Puede tener o no fecha de expiración.
- Se asocia al cliente y a su distribuidor.
- Genera comisión para el distribuidor si así lo establece la regla comercial.
- Debe aparecer en el ledger de uso y en el estado de cuenta.

### 8.7 Cambio de plan

- Upgrade: inmediato, con cobro proporcional o diferencia definida.
- Downgrade: efectivo en la siguiente renovación.
- Cancelación: efectiva según la política contractual.
- Un plan debe conservar su versión histórica para no alterar suscripciones existentes.

### 8.8 Ledger de mensajes

Cada movimiento deberá registrarse en un ledger inmutable:

- Créditos por plan.
- Créditos por recarga.
- Créditos promocionales.
- Consumo por mensaje.
- Ajustes administrativos.
- Expiraciones.
- Reversos.

Cada movimiento deberá incluir:

- Fecha y hora.
- Cliente.
- Distribuidor.
- Conversación.
- Mensaje.
- Canal.
- Agente.
- Tipo de movimiento.
- Cantidad.
- Saldo posterior.
- Fuente.
- Usuario o proceso responsable.

---

## 9. Canales soportados

### 9.1 Canales objetivo

- WhatsApp.
- Instagram Direct.
- Facebook Messenger.
- Telegram.
- Widget web.

### 9.2 Arquitectura de canales

El agente deberá ser independiente del canal.

```text
WhatsApp ───────────┐
Instagram ──────────┤
Messenger ──────────┤
Telegram ───────────┼── Motor central del agente
Widget web ─────────┘
```

Cada conector normalizará eventos a un formato común de mensaje.

### 9.3 Propiedad de cuentas

Recomendación:

- Las cuentas, números, páginas y bots pertenecen al cliente final.
- El distribuidor acompaña la conexión.
- El fabricante almacena tokens y credenciales cifrados.
- El cliente conserva propiedad de sus activos digitales.

### 9.4 Fases de canales

**MVP:**

- Widget web.
- WhatsApp.

**Fase 2:**

- Telegram.
- Messenger.
- Instagram.

El sistema se diseñará desde el inicio con interfaces de adaptador para todos los canales.

---

## 10. Constructor y administración de agentes

### 10.1 Información del agente

- Nombre.
- Descripción.
- Cliente.
- Distribuidor.
- Idioma.
- Zona horaria.
- Objetivo.
- Personalidad.
- Tono.
- Mensaje de bienvenida.
- Mensaje fuera de horario.
- Reglas permitidas y prohibidas.
- Datos que puede solicitar.
- Datos sensibles que no puede solicitar.
- Modelo de IA.
- Parámetros del modelo.
- Estado.

### 10.2 Estados del agente

- `DRAFT`.
- `TESTING`.
- `PUBLISHED`.
- `PAUSED`.
- `ARCHIVED`.

### 10.3 Versionado

Cada modificación deberá crear una nueva versión.

```text
Versión 1 — Borrador
Versión 2 — Pruebas
Versión 3 — Publicada
Versión 4 — Nueva versión en revisión
```

Debe ser posible:

- Comparar versiones.
- Restaurar una versión anterior.
- Probar una versión sin afectar producción.
- Publicar con comentario de cambio.
- Saber quién realizó cada modificación.

### 10.4 Plantillas de agente

El fabricante podrá crear plantillas globales:

- Atención al cliente.
- Ventas.
- Generación de leads.
- Reservaciones.
- Seguimiento.
- Cobranza.
- Preguntas frecuentes.
- Soporte técnico.
- Calificación de prospectos.

El distribuidor podrá duplicarlas y adaptarlas a un cliente.

### 10.5 Ambiente de pruebas

Debe permitir:

- Simular conversaciones.
- Revisar respuestas.
- Inspeccionar qué información consultó el agente.
- Probar webhooks.
- Probar transferencia a humano.
- Ver consumo estimado.
- Validar respuestas prohibidas.
- Aprobar antes de publicar.

### 10.6 Tecnología del motor de agentes

Para el MVP, los agentes se implementarán mediante un **Agent Runtime central en Node.js/TypeScript**, ejecutado principalmente desde el worker de mensajes.

La implementación inicial utilizará:

- **OpenAI Agents SDK para TypeScript (`@openai/agents`)** como runtime de orquestación.
- **OpenAI Responses API** como API principal para generación, herramientas y ejecución de turnos.
- Un adaptador interno `AgentRuntime` para evitar que el dominio dependa directamente del SDK.
- Un catálogo de modelos administrado por el fabricante, sin fijar nombres de modelos directamente en el código de negocio.
- PostgreSQL como fuente principal del historial, estado y auditoría de las conversaciones.
- Supabase Postgres con `pgvector` para recuperación de conocimiento mediante RAG.
- Redis y BullMQ para procesar turnos, documentos, herramientas y reintentos de forma asíncrona.

El sistema **no creará un servidor, contenedor o proceso independiente por cada agente**. Cada agente será una configuración versionada almacenada en la base de datos que el runtime cargará cuando reciba un mensaje.

Una versión publicada del agente contendrá, entre otros elementos:

- Instrucciones y prompt del sistema.
- Perfil de modelo permitido.
- Parámetros autorizados.
- Bases de conocimiento asignadas.
- Herramientas disponibles.
- Guardrails.
- Reglas de transferencia.
- Configuración por canal.
- Política de memoria y retención.

### 10.7 Flujo de ejecución de un turno

```text
Canal recibe mensaje
        ↓
ChannelAdapter normaliza y deduplica
        ↓
API guarda el mensaje y registra consumo inbound
        ↓
BullMQ encola AgentTurnRequested
        ↓
Agent Runtime carga tenant, conversación y versión publicada
        ↓
Recupera memoria y fragmentos RAG permitidos
        ↓
Construye herramientas tipadas y guardrails
        ↓
OpenAI Agents SDK ejecuta el turno
        ↓
Secure Tool Executor ejecuta acciones HTTP o n8n, si aplica
        ↓
Se valida, guarda y audita la respuesta
        ↓
ChannelAdapter envía la respuesta y registra consumo outbound
```

Cada ejecución deberá ser idempotente y registrar:

- `agent_run_id`.
- Tenant y versión del agente.
- Mensaje que inició el turno.
- Modelo utilizado.
- Herramientas solicitadas y ejecutadas.
- Fuentes de conocimiento recuperadas.
- Tokens, latencia y costo estimado.
- Resultado, error o motivo de transferencia.
- Respuesta final permitida para auditoría.

No se almacenará razonamiento interno o chain-of-thought del modelo.

### 10.8 Memoria de conversación

La fuente de verdad del historial será la base de datos de la plataforma, no únicamente el proveedor de IA.

El runtime deberá implementar una sesión compatible con el SDK respaldada por PostgreSQL o construir explícitamente el contexto de cada turno. La estrategia inicial será:

- Últimos mensajes relevantes de la conversación.
- Resumen acumulado para conversaciones largas.
- Datos estructurados del contacto autorizados.
- Estado de herramientas y procesos pendientes.
- Fragmentos de conocimiento recuperados para el turno actual.

La memoria deberá estar aislada por `client_id`, `agent_id` y `conversation_id`, respetar la política de retención y permitir cambiar de proveedor en el futuro sin perder el historial propio.

### 10.9 Herramientas, webhooks y n8n

n8n se utilizará para **automatizaciones de negocio e integraciones**, pero no será el motor principal de conversación ni la fuente de verdad de los agentes.

Las acciones configuradas por el distribuidor se convertirán en herramientas tipadas para el agente. El modelo únicamente podrá solicitar una herramienta; la ejecución real será realizada por un componente seguro de la plataforma que:

- Valida permisos y JSON Schema.
- Resuelve secretos fuera del contexto del modelo.
- Aplica timeout, reintentos y límites.
- Protege contra SSRF.
- Registra argumentos y resultados permitidos.
- Solicita aprobación humana cuando la acción lo requiera.
- Puede invocar un webhook de n8n o una API externa.

Esto permitirá casos como consultar inventario, crear leads, agendar citas, crear tickets o revisar pedidos sin acoplar el agente a una integración específica.

### 10.10 Uso de otros frameworks

No se combinará OpenAI Agents SDK con LangGraph en el MVP. LangGraph podrá evaluarse en una fase posterior únicamente para procesos que realmente necesiten grafos complejos, ejecución durable de larga duración, múltiples aprobaciones humanas o reanudación de flujos determinísticos.

El diseño mediante `AgentRuntime`, `ModelProvider` y herramientas tipadas deberá permitir agregar otros proveedores o runtimes posteriormente sin reescribir los dominios de clientes, canales, conversaciones, uso y facturación.

---

## 11. Base de conocimiento

### 11.1 Fuentes iniciales

- Texto manual.
- Preguntas frecuentes.
- PDF.
- DOCX.
- CSV.
- URLs.
- Catálogos.

### 11.2 Reglas

- Aislamiento por cliente.
- Opción de asignar una base a uno o varios agentes del mismo cliente.
- Almacenamiento inicial de embeddings en Supabase Postgres mediante `pgvector`.
- Búsqueda vectorial siempre filtrada por `client_id`, `knowledge_base_id` y permisos del agente.
- Perfil de embeddings versionado para evitar mezclar vectores generados por modelos incompatibles.
- Índice vectorial apropiado cuando el volumen lo requiera.
- Historial de carga y procesamiento.
- Estado de indexación.
- Eliminación segura.
- Versionado de documentos.
- Reprocesamiento manual.
- Límites de almacenamiento por plan.

### 11.3 Permisos

El distribuidor controla si el cliente puede:

- Ver documentos.
- Cargar documentos.
- Eliminar documentos.
- Publicar cambios.

---

## 12. Bandeja omnicanal

### 12.1 Objetivo

Permitir que los usuarios humanos atiendan conversaciones de todos los canales desde una sola interfaz.

### 12.2 Funciones

- Lista de conversaciones.
- Filtros por canal, agente, estado, usuario y etiqueta.
- Búsqueda por nombre, teléfono, correo o contenido.
- Vista cronológica de mensajes.
- Respuesta humana.
- Transferencia.
- Asignación.
- Notas internas.
- Etiquetas.
- Archivos adjuntos.
- Datos del contacto.
- Datos recopilados por la IA.
- Resumen de conversación.
- Historial de cambios.

### 12.3 Estados sugeridos

- Nueva.
- Atendida por IA.
- Esperando cliente.
- Requiere humano.
- Asignada.
- En seguimiento.
- Resuelta.
- Cerrada.

### 12.4 Transferencia a humano

El agente podrá transferir por:

- Solicitud explícita del usuario.
- Intención configurada.
- Sentimiento negativo.
- Falta de respuesta confiable.
- Tema restringido.
- Horario o prioridad.
- Error de integración.

---

## 13. Integraciones iniciales mediante webhooks

### 13.1 Alcance inicial

No se desarrollarán integraciones directas con múltiples CRMs en el MVP. Se ofrecerá un sistema genérico de webhooks y acciones HTTP para que cada distribuidor conecte n8n u otras herramientas.

### 13.2 Webhooks salientes

Eventos mínimos:

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

### 13.3 Seguridad de webhooks

- Firma HMAC.
- Timestamp.
- ID único de evento.
- Idempotency key.
- Allowlist opcional de IP.
- Secretos cifrados.
- Rotación de secreto.
- Logs de entrega.
- Botón de reintento.

### 13.4 Reintentos

Política recomendada:

- Intento inmediato.
- 1 minuto.
- 5 minutos.
- 30 minutos.
- 2 horas.
- 12 horas.

Después, mover a una cola de errores y permitir replay manual.

### 13.5 Acciones HTTP del agente

El distribuidor podrá definir herramientas para que el agente consulte o envíe información a sistemas externos.

Cada acción incluirá:

- Nombre.
- Descripción.
- Método HTTP.
- URL.
- Headers.
- Autenticación.
- Esquema JSON de entrada.
- Esquema JSON de respuesta.
- Timeout.
- Política de reintento.
- Mapeo de variables.
- Ambiente de prueba y producción.

### 13.6 Casos de uso con n8n

- Crear lead en CRM.
- Agendar cita.
- Crear ticket.
- Consultar estado de pedido.
- Enviar correo.
- Notificar a un supervisor.
- Actualizar una hoja de cálculo.
- Consultar inventario.
- Ejecutar seguimiento automático.

---

## 14. Cobros, suscripciones y facturación

### 14.1 Funciones para el cliente

- Ver plan actual.
- Ver mensajes incluidos.
- Ver mensajes consumidos.
- Ver saldo.
- Comprar recarga.
- Hacer upgrade.
- Consultar renovaciones.
- Consultar historial de pagos.
- Descargar comprobantes o facturas.
- Actualizar método de pago.

### 14.2 Funciones para el distribuidor

- Consultar clientes atribuidos.
- Ver estado de suscripción.
- Ver ingresos atribuidos.
- Ver comisión estimada, pendiente, disponible y pagada.
- Descargar estados de cuenta.
- Consultar ajustes y reversos.

### 14.3 Funciones para el fabricante

- Crear planes y versiones.
- Definir precios.
- Definir paquetes de recarga.
- Aplicar descuentos.
- Generar cupones.
- Configurar comisión por distribuidor.
- Conciliar pagos.
- Reversar operaciones autorizadas.
- Generar pagos a distribuidores.
- Administrar impuestos y facturación.
- Consultar contracargos.

### 14.4 Reglas críticas

- Un pago exitoso debe ser idempotente.
- Un mismo webhook del proveedor no puede crear dos recargas.
- Las comisiones se generan únicamente después de confirmar el pago.
- Una devolución debe reversar créditos no consumidos según política y crear un ajuste contable.
- No se permitirá saldo negativo sin una política explícita de excedentes.
- Todos los cambios administrativos deberán quedar auditados.

---

## 15. Modo soporte del fabricante

### 15.1 Objetivo

Permitir que el fabricante ayude a un distribuidor o cliente sin conocer su contraseña.

### 15.2 Flujo

1. El usuario del fabricante selecciona un distribuidor o cliente.
2. Escribe el motivo del acceso.
3. Inicia una sesión temporal de soporte.
4. La interfaz muestra un banner permanente de modo soporte.
5. Las acciones quedan registradas.
6. La sesión expira automáticamente.

### 15.3 Auditoría obligatoria

- Usuario del fabricante.
- Cuenta visitada.
- Motivo.
- Fecha de inicio.
- Fecha de fin.
- IP.
- Navegador.
- Acciones realizadas.
- Cambios efectuados.

### 15.4 Restricciones

- No revelar contraseñas ni secretos completos.
- Solicitar reautenticación para acciones críticas.
- MFA obligatorio para personal del fabricante.
- Duración máxima configurable.

---

## 16. Paneles y experiencia por rol

### 16.1 Panel del fabricante

Secciones:

- Resumen global.
- Distribuidores.
- Clientes.
- Agentes.
- Canales.
- Conversaciones.
- Planes.
- Pagos.
- Comisiones.
- Payouts.
- Consumo y costos.
- White-label.
- Webhooks.
- Salud del sistema.
- Auditoría.
- Soporte.
- Configuración global.

### 16.2 Panel del distribuidor

Secciones:

- Resumen.
- Clientes.
- Agentes.
- Plantillas.
- Canales.
- Bandeja.
- Contactos.
- Base de conocimiento.
- Webhooks.
- Consumo.
- Comisiones.
- Estado de cuenta.
- Equipo y permisos.
- Branding.
- Soporte.

### 16.3 Panel del cliente

Secciones:

- Resumen.
- Bandeja.
- Contactos.
- Agentes contratados.
- Base de conocimiento, si tiene permiso.
- Métricas.
- Consumo.
- Plan y recargas.
- Pagos y facturas.
- Usuarios.
- Soporte.

---

## 17. Analítica y métricas

### 17.1 Métricas de uso

- Mensajes entrantes.
- Mensajes salientes de IA.
- Mensajes humanos.
- Conversaciones.
- Usuarios únicos.
- Consumo por agente.
- Consumo por canal.
- Consumo por cliente.
- Saldo disponible.
- Tasa de uso por día.
- Proyección de agotamiento.

### 17.2 Métricas operativas

- Tiempo de primera respuesta.
- Conversaciones resueltas por IA.
- Transferencias a humano.
- Tiempo de atención humana.
- Conversaciones abandonadas.
- Errores de canal.
- Errores de webhook.
- Tasa de entrega.

### 17.3 Métricas comerciales

- Clientes activos por distribuidor.
- MRR.
- Recargas vendidas.
- Upgrades.
- Cancelaciones.
- Comisión generada.
- Comisión pagada.
- Ingreso por mensaje.
- Costo real por mensaje.
- Margen bruto por cliente.
- Margen bruto por distribuidor.

### 17.4 Costos internos

Aunque el cliente pague por mensajes, el fabricante deberá medir:

- Tokens de entrada.
- Tokens de salida.
- Costo del modelo.
- Costo del canal.
- Costo de almacenamiento.
- Costo de embeddings.
- Costo por análisis de audio, imagen o documento.
- Costo de infraestructura.

---

## 18. Requisitos funcionales

### 18.1 Identidad y acceso

- **FR-001:** El sistema deberá permitir autenticación segura por correo y contraseña.
- **FR-002:** El sistema deberá soportar MFA para roles críticos.
- **FR-003:** El sistema deberá implementar RBAC.
- **FR-004:** Toda sesión deberá estar asociada a un tenant y rol.
- **FR-005:** Los usuarios del fabricante podrán iniciar sesiones de soporte auditadas.

### 18.2 Distribuidores

- **FR-010:** El fabricante podrá crear distribuidores.
- **FR-011:** El fabricante podrá asignar comisión, límites y membresía.
- **FR-012:** El distribuidor podrá invitar miembros de su equipo.
- **FR-013:** El distribuidor solo podrá ver sus clientes.
- **FR-014:** El sistema calculará elegibilidad para white-label.

### 18.3 Clientes

- **FR-020:** El distribuidor podrá crear clientes.
- **FR-021:** Todo cliente deberá pertenecer a un distribuidor.
- **FR-022:** El cliente podrá administrar usuarios propios.
- **FR-023:** El cliente podrá consultar consumo, plan y pagos.
- **FR-024:** El fabricante podrá suspender o reactivar clientes.

### 18.4 Agentes

- **FR-030:** El distribuidor podrá crear agentes desde cero o plantilla.
- **FR-031:** Los agentes deberán manejar versiones.
- **FR-032:** Los agentes deberán tener ambiente de prueba.
- **FR-033:** Solo versiones aprobadas podrán publicarse.
- **FR-034:** El agente deberá funcionar en uno o varios canales.
- **FR-035:** El fabricante podrá pausar cualquier agente.
- **FR-036:** Los agentes serán configuraciones versionadas ejecutadas por un runtime central; no se desplegará una instancia por agente.
- **FR-037:** El runtime deberá ejecutar únicamente la versión publicada y autorizada para el tenant.
- **FR-038:** El runtime deberá soportar herramientas tipadas, guardrails, RAG, memoria y transferencia a humano.
- **FR-039:** Cada turno deberá generar un registro auditable con modelo, uso, costo, herramientas, fuentes y resultado.

### 18.5 Mensajes y conversaciones

- **FR-040:** Todos los mensajes deberán normalizarse a un esquema común.
- **FR-041:** El sistema deberá deduplicar eventos de proveedor.
- **FR-042:** El sistema deberá registrar mensajes entrantes y salientes.
- **FR-043:** El sistema deberá descontar créditos según reglas configuradas.
- **FR-044:** El sistema deberá detener automatizaciones al agotar saldo según política.
- **FR-045:** El sistema deberá permitir transferencia a humano.

### 18.6 Planes y pagos

- **FR-050:** El fabricante podrá crear planes versionados.
- **FR-051:** El cliente podrá comprar una suscripción.
- **FR-052:** El cliente podrá comprar recargas.
- **FR-053:** El sistema deberá aplicar créditos únicamente después del pago confirmado.
- **FR-054:** El sistema deberá generar alertas de consumo.
- **FR-055:** El sistema deberá mantener un ledger de créditos.

### 18.7 Comisiones

- **FR-060:** Cada pago deberá asociarse a un distribuidor.
- **FR-061:** El sistema deberá calcular comisión automáticamente.
- **FR-062:** El sistema deberá manejar retenciones, reversos y pagos.
- **FR-063:** El distribuidor podrá consultar su estado de cuenta.
- **FR-064:** Solo el fabricante podrá aprobar un payout.

### 18.8 Webhooks

- **FR-070:** El distribuidor podrá crear endpoints de webhook por cliente.
- **FR-071:** Los eventos deberán enviarse con firma HMAC.
- **FR-072:** El sistema deberá reintentar entregas fallidas.
- **FR-073:** El usuario autorizado podrá revisar y repetir entregas.
- **FR-074:** Los agentes podrán invocar acciones HTTP configuradas.

### 18.9 Auditoría

- **FR-080:** Toda acción crítica deberá registrarse.
- **FR-081:** Los registros no podrán ser modificados por distribuidores o clientes.
- **FR-082:** El fabricante podrá filtrar y exportar auditoría.
- **FR-083:** Los cambios de permisos, pagos, créditos y agentes deberán registrar antes y después.

---

## 19. Requisitos no funcionales

### 19.1 Seguridad

- Cifrado TLS en tránsito.
- Cifrado de secretos en reposo.
- MFA para fabricante y distribuidores administradores.
- RBAC.
- Aislamiento multi-tenant.
- Rate limiting.
- Protección contra CSRF, XSS, SSRF y SQL injection.
- Webhooks firmados.
- Rotación de secretos.
- Logs de acceso.
- Backups cifrados.
- Política de retención y eliminación.

### 19.2 Disponibilidad

- Objetivo inicial: 99.5% mensual para MVP.
- Arquitectura preparada para escalar horizontalmente.
- Reintentos para eventos de canales.
- Colas para procesos asíncronos.
- Monitoreo y alertas.

### 19.3 Rendimiento

- Pantallas principales con respuesta objetivo menor a 2 segundos en condiciones normales.
- Recepción de webhook menor a 500 ms antes de enviar a cola.
- Idempotencia en pagos y mensajes.
- Paginación obligatoria para conversaciones, mensajes, clientes y auditoría.

### 19.4 Observabilidad

- Logs estructurados.
- Métricas.
- Trazas.
- Alertas.
- Dashboard de salud por proveedor.
- Correlation ID por evento.

### 19.5 Privacidad

- Retención configurable por cliente o plan.
- Exportación de datos.
- Eliminación lógica y física según política.
- Acceso de soporte auditado.
- Minimización de datos sensibles.

---

## 20. Modelo de datos conceptual

Entidades principales:

### Plataforma y usuarios

- `Platform`.
- `User`.
- `Role`.
- `Permission`.
- `UserRole`.
- `Session`.
- `MfaMethod`.

### Distribuidores

- `Distributor`.
- `DistributorMember`.
- `DistributorBranding`.
- `DistributorCommissionRule`.
- `DistributorMembership`.
- `DistributorBankAccount`.

### Clientes

- `Client`.
- `ClientMember`.
- `ClientSettings`.
- `Contact`.
- `Tag`.

### Agentes

- `Agent`.
- `AgentVersion`.
- `AgentTemplate`.
- `AgentTool`.
- `AgentGuardrailPolicy`.
- `AgentChannel`.
- `AgentSession`.
- `AgentRun`.
- `AgentRunStep`.
- `ToolExecution`.
- `ModelProfile`.
- `ConversationSummary`.
- `AgentTestSession`.

### Conocimiento

- `KnowledgeBase`.
- `KnowledgeDocument`.
- `KnowledgeChunk`.
- `KnowledgeIndexJob`.

### Canales y conversaciones

- `ChannelConnection`.
- `Conversation`.
- `ConversationAssignment`.
- `Message`.
- `MessageDelivery`.
- `InternalNote`.
- `Attachment`.

### Planes y uso

- `Plan`.
- `PlanVersion`.
- `Subscription`.
- `UsageEvent`.
- `MessageCreditLedger`.
- `TopUpProduct`.
- `TopUpPurchase`.
- `UsageThresholdNotification`.

### Pagos y comisiones

- `PaymentCustomer`.
- `PaymentMethod`.
- `Payment`.
- `Invoice`.
- `Refund`.
- `Chargeback`.
- `CommissionEntry`.
- `Payout`.
- `PayoutItem`.

### Integraciones

- `WebhookEndpoint`.
- `WebhookEvent`.
- `WebhookDelivery`.
- `HttpAction`.
- `SecretReference`.

### Seguridad y soporte

- `AuditLog`.
- `SupportSession`.
- `SecurityEvent`.
- `ApiKey`.

---

## 21. Eventos internos recomendados

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

Se recomienda implementar patrón outbox para evitar pérdida de eventos entre la base de datos y las colas.

---

## 22. Arquitectura técnica recomendada

### 22.1 Enfoque

- Monolito modular para el MVP.
- Servicios y workers separados solo donde exista necesidad real.
- Arquitectura orientada a eventos para mensajes, pagos y webhooks.
- Adaptadores para proveedores de IA, canales y pagos.
- Un solo producto multi-tenant, no una instalación por distribuidor.

### 22.2 Componentes

```text
Portal web
│
├── Portal del fabricante
├── Portal del distribuidor
└── Portal del cliente
        │
        ▼
API central
│
├── Identidad y permisos
├── Distribuidores
├── Clientes
├── Agentes
├── Conversaciones
├── Conocimiento
├── Consumo
├── Pagos
├── Comisiones
├── Webhooks
└── Auditoría
        │
        ├── Worker de mensajes
        ├── Worker de IA / Agent Runtime
        │       ├── OpenAI Agents SDK para TypeScript
        │       ├── Adaptador OpenAI Responses API
        │       ├── Memoria respaldada por PostgreSQL
        │       ├── Recuperación RAG con pgvector
        │       ├── Guardrails
        │       └── Secure Tool Executor
        ├── Worker de webhooks
        ├── Worker de pagos
        └── Worker de documentos
                │
                ├── WhatsApp
                ├── Instagram
                ├── Messenger
                ├── Telegram
                ├── Widget
                ├── Proveedor de IA
                ├── Proveedor de pagos
                └── n8n / sistemas externos
```

### 22.3 Principios técnicos

- Idempotencia obligatoria.
- Tenant context obligatorio.
- Secretos fuera del código.
- Separación entre configuración y ejecución.
- API versionada.
- Migraciones de base de datos.
- Feature flags.
- Pruebas automáticas de aislamiento.
- Colas para tareas lentas.

### 22.4 Decisión tecnológica para agentes

| Capa | Decisión inicial |
|---|---|
| Lenguaje del runtime | TypeScript sobre Node.js |
| Orquestación de agentes | OpenAI Agents SDK para TypeScript |
| API del modelo | OpenAI Responses API |
| Procesamiento | Worker BullMQ separado de la API web |
| Historial y memoria | PostgreSQL de la plataforma |
| RAG | Supabase Postgres + pgvector |
| Herramientas | Function tools tipadas ejecutadas por Secure Tool Executor |
| Automatizaciones externas | Webhooks y n8n |
| Observabilidad | `AgentRun`, logs estructurados, métricas y tracing |
| Proveedores futuros | Mediante interfaces `AgentRuntime` y `ModelProvider` |

La elección conserva un solo stack TypeScript para frontend, API y workers, reduce complejidad operativa y permite utilizar herramientas, handoffs, guardrails, sesiones, streaming y tracing sin construir desde cero el loop del agente.

La lógica de consumo, permisos, tenant, facturación y auditoría permanecerá fuera del SDK. El SDK será una dependencia de infraestructura del runtime, no el núcleo del dominio de negocio.

---

## 23. Flujos principales

### 23.1 Alta de distribuidor

1. Fabricante crea distribuidor.
2. Asigna comisión, límites y plan de membresía.
3. Invita administrador.
4. Distribuidor completa datos.
5. Distribuidor acepta contrato.
6. Cuenta queda activa.

### 23.2 Alta de cliente

1. Distribuidor crea cliente.
2. Sistema asocia `distributor_id`.
3. Distribuidor selecciona plan.
4. Se genera checkout o invitación de pago.
5. Cliente paga al fabricante.
6. Se activa la suscripción.
7. Se acreditan mensajes.
8. Se genera comisión pendiente.
9. Distribuidor configura agentes.

### 23.3 Compra de recarga

1. Cliente recibe alerta de consumo.
2. Selecciona paquete de recarga.
3. Realiza pago al fabricante.
4. Proveedor confirma el pago.
5. Sistema valida idempotencia.
6. Agrega créditos al ledger.
7. Reactiva automatizaciones si estaban pausadas.
8. Genera comisión.
9. Notifica al cliente y distribuidor.

### 23.4 Agotamiento de saldo

1. Sistema descuenta el último crédito.
2. Publica evento `CreditsExhausted`.
3. Pausa respuestas automáticas.
4. Conserva mensajes entrantes.
5. Envía alertas.
6. Muestra opciones de recarga o upgrade.
7. Al recibir créditos, reactiva el agente.

### 23.5 Soporte del fabricante

1. Distribuidor solicita soporte.
2. Fabricante abre la cuenta.
3. Especifica motivo.
4. Inicia sesión de soporte.
5. Revisa configuración y logs.
6. Realiza cambios autorizados.
7. Cierra sesión.
8. Sistema conserva auditoría.

---

## 24. MVP recomendado

### 24.1 Incluido

1. Autenticación y MFA básico.
2. Roles y permisos.
3. Portal del fabricante.
4. Portal del distribuidor.
5. Portal básico del cliente.
6. Administración de distribuidores y clientes.
7. Planes por mensajes.
8. Suscripciones y recargas.
9. Ledger de créditos.
10. Comisiones.
11. Payouts manuales.
12. Creación y versionado de agentes.
13. Motor de agentes en TypeScript con OpenAI Agents SDK y Responses API.
14. Memoria de conversación respaldada por PostgreSQL.
15. Plantillas.
16. Base de conocimiento básica con pgvector.
17. Widget web.
18. WhatsApp.
19. Bandeja omnicanal.
20. Transferencia a humano.
21. Webhooks salientes.
22. Acciones HTTP para n8n.
23. Modo soporte.
24. Auditoría.
25. Métricas básicas.
26. Branding del fabricante.

### 24.2 Fuera del MVP

- Subdistribuidores.
- Marketplace público.
- Aplicación móvil nativa.
- Constructor visual complejo de automatizaciones.
- Integraciones directas con múltiples CRMs.
- Pagos automáticos a distribuidores.
- White-label completo.
- Excedentes automáticos.
- SSO empresarial.
- Infraestructura dedicada por cliente.

---

## 25. Fases posteriores

### Fase 2

- Telegram.
- Messenger.
- Instagram.
- White-label premium.
- Dominio personalizado.
- Reportes avanzados.
- Automatización de payouts.
- Cupones y promociones.
- Modelos de IA alternativos.
- Analítica de intención y sentimiento.

### Fase 3

- API pública.
- Marketplace de plantillas.
- Integraciones nativas con CRM.
- Aplicación móvil.
- Subdistribuidores.
- SSO.
- Entornos dedicados.
- SLA empresariales.

---

## 26. Criterios de aceptación del MVP

1. Un distribuidor no puede consultar clientes de otro distribuidor mediante UI, API o manipulación de URL.
2. Un cliente no puede consultar datos de otro cliente.
3. El fabricante puede consultar toda la plataforma.
4. Toda sesión de soporte queda auditada.
5. Un pago exitoso acredita mensajes una sola vez.
6. Una recarga aumenta el saldo inmediatamente después de confirmación.
7. Al llegar a cero créditos, el agente aplica la política configurada.
8. El saldo mostrado coincide con el ledger.
9. Cada pago genera la comisión correcta.
10. Un reembolso genera un reverso de comisión.
11. El distribuidor puede consultar comisión pendiente y pagada.
12. El fabricante puede crear un payout y marcarlo como pagado.
13. Un agente puede publicarse, pausarse y restaurar versiones.
14. Los mensajes del widget y WhatsApp aparecen en la misma bandeja.
15. Los webhooks llevan firma y pueden reintentarse.
16. Los eventos duplicados no crean mensajes, créditos o pagos duplicados.
17. El white-label solo se aplica cuando la membresía está activa.
18. Todas las acciones administrativas críticas aparecen en auditoría.

---

## 27. Indicadores de éxito

### Producto

- Tiempo de alta de cliente menor a 30 minutos, sin incluir aprobaciones externas de canales.
- Tiempo de creación de agente básico menor a 45 minutos.
- Reducción de incidencias de configuración.
- Porcentaje de conversaciones resueltas por IA.
- Tasa de entrega de mensajes.

### Negocio

- Distribuidores activos.
- Clientes activos por distribuidor.
- MRR.
- Ingreso promedio por cliente.
- Recargas por cliente.
- Churn.
- Margen bruto.
- Tiempo promedio para pagar comisiones.

### Operación

- Disponibilidad.
- Errores de canal.
- Entregas fallidas de webhook.
- Tiempo de resolución de soporte.
- Incidentes de aislamiento entre tenants: objetivo cero.

---

## 28. Riesgos y mitigaciones

### 28.1 Costos variables de IA superiores al precio por mensaje

**Mitigación:** medir costo real por mensaje, establecer límites de tokens, usar modelos por nivel y revisar margen por plan.

### 28.2 Clientes que agotan créditos durante conversaciones críticas

**Mitigación:** alertas anticipadas, compra inmediata, grace policy configurable y créditos de emergencia auditados.

### 28.3 Doble procesamiento de webhooks

**Mitigación:** idempotency keys, locks, deduplicación y ledger inmutable.

### 28.4 Acceso cruzado entre distribuidores

**Mitigación:** RLS, tenant context, pruebas automáticas y revisión de seguridad.

### 28.5 Contracargos después de pagar comisión

**Mitigación:** periodo de retención, reservas y reversos automáticos.

### 28.6 Dependencia de APIs externas

**Mitigación:** adaptadores, colas, reintentos, circuit breakers y monitoreo.

### 28.7 Confusión sobre quién cobra al cliente

**Mitigación:** términos claros, descriptor de pago, factura correcta y comunicación comercial consistente.

---

## 29. Decisiones ya tomadas

- El fabricante cobrará directamente al cliente final.
- El fabricante pagará una comisión al distribuidor.
- Los planes se venderán por mensajes.
- Existirán recargas de mensajes.
- El cliente podrá subir de plan.
- La marca principal será la del fabricante.
- White-label será un beneficio premium para distribuidores elegibles.
- Las integraciones iniciales serán mediante webhooks.
- n8n será una herramienta recomendada para automatizaciones, no el motor principal de los agentes.
- El motor inicial de agentes será TypeScript con OpenAI Agents SDK y Responses API.
- Los agentes serán configuraciones dinámicas y versionadas; no se desplegará una instancia por agente.
- PostgreSQL será la fuente de verdad del historial y estado de conversación.
- Supabase Postgres con pgvector será la opción inicial para RAG.
- El fabricante tendrá acceso global y modo soporte.
- El distribuidor creará y administrará clientes y agentes.

---

## 30. Decisiones pendientes

Estas decisiones no bloquean la creación del MVP, pero deben validarse antes de producción:

1. Porcentaje o fórmula de comisión por distribuidor.
2. Periodicidad de payout: quincenal o mensual.
3. Días de retención antes de liberar comisiones.
4. Definición contractual final del mensaje facturable.
5. Si los mensajes humanos también consumen créditos en todos los planes.
6. Política exacta al llegar al 100%.
7. Expiración de recargas.
8. Rollover de mensajes mensuales.
9. Política de reembolsos.
10. Entidad que emite factura y tratamiento fiscal.
11. Proveedor de pagos inicial.
12. Umbral de clientes o MRR para white-label.
13. Precio de la membresía white-label.
14. Retención de conversaciones y archivos.
15. Idiomas iniciales de la interfaz.
16. Canales exactos incluidos en la primera liberación comercial.
17. Modelos exactos de OpenAI habilitados para cada nivel de servicio.
18. Momento y requisitos para agregar proveedores de IA alternativos.
19. Límites de almacenamiento por plan.

---

## 31. Supuestos utilizados para comenzar desarrollo

Mientras se confirman las decisiones pendientes, se utilizarán estos defaults:

- Comisión configurable por porcentaje.
- Payout mensual y manual.
- Retención de 15 días.
- Sin rollover de créditos mensuales.
- Recargas con vigencia configurable; default 90 días.
- Upgrade inmediato y downgrade en siguiente ciclo.
- Pausa de IA al agotar créditos.
- Widget web y WhatsApp como primeros canales.
- Marca del fabricante para todos los distribuidores.
- White-label deshabilitado por defecto.
- Webhooks firmados y n8n como integración principal.
- Runtime central en TypeScript con `@openai/agents` y OpenAI Responses API.
- Un modelo rápido/económico y uno premium configurables desde un catálogo administrado, sin nombres hardcodeados en dominio.
- Memoria propia en PostgreSQL y RAG en pgvector.
- Un solo sistema multi-tenant con aislamiento lógico.

---

## 32. Glosario

- **Fabricante:** propietario de la plataforma y receptor de pagos.
- **Distribuidor:** socio que vende, configura y atiende clientes.
- **Cliente:** organización que contrata el servicio.
- **Agente:** chatbot con instrucciones, conocimiento y herramientas.
- **Mensaje facturable:** unidad descontada del paquete comercial.
- **Recarga:** compra única de créditos adicionales.
- **Payout:** pago de comisiones al distribuidor.
- **White-label:** personalización de marca para un distribuidor.
- **Tenant:** organización aislada dentro de la plataforma.
- **Ledger:** registro inmutable de movimientos.
- **Handoff:** transferencia de la conversación de IA a humano.
- **Webhook:** evento HTTP enviado a un sistema externo.

---

## 33. Declaración final del producto

> Plataforma SaaS multi-tenant para comercializar y operar chatbots de inteligencia artificial mediante una red de distribuidores. El fabricante controla la tecnología, marca, cobros, planes, consumo, comisiones, seguridad y soporte global. Los distribuidores crean clientes y agentes, conectan canales y brindan soporte de primer nivel. Los clientes pagan directamente al fabricante, utilizan paquetes de mensajes y pueden comprar recargas o cambiar de plan. El sistema ofrece bandeja omnicanal, bases de conocimiento, automatizaciones mediante webhooks, analítica, auditoría y una ruta de crecimiento hacia white-label premium.
