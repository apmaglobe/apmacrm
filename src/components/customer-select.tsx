"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { browserClient } from "@/lib/auth/browser";
import { Modal } from "@/components/dialog";
import { Field, Form } from "@/components/form";
export function CustomerSelect({
  org,
  entity = "customers",
  value,
  required = false,
  label = "Müəssisə",
  allowCreate = false,
}: {
  org: string;
  entity?: "customers"|"deals";
  value?: string;
  required?: boolean;
  label?: string;
  allowCreate?: boolean;
}) {
  const [q, setQ] = useState("");
  const [choice,setChoice]=useState<string>();
  const [chosen,setChosen]=useState<{id:string;name:string}|null>(null);
  const [adding,setAdding]=useState(false);
  const query = useQuery({
    queryKey: ["workspace", org, entity, "customer-lookup", q],
    queryFn: async () => {
      const r = await fetch(
        `/api/data?org=${org}&module=map&lookup=${entity}&q=${encodeURIComponent(q)}`,
      );
      if (!r.ok) throw new Error("Müəssisə axtarışı alınmadı");
      return r.json() as Promise<{ id: string; name: string }[]>;
    },
  });
  const selected = useQuery({
    queryKey: ["workspace", org, entity, "customer-option", value],
    enabled: !!value,
    queryFn: async () => {
      const r = await fetch(
        `/api/data?org=${org}&module=map&lookup=${entity}&id=${value}`,
      );
      return r.json() as Promise<{ id: string; name: string }[]>;
    },
  });
  const options = [
    ...new Map(
      [...(chosen?[chosen]:[]),...(selected.data ?? []), ...(query.data ?? [])].map((c) => [c.id, c]),
    ).values(),
  ];
  return (
    <>
      <label>
        {label} axtarışı
        <input
          aria-label={label + " axtarışı"}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={entity==="deals"?"Qutu adını yazın":"Müəssisə adını yazın"}
        />
      </label>
      <input type="hidden" name={entity==="deals"?"deal_id":"customer_id"} value={choice??value??""} />
      <div className="customer-picker">
        <div className="customer-picker-label">{label}</div>
        <div className="customer-options" role="listbox" aria-label={label}>
          {!options.length&&!query.isLoading&&<p className="customer-empty">{q.trim()?"Nəticə tapılmadı.":"Ad yazaraq axtarın."}</p>}
          {options.map((option)=><button
            type="button"
            role="option"
            aria-selected={(choice??value)===option.id}
            className={(choice??value)===option.id?"selected":""}
            key={option.id}
            onClick={()=>{setChoice(option.id);setChosen(option);setQ(option.name);}}
          >{option.name}</button>)}
        </div>
        {required&&!(choice??value)&&<p className="helper">Qutu yaratmaq üçün müəssisə seçin.</p>}
      </div>
      {allowCreate&&entity==="customers"&&q.trim()&&!options.some(o=>o.name.localeCompare(q,undefined,{sensitivity:"accent"})===0)&&<button type="button" onClick={()=>setAdding(true)}>“{q.trim()}” adlı yeni müəssisə əlavə et</button>}
      {query.isError && <p role="alert">Müəssisə axtarışı alınmadı.</p>}
      {adding&&<Modal title="Yeni müəssisə" onClose={()=>setAdding(false)}><Form label="Müəssisəni əlavə et" onSave={async f=>{
        const name=String(f.get("name")??"");
        const {data,error}=await browserClient().rpc("customer_create",{org,customer_name:name,customer_category:String(f.get("category")??""),customer_note:String(f.get("note")??""),request_id:crypto.randomUUID()});
        if(error) throw new Error(error.message.includes("CUSTOMER_NAME_REQUIRED")?"Müəssisənin adını yazın.":"Müəssisə əlavə edilə bilmədi.");
        const customer={id:data.id as string,name};setChosen(customer);setChoice(customer.id);setQ(name);setAdding(false);
      }}><p className="helper">Bu müəssisə agentliyin ümumi bazasına əlavə olunacaq. Sonradan Map bölməsində məlumatlarını tamamlaya bilərsiniz.</p><Field name="name" label="Müəssisə adı" value={q.trim()} required/><Field name="category" label="Kateqoriya"/><label>Qeyd<textarea name="note" /></label></Form></Modal>}
    </>
  );
}
