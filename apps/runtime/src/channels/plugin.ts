import {pathToFileURL} from 'node:url';
import { existsSync } from 'node:fs';
import type { Plugin } from './types.js';
export async function loadQQ(directory?:string):Promise<{plugin:Plugin;manifest:Record<string,unknown>}> {
  const built=new URL('../../../plugins/qq/index.mjs',import.meta.url);
  const source=new URL('../../../../plugins/qq/index.mjs',import.meta.url);
  const module=await import(directory?pathToFileURL(directory+'/index.mjs').href:(existsSync(built)?built:source).href);
  if(module.manifest?.id!=='qq'||typeof module.QQPlugin!=='function')throw new Error('INVALID_PLUGIN');
  return {plugin:new module.QQPlugin(),manifest:module.manifest};
}
