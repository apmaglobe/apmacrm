# APMA CRM — icra vəziyyəti

09.09.2026. Branch `codex/apma-crm-v1`. **M1–M6 kodu və əsas axınları qurulub; Hobby planında production yerləşdirmə READY-dir. Giriş dövrəsi və versiya-konflikt cavabı düzəldilib; təxirə salınan funksiyalar qalır.**

## Qüvvədə olan qərarlar

AGENTS.md, README.md, docs/01–08 və prompts/02 oxunub. D01–D56, S01–S33 və son istifadəçi göstərişləri tətbiq edilir. Orijinal sənəd paketləri/arxivləri qorunur. Ayrı Supabase/Vercel `apma-crm` seçilib. İlk admin `apmaglobe@gmail.com`; ilkin ünvan Vercel, custom domain sonra. Xəritə/Geoapify və email/SMTP/DNS yenidən yoxlanıb: email domeninin DNS təsdiqi, Geoapify açarı, real Excel və logo faylları hələ çatışmır. Əvvəl SMTP cavabında verilmiş rəqəm credential kimi istifadə edilməyib. **Son qərar: Vercel Pro-ya keçməyin; mövcud Hobby ilə davam edin. Pro təsdiqini təkrar soruşmayın və ödənişli plan aktivləşdirməyin.**

## Faktiki resurslar

| Mühit | Resurs | Vəziyyət |
|---|---|---|
| Supabase production | apma-crm, `clysniomfmmxwiozfizt`, Frankfurt | Free; 37 migration |
| Supabase preview | apma-crm-preview, `obtlqejryfvcqfsjxeda`, Frankfurt | Free; eyni 37 migration |
| Supabase təşkilat | apmaglobe, `mxpdnlyaiddizgeuwbwx` | Yeni ödənişli plan alınmayıb |
| Vercel | apmaglobe / `team_Jce1EdJI8YIHwHAFgUxunCqq`; layihə `prj_vphfySBR5nYCPMfL2xf08Y20dbPW` | Hobby, bir OWNER; CLI bağlıdır |
| Son preview | https://apma-lzy1uxu6i-apmaglobe.vercel.app | Preview-18 READY; Vercel protection tətbiq olunur |
| Əsas ünvan | https://apma-crm.vercel.app | Hobby production READY; ayrıca production env ilə build edilib |
| Production deploy | https://apma-6t4rx5utb-apmaglobe.vercel.app | `dpl_YLvHDPgkckmNR2PGEJfV96JSnVB1`; production-6 READY |

Public/server env-lər preview və production üçün ayrı bazalara bağlıdır. Server açarları sensitive/private saxlanır. Auth confirmation, TOTP və bootstrap allowlist var; apmaglobe@gmail.com Auth hesabı production və preview-də istifadəçinin seçdiyi parolla yaradılıb; giriş hər ikisində təsdiqlənib. 08.09-da istifadəçinin Authenticator faktorunun verified olduğu yoxlanıb; ilkin admin claim hələ tamamlanmamışdı. Yeni axın TOTP ilə uğurlu girişdən sonra uyğun ilk admini avtomatik aktivləşdirir. Artıq AAL2 sessiyası olan istifadəçiyə tək aktivləşdirmə düyməsi göstərilir. SMTP çatdırılması yoxlanmayıb. İlkin preview yoxlamalarından sonra `--prod` ilə ayrıca production build yerləşdirilib; preview artifact production-a promote edilməyib. Vercel connector yeni layihədə 403/404 verir; düzgün bağlı CLI fallback işləyir.

## Mərhələlər üzrə nəticə

- M1: Next.js16/React/TS, 12 bölməli responsive shell, tenant/active membership/rol/departament/field/export RLS, Auth və admin MFA.
- M2: XLSX/CSV parser, mapping/konflikt/preview, private Storage, durable batch import/retry/rollback; müəssisə/filial/kontakt siyahıları. 2500 sintetik sətir yoxlanıb. Real Excel mapping və real logo tətbiqi qalıb.
- M3: sales/recurring Kanban və cursor siyahısı, qutu/iş/alt tapşırıq, owner/creator/assignee sərhədləri, kataloq snapshot, due_at/qiymət/status/version guard, To Do mine/shared/admin-team, rəy/mention/audit/private Realtime.
- M4: Tools fiziki vahid və digital capacity, rezervasiya/checkout/return/nasazlıq; Meet iştirakçı/calendar/ICS/customer/deal/cancel; Users profil/rol/icazə/dəvət; Portfel və Drive/Gmail linkləri.
- M5: immutable charge/payment/reversal/refund/allocation/adjustment, dar creator payment, recurring müqavilə/period/version/worker/backoff/failed plan repair, short-month/stop/resume/50% display, monthly interval Portfel və Overview tarix/cash/report.
- M6: private chat və access revocation, raw HMAC/Vault rotation/durable intake, permission-revalidated CSV/XLSX export, private media, backup/restore/runbook və preview yerləşdirmə.

