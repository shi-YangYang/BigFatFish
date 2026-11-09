// Isolated process fixture: no production flags or Runtime endpoints enable this transport.
import { startRuntime } from '../../dist/runtime/src/lifecycle.js';
import { paths } from '../../dist/runtime/src/paths.js';
import { fileURLToPath } from 'node:url';
const runtime=await startRuntime(paths(process.argv[2]),0,{bilibili:{preload:fileURLToPath(new URL('./bilibili-network.mjs',import.meta.url)),env:{BFF_FIXTURE_MODE:'slow'}}});
console.log('ready');await runtime.finished;
