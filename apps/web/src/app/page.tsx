import * as React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
          Fase 1 — Identidad y multi-tenancy
        </span>
        <h1 className="text-4xl font-bold tracking-tight">Plataforma SaaS de Chatbots con IA</h1>
        <p className="max-w-xl text-muted-foreground">
          Auth propia con JWT, RBAC granular, 9 usuarios sembrados, endpoints de auth funcionales.
          Las pantallas de fabricante, distribuidor y cliente se construyen en Fases 1 y 2.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <Card title="Fabricante" subtitle="Superadministrador" />
        <Card title="Distribuidor" subtitle="Crea clientes y agentes" />
        <Card title="Cliente" subtitle="Atiende conversaciones" />
      </div>
      <div className="flex gap-4 text-sm">
        <Link href="/login" className="text-brand-600 underline-offset-4 hover:underline">
          Iniciar sesión →
        </Link>
        <a
          href="/api/v1/health"
          className="text-brand-600 underline-offset-4 hover:underline"
        >
          Verificar salud de la API →
        </a>
      </div>
    </main>
  );
}

function Card({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}
