import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function inventory(directory) {
  const files = {};
  function walk(relative = '') {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const key = relative ? `${relative}/${name}` : name, path = join(directory, key), stat = lstatSync(path);
      if (stat.isDirectory()) walk(key);
      else if (stat.isFile()) files[key] = sha256(readFileSync(path));
      else throw new Error(`NAPCAT_UNSAFE_FILE: ${key}`);
    }
  }
  walk(); return files;
}
export function verifySource() {
  const source = JSON.parse(readFileSync(join(root, 'third_party/napcat-source.json'), 'utf8'));
  const actual = inventory(join(root, 'third_party/napcat'));
  if (JSON.stringify(actual) !== JSON.stringify(source.files)) throw new Error('NAPCAT_SOURCE_CHECKSUM');
  return source;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = verifySource(); console.log(JSON.stringify({ commit: source.commit, files: Object.keys(source.files).length, verified: true }));
}
