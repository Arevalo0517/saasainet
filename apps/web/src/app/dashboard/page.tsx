'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearSession, getTenant, type StoredTenant } from '../../lib/api-client';

const RolePanel = ({ roles }: { roles: string[] }): JSX.Element => {
  const isPlatform = roles.includes('platform_super_admin') || roles.includes('platform_support');
  const isDistributor = roles.includes('distributor_admin') || roles.includes('distributor_agent');
  const isClient = roles.includes('client_admin') || roles.includes('client_agent');
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Panel
        title="Plataforma"
        description="Plataformas, planes, comisiones, auditoría."
        enabled={isPlatform}
        tone="electric"
      />
      <Panel
        title="Distribuidor"
        description="Clientes, agentes, canales, knowledge base."
        enabled={isDistributor}
        tone="cyan"
      />
      <Panel
        title="Cliente"
        description="Inbox, contactos, knowledge, facturación."
        enabled={isClient}
        tone="warm"
      />
    </div>
  );
};

const Panel = ({
  title,
  description,
  enabled,
  tone,
}: {
  title: string;
  description: string;
  enabled: boolean;
  tone: 'electric' | 'cyan' | 'warm' | 'cloud';
}): JSX.Element => {
  const toneClass = {
    electric: 'border-electric-500/40 from-electric-500/20 to-electric-500/0',
    cyan: 'border-cyan-ai/40 from-cyan-ai/20 to-cyan-ai/0',
    warm: 'border-warm/40 from-warm/20 to-warm/0',
    cloud: 'border-cloud-700/40 from-cloud-700/20 to-transparent',
  }[tone];
  return (
    <div
      className={`rounded-xl border bg-gradient-to-b p-4 transition ${
        enabled ? toneClass : 'border-cloud-700/30 from-cloud-800/20 to-transparent opacity-50'
      }`}
    >
      <div className="text-sm font-semibold text-cloud">{title}</div>
      <div className="mt-1 text-xs text-cloud-300">{description}</div>
      <div className="mt-2 text-xs text-cloud-400">
        {enabled ? 'Acceso permitido' : 'Sin acceso (rol)'}
      </div>
    </div>
  );
};

const NavLink = ({ href, label, tone = 'cyan' }: { href: string; label: string; tone?: 'cyan' | 'electric' | 'warm' | 'cloud' }): JSX.Element => {
  const colors = {
    cyan: 'hover:border-cyan-ai/60 hover:text-cyan-ai',
    electric: 'hover:border-electric-500/60 hover:text-electric-300',
    warm: 'hover:border-warm/60 hover:text-warm',
    cloud: 'hover:border-cloud-500/60 hover:text-cloud',
  }[tone];
  return (
    <Link
      href={href}
      className={`rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 transition ${colors}`}
    >
      {label}
    </Link>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [tenant, setTenant] = React.useState<StoredTenant | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const t = getTenant();
    setTenant(t);
    setLoaded(true);
    if (t === null) {
      router.replace('/login');
    }
  }, [router]);

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <span className="text-sm text-cloud-300">Cargando sesión…</span>
      </main>
    );
  }
  if (tenant === null) {
    return null;
  }

  const onLogout = (): void => {
    clearSession();
    router.replace('/login');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 border-b border-cyan-ai/20 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">AInet</span>
            </div>
            <h1 className="mt-2 bg-aurora-gradient bg-clip-text text-3xl font-bold text-transparent">
              Dashboard
            </h1>
            <p className="mt-1 text-xs text-cloud-300">
              user: <span className="font-mono text-cloud-200">{tenant.userId}</span> · platform:{' '}
              <span className="font-mono text-cloud-200">{tenant.platformId}</span>
              {tenant.distributorId
                ? ` · distributor: ${tenant.distributorId}`
                : ''}
              {tenant.clientId ? ` · client: ${tenant.clientId}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-warm/40 bg-warm/10 px-3 py-1.5 text-xs text-warm transition hover:bg-warm/20"
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="flex flex-wrap gap-2">
          <NavLink href="/distributors" label="Distribuidores" tone="electric" />
          <NavLink href="/clients" label="Clientes" tone="electric" />
          <NavLink href="/dashboard/subscriptions" label="Suscripciones" tone="cyan" />
          <NavLink href="/plans" label="Planes" tone="cyan" />
          <NavLink href="/dashboard/agents" label="Agentes" tone="cyan" />
          <NavLink href="/dashboard/knowledge-bases" label="Knowledge bases" tone="cyan" />
          <NavLink href="/dashboard/inbox" label="Inbox" tone="warm" />
          <NavLink href="/dashboard/webhooks" label="Webhooks" tone="cyan" />
          <NavLink href="/dashboard/audit" label="Audit log" tone="cloud" />
          <NavLink href="/dashboard/analytics" label="Analytics" tone="electric" />
          <NavLink href="/dashboard/chat" label="Chat test" tone="warm" />
        </nav>
      </header>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-cloud">Roles asignados</h2>
        <div className="flex flex-wrap gap-1.5">
          {tenant.roles.map((r) => (
            <span key={r} className="chip chip-cyan font-mono">
              {r}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-cloud">Paneles disponibles</h2>
        <RolePanel roles={tenant.roles} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-cloud">
          Permisos <span className="text-cyan-ai">({tenant.permissions.length})</span>
        </h2>
        <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
          {tenant.permissions.map((p) => (
            <li
              key={p}
              className="rounded-md border border-cyan-ai/20 bg-midnight-700/40 px-2 py-1 font-mono text-cloud-200"
            >
              {p}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
