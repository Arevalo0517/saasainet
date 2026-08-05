# Matriz de permisos

> última actualización: Fase 0.
> Implementación en código: `packages/auth/src/permissions.ts`.

## Roles

### Plataforma
- `PLATFORM_SUPER_ADMIN` — todo.
- `PLATFORM_SUPPORT` — lectura global + modo soporte.
- `PLATFORM_FINANCE` — pagos, comisiones, payouts.
- `PLATFORM_ANALYST` — lectura global sin acciones de escritura.

### Distribuidor
- `DISTRIBUTOR_ADMIN`
- `DISTRIBUTOR_IMPLEMENTER`
- `DISTRIBUTOR_SUPPORT`
- `DISTRIBUTOR_SALES`
- `DISTRIBUTOR_ANALYST`
- `DISTRIBUTOR_READ_ONLY`

### Cliente
- `CLIENT_ADMIN`
- `CLIENT_MANAGER`
- `CLIENT_HUMAN_AGENT`
- `CLIENT_ANALYST`
- `CLIENT_READ_ONLY`

## Permisos

```text
platform:distributor:write
platform:distributor:read
platform:client:read
platform:plan:write
platform:payment:read
platform:commission:read
platform:payout:write
platform:audit:read
platform:support:start

distributor:client:write
distributor:client:read
distributor:agent:write
distributor:agent:read
distributor:channel:write
distributor:knowledge:write
distributor:webhook:write
distributor:commission:read
distributor:branding:write
distributor:inbox:read
distributor:inbox:write

client:agent:read
client:inbox:read
client:inbox:write
client:contact:read
client:contact:write
client:knowledge:read
client:usage:read
client:billing:read
client:billing:write
client:user:invite
client:prompt:read
```

## Matriz rol × permisos

| Permiso | SUP_ADMIN | SUPPORT | FINANCE | ANALYST | D_ADMIN | D_IMPL | D_SUP | D_SALES | D_ANL | D_RO | C_ADMIN | C_MGR | C_HUMAN | C_ANL | C_RO |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `platform:distributor:write` | ✓ | | | | | | | | | | | | | | | |
| `platform:distributor:read` | ✓ | ✓ | | ✓ | | | | | | | | | | | |
| `platform:client:read` | ✓ | ✓ | | ✓ | | | | | | | | | | | |
| `platform:plan:write` | ✓ | | | | | | | | | | | | | | | |
| `platform:payment:read` | ✓ | | ✓ | | | | | | | | | | | | |
| `platform:commission:read` | ✓ | | ✓ | ✓ | | | | | | | | | | | |
| `platform:payout:write` | ✓ | | ✓ | | | | | | | | | | | | |
| `platform:audit:read` | ✓ | ✓ | | | | | | | | | | | | | |
| `platform:support:start` | ✓ | ✓ | | | | | | | | | | | | | |
| `distributor:client:write` | ✓ | | | | ✓ | | | ✓ | | | | | | | |
| `distributor:client:read` | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| `distributor:agent:write` | ✓ | | | | ✓ | ✓ | | | | | | | | | |
| `distributor:agent:read` | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | | | | |
| `distributor:channel:write` | ✓ | | | | ✓ | ✓ | | | | | | | | | |
| `distributor:knowledge:write` | ✓ | | | | ✓ | ✓ | | | | | | | | | |
| `distributor:webhook:write` | ✓ | | | | ✓ | | | | | | | | | | |
| `distributor:commission:read` | ✓ | | ✓ | ✓ | ✓ | | | ✓ | ✓ | | | | | | |
| `distributor:branding:write` | ✓ | | | | ✓ | | | | | | | | | | |
| `distributor:inbox:read` | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | | | | |
| `distributor:inbox:write` | ✓ | | | | ✓ | | ✓ | | | | | | | | |
| `client:agent:read` | ✓ | ✓ | | ✓ | | | | | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `client:inbox:read` | ✓ | ✓ | | ✓ | | | | | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `client:inbox:write` | ✓ | | | | | | | | | | ✓ | ✓ | ✓ | | |
| `client:contact:read` | ✓ | ✓ | | ✓ | | | | | | | ✓ | ✓ | ✓ | ✓ | |
| `client:contact:write` | ✓ | | | | | | | | | | ✓ | | | | |
| `client:knowledge:read` | ✓ | ✓ | | ✓ | | | | | | | ✓ | | | | |
| `client:usage:read` | ✓ | ✓ | | ✓ | | | | | | | ✓ | ✓ | ✓ | ✓ | |
| `client:billing:read` | ✓ | | ✓ | | | | | | | | ✓ | ✓ | | | |
| `client:billing:write` | ✓ | | | | | | | | | | ✓ | | | | |
| `client:user:invite` | ✓ | | | | | | | | | | ✓ | | | | |
| `client:prompt:read` | ✓ | | | | | | | | | | ✓ | | | | |

## Reglas importantes

1. **Wildcard `*` solo en `PLATFORM_SUPER_ADMIN`.**
2. **Ningún cliente puede ver el prompt completo del sistema sin permiso explícito del distribuidor.** Por defecto, `client:prompt:read = false`.
3. **Ningún rol puede ver APIs/comisiones de otro tenant.**
4. **Modo soporte añade permisos temporales** vía `support_sessions`, registradas en `audit_logs` con `actor`, `target_account`, `reason`, `inicio`, `fin`.
5. **El frontend nunca debe recibir ni confiar en IDs de tenant.** Toda validación es en servidor.

## Pruebas automáticas

Las pruebas de Fase 1 cubren:
- Distributor A no ve clientes de Distributor B.
- Cliente A1 no ve Cliente A2.
- `CLIENT_READ_ONLY` no puede escribir en inbox.
- `PLATFORM_FINANCE` no puede escribir en audit logs.
- Wildcard solo en `PLATFORM_SUPER_ADMIN`.
- Modo soporte requiere motivo y genera registro en `audit_logs`.
