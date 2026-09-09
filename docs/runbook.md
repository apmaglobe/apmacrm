# APMA CRM — işlətmə və bərpa

Əsas ünvan: https://apma-crm.vercel.app — istifadəçinin seçimi ilə Hobby planı saxlanılıb.

Bu təlimat qurulmuş kod üçündür. Bütün qəbul meyarlarının tamamlandığı iddiası deyil; cari boşluqlar implementation-status.md-dədir. İlk admin: apmaglobe@gmail.com.

## İlk adminin təhlükəsiz aktivləşdirilməsi

Email konfiqurasiyası istifadəçinin göstərişi ilə təxirə salınıb. **08.09.2026: apmaglobe@gmail.com Auth hesabı preview və production-da istifadəçinin seçdiyi parolla artıq yaradılıb; giriş yoxlanıb. Mövcud hesab üçün aşağıdakı provisioning scriptini yenidən işlətməyin; 2-ci addımdan başlayın.** Authenticator kodunu istifadəçi öz cihazından daxil edir; yeni axında TOTP-dən sonra bootstrap avtomatik tamamlanır. Yeni/təmiz qurulum üçün:

1. Bu repoda `pnpm exec tsx scripts/activate-admin.ts` işlədin. Script yalnız seçilmiş production ref-ə qoşulur, mövcud private cloud konfiqurasiyasını oxuyur. Parolu gizli terminal sorğusunda iki dəfə özünüz daxil edin; chat-a yazmayın. Script mövcud hesabın parolunu dəyişmir.
2. Faktiki buraxılış URL-sində email/parol ilə daxil olun. Giriş səhifəsində TOTP autentifikatorunu qurun və 6 rəqəmli kodla təsdiqləyin.
3. Yeni girişdə düzgün TOTP kodundan sonra ilk admin avtomatik aktivləşir və CRM açılır. Artıq təsdiqlənmiş sessiyanız varsa «İlk admini aktivləşdir» düyməsi görünür. Server təsdiqlənmiş email, AAL2 və bootstrap allowlist tələb edir. Təkrar əməliyyat ikinci agentlik yaratmır.
4. Şifrəni parol menecerinizdə, TOTP ehtiyatını ayrıca təhlükəsiz yerdə saxlayın. İkinci etibarlı admini istifadə etməyə başlayanda təyin edin. Son aktiv adminin dayandırılması DB tərəfindən bloklanır.

Bu operator provisioning-i yalnız əvvəlcədən seçilmiş hesab sahibinə aiddir. İstifadəçinin son göstərişi manual komanda provisioning-inə də icazə verir. **Userlər → Əməkdaş əlavə et**: ad, email, minimum 10 simvolluq ilkin parol, rol və departamentlər; hesab dərhal active olur, email göndərilmir. Giriş məlumatını əməkdaşa təhlükəsiz özünüz verin. Adi əməkdaş bu əməliyyatı edə bilmir. Mövcud emailin parolu dəyişdirilmir; həmin hesab üçün emailə bağlı dəvət keçidi istifadə olunur. Yarımçıq sorğunu eyni məlumatla yenidən göndərin; fərqli payload eyni işi gizlicə dəyişmir. Email/SMTP hazır olduqda normal qeydiyyat, təsdiq və reset axınını canlıda ayrıca yoxlayın.

## Gündəlik idarəetmə

- Userlər: üzvlük müraciətləri, departament/rol/fərdi icazələr. Sistem admini adi rol adından ayrıdır. Üzvü dayandırmazdan sonra açıq işləri və aylıq şablonları aktiv əməkdaşa təyin edin; tarixçə silinmir.
- CRM: lead-də boş qiymət/tarix mümkündür. Təsdiq üçün müəssisə, aktiv işlər, cavabdeh, qiymət və deadline-lar tamamlanmalıdır. İşi gecikdirmək üçün əvvəl ümumi deadline uyğunlaşdırılır, səbəb yazılır.
- Balans: pul daxil olması status deyil, ayrıca payment-dir. Səhv ödəniş əvəzləmə/reversal ilə düzəldilir. Artıq bölgünü avansa qaytarma və həqiqi refund ayrıdır. Maliyyə sənədlərini SQL ilə silməyin.
- Aylıq Abonentlər: failed dövrlərdə göstərilən səbəbi düzəldin, sonra «Dövrü yoxla». Şablon düzəlişi keçmiş dövrü dəyişmir. Yaranmamış failed dövrdə «İş planını düzəldib bərpa et» ilə aktiv cavabdeh/deadline planını səbəblə düzəldin. Eyni dövr mənbəyi saxlanır, hazır dövrlərə toxunulmur; yeni revision gələcək plan olur. Stop cari dövrün haqqını avtomatik azaltmır.
- Tools: götürülmüş vahid qaytarılana qədər məşğuldur. Nasaz vahidi admin paneldə işarələyin.
- İxrac: yalnız source read və ayrıca export hüququ ilə. Hazır artifact 24 saat saxlanır, endirmədə hüquqlar yenidən yoxlanır. CSV əsas cədvəl, XLSX əlaqəli vərəqlər verir. İxrac hüququ sonradan ləğv ediləndə köhnə artifact sərbəst linkə çevrilmir.

