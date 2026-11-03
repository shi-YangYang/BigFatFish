import { createHash } from 'node:crypto';
import { InputError, object, string } from '../ai/types.js';
export const permissions=['tools.execute','storage.read','storage.write','events.emit','events.subscribe','memory.search','memory.propose','personality.read','channel.propose','media.transcribe','media.synthesize','channel.qq','activity.bilibili','activity.douyin'] as const;
export interface Manifest {protocol:1;id:string;name:string;version:string;author:string;license:string;source:string;runtime:string;platforms:string[];kind:'extension'|'platform';permissions:string[];entry:string;dependencies:string[];extensions:string[];configSchema:{type:'object';properties:Record<string,{type:'string'|'number'|'boolean'}>;required?:string[]};tools:{name:string;description:string;parameters:Record<string,unknown>}[]}
export interface Bundle {format:'bigfatfish-plugin';manifest:Manifest;files:{path:string;sha256:string;data:string}[]}
export const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
export function validateBundle(input:unknown):Bundle{
 const b=object(input),m=object(b.manifest);if(b.format!=='bigfatfish-plugin'||m.protocol!==1||m.runtime!=='^0.1.0')throw new InputError('PLUGIN_INCOMPATIBLE');
 const id=string(m.id,64);if(!/^[a-z][a-z0-9-]{1,63}$/.test(id)||!/^\d+\.\d+\.\d+$/.test(String(m.version)))throw new InputError('PLUGIN_MANIFEST_INVALID');
 for(const k of ['name','author','license','source'])string(m[k],500);
 if(!Array.isArray(m.platforms)||!m.platforms.includes(process.platform)||!Array.isArray(m.permissions)||m.permissions.some(p=>!permissions.includes(p as never))||new Set(m.permissions).size!==m.permissions.length)throw new InputError('PLUGIN_PERMISSION_INVALID');
 if(!['extension','platform'].includes(String(m.kind))||m.kind==='platform'&&!['qq','bilibili','douyin'].includes(id)||m.kind==='extension'&&['qq','bilibili','douyin'].includes(id))throw new InputError('PLUGIN_MANIFEST_INVALID');
 if(!Array.isArray(m.dependencies)||m.dependencies.some(d=>!['ws','qrcode','playwright-core'].includes(String(d))))throw new InputError('PLUGIN_DEPENDENCY_UNSUPPORTED');
 if(!Array.isArray(m.extensions)||m.extensions.some(x=>!['Channel','Activity','Tool','Model','Memory','Personality','Service','Integration'].includes(String(x))))throw new InputError('PLUGIN_MANIFEST_INVALID');
 const schema=object(m.configSchema);validateSchema(schema);if(schema.type!=='object'||!schema.properties||Object.values(object(schema.properties)).some(v=>!['string','number','boolean'].includes(String(object(v).type))))throw new InputError('PLUGIN_SCHEMA_INVALID');
 if(!Array.isArray(m.tools)||m.tools.length>16)throw new InputError('PLUGIN_MANIFEST_INVALID');
 for(const t of m.tools){const tool=object(t);if(!/^[a-z][a-z0-9_]{0,40}$/.test(String(tool.name)))throw new InputError('PLUGIN_MANIFEST_INVALID');string(tool.description,500);validateSchema(object(tool.parameters));if(object(tool.parameters).type!=='object')throw new InputError('PLUGIN_SCHEMA_INVALID');}
 if(!Array.isArray(b.files)||!b.files.length||b.files.length>1000)throw new InputError('PLUGIN_ARCHIVE_INVALID');
 let total=0;const seen=new Set<string>();for(const value of b.files){const f=object(value),name=string(f.path,300);if(Object.keys(f).some(k=>!['path','sha256','data'].includes(k))||!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(name)||name.split('/').some(x=>x==='.'||x==='..'||x==='node_modules')||seen.has(name.toLowerCase()))throw new InputError('PLUGIN_ARCHIVE_PATH');seen.add(name.toLowerCase());const data=Buffer.from(string(f.data,24_000_000,true),'base64');total+=data.length;if(total>16_000_000||data.toString('base64')!==f.data||hash(data)!==f.sha256)throw new InputError('PLUGIN_ARCHIVE_CHECKSUM');}
 if(typeof m.entry!=='string'||!m.entry.endsWith('.mjs')||!seen.has(m.entry.toLowerCase()))throw new InputError('PLUGIN_MANIFEST_INVALID');
 return b as unknown as Bundle;
}
export function validateConfig(m:Manifest,value:unknown){const b=object(value);for(const [k,v]of Object.entries(b))if(!m.configSchema.properties[k]||typeof v!==m.configSchema.properties[k]!.type)throw new InputError('PLUGIN_CONFIG_INVALID');for(const k of m.configSchema.required??[])if(!(k in b))throw new InputError('PLUGIN_CONFIG_INVALID');validateArguments(m.configSchema,b);return b;}

