# APMA CRM — icra vəziyyəti

08.09.2026. Branch `codex/apma-crm-v1`. **M1–M6 kodu və əsas axınları qurulub; kommersiya production buraxılışı hələ tamamlanmayıb.**

## Qüvvədə olan qərarlar

AGENTS.md, README.md, docs/01–08 və prompts/02 oxunub. D01–D56, S01–S33 və son istifadəçi göstərişləri tətbiq edilir. Orijinal sənəd paketləri/arxivləri qorunur. Ayrı Supabase/Vercel `apma-crm` seçilib. İlk admin `apmaglobe@gmail.com`; ilkin ünvan Vercel, custom domain sonra. **Xəritə/Geoapify və email/SMTP/DNS istifadəçi tərəfindən sonraya saxlanıb; bunlara yenidən başlamayın və eyni sualları soruşmayın.** Real Excel və logo verilməyib. Əvvəl SMTP cavabında verilmiş rəqəm credential kimi istifadə edilməyib.

## Faktiki resurslar

| Mühit | Resurs | Vəziyyət |
|---|---|---|
| Supabase production | apma-crm, `clysniomfmmxwiozfizt`, Frankfurt | Free; 24 migration |
| Supabase preview | apma-crm-preview, `obtlqejryfvcqfsjxeda`, Frankfurt | Free; eyni 24 migration |
| Supabase təşkilat | apmaglobe, `mxpdnlyaiddizgeuwbwx` | Yeni ödənişli plan alınmayıb |
| Vercel | apmaglobe / `team_Jce1EdJI8YIHwHAFgUxunCqq`; layihə `prj_vphfySBR5nYCPMfL2xf08Y20dbPW` | Hobby, bir OWNER; CLI bağlıdır |
| Son preview | https://apma-10cmh78v9-apmaglobe.vercel.app | Preview-7 READY; Vercel protection tətbiq olunur |
| Əsas alias | apma-crm.vercel.app | Hələ production təhvili deyil |

Public/server env-lər preview və production üçün ayrı bazalara bağlıdır. Server açarları sensitive/private saxlanır. Auth confirmation, TOTP və bootstrap allowlist var; real admin hələ provision edilməyib. SMTP çatdırılması yoxlanmayıb. İlk avtomatik Production alias-ları qəbuldan əvvəl silinib; son deploy-lar explicit preview-dir. Vercel connector yeni layihədə 403/404 verir; düzgün bağlı CLI fallback işləyir.

## Mərhələlər üzrə nəticə

- M1: Next.js16/React/TS, 12 bölməli responsive shell, tenant/active membership/rol/departament/field/export RLS, Auth və admin MFA.
- M2: XLSX/CSV parser, mapping/konflikt/preview, private Storage, durable batch import/retry/rollback; müəssisə/filial/kontakt siyahıları. 2500 sintetik sətir yoxlanıb. Real Excel mapping və real logo tətbiqi qalıb.
- M3: sales/recurring Kanban və cursor siyahısı, qutu/iş/alt tapşırıq, owner/creator/assignee sərhədləri, kataloq snapshot, due_at/qiymət/status/version guard, To Do mine/shared/admin-team, rəy/mention/audit/private Realtime.
- M4: Tools fiziki vahid və digital capacity, rezervasiya/checkout/return/nasazlıq; Meet iştirakçı/calendar/ICS/customer/deal/cancel; Users profil/rol/icazə/dəvət; Portfel və Drive/Gmail linkləri.
- M5: immutable charge/payment/reversal/refund/allocation/adjustment, dar creator payment, recurring müqavilə/period/version/worker/backoff/failed plan repair, short-month/stop/resume/50% display, monthly interval Portfel və Overview tarix/cash/report.
- M6: private chat və access revocation, raw HMAC/Vault rotation/durable intake, permission-revalidated CSV/XLSX export, private media, backup/restore/runbook və preview yerləşdirmə.

## Son düzəlişlər

19–24 migration: Overview/report/gündəlik xülasə; təsviri quantity və giriş verməyən mentions; export filter uyğunluğu; shared To Do scope; Meet əlaqələri; recurring failed-job backoff; yaranmamış failed dövr planının səbəbli, atomik, idempotent bərpası; export source revalidation-da UUID index lookup.

Frontend: əlaqəli müştəri adları ilk100 lookup-dan kənarda da yüklənir; parent ID üzrə əlaqəli maliyyə/work məlumatı, siyahı pagination, Bakı tarix formatı, export AZN/önbaxış, profil fəaliyyəti. Login/MFA-dan sonra yeni document ilə auth keşi yenilənir. Mobil menyu hydration hazır olana qədər disabled-dir. Webhook body limiti stream oxunarkən tətbiq edilir. Export xətasında yalnız SQLSTATE loglanır.

