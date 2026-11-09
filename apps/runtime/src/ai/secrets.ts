import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { privateFile, type DataPaths } from '../paths.js';
export class SecretStore {
  private key: Buffer;
  constructor(p: DataPaths, requiresKey = false) {
    const file = join(p.config, 'master.key');
    const existed = existsSync(file);
    if (!existed && requiresKey) throw new Error('MASTER_KEY_MISSING');
    privateFile(file);
    if (!existed) writeFileSync(file, randomBytes(32));
    this.key = readFileSync(file);
    if (this.key.length !== 32) throw new Error('INVALID_MASTER_KEY');
  }
  encrypt(value: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }
  decrypt(value: string) {
    const bytes = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
  }
}
