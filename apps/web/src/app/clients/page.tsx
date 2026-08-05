import * as React from 'react';
import { Suspense } from 'react';
import ClientsView from './ClientsView';

export const dynamic = 'force-dynamic';

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
          <span className="text-sm text-muted-foreground">Cargando…</span>
        </main>
      }
    >
      <ClientsView />
    </Suspense>
  );
}
