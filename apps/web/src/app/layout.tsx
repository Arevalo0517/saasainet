import type { Metadata } from 'next';
import * as React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AInet · Plataforma de Agentes AI',
  description: 'SaaS multi-tenant de agentes AI para distribuidores.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-midnight text-cloud antialiased">{children}</body>
    </html>
  );
}
