"use client";
import {useEffect, useRef, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useInfiniteQuery} from "@tanstack/react-query";
import {Check, Copy, Link2, Mail, Plus, RefreshCw, ShieldCheck, UserRoundCheck, X} from "lucide-react";
import {browserClient} from "@/lib/auth/browser";
import {dateTime} from "@/lib/domain";
import {Modal} from "@/components/dialog";
import {Form, Field, Select} from "@/components/form";
import type {PanelProps} from "@/components/module-page";
import {Users} from "./panel";

type AccessLink={id:string;kind:"join"|"email";name:string;email:string|null;token:string|null;created_at:string;expires_at:string|null;revoked_at:string|null;accepted_at:string|null;version:number;status:string;uses:number};
type JoinRequest={id:string;name:string;email:string;version:number;status:string;decision:string;requested_at:string;decided_at:string|null;reason:string|null;source_kind:string;source_name:string};
type AccessData={counts:{pending:number;active_links:number;members:number};links:AccessLink[];requests:JoinRequest[]};
const labels:Record<string,string>={active:"Aktiv",expired:"Müddəti bitib",revoked:"Ləğv edilib",accepted:"İstifadə edilib",pending:"Təsdiq gözləyir",approved:"Təsdiqlənib",rejected:"Rədd edilib"};
const errors:Record<string,string>={VERSION_CONFLICT:"Məlumat dəyişib. Səhifəni yeniləyib təkrar yoxlayın.",ADMIN_REQUIRED:"Bu əməliyyat üçün aktiv admin və iki mərhələli giriş tələb olunur.",REQUEST_ALREADY_DECIDED:"Bu müraciətə artıq baxılıb.",INVITATION_USED:"Bu dəvət artıq istifadə edilib. Yeni dəvət yaradın.",LINK_RATE_LIMIT:"Saatlıq link yaratma limitinə çatılıb.",REASON_REQUIRED:"Rədd edilmə səbəbini yazın."};
function remaining(expires:string|null){if(!expires)return "Müddətsiz";const minutes=Math.ceil((new Date(expires).getTime()-Date.now())/60000);if(minutes<=0)return "Müddəti bitib";if(minutes>=1440)return `${Math.ceil(minutes/1440)} gün qalıb`;if(minutes>=60)return `${Math.ceil(minutes/60)} saat qalıb`;return `${minutes} dəqiqə qalıb`;}

