import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createDecipheriv,createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2);
if(!input?.startsWith('.local/cloud-backups/')||!output?.startsWith('.local/backups/')||output.includes('..')||existsSync(output))throw Error('Use an existing encrypted archive and a NEW private .local/backups directory.');
const packet=readFileSync(input);if(packet.subarray(0,5).toString()!=='APMA1')throw Error('Invalid archive');
const decipher=createDecipheriv('aes-256-gcm',readFileSync('.local/backup-master.key'),packet.subarray(5,17));decipher.setAuthTag(packet.subarray(17,33));
const files=JSON.parse(gunzipSync(Buffer.concat([decipher.update(packet.subarray(33)),decipher.final()])).toString()) as Record<string,string>;
for(const name of Object.keys(files))if(!/^[a-zA-Z0-9._-]+$/.test(name))throw Error('Invalid archive file name');
const manifest=JSON.parse(Buffer.from(files['manifest.json'],'base64').toString());
for(const o of manifest.objects){const bytes=Buffer.from(files[o.file],'base64');if(createHash('sha256').update(bytes).digest('hex')!==o.sha256)throw Error('Storage integrity failed');}
mkdirSync(output,{recursive:true,mode:0o700});for(const [name,b64] of Object.entries(files))writeFileSync(output+'/'+name,Buffer.from(b64,'base64'),{mode:0o600});writeFileSync('.local/latest-backup.txt',output,{mode:0o600});console.log('Archive authentication and all Storage hashes verified; private restore input ready.');