## Son düzəlişlər

09.09, HORECA data importu: `baku_horeca_database.xlsx` real sütunları oxundu. 654/654 koordinat etibarlı, 9 təkrarlanan ad fərqli filial ünvanlarıdır. Production APMA tenantinə idempotent `horeca-baku:*` mənbə kodları ilə **645 müəssisə, 654 filial/xəritə nöqtəsi və 654 telefon kontaktı** yazıldı. Geoapify açarı olmadan xəritə OpenStreetMap fonunu göstərir; açar verilərsə Geoapify qatına avtomatik keçir. Production-7 `dpl_7rWS3cLxRU8SSyxBCkwoD1zHV8jz` READY və əsas alias-a bağlıdır.

08.09, UI: `5fc451f` — “Canlı” ayrıca status komponenti ilə topbar ikonlarıyla eyni hündürlükdə və mərkəzdədir. Axtarış form label-in şaquli düzülüşündən ayrılıb: ikon/mətn üfüqi, 44px hündürlük, focus göstəricisi. Qutu filtrləri 58px yığcam ikonlu başlıq, açılma oxu, hover/focus və native klaviatura idarəsi ilə yenilənib. 1440/390/360px, ağ/qara tema, axtarış/filtr HTTP200: lokal və preview-13 hərəsində 7 hədəf yoxlaması keçib; 0 page error. Yeni migration yoxdur.

19–24 migration: Overview/report/gündəlik xülasə; təsviri quantity və giriş verməyən mentions; export filter uyğunluğu; shared To Do scope; Meet əlaqələri; recurring failed-job backoff; yaranmamış failed dövr planının səbəbli, atomik, idempotent bərpası; export source revalidation-da UUID index lookup.

Frontend: əlaqəli müştəri adları ilk100 lookup-dan kənarda da yüklənir; parent ID üzrə əlaqəli maliyyə/work məlumatı, siyahı pagination, Bakı tarix formatı, export AZN/önbaxış, profil fəaliyyəti. Login/MFA-dan sonra yeni document ilə auth keşi yenilənir. Mobil menyu hydration hazır olana qədər disabled-dir. Webhook body limiti stream oxunarkən tətbiq edilir. Export xətasında yalnız SQLSTATE loglanır.

25-ci migration: admin-only/AAL2 manual əməkdaş yaratma üçün parolsuz intent, əvvəlcədən ayrılan Auth UUID və current admin ilə atomik membership/departament completion. Auth çağırışı itərsə eyni admin/form yeni sorğu ID-si ilə yarımçıq işi bərpa edə bilir; mövcud hesaba parol reset edilmir. `/api/members` bounded body, same-origin, server-only key; UI Userlər→Əməkdaş əlavə et. İstifadəçi email göndərmədən manual aktivləşdirməni ayrıca təsdiqləyib.

Tema `#000000`, bütün portal/formalara tətbiq edilir və refresh-dən sonra saxlanır; ikonlar kvadrat/mərkəzdədir. Mobil tenant seçimi menyudadır.

26-cı migration: `export_page` hər500source sətirində cari tenant/aktor/field/export hüququnu yoxlayır. CSV yalnız əsas cədvəli, XLSX bütün vərəqləri yükləyir. Böyümüş12500sətirlik preview export-un57014/HTTP503 timeout-u bundan əvvəl aşkarlanıb. Template/header tema düyməsi də hydration hazır olana qədər disabled-dir.

27-ci migration: manual üzvlük tamamlananda tranzaksiya daxilində bir Realtime outbox hadisəsi yaranır; digər açıq admin sessiyası yeni əməkdaşı görür. Təkrar sorğu ikinci hadisə yaratmır. Export status endpoint-i ağır worker batch-ni sinxron gözləmir; durable cron işləyir. Browser test reporter-i request credential-lərini çıxışdan silir.

28–29-cu migration: export snapshot bir dəfə private 500 sətirlik hissələrə ayrılır; hər download səhifəsi bütün böyük JSON-u yenidən açmır. Chunk-lar current tenant/object/field yoxlamasından keçir və artifact expiry ilə cascade silinir. Eyni 15 min sətirlik cloud artifact üzrə ilk səhifə DB ölçməsi 644,952 ms → 71,677 ms oldu; bu ümumi download P95 deyil. Böyük cloud download təkrar sınaqda keçdi.

