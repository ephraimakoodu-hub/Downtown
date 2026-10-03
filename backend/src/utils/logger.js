// Minimal structured JSON logger with redaction of sensitive keys.
const REDACT = new Set([
  'password', 'passwordHash', 'password_hash', 'token', 'authorization',
  'cookie', 'jwt', 'secret', 'card', 'cvv',
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function write(level, msg, fields) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...redact(fields || {}) });
  (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  info: (msg, f) => write('info', msg, f),
  warn: (msg, f) => write('warn', msg, f),
  error: (msg, f) => write('error', msg, f),
};
