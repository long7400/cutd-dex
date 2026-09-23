import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJSON(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Ghi ra file tạm rồi rename (atomic trên cùng filesystem) → không bao giờ để lại file ghi dở.
export function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

export const writeJSON = (file, value, { pretty = false } = {}) =>
  writeAtomic(file, JSON.stringify(value, null, pretty ? 1 : 0) + (pretty ? '\n' : ''));
