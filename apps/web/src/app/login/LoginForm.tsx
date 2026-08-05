'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, type ApiError } from '../../lib/api-client';

const PLATFORM_ID = 'f0000001-0000-4000-8000-000000000001';

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/dashboard';
  const [email, setEmail] = React.useState('super@acme-fabricante.test');
  const [password, setPassword] = React.useState('');
  const [mfaCode, setMfaCode] = React.useState('');
  const [platformId, setPlatformId] = React.useState(PLATFORM_ID);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({
        platformId,
        email,
        password,
        mfaCode: mfaCode.length > 0 ? mfaCode : undefined,
      });
      if (result.mfaRequired) {
        setError('MFA requerido. Ingresa el código de 6 dígitos.');
        return;
      }
      const { persistSession } = await import('../../lib/api-client');
      persistSession(result);
      router.push(next);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">SaaS de chatbots con IA — Fase 1</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="form-login">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Platform ID</span>
          <input
            required
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="00000000-0000-4000-8000-000000000000"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2"
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Código MFA (opcional)</span>
          <input
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            maxLength={6}
            className="rounded border px-3 py-2"
            placeholder="123456"
          />
        </label>
        {error !== null && (
          <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Credenciales de prueba: <code>super@acme-fabricante.test</code> /{' '}
        <code>AcmeTest2026!</code>
      </p>
    </main>
  );
}
