import { open } from 'node:fs/promises';

// Verifies a file on disk actually starts with the bytes for its claimed image type, rather than
// trusting the client-supplied mimetype or file extension (both are easy to spoof).
const SIGNATURES = new Map([
  ['image/jpeg', [[0xff, 0xd8, 0xff]]],
  ['image/png', [[0x89, 0x50, 0x4e, 0x47]]],
  ['image/webp', [[0x52, 0x49, 0x46, 0x46]]], // RIFF header; WEBP marker checked separately below
]);

export async function verifyImageSignature(filePath, mimetype) {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    const sigs = SIGNATURES.get(mimetype) || [];
    const matches = sigs.some((sig) => sig.every((byte, i) => buf[i] === byte));
    if (mimetype === 'image/webp') return matches && buf.slice(8, 12).toString('ascii') === 'WEBP';
    return matches;
  } finally {
    await fh.close();
  }
}
