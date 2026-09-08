"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Download} from "lucide-react";
import {Modal} from "./dialog";
import {command} from "@/lib/db/api";
const supported=["crm","map","todo","finance","subscriptions","tools","meetings","portfolio","drive","users"];
type Job={id:string;module:string;format:string;status:string;last_error:string|null};
export function Export({org,module,q,filters={}}:{org:string;module:string;q:string;filters?:Record<string,string>}){
 const [open,setOpen]=useState(false),[format,setFormat]=useState("xlsx"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [preview,setPreview]=useState<{table:string;count:number;columns:string[];rows:Record<string,unknown>[]}[]>([]);
 const query=useQuery<Job[]>({queryKey:["workspace",org,"export-jobs"],enabled:open,refetchInterval:open?3000:false,queryFn:async()=>{
 const r=await fetch(`/api/export/jobs?org=${org}`);if(!r.ok)throw new Error("İxrac tarixçəsi yüklənmədi.");return r.json();}});
 if(!supported.includes(module))return null;
 async function create(){setBusy(true);setError("");try{
 const j=await command(org,"export","create",{module,format,filters:{...(module==="crm"?{pipeline:"sales"}:{}),...filters,q,scope:filters.scope??"own"}});
 await query.refetch();
 const r=await fetch("/api/export/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({org,id:j.id})});
 if(!r.ok)throw new Error("İş növbədə saxlanıb; vəziyyəti yeniləyin.");await query.refetch();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><button className="icon-button" aria-label="İxrac et" onClick={()=>setOpen(true)}><Download size={17}/></button>{open&&<Modal title="Məlumat ixracı" onClose={()=>setOpen(false)}>
 <p>Modul: {module}. Axtarış: {q||"Hamısı"}. Yalnız cari girişinizə uyğun qeydlər və sahələr çıxarılır. Tarixlər UTC, məbləğlər AZN-dir. XLSX əlaqəli qeydləri ayrı vərəqlərdə saxlayır; CSV əsas cədvəli saxlayır.</p>
 {Object.entries(filters).filter(([,v])=>v).length>0&&<p>Əlavə filtrlər: {Object.entries(filters).filter(([,v])=>v).map(([k,v])=>k+": "+v).join(" · ")}</p>}
 {module==="todo"&&<p>İxracın əhatəsi: {filters.scope==="team"?"komanda":filters.scope==="shared"?"ortaq sifarişlər":"öz işləriniz"}.</p>}
 <label className="field">Format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select></label>
 <button className="primary" disabled={busy} onClick={create}>{busy?"Hazırlanır…":"İxracı hazırla"}</button>
 {error&&<p role="alert" className="notice error">{error}</p>}
 <p>İş brauzer bağlandıqda da davam edir. Fayl 24 saat ərzində, cari icazələr yenidən yoxlanılaraq endirilir.</p>
 {query.data?.map(j=><div key={j.id} className="work-row"><span>{j.module} · {j.format.toUpperCase()} · {{queued:"Növbədə",done:"Hazır",failed:"Xəta",expired:"Vaxtı bitib"}[j.status]??j.status}</span>{j.status==="done"&&<div className="toolbar"><button onClick={async()=>{const r=await fetch(`/api/export?org=${org}&job=${j.id}&preview=1`);if(!r.ok){setError("Önbaxış hazır deyil və ya icazəniz dəyişib.");setPreview([]);return;}setPreview(await r.json());}}>Önbaxış</button><a href={`/api/export?org=${org}&job=${j.id}`}>Endir</a></div>}{j.status==="failed"&&<span role="alert">{j.last_error}</span>}</div>)}
 {preview.map(t=><section key={t.table}><h3>{t.table} · {t.count} sətir</h3><p>İlk 5 sətir · məbləğlər AZN</p><div className="table-scroll"><table><thead><tr>{t.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{t.rows.map((r,i)=><tr key={i}>{t.columns.map(c=><td key={c}>{typeof r[c]==="object"?JSON.stringify(r[c]):String(r[c]??"")}</td>)}</tr>)}</tbody></table></div></section>)}
 </Modal>}</>;
}