30-cu migration və giriş düzəlişi: `login_context()` yalnız cari hesabın active membership/admin MFA/bootstrap uyğunluğu bayraqlarını oxuyur, giriş hüququ vermir. İlk adminin TOTP təsdiqindən sonra claim və CRM keçidi avtomatikdir. Təsdiqlənmiş sessiyada boş login forması göstərilmir; pending istifadəçinin ayrıca ekranı var. Yarımçıq TOTP qurulması verified faktorları silmədən yenilənir. Videoda MFA uğurlu idi, amma hesab hələ ilk admin kimi aktivləşməmişdi.

## Son yoxlamalar

- PostgreSQL **41/41**, 30 migration: `.local/db-30.log`; manual provision saga, current admin/MFA, user_metadata spoof deny, same request/reopened form retry, tenant isolation, password payload rejection.
- Vitest **9/9**: `.local/unit-22.log`; sonrakı app dəyişiklikləri parser/pul unit funksiyalarını dəyişməyib.
- Tam lokal production-server Playwright **14/14, 2,7 dəqiqə**: `.local/e2e-final.log` (23 migration). Son mobil/export düzəlişindən sonra təsirlənən **2/2**: `.local/e2e-24.log`.
- Preview-5 **13/13**; preview-6 **12/14**, mobil erkən klik və bir export endirməsi uğursuz. Export təkrarında keçib; mobil readiness guard və UUID lookup düzəlişi əlavə edilib. **Preview-7 tam14/14, 4,3dəqiqə keçib** (`.local/preview-e2e-7.log`).
- Son `pnpm build` və `pnpm typecheck` keçib. `pnpm lint`: **0 error, 2 warning** — auth/MFA sərhədində qəsdən hard navigation. `.local/build-30.log`, `.local/type-30.log`, `.local/lint-30.log`.
- Production və preview security advisor hərəsində **1 WARN**: Free planda leaked-password protection yoxdur. HIBP Pro tələb edir, ödənişli upgrade edilməyib. Performance: production66/preview26 unused-index INFO; WARN/ERROR yoxdur.
- Yük/Realtime/LCP və restore rəqəmləri [test-results](test-results.md)-də; [AC-01–76 matrisi](acceptance-matrix.md) sübutları və əhatə sərhədlərini göstərir.

- Preview-11 manual əməkdaş create/login/tenant/retry və ikinci admin Realtime keçib (20,7 saniyə); black theme/reload/portal/mobile icons keçib (4,5 saniyə). Son təkrar CRM/To Do/Realtime 27,9 saniyə, 2500 import 30,4 saniyə keçib. Cloud mutation-dan ekrana 6,119 saniyəlik tək müşahidə də var; performans SLA-sı iddia edilmir.

- Hobby production build READY, 21 saniyə; faktiki əsas ünvan HTTP200. Production smoke 6/6: desktop/mobile login, anonim API401/redirect, real admin parol girişi və düzgün production Supabase hostu, aktivləşdirmə girişi. `.local/production-smoke.json`; yeni deployment error log sorğusunda 0 runtime xəta. Tam funksional suite production-da təkrarlanmayıb; preview sübutları yuxarıdadır.

- Giriş loop düzəlişi: lokal 5/5 (`.local/e2e-30.log`) və preview-12 5/5 (`.local/preview-e2e-12.log`): CRM/To Do/Realtime, manual əməkdaş, black theme, yarımçıq enrollment→yanlış/doğru TOTP→auto bootstrap→refresh→yenidən login, pending səhifəsi.

## Backup və admin

Şifrəli DB+Storage baytları+app Vault backup-u hazırdır; production əl ilə və LaunchAgent ilə həqiqətən işləyib. `com.apma.crm.backup`, gündəlik05:15 və login, private `~/Library/Application Support/APMA CRM Backup`. Mac/Docker/giriş bağlıdırsa24saat RPO təmin olunmur. Offline açar nüsxəsi istifadəçi tərəfindən qorunmalıdır. Dolu cloud preview snapshot-u ayrı lokal restore stack-də DB/StorageSHA256/Vault/2tenantRLS/worker replay ilə bərpa edilib; Son24migration məşqi keçib:4Storage faylı,17,872s bərpa,156,007s decrypt/schema/reset/verify daxil prosedur. Production admin Auth hesabı var. İstifadəçinin 12:24 ekran şəklində APMA iş sahəsi açıqdır; bu UI işi zamanı real iş məlumatları dəyişdirilməyib və admin claim DB-də yenidən yoxlanmayıb.

