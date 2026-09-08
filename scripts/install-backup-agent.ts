/** Install the CRM's own backup job; no cloud plan or billing changes. */
import {writeFileSync,existsSync,mkdirSync,readFileSync,cpSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
if(process.platform!=='darwin')throw Error('This installer is for the configured macOS backup host.');
const source=resolve('.'),root=homedir()+'/Library/Application Support/APMA CRM Backup',label='com.apma.crm.backup',file=homedir()+'/Library/LaunchAgents/'+label+'.plist';
if(!existsSync(source+'/.local/backup-master.key')||!existsSync(source+'/.local/cloud-backup-production-status.json'))throw Error('Run and verify a manual production backup first.');
if(existsSync(file)&&!readFileSync(file,'utf8').includes('<string>'+label+'</string>'))throw Error('Refusing to replace an unrelated agent.');
mkdirSync(root,{recursive:true,mode:0o700});mkdirSync(root+'/.local',{recursive:true,mode:0o700});mkdirSync(root+'/bin',{recursive:true,mode:0o700});
const conn=JSON.parse(readFileSync(source+'/.local/cloud-connection.json','utf8'));
writeFileSync(root+'/.local/cloud-connection.json',JSON.stringify({production:conn.production}),{mode:0o600});
if(existsSync(root+'/.local/backup-master.key')&&!readFileSync(root+'/.local/backup-master.key').equals(readFileSync(source+'/.local/backup-master.key')))throw Error('Existing backup key mismatch; preserve recovery access.');
cpSync(source+'/.local/backup-master.key',root+'/.local/backup-master.key');chmodSync(root+'/.local/backup-master.key',0o600);
cpSync(source+'/scripts/cloud-backup.ts',root+'/cloud-backup.ts');cpSync(source+'/supabase/migrations',root+'/supabase/migrations',{recursive:true});cpSync(source+'/supabase/config.toml',root+'/supabase/config.toml');
const bin=source+'/node_modules/.pnpm/@supabase+cli-darwin-arm64@2.116.0/node_modules/@supabase/cli-darwin-arm64/bin/';
for(const name of ['supabase','supabase-go']){cpSync(bin+name,root+'/bin/'+name);chmodSync(root+'/bin/'+name,0o700);}
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const paths=dirname(process.execPath)+':/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin';
mkdirSync(dirname(file),{recursive:true});for(const name of ['backup-agent.stdout.log','backup-agent.stderr.log'])if(!existsSync(root+'/.local/'+name))writeFileSync(root+'/.local/'+name,'',{mode:0o600});
writeFileSync(file,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(root+'/cloud-backup.ts')}</string></array>
<key>WorkingDirectory</key><string>${esc(root)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${esc(paths)}</string><key>APMA_SUPABASE_BIN</key><string>${esc(root+"/bin/supabase")}</string><key>DOCKER_HOST</key><string>${esc('unix://'+homedir()+'/.colima/apma-crm/docker.sock')}</string></dict>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>15</integer></dict><key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${esc(root+'/.local/backup-agent.stdout.log')}</string><key>StandardErrorPath</key><string>${esc(root+'/.local/backup-agent.stderr.log')}</string></dict></plist>`,{mode:0o600});
const domain='gui/'+process.getuid!();spawnSync('launchctl',['bootout',domain+'/'+label]);const r=spawnSync('launchctl',['bootstrap',domain,file],{encoding:'utf8'});if(r.status)throw Error('Backup agent did not load.');console.log('CRM backup agent loaded: daily 05:15 local time and at login; requires this Mac, Docker and account access.');
