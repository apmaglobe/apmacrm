"use client";
import { CustomerSelect } from "@/components/customer-select";
import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item } from "@/lib/db/types";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
import { command } from "@/lib/db/api";
import { cents } from "@/lib/domain";
export function Subscriptions({ org, data, member, refresh }: PanelProps) {
  const [add, setAdd] = useState(false),
    [selected, setSelected] = useState<{ id: string; op: string } | null>(null),
    [count, setCount] = useState(1),
    [error, setError] = useState(""),
    [repair,setRepair]=useState<Item|null>(null),
    [editing, setEditing] = useState<Item | null>(null);
  const revision = editing
    ? data.contract_revisions
        ?.filter((r) => r.contract_id === editing.id)
        .sort((a, b) => b.version - a.version)[0]
    : null;
  const template = revision?.settings.works ?? [];
  const selectedContract = selected
    ? data.service_contracts?.find((contract) => contract.id === selected.id)
    : null;
  if (!member.is_admin)
    return (
      <div className="empty">
        <Repeat size={34} />
        <h2>Aylıq müqavilələr</h2>
        <p>
          Müqavilələri admin idarə edir. Sizə təyin edilən aylıq işlər Dövri və
          To Do bölməsində görünür.
        </p>
      </div>
    );
  return (
    <>
      <div className="section-toolbar">
        <p className="muted">Versiyalı iş planı və aylıq dövrlər</p>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setCount(1);
            setAdd(true);
          }}
        >
          <Plus size={17} />
          Müqavilə yarat
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="card-grid">
        {data.service_contracts?.map((c) => (
          <article className="surface" key={c.id}>
            <span className="badge">{c.status}</span>
            <h2>{c.title}</h2>
            <p>{data.customers?.find((x) => x.id === c.customer_id)?.name}</p>
            <p>
              Ödəniş günü: {c.billing_day} · Növbəti dövr: {c.next_period_start}
            </p>
            <div className="toolbar">
              <button
                onClick={() => {
                  setEditing(c);
                  setCount(
                    data.contract_revisions
                      ?.filter((r) => r.contract_id === c.id)
                      .sort((a, b) => b.version - a.version)[0]?.settings.works
                      .length ?? 1,
                  );
                  setAdd(true);
                }}
              >
                İş planını düzəlt
              </button>
              {c.status === "active" ? (
                <>
                  <button
                    onClick={() => setSelected({ id: c.id, op: "contract.pause" })}
                  >
                    Fasilə ver
                  </button>
                  <button
                    onClick={() => setSelected({ id: c.id, op: "contract.stop" })}
                  >
                    Dayandır
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await command(
                          org,
                          "subscription",
                          "contract.generate",
                          { id: c.id },
                          c.version,
                        );
                        await refresh();
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    Dövrü yoxla
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelected({ id: c.id, op: "contract.resume" })}
                >
                  Yenidən başlat
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="surface">
        <h2>Dövr tarixçəsi</h2>
        {data.contract_periods?.map((p) => (
          <div className="work-row" key={p.id} data-period-id={p.id}>
            <div>
              <strong>
                {p.period_start} — {p.period_end}
              </strong>
              <p>
                {p.status === "ready"
                  ? "Qutu və işlər yaradılıb"
                  : p.status === "failed"
                    ? "Yaradılma xətası"
                    : "Növbədə"}
              </p>
              <small>{p.last_error}</small>
              {p.status==='failed'&&<button onClick={()=>{const c=data.service_contracts?.find(c=>c.id===p.contract_id);if(!c)return;setRepair(p);setEditing(c);const r=data.contract_revisions?.filter(r=>r.contract_id===c.id).sort((a,b)=>b.version-a.version)[0];setCount(r?.settings.works.length??1);setAdd(true);}}>İş planını düzəldib bərpa et</button>}
              {p.deal_id&&<a href={`/workspace/crm?org=${org}&deal=${p.deal_id}`}>Dövr qutusunu aç</a>}
            </div>
          </div>
        ))}
      </section>
      {add && (
        <Modal title="Aylıq müqavilə" wide onClose={() => {setAdd(false);setRepair(null);}}>
          <Form
            onSave={async (f) => {
              const works = Array.from({ length: count }, (_, i) => ({
                name: f.get(`name${i}`),
                department_id: f.get(`dept${i}`),
                assignee_id: f.get(`assignee${i}`),
                amount: cents(f.get(`amount${i}`)),
                due_offset_days: f.get(`offset${i}`)
                  ? Number(f.get(`offset${i}`))
                  : null,
                due_time: f.get(`time${i}`)||"18:00",
              }));
              await command(
                org,
                "subscription",
                repair?"period.repair":"contract.save",
                {
                  ...(repair?{id:repair.id}:editing ? { id: editing.id } : {}),
                  reason: f.get("reason"),
                  title: f.get("title"),
                  customer_id: f.get("customer_id"),
                  accountable_id: f.get("accountable_id"),
                  category: f.get("category"),
                  billing_day: Number(f.get("billing_day")),
                  first_payment_date: f.get("first_payment_date"),
                  end_date: f.get("end_date") || null,
                  zero_reason: f.get("zero_reason"),
                  works,
                },
                repair?.attempts??editing?.version ?? 1,
              );
              await refresh();
              setAdd(false);setRepair(null);
            }}
          >
            <Field
              name="title"
              label="Müqavilə adı"
              value={editing?.title}
              required
            />
            {editing?<><p>Müəssisə bu müqavilədə dəyişmir.</p><input type="hidden" name="customer_id" value={editing.customer_id}/></>:<CustomerSelect
              org={org}
              label="Müəssisə"
              required
            />}
            <Select
              name="accountable_id"
              value={revision?.settings.accountable_id}
              label="Ümumi cavabdeh"
              options={
                data.memberships?.filter((m) => m.status === "active") ?? []
              }
              required
            />
            <Select
              name="category"
              label="Kateqoriya"
              value={editing?.category ?? "monthly_service"}
              options={[
                { id: "product", name: "Development → Məhsul" },
                { id: "service", name: "Development → Xidmət" },
                { id: "monthly_service", name: "Marketing → Aylıq xidmət" },
                { id: "single_shoot", name: "Marketing → Tək çəkiliş" },
              ]}
            />
            <p className="helper">
              Bu forma aylıq müqavilə yaradır. Birdəfəlik işi Yeni müştəri
              qutusuna əlavə edin.
            </p>
            <div className="form-grid">
              <Field
                readOnly={!!editing}
                value={editing?.first_payment_date}
                name="first_payment_date"
                label="İlk planlaşdırılmış ödəniş tarixi"
                type="date"
                required
              />
              <Field
                readOnly={!!editing}
                value={editing?.billing_day}
                name="billing_day"
                label="Ödəniş günü (1–31)"
                type="number"
                required
              />
              <Field
                value={editing?.end_date}
                name="end_date"
                label="Son tarix (istəyə bağlı)"
                type="date"
              />
            </div>
            {editing && (
              <>
                <p className="notice">
                  {repair?"Bu bərpa yalnız yaranmamış xətalı dövrə və gələcək iş planına tətbiq edilir. Hazır dövrlər dəyişmir.":"Yaranmış dövrlərin surəti saxlanır. Yeni iş planı növbəti dövrə tətbiq edilir; başlanğıc və billing günü mövcud müqavilədə dəyişmir."}
                </p>
                <Field name="reason" label="Dəyişiklik səbəbi" required />
              </>
            )}
            <h3>Aylıq iş şablonu</h3>
            {Array.from({ length: count }, (_, i) => (
              <fieldset key={i}>
                <legend>İş {i + 1}</legend>
                <Field
                  name={`name${i}`}
                  label="İş adı"
                  value={String(template[i]?.name ?? "")}
                  required
                />
                <div className="form-grid">
                  <Select
                    value={String(template[i]?.department_id ?? "")}
                    name={`dept${i}`}
                    label="Departament"
                    options={data.departments ?? []}
                    required
                  />
                  <Select
                    value={String(template[i]?.assignee_id ?? "")}
                    name={`assignee${i}`}
                    label="Cavabdeh"
                    options={
                      data.memberships?.filter((m) => m.status === "active") ??
                      []
                    }
                    required
                  />
                  <Field
                    name={`amount${i}`}
                    label="Qiymət (AZN)"
                    value={
                      template[i]?.amount != null
                        ? Number(template[i].amount) / 100
                        : undefined
                    }
                    required
                  />
                  <Field name={`time${i}`} label="İşin son saatı" type="time" value={String(template[i]?.due_time??"18:00")}/>
                  <Field
                    value={
                      template[i]?.due_offset_days != null
                        ? Number(template[i].due_offset_days)
                        : undefined
                    }
                    name={`offset${i}`}
                    label="Dövr başlanğıcından gün sayı (boş: dövrün sonu)"
                    type="number"
                  />
                </div>
              </fieldset>
            ))}
            <button type="button" onClick={() => setCount((c) => c + 1)}>
              İş əlavə et
            </button>
            {count>1&&<button type="button" onClick={()=>setCount(c=>c-1)}>Son işi plandan çıxar</button>}
            <Field
              name="zero_reason"
              label="Sıfır qiymətin səbəbi (tətbiq edilirsə)"
            />
            <p className="notice">
              Başlamış dövrün haqqı dayandırılma ilə avtomatik dəyişmir. Sonrakı
              dövrlər dayandırılır.
            </p>
          </Form>
        </Modal>
      )}
      {selected && selectedContract && (
        <Modal title="Müqavilənin vəziyyəti" onClose={() => setSelected(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "subscription",
                selected.op,
                {
                  id: selectedContract.id,
                  reason: f.get("reason"),
                  service_last_day: f.get("service_last_day") || null,
                },
                selectedContract.version,
              );
              await refresh();
              setSelected(null);
            }}
          >
            <Field name="reason" label="Səbəb" required />
            {selected.op !== "contract.resume" && (
              <Field
                name="service_last_day"
                label="Son faktiki xidmət günü (boş: bu gün)"
                type="date"
              />
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
