import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { paths, preparePaths, privateFile } from '../../dist/runtime/src/paths.js';
import { acquireInstance } from '../../dist/runtime/src/instance.js';

const [root, mode] = process.argv.slice(2), p = paths(root);
preparePaths(p);
let release = acquireInstance(p.lock);
const connection = { version: 1, pid: process.pid, port: 0, token: randomBytes(32).toString('hex'), instanceId: randomUUID(), startedAt: new Date().toISOString() };
const publish = () => { privateFile(p.connection); writeFileSync(p.connection, JSON.stringify(connection)); };
const server = createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${connection.token}` || mode === 'auth') {
    res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'UNAUTHORIZED' }));
    return;
  }
  if (req.url !== '/v1/shutdown' || req.method !== 'POST') throw new Error('UNEXPECTED_REQUEST');
  res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  server.close(() => {
    unlinkSync(p.connection);
    if (mode === 'changed') {
      release();
      release = acquireInstance(p.lock);
      connection.instanceId = randomUUID();
      publish();
    }
    process.send({ state: 'listener-closed-lock-held' });
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
connection.port = server.address().port;
if (mode === 'refused' || mode === 'startup') await new Promise(resolve => server.close(resolve));
if (mode !== 'startup') publish();
process.on('message', message => {
  if (message !== 'release') throw new Error('UNEXPECTED_MESSAGE');
  server.close();
  if (existsSync(p.connection)) unlinkSync(p.connection);
  release();
  process.disconnect();
});
process.send({ state: 'ready' });
