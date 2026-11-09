export async function readInput(limit=65536):Promise<Record<string,unknown>>{
 process.stdin.setEncoding('utf8');let raw='';
 for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw new Error('INPUT_TOO_LARGE');}
 return raw.trim()?JSON.parse(raw):{};
}
