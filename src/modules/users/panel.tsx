"use client";
import {AddMember} from "./add-member";
import {Activity} from "./activity";
import Image from "next/image";
import { Settings } from "./settings";
import { Webhooks } from "./webhooks";
import { browserClient } from "@/lib/auth/browser";
import { useState } from "react";
import { Check, Copy, Plus, Shield } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item } from "@/lib/db/types";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
import { command } from "@/lib/db/api";
import { dateTime, modules, cents } from "@/lib/domain";
const permissionGroups: { title: string; items: readonly (readonly [string, string])[] }[] = [
  { title: "CRM və kommersiya", items: [["crm.read", "CRM qutularını gör"], ["crm.write", "CRM qutularını yarat və düzəlt"], ["commercials.read", "Qiymətləri gör"], ["commercials.write", "Qiymətləri dəyiş"]] },
  { title: "Müştəri və xəritə", items: [["map.read", "Müəssisə bazası və xəritə"], ["map.write", "Müəssisə və pinləri düzəlt"], ["map.import", "Excel import et"]] },
  { title: "İşin idarəsi", items: [["todo.read", "Sifariş To Do siyahısı"], ["tasks.read", "Daxili taskları gör"], ["tasks.write", "Daxili task yarat, təyin et və sil"], ["marketing.read", "Marketing planları gör"], ["marketing.write", "Marketing plan yarat və idarə et"], ["tools.read", "Alətləri gör"], ["tools.write", "Alət və rezervasiyanı idarə et"], ["meetings.read", "Görüşləri gör"], ["meetings.write", "Görüş yarat və düzəlt"]] },
  { title: "Maliyyə və abunəlik", items: [["finance.read", "Balansı və ödənişləri gör"], ["finance.write", "Ödəniş və maliyyə sənədi yarat"], ["subscriptions.read", "Aylıq abunəlikləri gör"], ["subscriptions.write", "Aylıq abunəlikləri idarə et"], ["portfolio.read", "Portfeli gör"]] },
  { title: "Kommunikasiya və materiallar", items: [["inbox.read", "Inbox mesajlarını gör"], ["inbox.write", "Mesaj göndər"], ["drive.read", "Drive materiallarını gör"], ["drive.write", "Material linki əlavə et"]] },
  { title: "İdarəetmə", items: [["users.read", "Əməkdaşları gör"], ["users.write", "Əməkdaşları və rolları idarə et"], ["settings.write", "Agentlik parametrlərini dəyiş"], ["webhooks.write", "Webhook-ları idarə et"]] },
  { title: "İxrac", items: modules.map(([id, label]) => [id + ".export", label + " ixracı"]) },
] as const;
const permissions = permissionGroups.flatMap((group) => group.items.map(([code]) => code));
const adminOnlyPermissions = new Set(["users.write", "settings.write", "webhooks.write"]);
const fullAccessPermissions = permissions.filter((permission) => !adminOnlyPermissions.has(permission));
const permissionLabel = (code: string) => permissionGroups.flatMap((group) => group.items).find(([item]) => item === code)?.[1] ?? code;

function AccessPreset({ selected }: { selected: Item }) {
  const initial = fullAccessPermissions.every((permission) => selected.overrides?.[permission] === "allow") && [...adminOnlyPermissions].every((permission) => selected.overrides?.[permission] === "deny") ? "full" : "simple";
  const [preset, setPreset] = useState(initial);
  return <section className="access-preset" aria-label="Giriş paketi">
    <div><h3>Giriş paketi</h3><p>{preset === "full" ? "Bütün gündəlik iş modulları açıqdır. Sistem admini və idarəetmə hüquqları verilmir." : "Rolun və aşağıdakı detallı seçimlərin qaydaları istifadə olunur."}</p></div>
    <label>Giriş səviyyəsi<select name="access_preset" value={preset} onChange={(event) => setPreset(event.target.value)}><option value="full">Full Access</option><option value="simple">Sadə</option></select></label>
  </section>;
}
export function Users({ org, data, member, refresh, inAdmin = false }: PanelProps & {inAdmin?: boolean}) {
  const [profile,setProfile]=useState<Item|null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null),
    [add, setAdd] = useState(""),
    [role, setRole] = useState<Item | null>(null);
  return (
    <>
      <div className="section-toolbar">
        <p className="muted">Komanda, departament və səlahiyyətlər</p>
        {member.is_admin && !inAdmin && <a className="button" href={`/workspace/admin?org=${org}`}>Admin panel · Müraciətlər və linklər</a>}
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
            setInviteCopied(false);
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
              setInviteCopied(false);
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
            <div className="notice invite-link-result" role="status">
              <span>
                7 gün ərzində yalnız bu email ilə qəbul olunur; sonra admin
                təsdiqi lazımdır. <a href={inviteLink}>{inviteLink}</a>
              </span>
              <button
                type="button"
                className="invite-copy-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    setInviteCopied(true);
                  } catch {
                    const input = document.createElement("textarea");
                    input.value = inviteLink;
                    input.setAttribute("readonly", "");
                    input.style.position = "fixed";
                    input.style.opacity = "0";
                    document.body.append(input);
                    input.select();
                    const copied = document.execCommand("copy");
                    input.remove();
                    if (copied) setInviteCopied(true);
                  }
                }}
              >
                {inviteCopied ? <Check size={16} /> : <Copy size={16} />}
                {inviteCopied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
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
            {member.is_admin && Object.entries(m.overrides ?? {}).filter(([, value]) => value !== "inherit").length > 0 && <small>Fərdi hüquqlar: {Object.entries(m.overrides ?? {}).filter(([, value]) => value !== "inherit").map(([code, value]) => `${permissionLabel(code)} · ${value === "allow" ? "aktiv" : "bağlı"}`).join(", ")}</small>}
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
              const fullAccess = f.get("access_preset") === "full";
              const overrides = Object.fromEntries(
                permissions.map((p) => [p, fullAccess ? (adminOnlyPermissions.has(p) ? "deny" : "allow") : f.get(p)]),
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
            <AccessPreset selected={selected} />
            <h3>Hesab üzrə səlahiyyətlər</h3>
            <p className="helper">Sadə seçimində hər hüquq rolun qaydasını bu konkret hesab üçün əvəz edir.</p>
            <div className="permission-groups">
              {permissionGroups.map((group) => <fieldset key={group.title} className="permission-group"><legend>{group.title}</legend>{group.items.map(([code, label]) => <Select key={code} name={code} label={label} value={selected.overrides?.[code] ?? "inherit"} options={[{ id: "inherit", name: "Roldan götür" }, { id: "allow", name: "Aktiv" }, { id: "deny", name: "Söndür" }]}/>)}</fieldset>)}
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
                <div className="permission-groups">
                  {permissionGroups.map((group) => <fieldset key={group.title} className="permission-group"><legend>{group.title}</legend>{group.items.map(([code, label]) => <label className="check" key={code}><input type="checkbox" name="permissions" value={code} defaultChecked={role ? role.permissions?.includes(code) : ["commercials.read", "commercials.write"].includes(code)}/>{label}</label>)}</fieldset>)}
                </div>
              )
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
