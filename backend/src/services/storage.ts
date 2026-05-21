import fs from 'node:fs';
import path from 'node:path';
import type { PackageType } from '../types';

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

/**
 * Save a base64 PNG to local disk under uploads/<readingId>/<type>.png.
 * Returns the public URL the BE will serve (relative to BACKEND public origin).
 */
export function saveScreenshot(
  readingId: string,
  type: PackageType,
  base64: string,
): { url: string; filePath: string } {
  const readingDir = path.join(UPLOADS_ROOT, readingId);
  fs.mkdirSync(readingDir, { recursive: true });
  const filePath = path.join(readingDir, `${type}.png`);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  const publicOrigin =
    process.env.PUBLIC_BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return {
    url: `${publicOrigin}/uploads/${readingId}/${type}.png`,
    filePath,
  };
}

export const UPLOADS_PATH = UPLOADS_ROOT;
