import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { InputError } from '../ai/types.js';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export interface StoredApproval{id:string;plugin:string;payload:Record<string,unknown>;digest:string;revision:string;expiresAt:number;status:string;approvedBy:string|null}
export class ApprovalStore{
 constructor(private db:DatabaseSync,readonly plugin:string){db.prepare("UPDATE approvals SET status='unknown' WHERE plugin=? AND status='executing'").run(plugin);}
 list(){this.db.prepare("UPDATE approvals SET status='expired' WHERE plugin=? AND status='pending' AND expires_at<=?").run(this.plugin,Date.now());return this.db.prepare('SELECT id FROM approvals WHERE plugin=? ORDER BY rowid DESC LIMIT 100').all(this.plugin).map(x=>this.get(x.id as string));}
 get(id:string):StoredApproval{const r=this.db.prepare('SELECT id,plugin,payload,digest,revision,expires_at AS expiresAt,status,approved_by AS approvedBy FROM approvals WHERE id=? AND plugin=?').get(id,this.plugin);if(!r)throw new InputError('APPROVAL_NOT_FOUND',404);return {...r,payload:JSON.parse(r.payload as string)} as unknown as StoredApproval;}
 create(payload:Record<string,unknown>,revision:string){const id=randomUUID(),text=JSON.stringify(payload);this.db.prepare("INSERT INTO approvals(id,plugin,payload,digest,revision,expires_at,status,created_at) VALUES(?,?,?,?,?,?,'pending',?)").run(id,this.plugin,text,digest(text),revision,Date.now()+300000,new Date().toISOString());return this.get(id);}
 check(id:string,expectedDigest:string,revision:string,status='executing'){const a=this.get(id);if(a.digest!==expectedDigest||digest(JSON.stringify(a.payload))!==a.digest)throw new InputError('APPROVAL_MISMATCH',409);if(a.revision!==revision||a.status!==status||a.expiresAt<=Date.now())throw new InputError('PERMISSION_REVOKED',403);return a;}
 decide(id:string,expectedDigest:string,revision:string,decision:string){const pending=this.get(id);if(pending.status!=='pending'||pending.expiresAt<=Date.now())throw new InputError('APPROVAL_NOT_PENDING',409);const a=this.check(id,expectedDigest,revision,'pending');if(!['approve','reject'].includes(decision))throw new InputError('INVALID_REQUEST');this.db.prepare('UPDATE approvals SET status=?,approved_by=? WHERE id=? AND plugin=?').run(decision==='approve'?'executing':'rejected','local-owner',id,this.plugin);return a;}
 state(id:string,status:string){this.db.prepare('UPDATE approvals SET status=? WHERE id=? AND plugin=?').run(status,id,this.plugin);}
 revoke(id?:string){this.db.prepare("UPDATE approvals SET status='revoked' WHERE plugin=? AND status IN ('pending','executing') AND (? IS NULL OR id=?)").run(this.plugin,id??null,id??null);}
}