## Son yoxlamalar

- PostgreSQL **39/39**, 24 migration: `.local/db-final.log`.
- Vitest **9/9**: `.local/unit-22.log`; sonrakı app dəyişiklikləri parser/pul unit funksiyalarını dəyişməyib.
- Tam lokal production-server Playwright **14/14, 2,7 dəqiqə**: `.local/e2e-final.log` (23 migration). Son mobil/export düzəlişindən sonra təsirlənən **2/2**: `.local/e2e-24.log`.
- Preview-5 **13/13**; preview-6 **12/14**, mobil erkən klik və bir export endirməsi uğursuz. Export təkrarında keçib; mobil readiness guard və UUID lookup düzəlişi əlavə edilib. **Preview-7 tam14/14, 4,3dəqiqə keçib** (`.local/preview-e2e-7.log`).
- Son `pnpm build` və `pnpm typecheck` keçib. `pnpm lint`: **0 error, 3 warning** — auth/MFA sərhədində qəsdən hard navigation. `.local/build-24.log`, `.local/type-24.log`, `.local/lint-24.log`.
- Production security advisor **0 lint**; preview **1 WARN**: Free planda leaked-password protection yoxdur. HIBP Pro tələb edir, ödənişli upgrade edilməyib. Performance: production64/preview24 unused-index INFO; WARN/ERROR yoxdur.
- Yük/Realtime/LCP və restore rəqəmləri [test-results](test-results.md)-də; [AC-01–76 matrisi](acceptance-matrix.md) sübutları və əhatə sərhədlərini göstərir.

## Backup və admin

Şifrəli DB+Storage baytları+app Vault backup-u hazırdır; production əl ilə və LaunchAgent ilə həqiqətən işləyib. `com.apma.crm.backup`, gündəlik05:15 və login, private `~/Library/Application Support/APMA CRM Backup`. Mac/Docker/giriş bağlıdırsa24saat RPO təmin olunmur. Offline açar nüsxəsi istifadəçi tərəfindən qorunmalıdır. Dolu cloud preview snapshot-u ayrı lokal restore stack-də DB/StorageSHA256/Vault/2tenantRLS/worker replay ilə bərpa edilib; Son24migration məşqi keçib:4Storage faylı,17,872s bərpa,156,007s decrypt/schema/reset/verify daxil prosedur. Production hələ boşdur.

`pnpm exec tsx scripts/activate-admin.ts`: hesab sahibi gizli terminalda parolu özü seçir; mövcud hesab reset edilmir. Sonra login→TOTP→İlk admini aktivləşdir. Script real admin üçün hələ işlədilməyib. Təlimat [runbook](runbook.md)-dadır.

## Davam nöqtəsi

1. Preview-7 tam14/14 keçib; kod və24migration uyğun gəlir. Lokal39DB/9unit və build/typecheck nəticələri yuxarıdadır; yeni dəyişiklik olmadan suite-ləri yenidən başlatma.
2. Son backup installer24migrationla yenilənib, avtomatik uğur06:27:56UTC. Cloud→local24migration restore06:35:39UTC keçib; cron bağlı, restore stack dayandırılıb. Köhnə generated Auth trace/error-context report-ları silinib; sanitizəli loglar private saxlanır.
3. Kommersiya buraxılışı üçün Vercel Pro **20USD/ay, bir deploy seat daxil; vergi və əlavə istifadə ayrıca**. Yeni ödənişli resurs üçün istifadəçi əvvəl faktiki xərc tələb edib; upgrade hələ təsdiqlənməyib/alınmayıb. Bütün müstəqil iş hazır olanda yalnız bu yeni ödəniş qərarını soruş. Supabase Free hələ saxlanır.100AZN hədəfdir, zəmanət deyil.
4. Xərc təsdiqindən sonra seçilmiş Vercel layihəsində test olunmuş kodu **production env ilə yenidən build/deploy** et; preview env build-ini birbaşa promote etmə. Faktiki alias/login/API-ni yoxla. Admin provisioning/TOTP hesab sahibinin təhlükəsiz giriş addımıdır.
5. Real Excel/logo çatışmır; email və xəritə təxirə salınıb. Bunları hazır göstərmə. AC matrisində ayrıca yoxlanmamış variasiyaları universal keçdi sayma.

## Lokal davam

PATH: `/opt/homebrew/bin:/Users/rafaelaghazade/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`. Colima `apma-crm`, Docker `~/.colima/apma-crm/docker.sock`; lokal API54321/DB54322/Next3000. Restore API55321/DB55322. Build ilə server eyni `.next`-ə paralel yazmamalıdır. `.env.local` yalnız lokal bazadır. `.local/fixture.json`, `.local/preview-fixture.json`, cloud-connection və backup key ignored/private-dir; çıxışa verməyin.
