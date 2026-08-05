-- ============================================================================
-- SEED: Fase 4 — 1 agente + 1 versión PUBLISHED para CLIENT_A1,
-- 1 knowledge base, 1 document con 2 chunks (embeddings placeholder).
-- 1 conversación + 2 mensajes.
-- ============================================================================
-- Idempotente: usa ON CONFLICT (id) DO NOTHING.

-- AGENT
INSERT INTO public.agents (id, platform_id, distributor_id, client_id, key, name, description, default_locale, default_timezone)
VALUES
  ('a0000002-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'soporte-a1', 'Agente Soporte A1', 'Atención al cliente de Cliente A1', 'es', 'America/Mexico_City')
ON CONFLICT (id) DO NOTHING;

-- AGENT_VERSION (v1 PUBLISHED)
INSERT INTO public.agent_versions (id, platform_id, agent_id, version, state, name, language, timezone, objective, personality, tone, system_prompt, welcome_message, allowed_rules, forbidden_rules, data_to_request, sensitive_data_forbidden, model_profile, model_parameters, published_at, published_by)
VALUES
  ('a0000002-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-000000000001', 'a0000002-0000-4000-8000-000000000001', 1, 'PUBLISHED', 'Soporte A1 v1', 'es', 'America/Mexico_City', 'Resolver dudas frecuentes y escalar a humano cuando sea necesario', 'Amable, profesional, paciente', 'Cercano y respetuoso', 'Eres un agente de soporte. Responde solo con información de la knowledge base. Si no sabes, escala a humano.', '¡Hola! ¿En qué puedo ayudarte?', '[]'::jsonb, '["No reveles datos personales"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'openai:gpt-4o-mini', '{"temperature":0.3,"max_tokens":500}'::jsonb, '2026-01-15T00:00:00Z', '22222222-2222-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- KNOWLEDGE_BASE
INSERT INTO public.knowledge_bases (id, platform_id, distributor_id, client_id, agent_id, name, description, embedding_model, embedding_dimensions, status)
VALUES
  ('a0000002-0000-4000-8000-000000000002', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000002-0000-4000-8000-000000000001', 'KB Soporte A1', 'Base de conocimiento inicial', 'openai:text-embedding-3-small', 1536, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- DOCUMENT
INSERT INTO public.documents (id, platform_id, distributor_id, client_id, knowledge_base_id, title, source_type, status, chunk_count, metadata)
VALUES
  ('a0000002-0000-4000-8000-000000000003', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000002-0000-4000-8000-000000000002', 'FAQ Inicial', 'TEXT', 'READY', 2, '{"seed":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- CHUNKS (embeddings 1536-dim dummy; los reales se generan vía MockEmbeddingProvider en tests)
INSERT INTO public.chunks (id, document_id, knowledge_base_id, platform_id, distributor_id, client_id, position, content, token_count, embedding, metadata)
VALUES
  ('a0000002-0000-4000-8000-000000000010', 'a0000002-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 0, 'Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00.', 18, array_fill(0.1, ARRAY[1536])::vector, '{}'::jsonb),
  ('a0000002-0000-4000-8000-000000000011', 'a0000002-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 1, 'Para cancelar una orden, contacta a soporte con tu número de pedido.', 22, array_fill(0.2, ARRAY[1536])::vector, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- CONVERSATION
INSERT INTO public.conversations (id, platform_id, distributor_id, client_id, agent_id, agent_version_id, channel, state, customer_display_name, customer_external_id, last_message_at, message_count, metadata)
VALUES
  ('a0000002-0000-4000-8000-000000000020', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000002-0000-4000-8000-000000000001', 'a0000002-0000-4000-8000-0000000000a1', 'WIDGET', 'AI_ACTIVE', 'Cliente Demo', 'cust-demo-1', '2026-01-20T12:00:00Z', 2, '{"seed":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- MESSAGES
INSERT INTO public.messages (id, platform_id, distributor_id, client_id, conversation_id, direction, role, content, token_count, citations, metadata)
VALUES
  ('a0000002-0000-4000-8000-000000000030', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000002-0000-4000-8000-000000000020', 'INBOUND', 'USER', '¿Cuál es su horario?', 5, '[]'::jsonb, '{}'::jsonb),
  ('a0000002-0000-4000-8000-000000000031', 'f0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-0000000000a1', 'f0000001-0000-4000-8000-0000000000c1', 'a0000002-0000-4000-8000-000000000020', 'OUTBOUND', 'ASSISTANT', 'Nuestro horario es de lunes a viernes de 9:00 a 18:00.', 16, '[{"documentId":"a0000002-0000-4000-8000-000000000003","chunkId":"a0000002-0000-4000-8000-000000000010","position":0}]'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
