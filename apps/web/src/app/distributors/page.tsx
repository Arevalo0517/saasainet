'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, clearSession, getTenant, type StoredTenant } from '../../lib/api-client';

type Distributor = {
  id: string;
  key: string;
  name: string;
  legalName: string | null;
  supportEmail: string | null;
  status: string;
  whiteLabelEnabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
  createdAt: string;
};

const canRenderList = (roles: string[]): boolean =>
  roles.some((r) => r.startsWith('platform_') || r === 'distributor_owner' || r === 'distributor_admin');

export default function DistributorsPage() {
  const router = useRouter();
  const [tenant, setTenant] = React.useState<StoredTenant | null>(null);
  const [items, setItems] = React.useState<Distributor[] | null>(null);
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
      setError('Tu rol no permite listar distribuidores.');
      return;
    }
    apiFetch<{ items: Distributor[] }>('/api/v1/distributors')
      .then((res) => setItems(res.items))
      .catch((err: { message?: string }) => setError(err.message ?? 'Error al cargar distribuidores'));
  }, [router]);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distribuidores</h1>
          <p className="text-xs text-muted-foreground">
            {tenant.distributorId === null ? 'Vista de plataforma completa' : 'Tu distribuidor'}
          </p>
        </div>
        <div className="flex gap-2">
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

      {items === null && error === null && (
        <span className="text-sm text-muted-foreground">Cargando distribuidores…</span>
      )}

      {items !== null && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((d) => (
            <article
              key={d.id}
              className="flex flex-col gap-2 rounded-lg border bg-white p-4"
              style={
                d.whiteLabelEnabled && d.primaryColor !== null
                  ? { borderColor: d.primaryColor, borderLeftWidth: 4 }
                  : undefined
              }
            >
              <div className="flex items-center gap-3">
                {d.logoUrl !== null && (
                  <img src={d.logoUrl} alt={d.name} className="h-8 w-8 rounded object-contain" />
                )}
                <div>
                  <h2 className="text-sm font-semibold">{d.name}</h2>
                  <p className="text-xs text-muted-foreground">{d.legalName ?? d.key}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-muted px-2 py-0.5">status: {d.status}</span>
                {d.whiteLabelEnabled && (
                  <span className="rounded bg-brand-100 px-2 py-0.5 text-brand-700">white-label</span>
                )}
                {d.customDomain !== null && (
                  <span className="rounded bg-muted px-2 py-0.5">{d.customDomain}</span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/distributors/${d.id}/branding`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  Branding
                </Link>
                <Link
                  href={`/clients?distributorId=${d.id}`}
                  className="rounded border px-2 py-1 text-xs"
                >
                  Clientes
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
