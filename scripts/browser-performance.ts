import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const target=process.env.APMA_PERF_URL??'http://127.0.0.1:3000';
if(target!=='http://127.0.0.1:3000')throw Error('LOCAL_SYNTHETIC_BENCHMARK_ONLY');
const fixture=JSON.parse(readFileSync('.local/load-fixture.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const c1=await browser.newContext({baseURL:target,viewport:{width:1440,height:900}}),c2=await browser.newContext({baseURL:target,viewport:{width:1440,height:900}});
const a=await c1.newPage(),b=await c2.newPage();
const report:{navigationLcp:number[];eventDurations:number[];realtimeFromCommit:number[];mutation:number[];reconnectMs?:number}={navigationLcp:[],eventDurations:[],realtimeFromCommit:[],mutation:[]};
try{
 for(const [page,user] of [[a,fixture.users[0]],[b,fixture.users[1]]] as const){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Şifrə',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Daxil ol',exact:true}).click();await page.waitForURL(/workspace/);}
 await a.addInitScript(()=>{const w=window as unknown as {perfLcp:number;perfEvents:number[]};w.perfLcp=0;w.perfEvents=[];new PerformanceObserver(l=>{for(const e of l.getEntries())w.perfLcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if((e as PerformanceEventTiming).interactionId)w.perfEvents.push(e.duration);}).observe({type:'event',buffered:true,durationThreshold:16} as PerformanceObserverInit);});
 for(let i=0;i<5;i++){await a.goto('/workspace/crm');await a.locator('.deal-card').first().waitFor();await a.getByRole('button',{name:'Siyahı',exact:true}).click();report.navigationLcp.push(await a.evaluate(()=>(window as unknown as {perfLcp:number}).perfLcp));}
 for(let i=0;i<12;i++){await a.getByRole('button',{name:i%2?'Siyahı':'Kanban',exact:true}).click();}
 report.eventDurations=await a.evaluate(()=>(window as unknown as {perfEvents:number[]}).perfEvents);
 const org=fixture.org,origin=target,base='Perf-visible-'+Date.now();
 const refs=await (await a.request.get(`/api/data?org=${org}&module=crm`)).json();
 async function command(operation:string,payload:Record<string,unknown>,v=1){const start=performance.now();const r=await a.request.post('/api/command',{headers:{origin},data:{org,domain:'crm',operation,payload,expected_version:v,request_id:crypto.randomUUID()}});if(!r.ok())throw Error('PERF_COMMAND_FAILED_'+r.status());report.mutation.push(Math.round(performance.now()-start));return r.json();}
 let deal=await command('deal.create',{title:base,customer_id:refs.data.customers[0].id,works:[{name:'Sintetik perf',department_id:refs.data.departments[0].id,assignee_id:fixture.users[0].member}]});
 await b.goto('/workspace/crm');await b.getByRole('textbox',{name:'Axtarış',exact:true}).fill(base);await b.getByRole('heading',{name:base,exact:true}).waitFor();
 for(let i=0;i<20;i++){const title=base+' '+i;deal=await command('deal.update',{deal_id:deal.id,title},deal.version);const committed=performance.now();await b.getByRole('heading',{name:title,exact:true}).waitFor();report.realtimeFromCommit.push(Math.round(performance.now()-committed));}
 await c2.setOffline(true);deal=await command('deal.update',{deal_id:deal.id,title:base+' reconnect'},deal.version);const resumed=performance.now();await c2.setOffline(false);await b.getByRole('heading',{name:base+' reconnect',exact:true}).waitFor({timeout:30000});report.reconnectMs=Math.round(performance.now()-resumed);
 const summary=(a:number[])=>{const x=[...a].sort((a,b)=>a-b);return {samples:x.length,p50:x[Math.ceil(x.length*.5)-1]??null,p95:x[Math.ceil(x.length*.95)-1]??null,max:x.at(-1)??null};};
 const output={testedAt:new Date().toISOString(),environment:'Local Next production server, Chrome headless 1440x900, no network/CPU throttle; existing 2500 customer / initial 10000 deal / 40000 work fixture',navigationLcpMs:summary(report.navigationLcp),observedInteractionEventMs:summary(report.eventDurations),realtimeAfterMutationResponseMs:summary(report.realtimeFromCommit),mutationMs:summary(report.mutation),reconnectMs:report.reconnectMs,raw:report};writeFileSync('.local/browser-performance.json',JSON.stringify(output,null,2));console.log(JSON.stringify({...output,raw:undefined},null,2));
}finally{await browser.close();}
