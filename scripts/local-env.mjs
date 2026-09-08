import { readFileSync, writeFileSync, chmodSync } from "node:fs";
const text = readFileSync(".local/supabase-start.log", "utf8");
const line = text
  .split("\n")
  .findLast((l) => l.startsWith("{") && l.includes("API_URL"));
if (!line) throw new Error("Lokal Supabase statusu tapılmadı");
const v = JSON.parse(line);
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${v.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${v.PUBLISHABLE_KEY}\nNEXT_PUBLIC_APP_URL=http://127.0.0.1:3000\nSUPABASE_SECRET_KEY=${v.SECRET_KEY}\nDATABASE_URL=${v.DB_URL}\n`,
);
chmodSync(".env.local", 0o600);
writeFileSync(
  ".local/supabase-start.log",
  text
    .split("\n")
    .filter((l) => !l.startsWith("{"))
    .join("\n"),
);
console.log("Lokal env yazıldı; açarlar göstərilmədi.");
