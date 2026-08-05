'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, clearSession, getTenant, type StoredTenant } from '../../../../lib/api-client';

type Distributor = {
  id: string;
  key: string;
  name: string;
  legalName: string | null;
  supportEmail: string | null;
  billingEmail: string | null;
  defaultLocale: string;
  defaultCurrency: string;
  whiteLabelEnabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
  status: string;
};

const canEditBranding = (roles: string[]): boolean =>
  roles.includes('platform_super_admin') || roles.includes('distributor_owner');

export default function BrandingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const distributorId = params.id;
  const [tenant, setTenant] = React.useState<StoredTenant | null>(null);
  const [dist, setDist] = React.useState<Distributor | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const [whiteLabel, setWhiteLabel] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = React.useState('#0ea5e9');
  const [customDomain, setCustomDomain] = React.useState('');

  React.useEffect(() => {
    const t = getTenant();
    setTenant(t);
    setLoaded(true);
    if (t === null) {
      router.replace('/login');
      return;
    }
    apiFetch<Distributor>(`/api/v1/distributors/${distributorId}`)
      .then((d) => {
        setDist(d);
        setWhiteLabel(d.whiteLabelEnabled);
        setLogoUrl(d.logoUrl ?? '');
        setPrimaryColor(d.primaryColor ?? '#1e40af');
        setSecondaryColor(d.secondaryColor ?? '#0ea5e9');
        setCustomDomain(d.customDomain ?? '');
      })
      .catch((err: { message?: string }) => setError(err.message ?? 'No se pudo cargar el distribuidor'));
  }, [router, distributorId]);

  if (!loaded) return <main className="p-6 text-sm text-muted-foreground">Cargando…</main>;
  if (tenant === null) return null;

  const onLogout = (): void => {
    clearSession();
    router.replace('/login');
  };

  const onSave = async (): Promise<void> => {
    if (dist === null) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<Distributor>(`/api/v1/distributors/${distributorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          whiteLabelEnabled: whiteLabel,
          logoUrl: logoUrl.length === 0 ? null : logoUrl,
          primaryColor: primaryColor.length === 0 ? null : primaryColor,
          secondaryColor: secondaryColor.length === 0 ? null : secondaryColor,
          customDomain: customDomain.length === 0 ? null : customDomain,
        }),
      });
      router.refresh();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const editable = canEditBranding(tenant.roles);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branding</h1>
          <p className="text-xs text-muted-foreground font-mono">{distributorId}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/distributors" className="rounded border px-3 py-1 text-sm">
            ← Distribuidores
          </Link>
          <button type="button" onClick={onLogout} className="rounded border px-3 py-1 text-sm">
            Logout
          </button>
        </div>
      </header>

      {error !== null && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {dist === null && error === null && (
        <span className="text-sm text-muted-foreground">Cargando distribuidor…</span>
      )}

      {dist !== null && (
        <section className="grid grid-cols-1 gap-4 rounded-lg border bg-white p-6">
          <div className="text-sm">
            <span className="font-semibold">{dist.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">({dist.key})</span>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={whiteLabel}
              onChange={(e) => setWhiteLabel(e.target.checked)}
              disabled={!editable}
            />
            White-label activado
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span>Logo URL</span>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.example.com/logo.png"
              className="rounded border px-2 py-1"
              disabled={!editable}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span>Color primario</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-full rounded border"
                disabled={!editable}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{primaryColor}</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Color secundario</span>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-9 w-full rounded border"
                disabled={!editable}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{secondaryColor}</span>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span>Custom domain</span>
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="support.example.com"
              className="rounded border px-2 py-1"
              disabled={!editable}
            />
          </label>

          <div className="rounded border bg-muted/30 p-3 text-xs">
            <span className="font-semibold">Preview:</span>
            <div
              className="mt-2 flex items-center gap-3 rounded p-3"
              style={
                whiteLabel
                  ? { backgroundColor: primaryColor, color: '#fff' }
                  : { backgroundColor: '#f3f4f6', color: '#111' }
              }
            >
              {logoUrl.length > 0 && (
                <img src={logoUrl} alt="logo" className="h-8 w-8 rounded object-contain bg-white" />
              )}
              <span className="font-semibold">{dist.name}</span>
            </div>
          </div>

          {editable && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="self-start rounded bg-brand-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar branding'}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
