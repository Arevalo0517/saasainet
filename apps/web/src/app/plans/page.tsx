'use client';

import * as React from 'react';
import { apiFetch, getTenant, type StoredTenant } from '../../lib/api-client';

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  active: boolean;
};

const formatPrice = (cents: number, currency: string): string => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
};

const fetchPlans = async (): Promise<{ items: Plan[] }> => {
  return apiFetch<{ items: Plan[] }>('/plans');
};

const fetchPlanWithVersions = async (id: string): Promise<{ plan: Plan; versions: Array<Record<string, unknown>> }> => {
  return apiFetch<{ plan: Plan; versions: Array<Record<string, unknown>> }>(`/plans/${id}`);
};

export default function PlansPage(): React.JSX.Element {
  const [tenant] = React.useState<StoredTenant | null>(() => getTenant());
  const [items, setItems] = React.useState<Plan[] | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [versions, setVersions] = React.useState<Array<Record<string, unknown>> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (selectedPlan === null) {
      setVersions(null);
      return;
    }
    fetchPlanWithVersions(selectedPlan)
      .then((data) => setVersions(data.versions))
      .catch((err: Error) => setError(err.message));
  }, [selectedPlan]);

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      <h1>Planes disponibles</h1>
      <p>
        <a href={tenant === null ? '/login' : '/dashboard'}>← Volver</a>
      </p>
      {loading && <p>Cargando planes…</p>}
      {error !== null && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {items !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          {items.map((plan) => (
            <article
              key={plan.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: 16,
                background: plan.active ? 'white' : '#f7f7f7',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <h2 style={{ margin: 0 }}>{plan.name}</h2>
              <p style={{ color: '#666', marginTop: 4 }}>
                <code>{plan.code}</code> {plan.isPublic ? '' : '· privado'}
              </p>
              {plan.description !== null && <p>{plan.description}</p>}
              {versions !== null && selectedPlan === plan.id && (
                <ul style={{ marginTop: 12, paddingLeft: 16 }}>
                  {versions.map((v) => (
                    <li key={v['id'] as string}>
                      {v['name'] as string} — {formatPrice(v['monthlyPriceCents'] as number, v['currency'] as string)}/mes
                      {v['annualPriceCents'] !== null && (
                        <> · {formatPrice(v['annualPriceCents'] as number, v['currency'] as string)}/año</>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
