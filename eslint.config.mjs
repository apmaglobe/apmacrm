import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".local/**",
    "playwright-report/**",
    "test-results/**",
    ".vercel/**",
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "src/lib/db/database.types.ts",
  ]),
]);
