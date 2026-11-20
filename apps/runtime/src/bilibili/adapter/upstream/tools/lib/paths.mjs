import path from 'node:path'
const root=process.env.BFF_BILI_DATA_DIR
if(!root||!path.isAbsolute(root))throw Error('BFF_BILI_DATA_DIR_REQUIRED')
export const HOME=root
export const DSH_HOME=root
export const dshPath=(...parts)=>path.join(root,...parts)
export const homePath=(...parts)=>path.join(root,...parts)
export const configPath=path.join(root,'bili-whale.config.json')
export const credentialsPath=path.join(root,'.bili-ai','credentials.json')
