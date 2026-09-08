/** Cloud DB + immutable Storage bytes + application Vault keys; encrypted on the owner's Mac. */
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync,readdirSync,chmodSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const mode=process.argv.includes('--preview')?'preview':'production';
const refs={production:'clysniomfmmxwiozfizt',preview:'obtlqejryfvcqfsjxeda'};
const ref=refs[mode],started=Date.now(),stamp=new Date().toISOString().replaceAll(':','-');
const root='.local/cloud-backups',temp=`.local/backup-work-${stamp}`,keyPath='.local/backup-master.key';
mkdirSync(root,{recursive:true,mode:0o700});mkdirSync(temp,{recursive:true,mode:0o700});
if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});
const key=readFileSync(keyPath);if(key.length!==32)throw Error('BACKUP_KEY_INVALID');
let stage='initial';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function cli(args:string[]){stage='cli-'+args[1];const r=spawnSync(process.env.APMA_SUPABASE_BIN??'pnpm',process.env.APMA_SUPABASE_BIN?args:['exec','supabase',...args],{encoding:'utf8',maxBuffer:512*1024*1024,timeout:300000});if(r.status!==0)throw Error('BACKUP_CLI_FAILED');return r.stdout;}
function query(sql:string){writeFileSync(temp+'/query.sql',sql,{mode:0o600});const result=JSON.parse(cli(['db','query','--linked','--project-ref',ref,'--file',temp+'/query.sql','--output','json']));stage='parse-query';const rows=Array.isArray(result)?result:result.rows;if(!Array.isArray(rows))throw Error('BACKUP_QUERY_FORMAT');return rows as Record<string,unknown>[];}
try{
 stage='connection';const conn=JSON.parse(readFileSync('.local/cloud-connection.json','utf8'))[mode];if(conn.url!==`https://${ref}.supabase.co`)throw Error('BACKUP_TARGET_MISMATCH');
 cli(['db','dump','--linked','--project-ref',ref,'--schema','public,private,auth,storage','--data-only','--use-copy','--exclude','auth.schema_migrations,storage.migrations,storage.buckets','--file',temp+'/database.sql']);chmodSync(temp+'/database.sql',0o600);
 stage='read-dump';const files:Record<string,string>={'database.sql':readFileSync(temp+'/database.sql').toString('base64')};
 const objects=query("select bucket_id,name,metadata->>'mimetype' content_type from storage.objects order by bucket_id,name");
 const manifest=[];
 for(const o of objects){const download=await fetch(conn.url+'/storage/v1/object/authenticated/'+encodeURIComponent(String(o.bucket_id))+'/'+String(o.name).split('/').map(encodeURIComponent).join('/'),{headers:{apikey:conn.secret,Authorization:'Bearer '+conn.secret}});if(!download.ok)throw Error('BACKUP_STORAGE_FAILED');const bytes=Buffer.from(await download.arrayBuffer()),file=hash(Buffer.from(String(o.bucket_id)+'/'+o.name))+'.bin';files[file]=bytes.toString('base64');manifest.push({...o,file,sha256:hash(bytes),bytes:bytes.length});}
 const vault=query("select id,name,description,decrypted_secret from vault.decrypted_secrets where name like 'apma-webhook:%' order by id");files['vault-secrets.json']=Buffer.from(JSON.stringify(vault)).toString('base64');
 const counts=query("select 'organizations' name,count(*)::int n from public.organizations union all select 'payments',count(*)::int from public.payments union all select 'financial_documents',count(*)::int from public.financial_documents union all select 'contract_periods',count(*)::int from public.contract_periods union all select 'work_items',count(*)::int from public.work_items union all select 'auth_users',count(*)::int from auth.users");
 const migrations=query('select version,name from supabase_migrations.schema_migrations order by version');
 const metadata={sourceRef:ref,format:'sql',createdAt:new Date().toISOString(),durationMs:Date.now()-started,objects:manifest,vaultSecrets:vault.length,counts,migrations,migrationNames:migrations.map(m=>m.name).sort(),sourceFiles:readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).map(n=>({name:n,sha256:hash(readFileSync('supabase/migrations/'+n))}))};
 files['manifest.json']=Buffer.from(JSON.stringify(metadata)).toString('base64');
 const localNames=metadata.sourceFiles.map(f=>f.name.replace(/^\d+_/, '').replace(/\.sql$/, '')).sort();if(JSON.stringify(localNames)!==JSON.stringify(metadata.migrationNames))throw Error('BACKUP_MIGRATION_SYNC_REQUIRED');
 stage='encryption';const plaintext=gzipSync(Buffer.from(JSON.stringify(files))),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
 const path=`${root}/${mode}-${stamp}.apma`,packet=Buffer.concat([Buffer.from('APMA1'),iv,cipher.getAuthTag(),encrypted]);writeFileSync(path,packet,{mode:0o600,flag:'wx'});
 const check=createDecipheriv('aes-256-gcm',key,iv);check.setAuthTag(packet.subarray(17,33));const decoded=Buffer.concat([check.update(packet.subarray(33)),check.final()]);if(hash(decoded)!==hash(plaintext))throw Error('BACKUP_VERIFICATION_FAILED');JSON.parse(gunzipSync(decoded).toString());
 const status={status:'done',sourceRef:ref,completedAt:new Date().toISOString(),durationMs:Date.now()-started,objects:objects.length,bytes:packet.length,sha256:hash(packet),path,verified:true};writeFileSync(`.local/cloud-backup-${mode}-status.json`,JSON.stringify(status,null,2),{mode:0o600});
 // Keep 30 daily generations; never remove the newest seven verified archives.
 const archives=readdirSync(root).filter(n=>new RegExp('^'+mode+'-\\d{4}-.*\\.apma$').test(n)).sort().reverse();
 for(const name of archives.slice(7))if(Date.now()-statSync(root+'/'+name).mtimeMs>30*86400000)rmSync(root+'/'+name);
 query(`insert into public.job_runs(organization_id,type,dedupe_key,status,attempts,result) select id,'backup.daily','${new Date().toISOString().slice(0,10)}','done',1,jsonb_build_object('completed_at',now(),'storage_objects',${objects.length},'archive_sha256','${status.sha256}') from public.organizations on conflict(organization_id,type,dedupe_key) do update set status='done',attempts=job_runs.attempts+1,result=excluded.result,last_error=null`);
 console.log(JSON.stringify(status));
}catch(e){writeFileSync(`.local/cloud-backup-${mode}-failure.json`,JSON.stringify({status:'failed',at:new Date().toISOString(),stage,errorType:e instanceof Error?e.name:'unknown',code:e instanceof Error&&/^BACKUP_[A-Z_]+$/.test(e.message)?e.message:'BACKUP_FAILED'}),{mode:0o600});throw Error('Cloud backup failed; inspect private status and account connectivity.');}
finally{rmSync(temp,{recursive:true,force:true});}
