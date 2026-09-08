# APMA CRM

Supabase Postgres/Auth/RLS/Storage/Realtime və Next.js/React/TypeScript üzərində agentlik CRM-i. M1–M6 qurulması davam edir; cari vəziyyət [implementation-status](docs/implementation-status.md), [qəbul matrisi](docs/acceptance-matrix.md) və [test nəticələri](docs/test-results.md), faktiki resurslar [resource-map](docs/resource-map.md), gündəlik əməliyyat və admin/backup təlimatı [runbook](docs/runbook.md)-dadır.

İstifadəçinin son göstərişi ilə xəritə və email/SMTP/DNS sonrakı işə saxlanıb. Real Excel/logo təqdim edilməyib. İstifadə olunan fixture-lər sintetikdir.

## Lokal işə salma

Node 24.x, pnpm 11.19.0 və Docker tələb olunur. macOS-da bu iş üçün ayrıca Colima `apma-crm` profili istifadə edilib; başqa profillərə toxunmayın.

```sh
pnpm install --frozen-lockfile
pnpm exec supabase start
# CLI-nin verdiyi lokal public/server açarlarını yalnız .env.local-a yerləşdirin.
# .env.example dəyişən adlarını göstərir, real secret ehtiva etmir.
pnpm exec tsx scripts/local-fixture.ts
pnpm dev
```

Lokal ünvan http://127.0.0.1:3000 . Sintetik hesablar `.local/fixture.json`-a yazılır; secretləri chat və ya git-ə çıxarmayın. `.env.local` lokal Supabase üçündür. `db reset` yalnız ayrılmış test bazasında istifadə edilir; production məlumatını reset etməyin.

## Yoxlama əmrləri

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

E2E üçün lokal server əvvəl açıq olmalıdır (`pnpm dev` və ya build-dən sonra `pnpm start`). Build və dev serverini eyni zamanda işlətməyin. DB testləri lokal bazada ayrıca sintetik tenant-lar yaradır. Fixture parolları private/ignored qovluqdadır. Auth sorğularını saxlamamaq üçün Playwright trace bağlıdır. Köhnə trace/snapshot diaqnostikası təmizlənib.

```sh
pnpm exec tsx scripts/benchmark.ts
pnpm exec tsx scripts/backup-local.ts
pnpm exec tsx scripts/restore-local.ts
pnpm exec tsx scripts/cloud-backup.ts
pnpm exec tsx scripts/install-backup-agent.ts
```

Benchmark 15 sintetik Auth hesabı, 2 500 müəssisə, 10 000 qutu və 40 000 iş ilə lokal HTTP nəticələri verir; production/Bakı şəbəkəsi ölçməsi deyil. Restore yalnız ayrılmış 55321/55322 hədəfinə işləyir. Ətraflı məhdudiyyətlər runbook-dadır.

## Quruluş

- `src/modules`: CRM, müəssisə/import, maliyyə, müqavilə, Users və əməliyyat UI-ləri.
- `src/app/api`: session/RLS ilə oxuma və transactional RPC əmrləri; private export/media; HMAC ingress.
- `supabase/migrations`: versiyalı schema, biznes invariantları, RLS, worker/cron. Client cədvəllərə sərbəst yazmır.
- `tests` və `scripts/test-db.ts`: biznes, izolyasiya, concurrency və browser testləri.
- `.env.example`, `vercel.json`, `.vercelignore`: mühit və deployment sərhədləri.

D01–D56, S01–S33 və istifadəçinin son düzəlişləri tətbiq edilir. Aktiv spesifikasiya docs/01–08 və prompts/02-qurulma-promptu.md-dir. `planning-v0.11-original.zip` tarixi arxiv olaraq qorunur, aktiv tələb deyil. Orijinal v1 paketləri də saxlanılıb.
