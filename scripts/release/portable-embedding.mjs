import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// The desktop daemon uses Node's ONNX CPU entry only. Browser/GPU backends,
// duplicate bundles and source maps are for SDK consumers, not the portable runtime.
export function trimPortableEmbedding(root) {
  const pkg = join(root, 'node_modules', 'onnxruntime-web');
  const {version} = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  if (version !== '1.31.1') throw new Error('REVIEW_ONNX_PORTABLE_FILES');
  const needed = new Set(['ort.node.min.mjs', 'ort.node.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']);
  const dist = join(pkg, 'dist');
  for (const file of needed) {
    if (!existsSync(join(dist, file))) throw new Error('MISSING_ONNX_RUNTIME_FILE: ' + file);
  }
  for (const file of readdirSync(dist)) {
    if (!needed.has(file) && !/licen[sc]e|notice/i.test(file)) rmSync(join(dist, file), { recursive: true });
  }
  for (const dir of ['docs','lib']) rmSync(join(pkg, dir), { recursive: true, force: true });
}