function useAdminChoice(key:string,fallback:string){
 const params=useSearchParams(),router=useRouter(),path=usePathname();
 return [params.get(key)??fallback,(value:string)=>{const next=new URLSearchParams(params.toString());next.set(key,value);router.replace(`${path}?${next}`,{scroll:false});}] as const;
}
export function AdminPanel(props:PanelProps){
 const [tab,setTab]=useAdminChoice("adminTab","access");
 if(!props.member.is_admin)return <p role="alert">Admin girişi tələb olunur.</p>;
 return <><div className="admin-tabs" role="tablist" aria-label="Admin bölmələri">
  <button role="tab" aria-selected={tab==="access"} aria-controls="admin-access-content" id="admin-access-tab" onClick={()=>setTab("access")}><ShieldCheck size={18}/>Müraciətlər və linklər</button>
  <button role="tab" aria-selected={tab==="team"} aria-controls="admin-team-content" id="admin-team-tab" onClick={()=>setTab("team")}><UserRoundCheck size={18}/>Komanda və parametrlər</button>
 </div>{tab==="access"?<section role="tabpanel" id="admin-access-content" aria-labelledby="admin-access-tab"><AccessManager {...props}/></section>:<section role="tabpanel" id="admin-team-content" aria-labelledby="admin-team-tab"><Users {...props} inAdmin/></section>}</>;
}
function AccessManager({org,refresh,q}:PanelProps){
 const [dialog,setDialog]=useState<{operation:string;link?:AccessLink;request?:JoinRequest;requestId:string}|null>(null);
 const [requestFilter,setRequestFilter]=useAdminChoice("requests","pending");
 const [linkFilter,setLinkFilter]=useAdminChoice("links","all");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const ids=useRef(new Map<string,string>());
 const previousPending=useRef<number|null>(null);
 const query=useInfiniteQuery({queryKey:["workspace",org,"admin-access"],initialPageParam:0,
  queryFn:async({pageParam})=>{const r=await browserClient().rpc("admin_access_read",{org,page_offset:pageParam});if(r.error)throw Error(errors[r.error.message]??"Admin məlumatları yüklənmədi.");return r.data as AccessData;},
  getNextPageParam:(last,pages)=>last.links.length>100||last.requests.length>100?pages.length*100:undefined,refetchInterval:30000});
 const pages=query.data?.pages??[];
 const links=pages.flatMap(p=>p.links.slice(0,100));
 const requests=pages.flatMap(p=>p.requests.slice(0,100));
 const counts=pages[0]?.counts;
 const pendingCount=counts?.pending;
 useEffect(()=>{
  if(pendingCount===undefined)return;
  if(previousPending.current!==null&&pendingCount>previousPending.current){
   setMessage("Yeni qoşulma müraciəti gəldi. Təsdiq üçün siyahıda görünür.");
   setError("");
  }
  previousPending.current=pendingCount;
 },[pendingCount]);
 async function mutate(operation:string,payload:Record<string,unknown>,version:number,requestId:string){
  const r=await browserClient().rpc("admin_access_command",{org,operation,payload,expected_version:version,request_id:requestId});
  if(r.error)throw Error(errors[r.error.message]??"Əməliyyat tamamlanmadı. Məlumatları yoxlayıb yenidən sınayın.");
  await refresh();
 }
 async function approve(row:JoinRequest){
  const key=`approve:${row.id}:${row.version}`;
  if(!ids.current.has(key))ids.current.set(key,crypto.randomUUID());
  setBusy(row.id);setError("");setMessage("");
  try{await mutate("request.approve",{id:row.id},row.version,ids.current.get(key)!);setMessage(`${row.name} — üzvlük aktivləşdirildi.`);}catch(e){setError((e as Error).message);}finally{setBusy(null);}
 }
 async function copy(link:AccessLink){
  if(!link.token)return;
  try{await navigator.clipboard.writeText(`${location.origin}/${link.kind==="join"?"join":"invite"}/${link.token}`);setMessage("Link kopyalandı.");setError("");}catch{setError("Brauzer kopyalamağa icazə vermədi. Linki açıb ünvan sətrindən kopyalayın.");}
 }
 const matches=(text:string)=>text.toLocaleLowerCase("az").includes(q.toLocaleLowerCase("az"));
 const visibleLinks=links.filter(l=>(linkFilter==="all"||l.status===linkFilter)&&matches(l.name));
 const visibleRequests=requests.filter(r=>(requestFilter==="all"||r.decision===requestFilter)&&matches(`${r.name} ${r.email}`));
 return <>
  <div className="admin-stats">
   <article className="surface"><UserRoundCheck size={20}/><strong>{counts?.pending??"—"}</strong><span>Gözləyən müraciət</span></article>
   <article className="surface"><Link2 size={20}/><strong>{counts?.active_links??"—"}</strong><span>Aktiv link</span></article>
   <article className="surface"><ShieldCheck size={20}/><strong>{counts?.members??"—"}</strong><span>Aktiv əməkdaş</span></article>
  </div>
  <p className="helper">Agentliyinizin qoşulma və dəvət linkləri, müraciətləri və giriş qərarları burada idarə olunur. Ümumi qeydiyyat özü agentliyə müraciət yaratmır; əməkdaş qoşulma linkini açmalıdır.</p>
  {message&&<p className="notice" role="status">{message}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  {query.isError&&<p className="notice error" role="alert">{query.error.message}<button onClick={()=>query.refetch()}>Yenidən yoxla</button></p>}
  <section className="surface admin-section" aria-label="Qoşulma müraciətləri">
   <div className="section-toolbar"><div><h2>Qoşulma müraciətləri</h2><p>Linkdən müraciət edən əməkdaşları təsdiqləyin.</p></div><label className="admin-filter">Müraciət vəziyyəti<select aria-label="Müraciət vəziyyəti" value={requestFilter} onChange={e=>setRequestFilter(e.target.value)}><option value="all">Hamısı</option>{["pending","approved","rejected"].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label></div>
   {query.isPending?<p>Yüklənir…</p>:visibleRequests.length===0?<div className="empty">Bu seçimdə müraciət yoxdur.</div>:visibleRequests.map(row=><article className="access-row" key={row.id}>
    <div className="access-info"><h3>{row.name}</h3><p>{row.email}</p><small>{row.source_name} · {dateTime(row.requested_at)}</small>{row.reason&&<p>Səbəb: {row.reason}</p>}</div>
    <span className={`access-status ${row.decision}`}>{labels[row.decision]}</span>
    {row.decision==="pending"&&<div className="toolbar"><button className="primary" disabled={busy!==null} onClick={()=>approve(row)}><Check size={16}/>{busy===row.id?"Saxlanır…":"Təsdiqlə"}</button><button disabled={busy!==null} onClick={()=>setDialog({operation:"request.reject",request:row,requestId:crypto.randomUUID()})}><X size={16}/>Rədd et</button></div>}
   </article>)}
  </section>
  <section className="surface admin-section" aria-label="Dəvət və qoşulma linkləri">
   <div className="section-toolbar"><div><h2>Dəvət və qoşulma linkləri</h2><p>Müddət, istifadə sayı və linkin cari vəziyyəti.</p></div><button className="primary" onClick={()=>setDialog({operation:"link.create",requestId:crypto.randomUUID()})}><Plus size={18}/>Link yarat</button></div>
   <label className="admin-filter">Link vəziyyəti<select aria-label="Link vəziyyəti" value={linkFilter} onChange={e=>setLinkFilter(e.target.value)}><option value="all">Hamısı</option>{["active","expired","revoked","accepted"].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
   {query.isPending?<p>Yüklənir…</p>:visibleLinks.length===0?<div className="empty">Bu seçimdə link yoxdur.</div>:visibleLinks.map(link=><article className="access-row" key={link.id}>
    <span className="filter-icon">{link.kind==="join"?<Link2 size={18}/>:<Mail size={18}/>}</span>
    <div className="access-info"><h3>{link.name}</h3><p>{link.kind==="join"?"Ümumi qoşulma":"Emailə bağlı dəvət"} · {link.uses} istifadə</p><small>Yaradılıb: {dateTime(link.created_at)}<br/>Bitir: {link.expires_at?dateTime(link.expires_at):"Müddətsiz"}{link.status==="active"&&` · ${remaining(link.expires_at)}`}</small>{link.accepted_at&&<p>İstifadə: {dateTime(link.accepted_at)}</p>}</div>
    <span className={`access-status ${link.status}`}>{labels[link.status]}</span>
    <div className="toolbar">
     {link.status==="active"&&link.token&&<><button aria-label={`${link.name} — linki kopyala`} onClick={()=>copy(link)}><Copy size={16}/>Kopyala</button><a className="button" href={`/${link.kind==="join"?"join":"invite"}/${link.token}`} target="_blank" rel="noreferrer">Aç</a></>}
     {link.status!=="accepted"&&<button aria-label={`${link.name} — linki yenilə`} onClick={()=>setDialog({operation:"link.renew",link,requestId:crypto.randomUUID()})}><RefreshCw size={16}/>Yenilə</button>}
     {link.status==="active"&&<button aria-label={`${link.name} — linki ləğv et`} onClick={()=>setDialog({operation:"link.revoke",link,requestId:crypto.randomUUID()})}><X size={16}/>Ləğv et</button>}
    </div>
    {link.kind==="email"&&!link.token&&link.status==="active"&&<small>Əvvəlki linkin ünvanını yenidən almaq üçün “Yenilə” seçin.</small>}
   </article>)}
  </section>
  {query.hasNextPage&&<button disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>Daha çox müraciət və link</button>}
  {dialog&&<AccessDialog key={dialog.requestId} dialog={dialog} close={()=>setDialog(null)} save={async(payload)=>{await mutate(dialog.operation,payload,dialog.link?.version??dialog.request?.version??1,dialog.requestId);setDialog(null);setMessage("Dəyişiklik saxlanıldı.");setError("");}}/>}
 </>;
}
function AccessDialog({dialog,close,save}:{dialog:{operation:string;link?:AccessLink;request?:JoinRequest};close:()=>void;save:(payload:Record<string,unknown>)=>Promise<void>}){
 const [kind,setKind]=useState("join");
 const titles:Record<string,string>={"link.create":"Yeni link","link.renew":"Linki yenilə","link.revoke":"Linki ləğv et","request.reject":"Müraciəti rədd et"};
 return <Modal title={titles[dialog.operation]} onClose={close}><Form label={dialog.operation==="request.reject"?"Rədd et":dialog.operation==="link.revoke"?"Linki ləğv et":"Saxla"} onSave={async f=>save({...(dialog.link?{id:dialog.link.id,kind:dialog.link.kind}:dialog.request?{id:dialog.request.id}:{kind,name:f.get("name"),email:f.get("email")}),...(dialog.operation==="link.create"||dialog.operation==="link.renew"?{days:Number(f.get("days"))}:{}),...(dialog.operation==="request.reject"?{reason:f.get("reason")}: {})})}>
  {dialog.operation==="link.create"&&<><label>Link növü<select aria-label="Link növü" value={kind} onChange={e=>setKind(e.target.value)}><option value="join">Ümumi qoşulma linki</option><option value="email">Emailə bağlı dəvət</option></select></label>{kind==="join"?<Field name="name" label="Linkin adı" required/>:<Field name="email" label="Dəvət edilənin emaili" type="email" required/>}<p>Linki əməkdaşa özünüz göndərirsiniz. Qoşulduqdan sonra müraciəti bu paneldə təsdiqləyirsiniz.</p></>}
  {dialog.operation==="link.renew"&&<p>Yeni ünvan yaradılacaq, əvvəlki ünvan işləməyəcək. Mövcud üzvlüklər saxlanır.</p>}
  {["link.create","link.renew"].includes(dialog.operation)&&<Select name="days" label="Etibarlılıq müddəti" value="7" options={[{id:"1",name:"1 gün"},{id:"7",name:"7 gün"},{id:"30",name:"30 gün"}]} required/>}
  {dialog.operation==="link.revoke"&&<p>Bu linkdən yeni müraciət qəbul edilməyəcək. Artıq qoşulmuş əməkdaşların üzvlüyü saxlanır.</p>}
  {dialog.operation==="request.reject"&&<><p>{dialog.request?.name} — bu müraciət rədd ediləcək.</p><Field name="reason" label="Rədd edilmə səbəbi" required/></>}
 </Form></Modal>;
}