İstifadəçinin birbaşa göstərişi ilə admin Auth hesabı artıq yaradılıb və parolla giriş yoxlanıb. Parol repo/loga yazılmayıb. Mövcud hesab üçün `scripts/activate-admin.ts`-i yenidən işlətməyin. Login→Authenticator kodu istifadəçinin öz cihazına aiddir; sonrakı admin claim/CRM keçidi avtomatikdir. Mövcud AAL2 sessiyası üçün bir «İlk admini aktivləşdir» düyməsi qalır. Təlimat [runbook](runbook.md)-dadır.

## Davam nöqtəsi

09.09 ümumi admin panel production-a yerləşdirildi: `/workspace/admin` girişində müraciət queue-su, ümumi/email link siyahısı, 1/7/30 gün, kopyalama, yeniləmə/ləğv və audit var. Köhnə Userlər → Dəvət keçidi pəncərəsinə də birbaşa **Kopyala** düyməsi əlavə edildi. 33-cü migration köhnəlmiş versiyanı retry edilən DB serializasiya xətası kimi deyil, HTTP409 kimi qaytarır; aylıq müqavilə pəncərəsi ən son müqavilə versiyasını istifadə edir. Lokal DB 41/41 və admin DB 10/10, preview-17-də köhnə dəvət/kopyalama və aylıq axın 2/2, yeni admin panel/Reatime/mobil axın 2/2 keçib. Production-4 əsas alias-a bağlıdır. S14 üzrə global qeydiyyat kataloqu açılmır; müraciət agentlik linki ilə bağlanır.

09.09 qutu yaratma axını genişləndirildi: admin qutunu yaradarkən siyahıda olmayan müəssisəni bazaya əlavə edə, qutunun ümumi cavabdehini, vasitəçini və bir neçə işi (məsələn Çəkiliş, Edit, Meta Manager) fərqli əməkdaşlara təyin edə bilir. Hər təyinat həmin əməkdaşın To Do görünüşünə düşür. Vasitəçi qutuya, tarixçəyə və “Ortaq sifarişlər” To Do görünüşünə giriş alır; iş, qiymət və ödəniş dəyişmək hüququ almır. Müəssisənin manual yaradılması yalnız adminə açıqdır; bulk məlumat üçün Excel importu qalır. Lokal DB 42/42, admin DB 10/10 və yeni browser ssenarisi 1/1; preview-19-da eyni ssenari 1/1 keçib. Production-6 əsas alias-a bağlıdır. Komissiya/maliyyə hesablaması v1-də qurulmayıb.

Son tələb tamamlandı: topbar “Canlı”, axtarış və filtr üslubu `5fc451f` ilə preview-13-də yoxlanıb, production-3 READY və əsas alias-a yerləşdirilib. Lokal/preview hərəsində7 UI yoxlaması; public production loginHTTP200 və yeni CSS-in əsas ünvandan gəldiyi təsdiqlənib (`.local/ui31-production-smoke.json`). Bu dəyişiklikdə production-da MFA keçərək iş sahəsi brauzer yoxlaması aparılmayıb; funksional vizual yoxlama preview-dədir. İstifadəçinin 12:24 screenshot-u artıq APMA iş sahəsini göstərir.

1. Giriş dövrəsi düzəldilib və production-2-yə yerləşdirilib: `ea25826`, 30 migration. Lokal 5/5 və preview-12 5/5 təsirlənən ssenari keçib; production real admin parol girişi→yalnız MFA addımı→refresh üçün 4/4 smoke keçib. İstifadəçinin cari TOTP kodu daxil edilməyib, onun admin claim tamamlanması hələ ayrıca təsdiqlənməyib. Əvvəlki geniş suite nəticələri test-results.md-də saxlanır.
2. Backup runtime 30 migration ilə yenilənib; avtomatik şifrəli backup 08:14:23 UTC-də verified=true, 32,327 saniyə, 0 Storage obyekti ilə tamamlanıb. Son full restore 24 migration, 06:35:39 UTC-dir; stack dayandırılıb. Sonrakı schema üçün full restore iddia edilmir. Generated error-context report-ları təmizlənib; məxfi məlumatı olmayan yekun loglar `.local`-da saxlanır.
3. İstifadəçi Vercel Pro-nu hələlik istəmir. Hobby və Supabase Free saxlanılıb; ödənişli plan alınmayıb. Bu seçimi təkrar təsdiqlətməyin. Hobby kommersiya məhdudiyyəti əvvəl izah edilib; yerləşdirmə həmin qaydanın dəyişməsi və ya xərc/sürət zəmanəti deyil.
4. Seçilmiş Vercel layihəsində production env ilə build/deploy tamamlanıb. Faktiki ünvan yuxarıdadır. İlk admin `apmaglobe@gmail.com` ilə daxil olub öz cihazında cari Authenticator kodunu təsdiqləyir; claim və CRM-ə keçid avtomatikdir. Əməkdaşlar Userlər → Əməkdaş əlavə et ilə emailsiz yaradılır.
5. Real Excel/logo da istifadəçi tərəfindən təxirə salınıb; email və xəritə də deferred qalır. Manual əməkdaş onboarding-i SMTP-dən asılı deyil. Bunları hazır göstərmə. AC matrisində ayrıca yoxlanmamış variasiyaları universal keçdi sayma.

