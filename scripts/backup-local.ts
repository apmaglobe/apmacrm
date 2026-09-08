/** Local restore rehearsal backup; production uses the documented encrypted/offsite procedure. */
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!env.DATABASE_URL.includes("127.0.0.1:54322"))
  throw new Error("Local rehearsal only");
const directory =
  ".local/backups/" + new Date().toISOString().replaceAll(":", "-");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const started = Date.now();
const pool = new Pool({ connectionString: env.DATABASE_URL });
try {
  const dump = spawnSync(
    "docker",
    [
      "exec",
      "supabase_db_apmacrm",
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--format=custom",
      "--data-only",
      "--schema=public",
      "--schema=private",
      "--schema=auth",
      "--schema=storage",
      "--exclude-table-data=auth.schema_migrations",
      "--exclude-table-data=storage.migrations",
      "--exclude-table-data=storage.buckets",
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  if (dump.status) throw new Error("Database backup failed");
  writeFileSync(directory + "/database.dump", dump.stdout, { mode: 0o600 });
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const objects = (
    await pool.query(
      "select bucket_id,name,metadata->>'mimetype' as content_type from storage.objects order by bucket_id,name",
    )
  ).rows;
  const manifest = [];
  for (const object of objects) {
    const { data, error } = await db.storage
      .from(object.bucket_id)
      .download(object.name);
    if (error) throw new Error("Storage backup failed");
    const bytes = Buffer.from(await data.arrayBuffer());
    const file =
      createHash("sha256")
        .update(object.bucket_id + "/" + object.name)
        .digest("hex") + ".bin";
    writeFileSync(directory + "/" + file, bytes, { mode: 0o600 });
    manifest.push({
      ...object,
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    });
  }
  const vault = (await pool.query("select id,name,description,decrypted_secret from vault.decrypted_secrets where name like 'apma-webhook:%' order by id")).rows;
  writeFileSync(directory+"/vault-secrets.json",JSON.stringify(vault),{mode:0o600});
  const counts = (
    await pool.query(
      "select 'organizations' name,count(*)::int n from public.organizations union all select 'payments',count(*)::int from public.payments union all select 'financial_documents',count(*)::int from public.financial_documents union all select 'contract_periods',count(*)::int from public.contract_periods union all select 'work_items',count(*)::int from public.work_items union all select 'auth_users',count(*)::int from auth.users",
    )
  ).rows;
  writeFileSync(
    directory + "/manifest.json",
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        objects: manifest,
        vaultSecrets: vault.length,
        counts,
        migrations: (
          await pool.query(
            "select version from supabase_migrations.schema_migrations order by version",
          )
        ).rows,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  writeFileSync(".local/latest-backup.txt", directory, { mode: 0o600 });
  chmodSync(directory, 0o700);
  console.log(
    "Local backup complete:",
    objects.length,
    "Storage objects;",
    Date.now() - started,
    "ms",
  );
} finally {
  await pool.end();
}
