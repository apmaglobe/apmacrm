/** Disposable join applicants; this fixture never runs against production. */
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const target=process.env.APMA_AUTH_TEST_TARGET??'local';
if(!['local','preview'].includes(target))throw Error('Only local/preview fixtures allowed');
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const connection=target==='preview'?JSON.parse(readFileSync('.local/cloud-connection.json','utf8')).preview:{url:env.NEXT_PUBLIC_SUPABASE_URL,secret:env.SUPABASE_SECRET_KEY};
if(!connection.url.includes(target==='preview'?'obtlqejryfvcqfsjxeda':'127.0.0.1'))throw Error('Incorrect fixture target');
const db=createClient(connection.url,connection.secret,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
for(let i=0;i<2;i++){
 const email=`access-${randomUUID()}@example.test`,password=randomUUID();const r=await db.auth.admin.createUser({email,password,email_confirm:true});
 if(r.error)throw Error('Fixture creation failed');users.push({email,password,id:r.data.user.id});
}
writeFileSync(`.local/access-${target}-fixture.json`,JSON.stringify({target,users}),{mode:0o600});
console.log(JSON.stringify({target,users:users.length}));
