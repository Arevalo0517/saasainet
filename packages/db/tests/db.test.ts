import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../src/schema/index.js';

describe('db schema', () => {
  it('tiene un versionado de esquema', () => {
    expect(SCHEMA_VERSION).toBeTruthy();
  });
});
