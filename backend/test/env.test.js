import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../src/config/env.js';

const base = {
  NODE_ENV: 'production', CORS_ORIGINS: 'https://shop.example.test', DB_HOST: 'h', DB_USER: 'u', DB_NAME: 'd',
  JWT_SECRET: 'x'.repeat(40),
};

test('accepts valid configuration', () => {
  assert.deepEqual(loadEnv(base).corsOrigins, ['https://shop.example.test']);
});
test('refuses to start without a strong JWT secret', () => {
  assert.throws(() => loadEnv({ ...base, JWT_SECRET: 'short' }), /JWT_SECRET/);
});
test('refuses wildcard CORS', () => {
  assert.throws(() => loadEnv({ ...base, CORS_ORIGINS: '*' }), /wildcard/);
});
test('refuses missing database settings', () => {
  const { DB_HOST, ...rest } = base;
  assert.throws(() => loadEnv(rest), /DB_HOST/);
});
