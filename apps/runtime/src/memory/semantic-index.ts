import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { privateFile, type DataPaths } from '../paths.js';
import { EMBEDDING_REVISION, type LocalEmbedder } from './local-embedder.js';
import { memoryAccess } from './attribution.js';
import type { MemoryAudience } from './types.js';
import { watchText } from './platform-scenes.js';

type Kind = 'memory' | 'note' | 'video';
type Pending = { kind: Kind; id: string; text: string; digest: string };
type Embedder = Pick<LocalEmbedder, 'status' | 'embed'>;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const dimensions = 512;
const batchSize = 8;
// Calibrated on local INT8 Chinese paraphrases: a follow-up hospital visit
// scored 0.547 while an unrelated greeting scored 0.460.
const minSimilarity = 0.5;

// The authoritative rows live in main. The attached cache contains only IDs,
// fingerprints and normalized vectors, and is omitted from logical backups.
export class SemanticIndex {
  private attached = false;
  private closing = false;
  private initialScan = true;
  private queriesInFlight = 0;
  private worker?: Promise<void>;
  private retryAfter = 0;
  private failed = false;
  private count = 0;
  constructor(private db: DatabaseSync, private p: DataPaths, private encoder: Embedder) {}

  status() { return { indexed: this.count, indexing: !!this.worker, failed: this.failed }; }

  private attach() {
    if (this.attached) return;
    const path = join(this.p.runtime, 'memory-vectors.sqlite');
    privateFile(path);
    this.db.prepare('ATTACH DATABASE ? AS semantic_cache').run(path);
    try {
      this.db.exec('BEGIN');
      this.db.exec(`CREATE TABLE IF NOT EXISTS semantic_cache.vectors(
        kind TEXT NOT NULL, id TEXT NOT NULL, digest TEXT NOT NULL, value BLOB NOT NULL,
        PRIMARY KEY(kind,id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS semantic_cache.metadata(revision TEXT PRIMARY KEY);
        CREATE TEMP VIEW semantic_sources(kind,id,text,shared,scope,author,platform,source_id) AS
          SELECT 'memory',id,subject || char(10) || content,visibility='shared','','','',''
            FROM main.memories WHERE status='confirmed'
          UNION ALL SELECT 'note',id,content,0,scope,author,'','' FROM main.conversation_notes
          UNION ALL SELECT 'video',id,summary,0,'','',kind,source_id FROM main.activity_records
            WHERE kind IN ('bilibili.watched','douyin.watched');`);
      // TEMP triggers are active only on this Runtime connection. Queue updates
      // transactionally, including changes made through tools or direct stores.
      this.db.exec('CREATE TEMP TABLE semantic_dirty(kind TEXT,id TEXT,PRIMARY KEY(kind,id)) WITHOUT ROWID');
      for (const [kind,table,eligible] of [
        ['memory','memories', (p:string) => p+".status='confirmed'"],
        ['note','conversation_notes', () => '1'],
        ['video','activity_records', (p:string) => p+".kind IN ('bilibili.watched','douyin.watched')"],
      ] as const) {
        for (const event of ['INSERT','UPDATE','DELETE']) {
          const ref = event === 'DELETE' ? 'OLD' : 'NEW';
          const condition = event === 'UPDATE' ? eligible('OLD') + ' OR ' + eligible('NEW') : eligible(ref);
          this.db.exec(`CREATE TEMP TRIGGER semantic_${kind}_${event} AFTER ${event} ON main.${table}
            WHEN ${condition} BEGIN INSERT INTO semantic_dirty(kind,id) VALUES('${kind}',${ref}.id)
            ON CONFLICT(kind,id) DO NOTHING; END`);
        }
      }
      this.db.function('semantic_digest', { deterministic: true }, value => hash(String(value)));
      if (!this.db.prepare('SELECT revision FROM semantic_cache.metadata WHERE revision=?').get(EMBEDDING_REVISION)) {
        this.db.exec('DELETE FROM semantic_cache.vectors; DELETE FROM semantic_cache.metadata');
        this.db.prepare('INSERT INTO semantic_cache.metadata VALUES(?)').run(EMBEDDING_REVISION);
      }
      this.count = Number(this.db.prepare('SELECT count(*) AS n FROM semantic_cache.vectors').get()!.n);
      this.db.exec('COMMIT');
      this.attached = true;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      this.db.exec('DETACH DATABASE semantic_cache');
      throw error;
    }
  }

