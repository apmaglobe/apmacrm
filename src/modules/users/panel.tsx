"use client";
import {AddMember} from "./add-member";
import {Activity} from "./activity";
import Image from "next/image";
import { Settings } from "./settings";
import { Webhooks } from "./webhooks";
import { browserClient } from "@/lib/auth/browser";
import { useState } from "react";
import { Plus, Shield } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item } from "@/lib/db/types";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
import { command } from "@/lib/db/api";
import { dateTime, modules, cents } from "@/lib/domain";
const permissions = [
  "commercials.read",
  "commercials.write",
  "finance.read",
  ...modules.map((m) => m[0] + ".export"),
];
export function Users({ org, data, member, refresh }: PanelProps) {
  const [profile,setProfile]=useState<Item|null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [selected, setSelected] = useState<Item | null>(null),
    [add, setAdd] = useState(""),
    [role, setRole] = useState<Item | null>(null);
  return (
    <>
      <div className="section-toolbar">
        <p className="muted">Komanda, departament və səlahiyyətlər</p>
        {member.is_admin && (
          <div className="toolbar">
            <button className="primary" onClick={() => setAdd("member")}><Plus size={18}/>Əməkdaş əlavə et</button>
            <button onClick={() => setAdd("invite")}>Dəvət keçidi</button>
            <button className="primary" onClick={() => setAdd("role")}>
              <Plus size={17} />
              Rol yarat
            </button>
          </div>
        )}
      </div>
      {add === "member" && <AddMember org={org} roles={data.roles??[]} departments={data.departments??[]} onClose={()=>setAdd("")} onCreated={refresh}/>}
      {add === "invite" && (
        <Modal
          title="Emailə bağlı dəvət"
          onClose={() => {
            setAdd("");
            setInviteLink("");
          }}
        >
          <Form
            label="Keçid yarat"
            onSave={async (f) => {
              const { data, error } = await browserClient().rpc(
                "invite_create",
                { org, email_address: String(f.get("email")) },
              );
              if (error) throw new Error("Dəvət yaradıla bilmədi");
              setInviteLink(location.origin + "/invite/" + data);
            }}
          >
            <Field
              name="email"
              label="Dəvət edilənin emaili"
              type="email"
              required
            />
          </Form>
          {inviteLink && (
            <p className="notice">
              7 gün ərzində yalnız bu email ilə qəbul olunur; sonra admin
              təsdiqi lazımdır. <a href={inviteLink}>{inviteLink}</a>
            </p>
          )}
        </Modal>
      )}
      <Settings org={org} data={data} member={member} refresh={refresh} q="" />
      <Webhooks org={org} data={data} member={member} refresh={refresh} q="" />
      <div className="user-grid">
        {data.memberships?.map((m) => (
          <article className="surface user-card" key={m.id}>
            <div className="large-avatar">{m.avatar_path?<Image unoptimized src={`/api/media?org=${org}&member=${m.id}&v=${m.version}`} width={64} height={64} alt={m.name}/>:m.name?.slice(0, 1)}</div>
            <h2>{m.name}</h2>
            <button onClick={()=>setProfile(m)}>İş fəaliyyəti</button>
            <p>
              {m.is_admin
                ? "Sistem admini"
                : (data.roles?.find((r) => r.id === m.role_id)?.name ??
                  "Əməkdaş")}
            </p>
            <span className={"badge " + (m.status === "active" ? "green" : "")}>
              {m.status === "active"
                ? "Aktiv"
                : m.status === "pending"
                  ? "Təsdiq gözləyir"
                  : "Dayandırılıb"}
            </span>
            <small>Qoşulub: {dateTime(m.joined_at)}</small>
            <p>{m.skills?.join(" · ")}</p>
            {member.is_admin && (
              <button onClick={() => setSelected(m)}>
                <Shield size={15} />
                İdarə et
              </button>
            )}
          </article>
        ))}
      </div>
      {profile&&<Activity org={org} member={profile} onClose={()=>setProfile(null)}/>}
      {member.is_admin && (
        <>
          <section className="surface">
            <h2>Rollar</h2>
            {data.roles?.map((r) => (
              <div className="work-row" key={r.id}>
                <div>
                  <h3>{r.name}</h3>
                  <small>{r.permissions?.join(", ")}</small>
                </div>
                <button onClick={() => setRole(r)}>Düzəliş</button>
              </div>
            ))}
          </section>
          <section className="surface">
            <h2>Fon işləri və yenidən təyinat</h2>
            {data.job_runs?.map((j) => (
              <p key={j.id}>
                {j.type} · {j.status} · {j.attempts} cəhd · {j.last_error}
                {j.status==="failed"&&<> · Növbəti cəhd: {dateTime(j.run_after)}</>}
              </p>
            ))}
            <p className="helper">
              Dayandırılmış üzvün işləri və tarixçəsi silinmir. Mövcud qutu və
              müqavilələrdə cavabdehi yeniləyin.
            </p>
          </section>
        </>
      )}
      {selected && (
        <Modal
          title={selected.name + " — idarəetmə"}
          wide
          onClose={() => setSelected(null)}
        >
          <Form
            onSave={async (f) => {
              const overrides = Object.fromEntries(
                permissions.map((p) => [p, f.get(p)]),
              );
              await command(
                org,
                "identity",
                "member.update",
                {
                  id: selected.id,
                  name: f.get("name"),
                  status: f.get("status"),
                  is_admin: f.get("is_admin") === "on",
                  role_id: f.get("role_id") || null,
                  departments: f.getAll("departments"),
                  skills: String(f.get("skills"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  overrides,
                },
                selected.version,
              );
              await refresh();
              setSelected(null);
            }}
          >
            <Field name="name" label="Ad" value={selected.name} required />
            <Select
              name="status"
              label="Üzvlük"
              value={selected.status}
              options={[
                { id: "active", name: "Aktiv" },
                { id: "pending", name: "Təsdiq gözləyir" },
                { id: "suspended", name: "Dayandırılmış" },
              ]}
            />
            <Select
              name="role_id"
              label="Rol"
              value={selected.role_id}
              options={data.roles ?? []}
            />
            <label className="check">
              <input
                type="checkbox"
                name="is_admin"
                defaultChecked={selected.is_admin}
              />
              Sistem admini (TOTP məcburidir)
            </label>
            <fieldset>
              <legend>Departamentlər</legend>
              {data.departments?.map((d) => (
                <label key={d.id} className="check">
                  <input
                    name="departments"
                    value={d.id}
                    type="checkbox"
                    defaultChecked={data.department_members?.some(
                      (dm) =>
                        dm.department_id === d.id &&
                        dm.member_id === selected.id,
                    )}
                  />
                  {d.name}
                </label>
              ))}
            </fieldset>
            <Field
              name="skills"
              label="Bacarıqlar (vergüllə)"
              value={selected.skills?.join(", ")}
            />
            <h3>Fərdi icazələr</h3>
            <div className="mapping-grid">
              {permissions.map((p) => (
                <Select
                  key={p}
                  name={p}
                  label={p}
                  value={selected.overrides?.[p] ?? "inherit"}
                  options={[
                    { id: "inherit", name: "Roldan götür" },
                    { id: "allow", name: "İcazə ver" },
                    { id: "deny", name: "Bağla" },
                  ]}
                />
              ))}
            </div>
          </Form>
        </Modal>
      )}
      {((add && !["invite","member"].includes(add)) || role) && (
        <Modal
          title={
            add === "department"
              ? "Departament"
              : add === "catalog"
                ? "Xidmət kataloqu"
                : "Rol"
          }
          onClose={() => {
            setAdd("");
            setRole(null);
          }}
        >
          <Form
            onSave={async (f) => {
              if (add === "department")
                await command(org, "identity", "department.save", {
                  name: f.get("name"),
                });
              else if (add === "catalog")
                await command(org, "identity", "catalog.save", {
                  name: f.get("name"),
                  department_id: f.get("department_id"),
                  amount: cents(f.get("amount")),
                  description: f.get("description"),
                });
              else
                await command(
                  org,
                  "identity",
                  "role.save",
                  {
                    ...(role ? { id: role.id } : {}),
                    name: f.get("name"),
                    permissions: f.getAll("permissions"),
                  },
                  role?.version ?? 1,
                );
              await refresh();
              setAdd("");
              setRole(null);
            }}
          >
            <Field name="name" label="Ad" value={role?.name} required />
            {add === "catalog" ? (
              <>
                <Select
                  name="department_id"
                  label="Departament"
                  options={data.departments ?? []}
                  required
                />
                <Field name="amount" label="Standart qiymət (AZN)" />
                <Field name="description" label="Təsvir" />
              </>
            ) : (
              add !== "department" && (
                <fieldset>
                  <legend>Rol icazələri</legend>
                  {permissions.map((p) => (
                    <label className="check" key={p}>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p}
                        defaultChecked={
                          role
                            ? role.permissions?.includes(p)
                            : [
                                "commercials.read",
                                "commercials.write",
                              ].includes(p)
                        }
                      />
                      {p}
                    </label>
                  ))}
                </fieldset>
              )
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
