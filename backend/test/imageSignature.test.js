import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyImageSignature } from '../src/lib/imageSignature.js';

test('accepts a file whose bytes match its claimed type', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'img-'));
  const file = path.join(dir, 'a.jpg');
  await writeFile(file, Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]));
  assert.equal(await verifyImageSignature(file, 'image/jpeg'), true);
  await rm(dir, { recursive: true, force: true });
});

test('rejects a file whose bytes do not match its claimed type', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'img-'));
  const file = path.join(dir, 'fake.jpg');
  await writeFile(file, Buffer.from('<html><script>evil</script></html>'));
  assert.equal(await verifyImageSignature(file, 'image/jpeg'), false);
  await rm(dir, { recursive: true, force: true });
});

test('checks the WEBP marker, not just the RIFF header', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'img-'));
  const file = path.join(dir, 'a.webp');
  await writeFile(file, Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('AVI ')]));
  assert.equal(await verifyImageSignature(file, 'image/webp'), false);
  await rm(dir, { recursive: true, force: true });
});