// The v1 schema subset is deliberately small and validated at both declaration and invocation.
export function validateArguments(schema:Record<string,unknown>,value:unknown,depth=0):void{
 if(depth>8)throw new InputError('PLUGIN_SCHEMA_INVALID');
 if(schema.type==='object'){const b=object(value),properties=object(schema.properties??{});for(const k of schema.required as string[]??[])if(!Object.hasOwn(b,k))throw new InputError('PLUGIN_ARGUMENT_INVALID');for(const [k,v]of Object.entries(b)){if(!Object.hasOwn(properties,k))throw new InputError('PLUGIN_ARGUMENT_INVALID');validateArguments(object(properties[k]),v,depth+1);}}
 else if(schema.type==='array'){if(!Array.isArray(value)||value.length>100)throw new InputError('PLUGIN_ARGUMENT_INVALID');for(const v of value)validateArguments(object(schema.items),v,depth+1);}
 else if(!['string','boolean','number','integer'].includes(String(schema.type))||typeof value!==(schema.type==='integer'?'number':schema.type)||schema.type==='integer'&&!Number.isInteger(value)||typeof value==='string'&&value.length>16000||typeof value==='number'&&!Number.isFinite(value))throw new InputError('PLUGIN_ARGUMENT_INVALID');
 if(Array.isArray(schema.enum)&&!schema.enum.includes(value))throw new InputError('PLUGIN_ARGUMENT_INVALID');
}

export function validateSchema(schema:Record<string,unknown>,depth=0):void{
 if(depth>8||!['object','array','string','boolean','number','integer'].includes(String(schema.type)))throw new InputError('PLUGIN_SCHEMA_INVALID');
 const allowed=['type','description','title',...(schema.type==='object'?['properties','required','additionalProperties']:schema.type==='array'?['items']:['enum'])];if(Object.keys(schema).some(k=>!allowed.includes(k)))throw new InputError('PLUGIN_SCHEMA_UNSUPPORTED');
 if(schema.type==='object'){if(schema.additionalProperties!==undefined&&schema.additionalProperties!==false)throw new InputError('PLUGIN_SCHEMA_UNSUPPORTED');const props=object(schema.properties??{});if(Object.keys(props).length>50||Object.keys(props).some(k=>!/^[_a-zA-Z][_a-zA-Z0-9]{0,63}$/.test(k)||['__proto__','constructor','prototype'].includes(k)))throw new InputError('PLUGIN_SCHEMA_INVALID');if(schema.required!==undefined&&(!Array.isArray(schema.required)||schema.required.some(k=>typeof k!=='string'||!Object.hasOwn(props,k))))throw new InputError('PLUGIN_SCHEMA_INVALID');for(const v of Object.values(props))validateSchema(object(v),depth+1);}
 if(schema.type==='array')validateSchema(object(schema.items),depth+1);
 if(schema.enum!==undefined&&(!Array.isArray(schema.enum)||schema.enum.length>100||!schema.enum.length||schema.enum.some(v=>typeof v!==(schema.type==='integer'?'number':schema.type))))throw new InputError('PLUGIN_SCHEMA_INVALID');
}