## Fon işləri və webhook

Postgres pg_cron davamlı işi oyadır; Next.js prosesinin RAM-ında saxlanan promise tələb olunmur.

- apma-crm-worker: hər dəqiqə vaxtı çatmış dövr, lead ingress, deadline bildirişləri; tenant lock və mənbə idempotency.
- apma-import-worker: təsdiqlənmiş import batch-ləri; browser bağlandıqda davam. Başlatmış adminin cari aktiv səlahiyyəti yoxlanır.
- apma-export-worker: növbədəki export snapshot-ları və müddəti bitmiş private artifact-lərin təmizlənməsi.
- apma-crm-daily-summary: saat 09:00-dan sonra hər aktiv adminə bir overdue xülasəsi.
- apma-housekeeping: köhnə texniki rate/outbox məlumatı. Maliyyə və biznes auditini silmir.

Webhook Userlər panelində yaradılır. Verilən yeni signing key yalnız məxfi göndərən konfiqurasiyasına köçürülür, Vault-da şifrəli saxlanır. URL-də secret yoxdur. Rotation köhnə açara 5 dəqiqə keçid verir. Body və imza formatı docs/04-inteqrasiyalar.md-dədir. API 202 cavabı qəbulun davamlı bazaya yazılmasıdır; qutu worker işləyəndən sonra yaranır. Failed default admin/departament problemini düzəldib «Yenidən sına» seçin. Eyni external_event_id üçün fərqli payload 409-dur.

