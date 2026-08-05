import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from '../src/app/page';

describe('HomePage', () => {
  it('muestra el título de la plataforma', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /Plataforma SaaS de Chatbots/i })).toBeTruthy();
  });
});
