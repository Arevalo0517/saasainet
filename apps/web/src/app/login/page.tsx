import * as React from 'react';
import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
          <span className="text-sm text-muted-foreground">Cargando…</span>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