## Lokal davam

14.09 qutu və xəritə axını yeniləndi: satış qutusu müəssisə seçilmədən draft kimi yaradıla bilir; sifariş təsdiqinə keçiddə mövcud `CONFIRMATION_FIELDS_REQUIRED` qaydası müəssisə, qiymət və deadline-ları yenə məcburi saxlayır. Mövcud müəssisə ilə qutu yaradan qeyri-admin əməkdaş üçün DB sınağı keçib. Adminlər Map-də yeni məkan əlavə edə, pin popup-u və siyahıdan məkanı düzəldə, silmədə isə qeydi arxivləyə bilir. Lokal 44 DB ssenarisi, lint və build keçib; migration production Supabase-ə tətbiq olunub. Production deployment `dpl_7NbwjYRX1nc6ri4uwyY4paUa4NBr` READY, əsas login URL HTTP 200-dir.

10.09 dəvət müraciəti bildirişi düzəldildi: ümumi qoşulma və emailə bağlı fərdi dəvət qəbul ediləndə hər aktiv admin üçün tenant-izolyasiyalı in-app bildiriş yaranır. Açıq admin panel mövcud Realtime invalidation ilə müraciət siyahısını yeniləyir və yeni pending müraciət artdıqda ekranda təsdiq mesajı göstərir. Lokal migration tətbiq edilib; admin access DB yoxlaması 10/10, typecheck və build keçib. Migration production Supabase-ə tətbiq olunub, Vercel deployment `dpl_AXp3ZkC8sNtzxPeT6Ese9XyHjP1a` READY-dir; əsas URL `/login` HTTP 200 cavab verir.

14.09 Google giriş başlanğıcı əlavə edildi: login və qeydiyyat ekranlarında “Google ilə davam et” düyməsi Supabase OAuth/PKCE callback (`/auth/callback`) axınını başladır. OAuth hesabı aktiv üzvlüyə sahib deyilsə, mövcud pending üzvlük yoxlamasından keçir; heç bir Google hesabına avtomatik tenant girişi verilmir. Typecheck və production build keçib; `dpl_9kAnsVaRjC4fshgY11pidFoxB46F` READY olaraq production-a yerləşdirilib, canlı login ekranında düymə görünüb. Google Cloud OAuth client ID/secret və Supabase Google provider konfiqurasiyası olmadan real Google consent sınağı aparılmayıb.

PATH: `/opt/homebrew/bin:/Users/rafaelaghazade/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`. Colima `apma-crm`, Docker `~/.colima/apma-crm/docker.sock`; lokal API54321/DB54322/Next3000. Restore API55321/DB55322. Build ilə server eyni `.next`-ə paralel yazmamalıdır. `.env.local` yalnız lokal bazadır. `.local/fixture.json`, `.local/preview-fixture.json`, cloud-connection və backup key ignored/private-dir; çıxışa verməyin.

14.09 Google OAuth provider: ayrıca Google Cloud OAuth web client yaradıldı; production origin `https://apma-crm.vercel.app` və Supabase callback-i konfiqurasiya edildi. Client secret yalnız sistem clipboard-dan birbaşa Supabase Auth provider-ə ötürüldü, repo və status sənədində saxlanılmadı. Supabase Management API provider aktivləşməsini HTTP 200 ilə qəbul etdi. Google tətbiqi hələ Google-un test-user rejimindədir; faktiki Google hesabı ilə consent/membership axını ayrıca brauzer yoxlaması gözləyir. Login UI artıq provider əlçatan olmadıqda xam JSON səhifəsinə keçmək əvəzinə öz xəta mesajını göstərəcək.
