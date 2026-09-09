import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
if(!env.DATABASE_URL?.includes('127.0.0.1'))throw Error('Isolated local database required');
const db=new Pool({connectionString:env.DATABASE_URL});
const org=randomUUID(),foreign=randomUUID(),admin=randomUUID(),otherAdmin=randomUUID(),member=randomUUID(),newUser=randomUUID(),rejectedUser=randomUUID(),invited=randomUUID();
let passed=0;
async function check(name:string,fn:()=>Promise<void>){await fn();console.log('PASS '+name);passed++;}
async function as(uid:string,sql:string,args:unknown[]=[],aal='aal2'){
 const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,role:'authenticated',aal})]);await c.query('set local role authenticated');const r=await c.query(sql,args);await c.query('commit');return r.rows;}catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
async function read(uid:string=admin,target:string=org,aal='aal2'){return (await as(uid,'select public.admin_access_read($1) r',[target],aal))[0].r;}
async function cmd(operation:string,payload:unknown,version=1,id:string=randomUUID(),uid:string=admin,target:string=org){return (await as(uid,'select public.admin_access_command($1,$2,$3,$4,$5) r',[target,operation,payload,version,id]))[0].r;}
async function link(id:string){return (await read()).links.find((x:{id:string})=>x.id===id);}
async function join(uid:string,token:string){return (await as(uid,'select public.join_organization($1,$2) id',[token,'Access test']))[0].id;}
try{
 for(const u of [admin,otherAdmin,member,newUser,rejectedUser,invited])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,u+'@example.test']);
 for(const o of [org,foreign]){await db.query('insert into public.organizations(id,name,slug) values($1::uuid,$2,$1::text)',[o,'Access test']);await db.query('select private.initialize_org($1)',[o]);}
 for(const [o,u,isAdmin] of [[org,admin,true],[foreign,otherAdmin,true],[org,member,false]])await db.query("insert into public.memberships(organization_id,user_id,name,status,is_admin) values($1,$2,'Access actor','active',$3)",[o,u,isAdmin]);
 await check('admin-only read/write, AAL2, tenant and raw-token boundaries',async()=>{
  assert.equal((await read()).counts.members,2);
  for(const [uid,target,aal] of [[member,org,'aal2'],[otherAdmin,org,'aal2'],[admin,org,'aal1'],[newUser,org,'aal2']])await assert.rejects(read(uid,target,aal),/ADMIN_REQUIRED/);
  await assert.rejects(cmd('link.create',{kind:'join',name:'Denied'},1,randomUUID(),otherAdmin),/ADMIN_REQUIRED/);
  await assert.rejects(as(member,'select join_token from public.organizations where id=$1',[org]),/permission denied/);
  await assert.rejects(as(admin,'select * from private.invitation_tokens'),/permission denied/);
  assert.equal((await db.query("select has_function_privilege('anon','public.admin_access_read(uuid,integer)','execute') allowed")).rows[0].allowed,false);
 });
 let general:string;
 await check('link create is idempotent with no credential in request/audit payload',async()=>{
  const request=randomUUID(),payload={kind:'join',name:'Hiring',days:7};
  const a=await cmd('link.create',payload,1,request),b=await cmd('link.create',payload,1,request);assert.equal(a.id,b.id);general=a.id;
  await assert.rejects(cmd('link.create',{...payload,name:'Changed'},1,request),/IDEMPOTENCY_CONFLICT/);
  const l=await link(general);assert.equal(l.status,'active');assert.equal(l.uses,0);assert.ok(new Date(l.expires_at).getTime()>Date.now()+6*86400000);
  const rows=await db.query('select payload::text,result::text from private.requests where organization_id=$1',[org]);assert.ok(rows.rows.every(r=>!JSON.stringify(r).includes(l.token)));
 });
 let pending:string;
 await check('join replay/concurrency creates one pending request and source use',async()=>{
  const l=await link(general!);const mids=await Promise.all([join(newUser,l.token),join(newUser,l.token)]);assert.equal(mids[0],mids[1]);pending=mids[0];
 const r=await read();assert.equal(r.requests.find((x:{id:string})=>x.id===pending).decision,'pending');assert.equal((await link(general!)).uses,1);
  const notices=await db.query("select event_key,label from public.notifications where organization_id=$1 and recipient_id=(select id from public.memberships where organization_id=$1 and user_id=$2)",[org,admin]);
  assert.deepEqual(notices.rows,[{event_key:`membership-request:${pending}`,label:'Yeni qoşulma müraciəti'}]);
  assert.equal((await as(newUser,'select count(*)::int n from public.customers where organization_id=$1',[org]))[0].n,0);
  await assert.rejects(read(newUser),/ADMIN_REQUIRED/);
 });
 await check('approval is versioned, retry-safe and cannot target another tenant',async()=>{
  const request=randomUUID();await assert.rejects(cmd('request.approve',{id:pending},99),(e:unknown)=>{assert.equal((e as {code:string}).code,'PT409');return /VERSION_CONFLICT/.test(String(e));});
  await assert.rejects(cmd('request.approve',{id:pending},1,randomUUID(),otherAdmin,foreign),/NOT_FOUND/);
  await cmd('request.approve',{id:pending},1,request);await cmd('request.approve',{id:pending},1,request);
  const m=(await db.query('select status,version from public.memberships where id=$1',[pending])).rows[0];assert.equal(m.status,'active');assert.equal(Number(m.version),2);
  assert.equal((await read()).requests.find((x:{id:string})=>x.id===pending).decision,'approved');
 });
 await check('renew invalidates old link; expiry and revoke deny new requests',async()=>{
  const old=await link(general!);await cmd('link.renew',{id:general,kind:'join',days:1},old.version);await assert.rejects(join(rejectedUser,old.token),/INVALID_JOIN_LINK/);
  let current=await link(general!);await db.query("update private.join_links set expires_at=now()-interval '1 second' where id=$1",[general]);await assert.rejects(join(rejectedUser,current.token),/INVALID_JOIN_LINK/);assert.equal((await link(general!)).status,'expired');
  await cmd('link.renew',{id:general,kind:'join',days:7},current.version);current=await link(general!);await cmd('link.revoke',{id:general,kind:'join'},current.version);await assert.rejects(join(rejectedUser,current.token),/INVALID_JOIN_LINK/);assert.equal((await link(general!)).status,'revoked');
  assert.equal((await db.query('select status from public.memberships where id=$1',[pending])).rows[0].status,'active');
 });
 await check('rejection requires a reason and never reactivates on join replay',async()=>{
  const id=(await cmd('link.create',{kind:'join',name:'Review',days:7})).id,l=await link(id),mid=await join(rejectedUser,l.token);
  await assert.rejects(cmd('request.reject',{id:mid},1),/REASON_REQUIRED/);await cmd('request.reject',{id:mid,reason:'Not this team'},1);
  assert.equal(await join(rejectedUser,l.token),mid);assert.equal((await read()).requests.find((x:{id:string})=>x.id===mid).decision,'rejected');
 });
 await check('email invite targets only its verified email, tracks acceptance once',async()=>{
  const id=(await cmd('link.create',{kind:'email',email:invited+'@example.test',days:7})).id,l=await link(id);
  await assert.rejects(as(newUser,'select public.invite_accept($1,$2)',[l.token,'Wrong']),/INVALID_INVITATION/);
  const a=await as(invited,'select public.invite_accept($1,$2) id',[l.token,'Invited']);const b=await as(invited,'select public.invite_accept($1,$2) id',[l.token,'Invited']);assert.equal(a[0].id,b[0].id);
  const notice=await db.query("select event_key from public.notifications where organization_id=$1 and recipient_id=(select id from public.memberships where organization_id=$1 and user_id=$2) and event_key=$3",[org,admin,`membership-request:${a[0].id}`]);assert.equal(notice.rowCount,1);
  const now=await link(id);assert.equal(now.uses,1);assert.equal(now.status,'accepted');assert.ok(now.accepted_at);await assert.rejects(cmd('link.renew',{id,kind:'email',days:7},now.version),/INVITATION_USED/);
 });
 await check('email renewal/revocation and stale versions enforce lifecycle',async()=>{
  const id=(await cmd('link.create',{kind:'email',email:newUser+'@example.test',days:7})).id,old=await link(id);
  await cmd('link.renew',{id,kind:'email',days:30},old.version);await assert.rejects(as(newUser,'select public.invite_accept($1,$2)',[old.token,'Wrong']),/INVALID_INVITATION/);
  const l=await link(id);await assert.rejects(cmd('link.revoke',{id,kind:'email'},1),/VERSION_CONFLICT/);await cmd('link.revoke',{id,kind:'email'},l.version);await assert.rejects(as(newUser,'select public.invite_accept($1,$2)',[l.token,'Wrong']),/INVALID_INVITATION/);
 });
 await check('legacy join token preserved for new organizations and foreign lists isolated',async()=>{
  const legacy=(await db.query('select join_token from public.organizations where id=$1',[foreign])).rows[0].join_token;
  assert.equal((await read(otherAdmin,foreign)).links[0].token,legacy);
  assert.ok((await read(otherAdmin,foreign)).requests.length===0);
  assert.equal((await as(member,'select * from public.invitations where organization_id=$1',[org])).length,0);
 });
 await check('offboarding preserves the historical approval decision',async()=>{
  await db.query("update public.memberships set status='suspended' where id=$1",[pending]);
  assert.equal((await read()).requests.find((x:{id:string})=>x.id===pending).decision,'approved');
 });
 console.log(`${passed} admin access database checks passed.`);
}finally{await db.end();}
