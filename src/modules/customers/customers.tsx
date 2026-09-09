"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { browserClient } from "@/lib/auth/browser";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Upload, MapPin, Building2, FileSpreadsheet } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import { command } from "@/lib/db/api";
import { Modal } from "@/components/dialog";
import { Form, Field } from "@/components/form";
import type { Item } from "@/lib/db/types";
const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="empty">Xəritə yüklənir…</div>,
});
const fields = [
  "external_id",
  "customer_name",
  "branch_name",
  "location_external_id",
  "contact_name",
  "phone",
  "email",
  "address",
  "latitude",
  "longitude",
  "category",
  "note",
];
const labels = [
  "Mənbə ID",
  "Müəssisə adı",
  "Filial adı",
  "Filial ID",
  "Əlaqə şəxsi",
  "Telefon",
  "Email",
  "Ünvan",
  "Enlik (latitude)",
  "Uzunluq (longitude)",
  "Kateqoriya",
  "Qeyd",
];
export function Customers({
  org,
  data: baseData,
  member,
  refresh,
  q,
}: PanelProps) {
  const list = useInfiniteQuery({
    queryKey: ["workspace", org, "customer-list", q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await fetch(
        `/api/data?org=${org}&module=map&q=${encodeURIComponent(q)}&offset=${pageParam}`,
      );
      if (!r.ok) throw new Error("Müəssisələr yüklənmədi");
      return r.json() as Promise<{ data: typeof baseData }>;
    },
    getNextPageParam: (last, pages) =>
      pages.length * 100 < (last.data.customer_page?.[0]?.count ?? 0)
        ? pages.length * 100
        : undefined,
  });
  const data = {
    ...baseData,
    ...Object.fromEntries(
      ["customers", "customer_locations", "contacts"].map((k) => [
        k,
        list.data?.pages.flatMap((p) => p.data[k]) ?? baseData[k] ?? [],
      ]),
    ),
  };
  const [showMap, setShowMap] = useState(false);

  const mapData = useQuery({
    queryKey: ["workspace", org, "customer-map-points"],
    enabled: showMap,
    queryFn: async () => {
      const response = await fetch(`/api/data?org=${org}&module=map&all_locations=1`);
      if (!response.ok) throw new Error("Xəritə nöqtələri yüklənmədi");
      return response.json() as Promise<{ customers: Item[]; locations: Item[] }>;
    },
  });

  const [importOpen, setImportOpen] = useState(false),
    [pin, setPin] = useState<Item | null>(null),
    [edit, setEdit] = useState<Item | null>(null),
    [rollback, setRollback] = useState<Item | null>(null);
  return (
    <>
      <div className="section-toolbar">
        <div className="muted">
          {data.customers?.length ?? 0} müəssisə göstərilir · adla axtarış
        </div>
        <div className="toolbar">
          <button onClick={() => setShowMap(!showMap)}>
            <MapPin size={17} />
            {showMap ? "Siyahı" : "Xəritə"}
          </button>
          {member.is_admin && (
            <button className="primary" onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              Excel importu
            </button>
          )}
        </div>
      </div>
      {showMap && (
        <MapView
          locations={mapData.data?.locations ?? []}
          customers={mapData.data?.customers ?? []}
        />
      )}
      <div className="customer-grid">
        {data.customers?.map((c) => {
          const locations =
            data.customer_locations?.filter((l) => l.customer_id === c.id) ??
            [];
          const contacts =
            data.contacts?.filter((x) => x.customer_id === c.id) ?? [];
          return (
            <article className="customer-card" key={c.id}>
              <div className="customer-icon">
                <Building2 size={22} />
              </div>
              <h3>{c.name}</h3>
              <p>{c.category || "Kateqoriya seçilməyib"}</p>
              {contacts.map((x) => (
                <div key={x.id} className="contact">
                  <span>{x.name}</span>
                  {x.phone && <a href={"tel:" + x.phone}>{x.phone}</a>}
                  {x.email && <a href={"mailto:" + x.email}>{x.email}</a>}
                </div>
              ))}
              {locations.map((l) => (
                <div className="location" key={l.id}>
                  <MapPin size={15} />
                  <div>
                    <strong>{l.name || "Əsas məkan"}</strong>
                    <p>{l.address || "Ünvan yoxdur"}</p>
                    <small>
                      {l.latitude != null
                        ? `${l.latitude}, ${l.longitude}`
                        : "Koordinat əlavə edilməyib"}
                    </small>
                  </div>
                  {member.is_admin && (
                    <button onClick={() => setPin(l)}>Pin</button>
                  )}
                </div>
              ))}
              {member.is_admin && (
                <button onClick={() => setEdit(c)}>Məlumatı düzəlt</button>
              )}
            </article>
          );
        })}
      </div>
      {list.hasNextPage && (
        <button
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          Daha çox müəssisə göstər
        </button>
      )}
      {list.isError && <p role="alert">Müəssisələr yüklənmədi.</p>}
      {!data.customers?.length && (
        <div className="empty">
          <FileSpreadsheet size={36} />
          <h2>Müəssisə bazası boşdur</h2>
          <p>Excel və ya CSV faylını import edərək başlayın.</p>
        </div>
      )}
      {member.is_admin && !!data.import_jobs?.length && (
        <section className="surface">
          <h2>Import tarixçəsi</h2>
          {data.import_jobs.map((j) => (
            <div className="work-row" key={j.id}>
              <span>
                {j.status} · {j.cursor} sətir
              </span>
              {j.status !== "rolled_back" && (
                <button onClick={() => setRollback(j)}>
                  Importu geri qaytar
                </button>
              )}
              {!["done", "rolled_back"].includes(j.status) && (
                <button
                  onClick={async () => {
                    await command(
                      org,
                      "import",
                      "import.apply",
                      { id: j.id },
                      j.version,
                    );
                    await refresh();
                  }}
                >
                  Davam et
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {rollback && (
        <Modal title="Importu geri qaytar" onClose={() => setRollback(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "import",
                "import.rollback",
                { id: rollback.id, reason: f.get("reason") },
                rollback.version,
              );
              await refresh();
              setRollback(null);
            }}
          >
            <p>
              Sonradan düzəldilmiş və ya sifarişdə istifadə edilmiş məlumat
              varsa əməliyyat bütövlükdə rədd ediləcək. Müştəri, filial və
              kontaktların əvvəlki vəziyyəti bərpa olunur.
            </p>
            <Field name="reason" label="Geri qaytarma səbəbi" required />
          </Form>
        </Modal>
      )}
      {importOpen && (
        <ImportWizard
          org={org}
          onClose={() => setImportOpen(false)}
          refresh={refresh}
        />
      )}
      {pin && (
        <Modal title="Koordinatı düzəlt" onClose={() => setPin(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "import",
                "location.pin",
                {
                  id: pin.id,
                  latitude: Number(String(f.get("latitude")).replace(",", ".")),
                  longitude: Number(
                    String(f.get("longitude")).replace(",", "."),
                  ),
                },
                pin.version,
              );
              await refresh();
              setPin(null);
            }}
          >
            <Field
              name="latitude"
              label="Enlik"
              value={pin.latitude ?? undefined}
              required
            />
            <Field
              name="longitude"
              label="Uzunluq"
              value={pin.longitude ?? undefined}
              required
            />
            <p className="helper">
              Əl ilə düzəldilən pin sonrakı importda qorunur.
            </p>
          </Form>
        </Modal>
      )}
      {edit && (
        <Modal title="Müəssisə məlumatı" onClose={() => setEdit(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "import",
                "customer.update",
                {
                  id: edit.id,
                  name: f.get("name"),
                  category: f.get("category"),
                  note: f.get("note"),
                },
                edit.version,
              );
              await refresh();
              setEdit(null);
            }}
          >
            <Field name="name" label="Ad" value={edit.name} required />
            <Field name="category" label="Kateqoriya" value={edit.category} />
            <label>
              Qeyd
              <textarea name="note" defaultValue={edit.note} />
            </label>
          </Form>
        </Modal>
      )}
    </>
  );
}
function ImportWizard({
  org,
  onClose,
  refresh,
}: {
  org: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>(
      [],
    ),
    [sheet, setSheet] = useState(0),
    [header, setHeader] = useState(0),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [hash, setHash] = useState(""),
    [storagePath, setStoragePath] = useState(""),
    [candidates, setCandidates] = useState<
      {
        index: number;
        matches: { id: string; name: string; external_id: string }[];
      }[]
    >([]),
    [matches, setMatches] = useState<Record<number, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [preview, setPreview] = useState(false);
  const rows = sheets[sheet]?.rows ?? [];
  const headers = rows[header] ?? [];
  const mapped = rows
    .slice(header + 1)
    .filter((r) => r.some(Boolean))
    .map((r, index) => {
      const value = Object.fromEntries(
        fields.map((f) => [
          f,
          mapping[f] !== undefined ? (r[Number(mapping[f])] ?? "") : "",
        ]),
      );
      const errors = [];
      if (!value.customer_name.trim()) errors.push("Ad boşdur");
      if (Boolean(value.latitude) !== Boolean(value.longitude))
        errors.push("Hər iki koordinat lazımdır");
      const lat = value.latitude
          ? Number(value.latitude.replace(",", "."))
          : null,
        lng = value.longitude
          ? Number(value.longitude.replace(",", "."))
          : null;
      if (
        (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
        (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
      )
        errors.push("Koordinat yanlışdır");
      return {
        index: index + header + 2,
        value: {
          ...value,
          customer_name: value.customer_name,
          phone: value.phone,
          branch_name: value.branch_name,
          latitude: lat,
          longitude: lng,
        },
        errors,
      };
    });
  async function read(file: File) {
    setBusy(true);
    setError("");
    try {
      const bytes = await file.arrayBuffer();
      const hashBytes = await crypto.subtle.digest("SHA-256", bytes);
      const fileHash = Array.from(new Uint8Array(hashBytes))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const db = browserClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("Giriş edin");
      const storagePath = `${org}/imports/${user.id}/${fileHash}.${file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx"}`;
      const upload = await db.storage
        .from("crm-private")
        .upload(storagePath, file, { upsert: true });
      if (upload.error)
        throw new Error(
          "Import faylı saxlanmadı. Girişi və 10 MB limitini yoxlayın.",
        );
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, path: storagePath }),
      });
      const parsed = await r.json();
      if (!r.ok) throw new Error(parsed.error);
      setSheets(parsed.sheets);
      setSheet(0);
      setHeader(0);
      setPreview(false);
      setHash(fileHash);
      setStoragePath(storagePath);
      setMatches({});
      setCandidates([]);
      const h = parsed.sheets[0]?.rows[0] as string[];
      setMapping(
        Object.fromEntries(
          fields.flatMap((f) => {
            const i = h.findIndex((x) => x.trim().toLowerCase() === f);
            return i < 0 ? [] : [[f, String(i)]];
          }),
        ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setError("");
    try {
      let job = await command(org, "import", "import.preview", {
        file_hash: hash,
        mapping: { sheet, header, ...mapping },
        storage_path: storagePath,
        rows: mapped.map((r, i) => ({
          ...r.value,
          match_customer_id: matches[i] || null,
        })),
      });
      let conflicts=0;
      while (job.status !== "done") {
        try {
          job = await command(org,"import","import.apply",{id:job.id},job.version);
          conflicts=0;
        } catch(error) {
          // Cron may have advanced the same durable job while this client was applying its previous version.
          const current=await browserClient().from("import_jobs").select("id,version,status,cursor").eq("organization_id",org).eq("id",job.id).single();
          if(current.error||!current.data||current.data.version===job.version||++conflicts>10)throw error;
          job={...job,...current.data};
          if(job.status==="failed"||job.status==="rolled_back")throw error;
        }
        setProgress(`${job.cursor} / ${mapped.length} sətir tətbiq edildi`);
      }
      await refresh();
      setProgress(`${job.cursor} sətir tətbiq edildi. Import tamamlandı.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Excel importu" wide onClose={onClose}>
      <div className="stack">
        <label className="upload-zone">
          <Upload size={28} />
          <strong>XLSX və ya UTF-8 CSV seçin</strong>
          <span>10 MB · 10 000 sətir · 100 sütun</span>
          <input
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) read(file);
            }}
          />
        </label>
        {sheets.length > 0 && (
          <>
            <div className="form-grid">
              <label>
                Vərəq
                <select
                  value={sheet}
                  onChange={(e) => {
                    setSheet(Number(e.target.value));
                    setPreview(false);
                  }}
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Başlıq sətri
                <input
                  type="number"
                  min={1}
                  max={rows.length}
                  value={header + 1}
                  onChange={(e) => {
                    setHeader(Number(e.target.value) - 1);
                    setPreview(false);
                  }}
                />
              </label>
            </div>
            <div className="mapping-grid">
              {fields.map((f, i) => (
                <label key={f}>
                  {labels[i]}
                  <select
                    value={mapping[f] ?? ""}
                    onChange={(e) => {
                      setMapping((m) => {
                        const n = { ...m };
                        if (e.target.value === "") delete n[f];
                        else n[f] = e.target.value;
                        return n;
                      });
                      setPreview(false);
                    }}
                  >
                    <option value="">Uyğunlaşdırılmayıb</option>
                    {headers.map((h, j) => (
                      <option key={j} value={j}>
                        {h || `Sütun ${j + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="notice">
              Mənbə ID-si eyni qeydi yeniləyir. ID yoxdursa fayl və sətir açarı
              istifadə edilir; fərqli fayllardakı eyni adlı qeydlər avtomatik
              birləşdirilmir. Boş xana mövcud dəyəri silmir.
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await command(org, "import", "import.inspect", {
                    rows: mapped.map((r) => r.value),
                  });
                  setCandidates(r.candidates);
                  setPreview(true);
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Önbaxışı yoxla
            </button>
            {preview &&
              candidates
                .filter((c) => c.matches.length)
                .map((c) => (
                  <label key={c.index}>
                    {c.index + header + 2}-ci sətir: mümkün uyğunluq
                    <select
                      value={matches[c.index] ?? ""}
                      onChange={(e) =>
                        setMatches({ ...matches, [c.index]: e.target.value })
                      }
                    >
                      <option value="">
                        Mənbə ID varsa yenilə; yoxdursa yeni müəssisə
                      </option>
                      {c.matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.external_id}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            {preview && (
              <>
                <p>
                  {mapped.length} sətir ·{" "}
                  {mapped.filter((r) => r.errors.length).length} xəta
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Sətir</th>
                        <th>Müəssisə</th>
                        <th>Telefon</th>
                        <th>Filial</th>
                        <th>Nəticə</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapped.slice(0, 100).map((r) => (
                        <tr key={r.index}>
                          <td>{r.index}</td>
                          <td>{r.value.customer_name}</td>
                          <td>{r.value.phone}</td>
                          <td>{r.value.branch_name}</td>
                          <td>{r.errors.join(", ") || "Tətbiq edilə bilər"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    mapped.some((r) => r.errors.length) ||
                    !mapped.length
                  }
                  onClick={apply}
                >
                  {busy ? "Import edilir…" : "Önbaxışı tətbiq et"}
                </button>
              </>
            )}
          </>
        )}
        {progress && (
          <p role="status" className="notice">
            {progress}
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