  changed() { this.schedule(); }

  schedule() {
    if (this.closing || this.worker || this.retryAfter > Date.now() || this.encoder.status().state !== 'ready') return;
    if (this.attached && !this.initialScan && !this.pendingChanges()) return;
    this.worker = Promise.resolve().then(async () => {
      this.attach();
      // A mutation during an await requests another pass. Existing and
      // unchanged rows are skipped in SQLite; only new text goes to the model.
      if (this.initialScan && this.available()) {
        await this.reconcile();
        this.initialScan = !this.available();
      }
      while (this.available() && this.pendingChanges()) await this.indexChanges();
      this.count = Number(this.db.prepare('SELECT count(*) AS n FROM semantic_cache.vectors').get()!.n);
      this.failed = false;
    }).catch(() => {
      this.initialScan = true;
      this.failed = true;
      this.retryAfter = Date.now() + 5000;
    }).finally(() => { this.worker = undefined; });
  }

  private available() { return !this.closing && this.encoder.status().state === 'ready'; }

  private async reconcile() {
    this.db.exec(`DELETE FROM semantic_cache.vectors AS v WHERE NOT EXISTS
      (SELECT 1 FROM semantic_sources s WHERE s.kind=v.kind AND s.id=v.id AND semantic_digest(s.text)=v.digest)`);
    // Pull at most one small batch per await. The cursor avoids repeatedly
    // traversing all preceding rows when populating a new cache.
    const pending = this.db.prepare(`SELECT s.kind,s.id,s.text,semantic_digest(s.text) AS digest
      FROM semantic_sources s LEFT JOIN semantic_cache.vectors v ON v.kind=s.kind AND v.id=s.id
      WHERE s.kind=? AND s.id>? AND (v.digest IS NULL OR v.digest<>semantic_digest(s.text))
      ORDER BY s.id LIMIT ?`);
    for (const kind of ['memory', 'note', 'video'] as const) {
      let cursor = '';
      while (this.available()) {
        const batch = pending.all(kind, cursor, batchSize) as Pending[];
        if (!batch.length) break;
        await this.encodeBatch(batch);
        cursor = batch.at(-1)!.id;
      }
      if (!this.available()) break;
    }
  }

  private pendingChanges() {
    return this.db.prepare('SELECT 1 FROM temp.semantic_dirty LIMIT 1').get();
  }

  private async indexChanges() {
    const keys = this.db.prepare('SELECT kind,id FROM temp.semantic_dirty LIMIT ?').all(batchSize);
    const changed: Pending[] = [];
    const current = this.db.prepare(`SELECT s.kind,s.id,s.text,semantic_digest(s.text) AS digest,v.digest AS cached
      FROM semantic_sources s LEFT JOIN semantic_cache.vectors v ON v.kind=s.kind AND v.id=s.id WHERE s.kind=? AND s.id=?`);
    for (const key of keys) {
      // Remove before await; another edit to the same row will enqueue it again.
      this.db.prepare('DELETE FROM temp.semantic_dirty WHERE kind=? AND id=?').run(key.kind!,key.id!);
      const row = current.get(key.kind!,key.id!);
      if (!row) this.db.prepare('DELETE FROM semantic_cache.vectors WHERE kind=? AND id=?').run(key.kind!,key.id!);
      else if (row.digest !== row.cached) changed.push(row as Pending);
    }
    if (changed.length) {
      await this.encodeBatch(changed);
      if (!this.available()) this.initialScan = true;
    }
  }

