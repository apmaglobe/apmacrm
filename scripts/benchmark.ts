import {createClient} from '@supabase/supabase-js';
import {Pool} from 'pg';
import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import os from 'node:os';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
if(!env.DATABASE_URL?.includes('127.0.0.1:54322')||env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('LOCAL_BENCHMARK_ONLY');
const pool=new Pool({connectionString:env.DATABASE_URL});const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
type Fixture={org:string;users:{id:string;member:string;email:string;password:string}[]};
let fixture:Fixture;
if(existsSync('.local/load-fixture.json'))fixture=JSON.parse(readFileSync('.local/load-fixture.json','utf8'));else{
 fixture={org:randomUUID(),users:[]};
 await pool.query("insert into public.organizations(id,name,slug) values($1,'Sintetik yük testi',$2)",[fixture.org,'load-'+fixture.org]);await pool.query('select private.initialize_org($1)',[fixture.org]);
 const deps=(await pool.query('select id from public.departments where organization_id=$1',[fixture.org])).rows.map(x=>x.id);
 for(let i=0;i<15;i++){const email=`load-${fixture.org}-${i}@example.test`,password=randomBytes(24).toString('base64url')+'aA1!';const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error(error.code??'CREATE_TEST_USER_FAILED');const member=randomUUID();await pool.query("insert into public.memberships(id,organization_id,user_id,name,status,role_id) values($1,$2,$3,$4,'active',(select id from public.roles where organization_id=$2 limit 1))",[member,fixture.org,data.user.id,'Yük '+i]);for(const dep of deps)await pool.query('insert into public.department_members values($1,$2,$3)',[fixture.org,dep,member]);fixture.users.push({id:data.user.id,member,email,password});}
 await pool.query("insert into public.customers(organization_id,external_id,name) select $1,'load-'||n,'Sintetik müəssisə '||n from generate_series(1,2500)n",[fixture.org]);
 await pool.query(`with c as(select id,row_number() over(order by id) n from public.customers where organization_id=$1), m as(select id,row_number() over(order by id) n from public.memberships where organization_id=$1)
 insert into public.deals(organization_id,serial,title,customer_id,created_by,accountable_id,creation_source,stage,due_at)
 select $1,'LOAD-'||n,'Sintetik qutu '||n,(select id from c where c.n=(g.n-1)%2500+1),(select id from m where m.n=(g.n-1)%15+1),(select id from m where m.n=(g.n-1)%15+1),'manual',(array['to_call','called','proposal_sent','met'])[(n-1)%4+1],now()+interval '30 days' from generate_series(1,10000)g(n)`,[fixture.org]);
 await pool.query(`insert into public.work_items(organization_id,deal_id,name,department_id,assignee_id,due_at) select $1,d.id,'Sintetik iş '||n,$2,d.accountable_id,now()+interval '10 days' from public.deals d cross join generate_series(1,4)n where d.organization_id=$1`,[fixture.org,deps[0]]);
 await pool.query('insert into public.work_prices select organization_id,id,10000 from public.work_items where organization_id=$1',[fixture.org]);
 writeFileSync('.local/load-fixture.json',JSON.stringify(fixture),{mode:0o600});
 await pool.query("insert into public.audit_events(organization_id,deal_id,action,visibility) select $1,id,'synthetic.seed','object' from public.deals where organization_id=$1",[fixture.org]);
 writeFileSync('.local/load-fixture.json',JSON.stringify(fixture),{mode:0o600});chmodSync('.local/load-fixture.json',0o600);console.log('Synthetic fixture: 15 users, 2500 customers, 10000 deals, 40000 works.');
}
if(process.argv.includes('--seed-only')){await pool.end();process.exit(0);}
const clients=await Promise.all(fixture.users.map(async u=>{const c=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInWithPassword({email:u.email,password:u.password});if(r.error)throw Error('TEST_LOGIN_FAILED');return c;}));
const results:{kind:string;ms:number;error:string|null}[]=[];
async function measured(kind:string,fn:()=>PromiseLike<{error:{code?:string}|null}>){const t=performance.now();const r=await fn();results.push({kind,ms:Math.round(performance.now()-t),error:r.error?.code??null});}
await measured('cold_board',()=>clients[0].rpc('board_page',{org:fixture.org,which_pipeline:'sales',search:'',page_number:0}));
for(let wave=0;wave<3;wave++)await Promise.all(clients.map((c)=>measured('warm_board_15',()=>c.rpc('board_page',{org:fixture.org,which_pipeline:'sales',search:'',page_number:0}))));
const customer=(await clients[0].from('customers').select('id').eq('organization_id',fixture.org).limit(1)).data?.[0];
const dep=(await clients[0].from('departments').select('id').eq('organization_id',fixture.org).limit(1)).data?.[0];
await Promise.all(clients.map((c,i)=>measured('write_15',()=>c.rpc('crm_command',{org:fixture.org,operation:'deal.create',expected_version:1,request_id:randomUUID(),payload:{customer_id:customer?.id,works:[{name:'Ölçmə işi',department_id:dep?.id,assignee_id:fixture.users[i].member}]}}))));
const groups=Object.fromEntries([...new Set(results.map(r=>r.kind))].map(kind=>{const group=results.filter(r=>r.kind===kind),times=group.map(r=>r.ms).sort((a,b)=>a-b);return[kind,{samples:group.length,errors:group.filter(r=>r.error).length,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1],max:times.at(-1)}];}));
const report={testedAt:new Date().toISOString(),environment:'Local Supabase Docker / Colima 4 CPU 6 GB; direct SDK HTTP; not production or Baku WAN',host:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model},dataset:{users:15,customers:2500,deals:10000,works:40000},groups,results};writeFileSync('.local/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(groups));await pool.end();
