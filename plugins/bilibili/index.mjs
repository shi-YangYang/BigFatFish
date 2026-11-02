import { QrAuth, verifyAccount } from './upstream/lib/auth.js';
import { parseManualCookie } from './upstream/lib/credentials.js';
export { QrAuth, verifyAccount, parseManualCookie };
export const manifest = {id:'bilibili',version:'0.1.0',upstream:{version:'0.4.6',commit:'8b0009f8ce2ebdc421afcb2e727b19ac18912ec6',license:'MIT'},permissions:['video.read','account.login'],dependencies:['node >=24.9','qrcode 1.5.4','ffmpeg (frames)'],configSchema:{type:'object',properties:{enabled:{type:'boolean'}},additionalProperties:false}};