  private async encodeBatch(batch: Pending[]) {
    const store = this.db.prepare(`INSERT OR REPLACE INTO semantic_cache.vectors(kind,id,digest,value)
      SELECT s.kind,s.id,?,? FROM semantic_sources s WHERE s.kind=? AND s.id=? AND semantic_digest(s.text)=?`);
    const inputs = batch.map(r => r.kind === 'video' ? watchText(r.text) : r.text);
    const vectors = await this.encoder.embed(inputs, 'passage');
    if (!this.available()) return;
    if (vectors.length !== batch.length) throw new Error('EMBEDDING_BATCH_SIZE');
    for (const [i,row] of batch.entries()) {
      const vector = vectors[i]!;
      if (vector.length !== dimensions || !vector.every(Number.isFinite)) throw new Error('INVALID_EMBEDDING');
      store.run(row.digest, Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength), row.kind, row.id, row.digest);
    }
  }

  async query(text: string): Promise<Float32Array | undefined> {
    this.schedule();
    if (!this.available() || !this.attached || !this.count || !text.trim() || this.queriesInFlight >= 2) return;
    let timer: NodeJS.Timeout | undefined;
    this.queriesInFlight++;
    try {
      const result = await Promise.race([
        this.encoder.embed([text], 'query').finally(()=>this.queriesInFlight--),
        new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 900); }),
      ]);
      if (this.available() && result?.[0]?.length === dimensions) return result[0];
    } catch { /* A lexical lookup is still fully usable when inference fails. */ }
    finally { clearTimeout(timer); }
  }

  memoryIds(vector: Float32Array | undefined, audience: boolean | MemoryAudience) {
    const access = memoryAccess(typeof audience === 'boolean' ? audience ? 'owner' : 'group' : audience);
    return this.rank(vector, 'memory', ` AND EXISTS (SELECT 1 FROM main.memories WHERE memories.id=s.id AND ${access.sql})`, access.params);
  }

  noteIds(vector: Float32Array | undefined, visible: string[]) {
    if (!visible.length) return [];
    return this.rank(vector, 'note', ' AND s.id IN (SELECT value FROM json_each(?))', [JSON.stringify(visible)]);
  }

  videoIds(vector: Float32Array | undefined, platform?: 'bilibili' | 'douyin', exclude?: string) {
    const filter = (platform ? ' AND s.platform=?' : '') + (exclude ? ' AND s.source_id<>?' : '');
    return this.rank(vector, 'video', filter, [...(platform ? [platform + '.watched'] : []), ...(exclude ? [exclude] : [])]);
  }

  private rank(vector: Float32Array | undefined, kind: Kind, filter: string, params: SQLInputValue[]) {
    if (!vector || !this.available() || !this.attached) return [];
    try {
      return this.score(vector, kind,filter,params);
    } catch {
      this.failed = true;
      this.initialScan = true;
      this.retryAfter = Date.now() + 5000;
      return [];
    }
  }

  private score(vector: Float32Array, kind: Kind, filter: string, params: SQLInputValue[]) {
    const rows = this.db.prepare(`SELECT s.id,v.value FROM semantic_sources s
      JOIN semantic_cache.vectors v ON v.kind=s.kind AND v.id=s.id
      WHERE s.kind=? ${filter} AND v.digest=semantic_digest(s.text)`).iterate(kind,...params);
    const top: {id:string;score:number}[] = [];
    for (const row of rows) {
      const bytes = row.value as Uint8Array;
      if (bytes.byteLength !== dimensions * 4) continue;
      const data = bytes.byteOffset % 4 ? bytes.slice() : bytes;
      const values = new Float32Array(data.buffer, data.byteOffset, dimensions);
      let score = 0;
      for (let i = 0; i < dimensions; i++) score += vector[i]! * values[i]!;
      if (score < minSimilarity || !Number.isFinite(score) || (top.length === 12 && score <= top[11]!.score)) continue;
      top.push({id:String(row.id),score});
      top.sort((a,b)=>b.score-a.score);
      if (top.length > 12) top.pop();
    }
    return top.map(r=>r.id);
  }

  async close() {
    this.closing = true;
    await this.worker;
    if (this.attached) {
      for (const kind of ['memory','note','video']) for (const event of ['INSERT','UPDATE','DELETE']) {
        this.db.exec(`DROP TRIGGER IF EXISTS temp.semantic_${kind}_${event}`);
      }
      this.db.exec('DROP TABLE temp.semantic_dirty; DROP VIEW temp.semantic_sources; DETACH DATABASE semantic_cache');
    }
  }
}
