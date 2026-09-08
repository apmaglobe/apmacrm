"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {browserClient} from "@/lib/auth/browser";
import type {PanelProps} from "@/components/module-page";
import type {Item} from "@/lib/db/types";
import {Modal} from "@/components/dialog";
import {Form,Field,Select} from "@/components/form";
import {command} from "@/lib/db/api";
import {cents} from "@/lib/domain";
export function Settings(props:PanelProps){
 const {org,data,member,refresh}=props,router=useRouter();
 const [edit,setEdit]=useState<{kind:string;row?:Item}|null>(null);
 const organization=useQuery({queryKey:["workspace",org,"organization"],queryFn:async()=>{const r=await browserClient().from('organizations').select('id,name,version,logo_path').eq('id',org).single();if(r.error)throw new Error('Agentlik məlumatı yüklənmədi');return r.data;}});
 async function upload(f:FormData,kind:string){const file=f.get('file');if(!(file instanceof File)||!file.size)return undefined;const form=new FormData();form.set('org',org);form.set('kind',kind);form.set('file',file);const r=await fetch('/api/media',{method:'POST',body:form}),j=await r.json();if(!r.ok)throw new Error(j.error);return j.path as string;}
 const groups=[['department','Departamentlər','departments'],['catalog','Xidmət kataloqu','service_catalog'],['loss_reason','İtirilmə səbəbləri','loss_reasons'],['stage','Mərhələ görünüşü','pipeline_stages']] as const;
 return <><div className="section-toolbar"><button onClick={()=>setEdit({kind:'profile',row:member})}>Profilimi düzəlt</button>{member.is_admin&&<button disabled={!organization.data} onClick={()=>setEdit({kind:'organization'})}>Agentlik adı və logo</button>}</div>
 {member.is_admin&&groups.map(([kind,title,table])=><section className="surface" key={kind}><div className="section-toolbar"><h2>{title}</h2>{kind!=='stage'&&<button onClick={()=>setEdit({kind})}>Əlavə et</button>}</div>{data[table]?.map(row=><div className="work-row" key={row.id??row.code}><span>{row.name??row.label}{row.archived?' · Arxivdə':''}</span><button onClick={()=>setEdit({kind,row})}>Düzəliş</button></div>)}</section>)}
 {edit&&<Modal title={edit.kind==='profile'?'Profilim':edit.kind==='organization'?'Agentlik məlumatı':groups.find(g=>g[0]===edit.kind)?.[1]??'Düzəliş'} onClose={()=>setEdit(null)}><Form onSave={async f=>{
 const row=edit.row,kind=edit.kind;let payload:Record<string,unknown>={...(row?{id:row.id}:{}),name:f.get('name'),archived:f.get('archived')==='on'};
 if(kind==='profile')payload={name:f.get('name'),skills:String(f.get('skills')??'').split(',').map(s=>s.trim()).filter(Boolean),avatar_path:await upload(f,'avatar')};
 if(kind==='organization')payload={name:f.get('name'),logo_path:await upload(f,'logo')};
 if(kind==='catalog')payload={...payload,department_id:f.get('department_id'),description:f.get('description'),amount:cents(f.get('amount')),task_templates:String(f.get('tasks')??'').split('\n').map(s=>s.trim()).filter(Boolean).map(name=>({name}))};
 if(kind==='stage')payload={code:row?.code,label:f.get('label'),color:f.get('color')};
 await command(org,'identity',kind+'.save',payload,row?.version??organization.data?.version??1);setEdit(null);await refresh();router.refresh();
 }}>
 {edit.kind==='stage'?<><Field name="label" label="Mərhələ başlığı" value={edit.row?.label} required/><Field name="color" label="Rəng" type="color" value={edit.row?.color??'#6366f1'} required/></>:<Field name="name" label="Ad" value={edit.row?.name??(edit.kind==='organization'?organization.data?.name:undefined)} required/>}
 {['profile','organization'].includes(edit.kind)&&<label>Şəkil (PNG/JPEG/WebP, maksimum 1 MB)<input name="file" type="file" accept="image/png,image/jpeg,image/webp"/></label>}
 {edit.kind==='profile'&&<Field name="skills" label="Bacarıqlar (vergüllə)" value={edit.row?.skills?.join(', ')}/>}
 {edit.kind==='catalog'&&<><Select name="department_id" label="Departament" value={edit.row?.department_id} options={data.departments??[]} required/><Field name="description" label="Təsvir" value={edit.row?.description}/><Field name="amount" label="Standart qiymət (AZN)" value={edit.row&&data.catalog_prices?.find(p=>p.service_id===edit.row?.id)?.amount!=null?Number(data.catalog_prices.find(p=>p.service_id===edit.row?.id)!.amount)/100:undefined}/><label>Alt tapşırıq şablonları (hər sətirdə bir ad)<textarea name="tasks" defaultValue={edit.row?.task_templates?.map(t=>t.name).join('\n')}/></label></>}
 {edit.row&&['department','catalog','loss_reason'].includes(edit.kind)&&<label className="check"><input type="checkbox" name="archived" defaultChecked={edit.row.archived}/>Arxivləşdir</label>}
 </Form></Modal>}
 </>;
}
