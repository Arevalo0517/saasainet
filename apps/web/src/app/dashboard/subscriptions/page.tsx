'use client';

import * as React from 'react';
import Link from 'next/link';
import { apiFetch, getTenant, type StoredTenant } from '../../../lib/api-client';

type Subscription = {
  id: string;
  clientId: string;
  planId: string;
  planVersionId: string;
  status: string;
  billingInterval: string;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};

const canView = (roles: string[]): boolean =>
  roles.some((r) => r.startsWith('platform_') || r === 'distributor_owner' || r === 'distributor_admin' || r === 'client_admin');

const statusColor = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
      return '#16a34a';
    case 'PENDING_PAYMENT':
      return '#ca8a04';
    case 'CANCELLED':
    case 'EXPIRED':
      return '#dc2626';
    default:
      return '#666';
  }
};

export default function SubscriptionsPage(): React.JSX.Element {
  const [tenant] = React.useState<StoredTenant | null>(() => getTenant());
  const [items, setItems] = React.useState<Subscription[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const t = getTenant();
    if (t === null) {
      setLoading(false);
      return;
    }
    if (!canView(t.roles)) {
      setError('No tienes permisos para ver suscripciones');
      setLoading(false);
      return;
    }
    apiFetch<{ items: Subscription[] }>('/subscriptions')
      .then((data) => {
        setItems(data.items);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (tenant === null) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          <Link href="/login">Inicia sesión</Link> para ver suscripciones.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1080, margin: '0 auto' }}>
      <h1>Suscripciones</h1>
      <p>
        <Link href="/dashboard">← Volver al panel</Link>
      </p>
      {loading && <p>Cargando suscripciones…</p>}
      {error !== null && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {items !== null && items.length === 0 && <p>Aún no hay suscripciones.</p>}
      {items !== null && items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Plan</th>
              <th style={{ padding: 8 }}>Intervalo</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Periodo</th>
              <th style={{ padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>
                  <code style={{ fontSize: 12 }}>{s.clientId.slice(0, 8)}</code>
                </td>
                <td style={{ padding: 8 }}>
                  <code style={{ fontSize: 12 }}>{s.planId.slice(0, 8)}</code>
                </td>
                <td style={{ padding: 8 }}>{s.billingInterval}</td>
                <td style={{ padding: 8, color: statusColor(s.status), fontWeight: 600 }}>
                  {s.status}
                </td>
                <td style={{ padding: 8, fontSize: 12, color: '#666' }}>
                  {s.periodStart.slice(0, 10)} → {s.periodEnd.slice(0, 10)}
                </td>
                <td style={{ padding: 8 }}>
                  {s.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch<{ id: string; status: string }>(`/subscriptions/${s.id}/cancel`, {
                            method: 'PATCH',
                          });
                          setItems((prev) =>
                            prev === null
                              ? null
                              : prev.map((it) => (it.id === s.id ? { ...it, status: 'CANCELLED' } : it)),
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                      style={{ padding: '4px 8px', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