## Buraxılış və geri qaytarma

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build`. Build və dev serveri eyni `.next` qovluğuna paralel yazdırmayın.
2. Migration-ları əvvəl lokal boş bazada və ayrıca preview-də yoxlayın. Supabase pluginlə tətbiq olunmuş migration timestamp-ləri CLI fayl timestamp-lərindən fərqlənə bilər; ad/SQL uyğunluğunu yoxlamadan `db push` etməyin. Tarixçəni explicit migration repair ilə uzlaşdırın; keçmiş SQL-i dağıdıcı dəyişməyin.
3. Vercel-də yalnız `apma-crm` layihəsi və `apmaglobe` scope-u. Preview env-ləri `obtlqejryfvcqfsjxeda`, production env-ləri `clysniomfmmxwiozfizt` bazasına aiddir. `.vercelignore` private faylları çıxarır.
4. `pnpm dlx vercel@59.11.7 deploy --target preview --scope apmaglobe`. Faktiki URL-də əsas axınları yoxlayın. Yoxlanmış kodu production env ilə ayrıca `pnpm dlx vercel@59.11.7 deploy --prod --yes --scope apmaglobe` əmri ilə yerləşdirin; preview bazasının env-lərini promote etməyin. Cari production yerləşdirməsi tamamlanıb. İstifadəçi Hobby planını saxlayır; Pro-ya keçməyin.
5. Frontend rollback əvvəlki sağlam deployment-ə aparılır. DB-də destructive rollback yerinə uyğun forward migration; maliyyə/source tarixçəsini geri yazmaq olmaz. Restore daha geniş insident prosedurudur.

## Backup və restore

Hədəf RPO 24 saat, RTO 8 iş saatıdır. Bunlar bütün nasazlıqlar üçün zəmanət deyil. Production DB + Storage baytları + tətbiqin Vault açarları AES-256-GCM ilə şifrələnərək bu Mac-də saxlanır. Bu, Supabase Pro idarə olunan backup-u deyil. `com.apma.crm.backup` LaunchAgent hər gün yerli saat 05:15 və istifadəçi sessiyası açılarkən işləyir. Avtomatik ilk icra həqiqətən keçib (exit 0). Mac, Docker/Colima və Supabase hesab girişi tələb olunur; Mac sönülü və ya giriş bağlıdırsa 24 saat RPO təmin olunmur. Hər gün son uğurun tarixini yoxlayın.

Fon işinin kataloqu: `~/Library/Application Support/APMA CRM Backup`. Şifrəli fayllar oradakı `.local/cloud-backups`, son nəticə `.local/cloud-backup-production-status.json`, son xəta `.local/cloud-backup-production-failure.json`-dadır; tarixləri müqayisə edin. Status payload-u Userlər → Fon işlərinə də yazılır (agentlik aktivləşəndən sonra). 30 günlük surətlər saxlanır, ən yeni 7 surət silinmir.

Bərpa açarı `.local/backup-master.key`-dir: həm repodakı private konfiqurasiyada, həm backup kataloqunda 600 icazəsi ilə saxlanır. Onun bir nüsxəsini öz təhlükəsiz offline yaddaşınıza köçürün. Açar itərsə arxiv açılmır. Faylı chat-a, git-ə və bulud tətbiqinin public hissəsinə yerləşdirməyin.

```sh
pnpm exec tsx scripts/cloud-backup.ts
pnpm exec tsx scripts/cloud-backup.ts --preview
pnpm exec tsx scripts/install-backup-agent.ts
# Son əmr backup kodu, migration və credential dəyişəndə fon nüsxəsini yeniləyir.
# Fon işini dayandırmaq:
launchctl bootout gui/$(id -u)/com.apma.crm.backup
```

Fon işi Desktop-dan asılı deyil, öz private Application Support kataloqundan işləyir. Supabase CLI-nin agent/non-agent JSON format fərqi nəzərə alınıb. Hesab açarı rotasiyasından sonra installer-i yenidən işlədin. Vercel/Supabase ödənişli plana keçid bu scriptlərin işi deyil.

Şifrəli cloud preview arxivi ayrıca lokal target-ə açılıb, DB + Storage + Vault bərpası və iki tenant izolyasiyası yoxlanıb. Son24migration testində4Storage obyekti ilə bərpa mərhələsi17,872s, deşifrə/schema/reset/verify daxil prosedur156,007s çəkib. Production surətində adminin Auth hesabı var; agentlik və real media hələ yoxdur; boş production backup-un özü dolu bazanın sübutu sayılmır.

Lokal məşq mənbəsi 54322-dir; restore scripti yalnız ayrılmış 55322 hədəfini qəbul edir. Production-a səhv restore cəhdi rədd olunur:

```sh
pnpm exec tsx scripts/backup-local.ts
# .local/restore-stack-də eyni migration-larla boş apmacrm_restore Supabase başladılır.
pnpm exec tsx scripts/restore-local.ts
```

Cloud arxivini açmaq üçün `pnpm exec tsx scripts/decrypt-backup.ts .local/cloud-backups/ARXIV.apma .local/backups/YENI-QOVLUQ` istifadə edilir. Açar həmin iş qovluğunun `.local/backup-master.key` faylında olmalıdır. Target-i arxivin `manifest.json`-ındakı migration siyahısı ilə hazırlayın; daha yeni migrationları bərpa yoxlamasından sonra tətbiq edin. Cloud preview fixture üçün `APMA_RESTORE_FIXTURE_FILE=.local/preview-fixture.json pnpm exec tsx scripts/restore-local.ts` işlədilib. Production bərpasında fixture testlərini real/sintetik qəbul hesabları ilə ayrıca uyğunlaşdırın.

Restore script DB məlumatını, ayrıca real Storage baytlarını və SHA-256 manifestini bərpa edir; cron əvvəl bağlı saxlanır. Kritik saylar, iki tenantlı Auth/RLS, maliyyə source unikallığı və fayl hash-ləri yoxlanır. `--resume` yalnız eyni yarımçıq restore hədəfinin davamıdır, yeni/full RTO ölçməsi deyil.

Backup zamanı tətbiq yazmaları dayandırılmalı və ya DB/Storage üçün koordinasiyalı snapshot proseduru olmalıdır; ardıcıl dump+download avtomatik vahid transaction snapshot-u deyil. Backup private qovluqları həssasdır, git/deploy-a daxil edilmir. Production surətlərini tətbiq hesabından ayrı girişlə, şifrəli/offsite saxlayın. Vault root key/secrets bərpası ayrıca tələb olunur; adi public/private DB dump yeni layihədə Vault açarlarını özü bərpa etmir.

İnsident ardıcıllığı: ingress/cron yazmalarını saxla → yeni ayrılmış target → uyğun migration → DB → Storage/Vault → Auth/site/env → RLS/source/payment/hash yoxlaması → read-only smoke → worker/ingress-i kontrollu aç. Real istifadəçi məlumatına çatmadan əvvəl test target-də hər addımı sına.

## Nasazlıq göstəriciləri

- VERSION_CONFLICT: formadakı köhnə məlumatı yeniləyin, səbəbli əməliyyatı təkrar edin; silently overwrite etməyin.
- ACCESS_DENIED / MFA_REQUIRED: cari tenant, active membership və admin TOTP-ni yoxlayın. Browser keşi icazə mənbəyi deyil.
- Realtime «Bağlanır…»: şəbəkə/token və Supabase Realtime statusu. Reconnect bazadan təzə məlumat alır.
- Export/import failed: job metadata və sanitize edilmiş xətanı yoxlayın. Faylı və secretləri loga çıxarmayın.
- Vercel 404: faktiki alias və deployment statusunu oxuyun; nəzərdə tutulan domeni hazır URL kimi verməyin.


## Ümumi admin panel — müraciətlər və linklər

`/workspace/admin` yalnız seçilmiş agentliyin aktiv, TOTP təsdiqli admininə açılır. Desktop-da yuxarı sağdakı **Admin panel**, mobil menyuda **Admin panel** seçin.

1. **Link yarat** → ümumi qoşulma (ad verin) və ya emailə bağlı dəvət → 1/7/30 gün → **Saxla**.
2. Siyahıdan **Kopyala** ilə ünvanı alın və əməkdaşa özünüz göndərin. Avtomatik email göndərilmir.
3. Əməkdaş öz təsdiqlənmiş hesabına daxil olduğu brauzerdə linki açır və **Qoşulma müraciəti** göndərir. Adi qeydiyyat özü agentliyə aid müraciət yaratmır.
4. Müraciət **Qoşulma müraciətləri** hissəsinə gəlir. **Təsdiqlə** əsas üzvlüyü açır; **Rədd et** səbəb tələb edir. Departament/rol/fərdi hüquqlar **Komanda və parametrlər** → əməkdaş → **İdarə et** ilə təyin olunur.
5. Əməkdaş login ekranında **Vəziyyəti yenilə** seçir. Təsdiqlənmiş üzvlüklə CRM-ə daxil ola bilər.

Link vəziyyətləri: Aktiv, Müddəti bitib, Ləğv edilib, İstifadə edilib. Email dəvəti bir hesaba bağlıdır; ümumi link çox əməkdaşın pending müraciətinə imkan verir. Müddətlər UTC saxlanır, tarixlər Bakı vaxtı ilə göstərilir. Ümumi link istifadə sayı bu linkdən qeydə alınmış unikal müraciətlərdir; migration-dan əvvəl mənbəsi bilinməyən müraciətlərə link attribution uydurulmur. Yenilə yeni ünvan yaradır və əvvəlkini bağlayır. Ləğv yeni müraciətləri dayandırır, mövcud üzvlüklərə toxunmur. Artıq istifadə edilmiş email dəvəti yenilənmir; yeni dəvət yaradın.

Tarixçə silinmir. Bir əməkdaş sonradan dayandırıldıqda əvvəlki təsdiq qərarı tarixçədə saxlanır. Müraciət/link filtrləri ünvanın parametrində saxlanır; Realtime yenilənmə seçimi sıfırlamır. Siyahılar 100 sətirlik səhifələrlə yüklənir.

Bu hissənin DB yoxlaması `pnpm test:admin-db`. Sintetik brauzer müraciətçiləri yalnız local/preview üçün `pnpm exec tsx scripts/access-fixture.ts` (preview üçün `APMA_AUTH_TEST_TARGET=preview`) ilə yaradılır. Private fixture yolunu `APMA_ACCESS_FIXTURE_FILE` ilə Playwright-a ötürün; credential faylını açıq paylaşmayın. Production-da fixture yaratmayın.
