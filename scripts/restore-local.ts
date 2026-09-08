/** Restore only into the disposable apmacrm_restore stack. Never accepts a production target. */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
const backup = readFileSync(".local/latest-backup.txt", "utf8").trim();
if (!backup.startsWith(".local/backups/"))
  throw new Error("Invalid local backup path");
const manifest = JSON.parse(readFileSync(backup + "/manifest.json", "utf8"));
const env = Object.fromEntries(
  readFileSync(".local/restore-env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
if (
  !env.DB_URL?.includes("127.0.0.1:55322") ||
  !env.API_URL?.includes("127.0.0.1:55321")
)
  throw new Error("Isolated restore only");
const start = Date.now();
const pool = new Pool({ connectionString: env.DB_URL });
try {
  const stop = spawnSync("docker", [
    "exec",
    "supabase_db_apmacrm_restore",
    "psql",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "update cron.job set active=false",
  ]);
  if (stop.status) throw new Error("Could not suspend restore jobs");
  const actualMigrations=(await pool.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  if(manifest.migrationNames){
    const names=actualMigrations.map(r=>r.name).sort();if(JSON.stringify(names)!==JSON.stringify(manifest.migrationNames))throw new Error("Restore migration names do not match cloud snapshot");
    for(const f of manifest.sourceFiles){if(!/^[a-zA-Z0-9_.-]+$/.test(f.name)||createHash('sha256').update(readFileSync('supabase/migrations/'+f.name)).digest('hex')!==f.sha256)throw new Error('Restore migration file integrity mismatch');}
  }else if(JSON.stringify(actualMigrations.map(r=>({version:r.version})))!==JSON.stringify(manifest.migrations))throw new Error("Restore migration versions do not match snapshot");
  const count = await pool.query(
    "select count(*)::int n from public.organizations",
  );
  if (count.rows[0].n !== 0 && !process.argv.includes("--resume"))
    throw new Error(
      "Restore target must be empty; --resume only resumes its existing restore",
    );
  if(count.rows[0].n===0 && manifest.format==='sql'){
    const sql=readFileSync(backup+'/database.sql','utf8');
    const restore=spawnSync('docker',['exec','-i','supabase_db_apmacrm_restore','psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction'],{input:"set session_replication_role='replica';\n"+sql,encoding:'utf8',maxBuffer:32*1024*1024});
    if(restore.status){writeFileSync('.local/restore-error.log',restore.stderr,{mode:0o600});throw new Error('SQL restore failed; private diagnostic file saved');}
  } else if (count.rows[0].n === 0) {
    const copy = spawnSync("docker", [
      "cp",
      backup + "/database.dump",
      "supabase_db_apmacrm_restore:/tmp/apma-rehearsal.dump",
    ]);
    if (copy.status) throw new Error("Restore copy failed");
    const restore = spawnSync(
      "docker",
      [
        "exec",
        "supabase_db_apmacrm_restore",
        "pg_restore",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "--data-only",
        "--disable-triggers",
        "--exit-on-error",
        "/tmp/apma-rehearsal.dump",
      ],
      { encoding: "utf8" },
    );
    if (restore.status) {
      writeFileSync(".local/restore-error.log", restore.stderr, {
        mode: 0o600,
      });
      throw new Error("Restore failed; private diagnostic file saved");
    }
  }
  // Re-encrypt app-owned Vault secrets with this isolated project's own root key.
  const secrets=JSON.parse(readFileSync(backup+"/vault-secrets.json","utf8")) as {id:string;name:string;description:string;decrypted_secret:string}[];
  for(const secret of secrets){
    const existing=(await pool.query('select id,decrypted_secret from vault.decrypted_secrets where name=$1',[secret.name])).rows[0];
    let newId=existing?.id;
    if(!newId)newId=(await pool.query('select vault.create_secret($1,$2,$3) id',[secret.decrypted_secret,secret.name,secret.description])).rows[0].id;
    else if(existing.decrypted_secret!==secret.decrypted_secret)throw new Error('Restored Vault key mismatch');
    await pool.query('update private.webhook_keys set current_secret=$2 where current_secret=$1',[secret.id,newId]);
    await pool.query('update private.webhook_keys set previous_secret=$2 where previous_secret=$1',[secret.id,newId]);
    await pool.query("update private.requests set result=jsonb_set(result,'{secret_id}',to_jsonb($2::text)) where result->>'secret_id'=$1",[secret.id,newId]);
    const saved=(await pool.query('select decrypted_secret from vault.decrypted_secrets where id=$1',[newId])).rows[0].decrypted_secret;
    if(createHash('sha256').update(saved).digest('hex')!==createHash('sha256').update(secret.decrypted_secret).digest('hex'))throw new Error('Vault restore hash mismatch');
  }
  const db = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Metadata alone is insufficient: restore each Storage object's actual bytes.
  for (const object of manifest.objects) {
    const bytes = readFileSync(backup + "/" + object.file);
    if (createHash("sha256").update(bytes).digest("hex") !== object.sha256)
      throw new Error("Backup object checksum mismatch");
    const upload = await db.storage
      .from(object.bucket_id)
      .upload(object.name, bytes, {
        upsert: true,
        contentType:
          object.content_type ??
          (object.name.endsWith(".csv")
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      });
    if (upload.error)
      throw new Error("Storage restore failed: " + upload.error.message);
    const download = await db.storage
      .from(object.bucket_id)
      .download(object.name);
    if (download.error) throw new Error("Restored media link failed");
    if (
      createHash("sha256")
        .update(Buffer.from(await download.data.arrayBuffer()))
        .digest("hex") !== object.sha256
    )
      throw new Error("Restored object checksum mismatch");
  }
  for (const { name, n } of manifest.counts) {
    const table = name === "auth_users" ? "auth.users" : "public." + name;
    const result = await pool.query("select count(*)::int n from " + table);
    if (result.rows[0].n !== n) throw new Error("Count mismatch " + name);
  }
  const fixtures = JSON.parse(readFileSync(process.env.APMA_RESTORE_FIXTURE_FILE??".local/fixture.json", "utf8"));
  for (const fixture of fixtures) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({
          sub: fixture.users[1].id,
          role: "authenticated",
          aal: "aal1",
        }),
      ]);
      const rows = (
        await client.query(
          "select distinct organization_id from public.customers",
        )
      ).rows;
      if (rows.length !== 1 || rows[0].organization_id !== fixture.org)
        throw new Error("Restored tenant isolation failed");
      await client.query("rollback");
    } finally {
      client.release();
    }
  }
  await pool.query('select private.run_worker()');await pool.query('select private.run_worker()');
  await pool.query('select private.continue_imports()');
  const duplicate = await pool.query(
    "select organization_id,source_key,count(*) from public.financial_documents group by organization_id,source_key having count(*)>1",
  );
  if (duplicate.rows.length) throw new Error("Duplicate financial source");
  const report = {
    testedAt: new Date().toISOString(),
    environment: manifest.sourceRef ? "cloud preview synthetic snapshot into isolated local restore" : "isolated local synthetic restore",
    restoreMs: Date.now() - start,
    backupDurationMs: manifest.durationMs,
    backupAgeMs: start - Date.parse(manifest.createdAt),
    storageObjects: manifest.objects.length,
    checks: [
      "migration baseline applied",
      "all critical counts equal",
      "two tenant RLS isolated",
      "financial sources unique",
      "Storage upload/download SHA-256 equal",
      "Vault app secrets re-encrypted and hash verified",
      "worker replay does not duplicate financial sources",
    ],
    cronEnabled: false,
  };
  writeFileSync(".local/restore-report.json", JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await pool.end();
}
