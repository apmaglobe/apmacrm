# Faktiki yoxlama jurnalı

08.09.2026. Test hesabları və müəssisələr sintetikdir. Bu nəticələr bütün AC cümlələrinin production-da təsdiqlənməsi demək deyil. Bəndlər üzrə sübut və sərhəd [qəbul matrisində](acceptance-matrix.md) göstərilib.

## Son təsdiqlənmiş nəticələr

| Yoxlama | Nəticə | Sübut və sərhəd |
|---|---|---|
| PostgreSQL | **39/39 keçib**, 24 migration | `.local/db-final.log`: tenant/RLS, pending/suspended/bootstrap MFA, actor/owner/payment sərhədi, version/allocation concurrency, last admin, deadline, price reconciliation, import/retry/rollback/worker, export owner/field/revocation/expiry, Vault/owner retry, report/mention, To Do scope, failed period repair, NULL/zero/refund |
| Vitest | **9/9 keçib** | `.local/unit-22.log`: XLSX/CSV parser, limitlər, formula injection, CSRF, integer pul/NULL/zero və Bakı gecə sərhədi |
| Lokal tam Playwright | **14/14, 2,7 dəqiqə** | `.local/e2e-final.log`, lokal Next production server, 23 migration |
| Son dəyişiklik lokal browser | **2/2, 18,5 saniyə** | `.local/e2e-24.log`: mobil menyu və export; 24 migration/build |
| Son cloud preview tam Playwright | **14/14, 4,3 dəqiqə** | `.local/preview-e2e-7.log`; [preview-7](https://apma-10cmh78v9-apmaglobe.vercel.app), ayrıca preview Supabase, Vercel protection ilə |
| TypeScript | Keçib | `.local/type-final-24.log` |
| Next production build | Keçib | `.local/build-24.log`; preview-7 Vercel READY |
| ESLint | **0 error, 3 warning** | `.local/lint-24.log`: login/MFA-dan sonra auth cookie və router cache üçün qəsdən yeni document navigation; xəbərdarlıq gizlədilməyib |
| Supabase security advisor | Production 0 lint; preview 1 WARN | Preview Free planda leaked-password protection bağlıdır. Funksiya [Pro tələb edir](https://supabase.com/docs/guides/auth/password-security); yeni ödənişli plan alınmayıb |
| Supabase performance advisor | 0 WARN/ERROR | Production 64, preview 24 unused-index INFO; boş/az istifadə olunan indekslər, yük sınağının əvəzi deyil |

Tam browser suite: desktop login → qutu yarat → həqiqi drag/confirm → To Do; ikinci sessiya Realtime; 360px menyu/create; iki agentlik API izolyasiyası və 12 route; admin private CSV upload → mapping/preview → 2500 import → search; 390px creator payment/əvəzləmə; profil/kataloq/dəvət; yanlış/etibarlı HMAC HTTP və real cron; aylıq generation/template revision/stop və failed assignee plan repair; Tools reserve/checkout/return/broken; mobil Meet/calendar/ICS; iki sessiya private chat və üzvlük ləğvi; 2500+ filtrli export/foreign deny; tarixli Overview/profil fəaliyyəti/lookup səhifəsindən kənar müştəri adı.

Cloud export testi 1,2 dəqiqə çəkib: bu müddət queue/cron gözləməsi, hazır artifact endirməsi və UI yoxlamasını birlikdə ehtiva edir. Tək API latency və ya istifadəçi hərəkəti P95 kimi təqdim olunmur.

## Aşkarlanmış və düzəldilmiş yoxlama xətaları

- Ağır restore ilə paralel lokal dev testləri gecikmə yaratmışdı. Son tam lokal suite ayrıca production serverdə işlədilib. Yük/restore testləri browser suite ilə təkrarlanmır.
- Export testi əvvəllər durable işin dərhal `done` olmasını gözləyirdi; indi queue nəticəsi poll edilir. Biznes şərti zəiflədilməyib: tam fayl və foreign tenant deny yenə yoxlanır.
- Preview-6-da 12/14 keçdi: mobil ilk klik və bir export download uğursuz oldu. Export təkrarında keçdi; mobil readiness guard, export source UUID index lookup və yalnız SQLSTATE diaqnostikası əlavə edildi. Preview-7 tam 14/14 keçdi. İlk export uğursuzluğunun HTTP kodu əvvəlki testdə saxlanmadığından onun qəti səbəbi iddia edilmir.
- Aylıq failed snapshot üçün adi gələcək template revision kifayət etmirdi. Səbəbli `period.repair` eyni failed period ID-sini atomik bərpa edir; DB və browser yoxlaması keçib.
- Admin girişindən sonra sessiya state yarışını və əvvəlki MFA form input-unun qalmasını düzəltdik; son suite login/TOTP ilə keçib.

## Lokal yük ölçməsi

Mac ARM64, Colima 4 CPU / 6 GB, lokal Supabase HTTP. Auth-dan keçmiş 15 ayrı sintetik istifadəçi; bir agentlikdə 2500 müəssisə, ilkin 10000 qutu və 40000 iş. Bunlar istifadəçinin real biznes rəqəmləri deyil. Cloud/Vercel cold start və Bakı WAN ölçməsi deyil.

| Ssenari | Əvvəl | Düzəlişdən sonra |
|---|---|---|
| İlk board çağırışı | 8132 ms, timeout | 195 ms, uğurlu |
| 15 paralel board, 3 dalğa / 45 nümunə | 45 timeout, P95 16213 ms | 0 xəta, P50 799 ms, P95 1074 ms, max 1133 ms |
| 15 paralel qutu yaratma | 0 xəta, P95 144 ms | 0 xəta, P95 118 ms |

İlkin sorğu bütün icazəli qutuların qiymətini hesablayırdı; düzəlişdə obyekt sərhədi bir SQL seçiminə, qiymət hesabı cari kart səhifəsinə keçirilib. Sübut `.local/benchmark.json`; təkrar skript `scripts/benchmark.ts`.

## Browser performansı və reconnect

`scripts/browser-performance.ts`, `.local/browser-performance.json`. Lokal Next production server, Chrome headless 1440×900, CPU/şəbəkə throttle yoxdur, yuxarıdakı böyük fixture. Backup prosesinin bir hissəsi bu ölçmə ilə üst-üstə düşüb; nəticə və outlier saxlanır.

| Ölçmə | Nümunə | P50 | P95 | Max |
|---|---:|---:|---:|---:|
| Navigation LCP | 5 | 1008 ms | 2196 ms | 2196 ms |
| Müşahidə edilmiş EventTiming duration | 36 event | 72 ms | 88 ms | 88 ms |
| Mutation HTTP cavabı | 22 | 120 ms | 390 ms | 576 ms |
| Mutation cavabından ikinci sessiyada Realtime görünüş | 20 | 302 ms | 823 ms | **5864 ms** |

Offline → online sonrası yeni məlumatın görünməsi bir sınaqda 292 ms. EventTiming cədvəli formal field INP deyil. LCP cəmi beş navigation nümunəsidir. Lokal ölçülən P95-lər LCP <2,5s, mutation <800ms və Realtime <1s hədəflərinin altındadır; Realtime maksimumu hədəfdən yuxarıdır. Bunlar real cihaz/cloud performans zəmanəti deyil.

Son tam cloud browserdə create klikindən ikinci sessiyada görünməyə **4809 ms** ölçülüb; bu axın mutation və popup bağlama addımını da ehtiva edir, saf Realtime gecikməsi/P95 deyil. Lokal oxşar ölçmə 4899 ms-dir. Daha köhnə sürətli müşahidəni son nəticə kimi seçməmişik.

## Backup / restore sübutu

Production əl ilə və gündəlik LaunchAgent tərəfindən DB+Storage+app Vault backup-u AES-256-GCM arxivinə yazılıb, authentication tag/hash yoxlanıb. Son avtomatik nəticə 08.09.2026 06:27:56 UTC, **38,594 saniyə, exit 0, verified=true**. Production hələ boş olduğundan 0 Storage obyekti var; bu nəticə dolu bazanın restore sübutu deyil.

Dolu cloud preview arxivi ayrıca lokal API55321/DB55322 mühitinə bərpa edilib. 22 migration məşqində DB mərhələsi **13,457 saniyə**, decrypt/schema reset/restore/verify daxil prosedur təxminən **153,857 saniyə** idi. Bir Storage faylının real baytları SHA-256 ilə tutuşduruldu; kritik saylar, iki tenant RLS, Vault yeni root altında re-encryption və worker replay source unikallığı keçdi. `.local/cloud-restore-22.log`, `.local/restore-report.json`. Restore cron bağlı saxlanıb. **Son24migration məşqi də keçib** (06:35:39UTC):4Storage obyekti,17,872s restore mərhələsi,156,007s decrypt/schema reset/restore/verify daxil prosedur. Bütün kritik saylar,2tenantRLS,Vault və worker replay yoxlamaları keçib. Snapshot-un test başlananda yaşı183,353s idi; bu ümumi24saat RPO zəmanəti deyil. `.local/cloud-restore-24.log`, `.local/restore-report.json`. Ayrılmış restore stack yoxlamadan sonra dayandırılıb.

Gündəlik job05:15 və login zamanı Mac-də işləyir. Mac/Docker/credential olmadıqda24saat RPO təmin edilmir. DB dump və Storage download vahid transaction snapshot-u deyil; aktiv yazmalarda koordinasiyalı snapshot/maintenance proseduru lazımdır. Offline bərpa açarı və gündəlik yoxlama [runbook](runbook.md)-dadır.

## Yoxlanmış sayılmayanlar

Real Excel-in sütunları və logo faylı verilməyib. Xəritə/Geoapify və SMTP/email confirmation/reset delivery istifadəçi tərəfindən təxirə salınıb. Tam accessibility audit, real telefon/planşet şəbəkəsi, bütün rol/filtr/concurrency kombinasiyaları və production real istifadəçi axını ayrıca təsdiqlənməyib. Bu limitlər gizlədilmir; AC matrisi konkret sərhədləri saxlayır.

Auth request-lərini saxlayan Playwright trace bağlıdır. Köhnə generated trace/error-context report-ları silinib; sanitizəli `.local/*log` nəticələri private saxlanır, ictimai artifact deyil.
