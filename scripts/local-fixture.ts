import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
if (!env.DATABASE_URL.includes("127.0.0.1")) throw new Error("Local only");
const pool = new Pool({ connectionString: env.DATABASE_URL });
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replaceAll("=", "")]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)));
  const t = Buffer.alloc(8);
  t.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(t).digest();
  const offset = hash[19] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const fixtures: {
  org: string;
  users: {
    email: string;
    password: string;
    id: string;
    member: string;
    totp?: string;
  }[];
}[] = [];
try {
  for (const index of [1, 2]) {
    const org = randomUUID();
    await pool.query(
      "insert into public.organizations(id,name,slug) values($1::uuid,$2,$1::text)",
      [org, "Sınaq agentliyi " + index],
    );
    await pool.query("select private.initialize_org($1)", [org]);
    const depts = (
      await pool.query(
        "select id from public.departments where organization_id=$1 order by name",
        [org],
      )
    ).rows;
    const users = [];
    for (const [j, label] of ["Admin", "Aysel", "Murad"].entries()) {
      const email = `apma-${index}-${j}-${Date.now()}@example.test`,
        password = randomBytes(24).toString("base64url");
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      const id = data.user.id,
        member = randomUUID();
      await pool.query(
        "insert into public.memberships(id,organization_id,user_id,name,status,is_admin,overrides) values($1,$2,$3,$4,'active',$5,'{\"commercials.write\":\"allow\"}')",
        [member, org, id, label, j === 0],
      );
      await pool.query(
        "insert into public.department_members values($1,$2,$3)",
        [org, depts[j === 2 ? 1 : 0].id, member],
      );
      let secret: string | undefined;
      if (j === 0) {
        const db = createClient(
          env.NEXT_PUBLIC_SUPABASE_URL,
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const login = await db.auth.signInWithPassword({ email, password });
        if (login.error) throw new Error(login.error.message);
        const factor = await db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Local test",
        });
        if (factor.error) throw new Error(factor.error.message);
        secret = factor.data.totp.secret;
        const v = await db.auth.mfa.challengeAndVerify({
          factorId: factor.data.id,
          code: totp(secret),
        });
        if (v.error) throw new Error(v.error.message);
        await db.auth.signOut();
      }
      users.push({ email, password, id, member, totp: secret });
    }
    const cid = randomUUID();
    await pool.query(
      "insert into public.customers(id,organization_id,external_id,name,category) values($1,$2,'synthetic-1','Nümunə Studio','Yaradıcı studiya')",
      [cid, org],
    );
    await pool.query(
      "insert into public.financial_accounts(organization_id,name,kind) values($1,'Sınaq bank hesabı','bank')",
      [org],
    );
    await pool.query(
      "insert into public.customer_locations(organization_id,customer_id,external_id,address,latitude,longitude) values($1,$2,'main','Bakı — sintetik ünvan',40.4093,49.8671)",
      [org, cid],
    );
    fixtures.push({ org, users });
  }
  writeFileSync(".local/fixture.json", JSON.stringify(fixtures, null, 2));
  chmodSync(".local/fixture.json", 0o600);
  console.log(
    "İki lokal agentlik və 6 test hesabı yaradıldı. Girişlər yalnız .local/fixture.json-da saxlanır.",
  );
} finally {
  await pool.end();
}
