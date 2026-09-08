/** Disposable identities for testing first-admin onboarding. Never targets production. */
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {Pool} from 'pg';
const target=process.env.APMA_AUTH_TEST_TARGET??'local';
if(!['local','preview'].includes(target))throw Error('Only isolated local/preview targets allowed');
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const connection=target==='preview'?JSON.parse(readFileSync('.local/cloud-connection.json','utf8')).preview:{url:env.NEXT_PUBLIC_SUPABASE_URL,secret:env.SUPABASE_SECRET_KEY};
if(target==='local'&&!connection.url.includes('127.0.0.1'))throw Error('Local target required');
if(target==='preview'&&!connection.url.includes('obtlqejryfvcqfsjxeda'))throw Error('Preview target required');
const service=createClient(connection.url,connection.secret,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
for(const name of ['bootstrap','pending']){
 const email=`login-${name}-${randomUUID()}@example.test`,password=randomUUID();
 const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error('Fixture creation failed');
 users.push({id:data.user.id,email,password});
}
const slug='login-'+randomUUID(),fixture={target,users,slug};
writeFileSync(`.local/login-${target}-fixture.json`,JSON.stringify(fixture),{mode:0o600});
if(target==='local'){
 const pool=new Pool({connectionString:env.DATABASE_URL});
 await pool.query('insert into private.bootstrap_admins(email,organization_name,slug) values($1,$2,$3)',[users[0].email,'Login test',slug]);await pool.end();
}
console.log(JSON.stringify({target,bootstrapEmail:users[0].email,slug}));
