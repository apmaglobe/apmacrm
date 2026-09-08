"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
export function CustomerSelect({
  org,
  entity = "customers",
  value,
  required = false,
  label = "Müəssisə",
}: {
  org: string;
  entity?: "customers"|"deals";
  value?: string;
  required?: boolean;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [choice,setChoice]=useState<string>();
  const [chosen,setChosen]=useState<{id:string;name:string}|null>(null);
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
      <label>{label}<select name={entity==="deals"?"deal_id":"customer_id"} aria-label={label} value={choice??value??""} required={required} onChange={e=>{const id=e.target.value;setChoice(id);setChosen(options.find(o=>o.id===id)??null);}}><option value="">Seçin</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      {query.isError && <p role="alert">Müəssisə axtarışı alınmadı.</p>}
    </>
  );
}
