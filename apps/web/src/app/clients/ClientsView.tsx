'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, clearSession, getTenant, type StoredTenant } from '../../lib/api-client';

type Client = {
  id: string;
  distributorId: string;
  key: string;
  name: string;
  legalName: string | null;
  supportEmail: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
};

const canRenderList = (roles: string[]): boolean =>
  roles.some((r) => r.startsWith('platform_') || r.startsWith('distributor_') || r.startsWith('client_'));

export default function ClientsView() {
  const router = useRouter();
  const search = useSearchParams();
  const [tenant, setTenant] = React.useState<StoredTenant | null>(null);
  const [items, setItems] = React.useState<Client[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const t = getTenant();
    setTenant(t);
    setLoaded(true);
    if (t === null) {
      router.replace('/login');
      return;
    }
    if (!canRenderList(t.roles)) {
      setError('Tu rol no permite listar clientes.');
      return;
    }
    apiFetch<{ items: Client[] }>('/api/v1/clients')
      .then((res) => setItems(res.items))
      .catch((err: { message?: string }) => setError(err.message ?? 'Error al cargar clientes'));
  }, [router]);

  const filterDist = search.get('distributorId');

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </main>
    );
  }
  if (tenant === null) return null;

  const onLogout = (): void => {
    clearSession();
    router.replace('/login');
  };

  const filtered = items?.filter((c) => (filterDist === null ? true : c.distributorId === filterDist)) ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-xs text-muted-foreground">
            {filterDist !== null ? `Filtrado por distributor ${filterDist}` : 'Vista según tu scope'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/distributors" className="rounded border px-3 py-1 text-sm">
            Distribuidores
          </Link>
          <Link href="/dashboard" className="rounded border px-3 py-1 text-sm">
            Dashboard
          </Link>
          <button type="button" onClick={onLogout} className="rounded border px-3 py-1 text-sm">
            Logout
          </button>
        </div>
      </header>

      {error !== null && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {filtered === null && error === null && (
        <span className="text-sm text-muted-foreground">Cargando clientes…</span>
      )}

      {filtered !== null && filtered.length === 0 && (
        <div className="rounded border bg-muted/30 p-4 text-sm text-muted-foreground">
          No hay clientes visibles para tu scope.
        </div>
      )}

      {filtered !== null && filtered.length > 0 && (
        <section className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Distribuidor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Soporte</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.key}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.distributorId.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{c.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{c.supportEmail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
