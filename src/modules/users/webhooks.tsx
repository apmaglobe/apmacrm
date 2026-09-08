"use client";
import {useState} from "react";
import type {PanelProps} from "@/components/module-page";
import type {Item} from "@/lib/db/types";
import {Modal} from "@/components/dialog";
import {Form,Field,Select} from "@/components/form";
import {command} from "@/lib/db/api";
export function Webhooks({org,data,member,refresh}:PanelProps){
 const [edit,setEdit]=useState<Item|null|undefined>(),[secret,setSecret]=useState(""),[error,setError]=useState("");
 if(!member.is_admin)return null;
 return <section className="surface"><div className="section-toolbar"><h2>Lead webhook-ları</h2><button onClick={()=>setEdit(null)}>Webhook yarat</button></div>
 <p>Göndərən sistem bu CRM-in HMAC-SHA256 formatından istifadə etməlidir. Naməlum müəssisə lead-də saxlanır və sonradan Excel bazasına bağlanır.</p>
 {error&&<p className="notice error" role="alert">{error}</p>}
 {data.webhook_endpoints?.map(e=><div className="work-row" key={e.id}><div><h3>{e.name}</h3><code>/api/webhooks/leads/{e.id}</code><p>{e.enabled?"Aktiv":"Dayandırılıb"}</p></div><button onClick={()=>setEdit(e)}>Düzəliş</button><button onClick={async()=>{try{const r=await command(org,"identity","webhook.rotate",{id:e.id},e.version);setSecret(r.signing_secret??"");await refresh();}catch(x){setError((x as Error).message);}}}>İmza açarını yenilə</button></div>)}
 {data.webhook_events?.map(e=><div className="work-row" key={e.id}><span>{e.external_event_id} · {e.status} {e.last_error}</span>{e.deal_id&&<a href={`/workspace/crm?org=${org}&deal=${e.deal_id}`}>Qutu</a>}{e.status==="failed"&&<button onClick={async()=>{try{await command(org,"identity","webhook.retry",{id:e.id});await refresh();}catch(x){setError((x as Error).message);}}}>Yenidən sına</button>}</div>)}
 {edit!==undefined&&<Modal title={edit?"Webhook düzəlişi":"Webhook yarat"} onClose={()=>setEdit(undefined)}><Form onSave={async f=>{const r=await command(org,"identity","webhook.save",{...(edit?{id:edit.id}:{}),name:f.get("name"),department_id:f.get("department_id"),default_admin_id:f.get("default_admin_id"),enabled:f.get("enabled")==="on"},edit?.version??1);setSecret(r.signing_secret??"");setEdit(undefined);await refresh();}}><Field name="name" label="Webhook adı" value={edit?.name} required/><Select name="department_id" label="İlkin departament" value={edit?.department_id} options={data.departments?.filter(d=>!d.archived)??[]} required/><Select name="default_admin_id" label="İlkin cavabdeh admin" value={edit?.default_admin_id??member.id} options={data.memberships?.filter(m=>m.is_admin&&m.status==="active")??[]} required/><label className="check"><input name="enabled" type="checkbox" defaultChecked={edit?.enabled??true}/>Aktiv</label></Form></Modal>}
 {secret&&<Modal title="Webhook imza açarı" onClose={()=>setSecret("")}><p>Açarı göndərən sistemin gizli dəyişəninə köçürün. URL-yə, rəyə və ya paylaşılmış sənədə yazmayın. Köhnə açar yeniləmədən sonra 5 dəqiqə işləyir.</p><input aria-label="İmza açarı" type="password" value={secret} readOnly/><button onClick={()=>navigator.clipboard.writeText(secret)}>Açarı köçür</button><p>İmza: hex(HMAC-SHA256(açar, timestamp + &quot;.&quot; + raw_body)). Başlıqlar: X-CRM-Timestamp və X-CRM-Signature. Timestamp saniyə ilədir; 5 dəqiqəlik pəncərə qəbul edilir.</p></Modal>}
 </section>;
}
