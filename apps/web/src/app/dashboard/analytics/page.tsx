'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getTenant } from '../../../lib/api-client';

interface AggregateRow {
  key: string;
  totalQuantity: number;
  totalCostCents: number;
  eventCount: number;
}

interface AggregateResponse {
  rows: AggregateRow[];
  totals: AggregateRow;
  from: string;
  to: string;
  groupBy: string;
}

const GROUP_BY_OPTIONS: Array<{ value: 'day' | 'metric' | 'agent' | 'channel' | 'client' | 'distributor'; label: string }> = [
  { value: 'day', label: 'Por día' },
  { value: 'metric', label: 'Por métrica' },
  { value: 'agent', label: 'Por agente' },
  { value: 'channel', label: 'Por canal' },
  { value: 'client', label: 'Por cliente' },
  { value: 'distributor', label: 'Por distribuidor' },
];

const METRIC_OPTIONS: Array<{ value: '' | string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'messages_sent', label: 'Mensajes enviados' },
  { value: 'messages_received', label: 'Mensajes recibidos' },
  { value: 'agent_runs', label: 'Runs de agente' },
  { value: 'tokens_input', label: 'Tokens input' },
  { value: 'tokens_output', label: 'Tokens output' },
];

const formatDate = (s: string): string => {
  if (s.length === 0) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
};

const formatCost = (cents: number): string => {
  if (cents === 0) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
};

const AuthGate = ({ children }: { children: React.ReactNode }): JSX.Element | null => {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = getTenant();
    if (t === null) router.replace('/login');
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return <>{children}</>;
};

const BarChart = ({ rows }: { rows: AggregateRow[]; groupBy?: string }): JSX.Element => {
  if (rows.length === 0) return <div className="py-12 text-center text-cloud/50 text-sm">Sin datos para el rango seleccionado.</div>;
  const max = Math.max(...rows.map((r) => r.totalQuantity), 1);
  return (
    <div className="space-y-2">
      {rows.slice(0, 30).map((r) => {
        const width = `${(r.totalQuantity / max) * 100}%`;
        return (
          <div key={r.key} className="flex items-center gap-3">
            <div className="w-32 truncate text-xs text-cloud/60 font-mono">{r.key}</div>
            <div className="flex-1">
              <div className="h-7 rounded bg-gradient-to-r from-electric-500/60 to-cyan-ai/60 transition-all" style={{ width }} />
            </div>
            <div className="w-20 text-right text-xs text-cloud/80 font-mono">{r.totalQuantity.toLocaleString('es-ES')}</div>
            <div className="w-20 text-right text-xs text-cloud/50 font-mono">{r.eventCount} ev</div>
          </div>
        );
      })}
      {rows.length > 30 && <div className="text-xs text-cloud/40 text-center pt-2">+{rows.length - 30} más…</div>}
    </div>
  );
};

export default function AnalyticsPage(): JSX.Element {
  const tenant = getTenant();
  const [data, setData] = React.useState<AggregateResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [groupBy, setGroupBy] = React.useState<'day' | 'metric' | 'agent' | 'channel' | 'client' | 'distributor'>('day');
  const [metric, setMetric] = React.useState<string>('');
  const [from, setFrom] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = React.useState<string>(() => new Date().toISOString().slice(0, 10));

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('from', new Date(from).toISOString());
      params.set('to', new Date(`${to}T23:59:59`).toISOString());
      params.set('groupBy', groupBy);
      if (metric !== '') params.set('metric', metric);
      const res = await apiFetch<AggregateResponse>(`/usage-events/aggregate?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy, metric]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (tenant === null) return <div />;

  return (
    <AuthGate>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-cloud">Analytics</h1>
          <p className="mt-1 text-sm text-cloud/60">Uso agregado tenant-scoped. Período por defecto: últimos 30 días.</p>
        </header>

        <section className="midnight-card mb-6 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Desde</span>
              <input type="date" className="input-midnight w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Hasta</span>
              <input type="date" className="input-midnight w-full" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Agrupar por</span>
              <select className="input-midnight w-full" value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
                {GROUP_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Métrica</span>
              <select className="input-midnight w-full" value={metric} onChange={(e) => setMetric(e.target.value)}>
                {METRIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="button" className="btn-electric w-full" onClick={() => void load()} disabled={loading}>
                {loading ? 'Cargando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </section>

        {error !== null && (
          <div className="midnight-card mb-4 p-3 text-sm text-warm">
            Error: {error}
          </div>
        )}

        {data !== null && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="midnight-card p-4">
                <div className="text-xs text-cloud/50">Total eventos</div>
                <div className="mt-1 text-2xl font-semibold text-cloud font-mono">{data.totals.eventCount.toLocaleString('es-ES')}</div>
              </div>
              <div className="midnight-card p-4">
                <div className="text-xs text-cloud/50">Cantidad total</div>
                <div className="mt-1 text-2xl font-semibold text-electric-300 font-mono">{data.totals.totalQuantity.toLocaleString('es-ES')}</div>
              </div>
              <div className="midnight-card p-4">
                <div className="text-xs text-cloud/50">Costo total</div>
                <div className="mt-1 text-2xl font-semibold text-warm font-mono">{formatCost(data.totals.totalCostCents)}</div>
              </div>
              <div className="midnight-card p-4">
                <div className="text-xs text-cloud/50">Período</div>
                <div className="mt-1 text-sm text-cloud/80">
                  {formatDate(data.from)} → {formatDate(data.to)}
                </div>
              </div>
            </div>

            <section className="midnight-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-cloud/80">
                Distribución ({GROUP_BY_OPTIONS.find((g) => g.value === data.groupBy)?.label ?? data.groupBy})
              </h2>
              <BarChart rows={data.rows} groupBy={data.groupBy} />
            </section>
          </>
        )}
      </div>
    </AuthGate>
  );
}
