# Agentlik CRM — layihə qaydaları

## Cari vəziyyət və səlahiyyət

Paket v1.0 üçün yekundur. Bu repo hələ planlaşdırma mərhələsindədir; tətbiqi yalnız istifadəçi qurulma tapşırığı verəndə implementasiya et. Bu fayl təkbaşına qurulma əmri deyil.

Əvvəl README.md və docs/06-suallar-ve-qerarlar.md, sonra cari mərhələnin sənədlərini oxu. D01–D56 birbaşa istifadəçi qərarıdır. Son göstəriş D57 ilə qalan seçimləri assistentə həvalə edib; S01–S33 docs/07-yekun-suallar-ve-cavablar.md-də v1 üçün seçilib. Onları yenidən istifadəçidən təsdiqlətmə. Yeni göstəriş üstün sayılır; böyük biznes ziddiyyəti yaranarsa konkretləşdir, adi texniki seçimlərə görə müsahibəni yenidən başlatma.

İstifadəçi ilə Azərbaycan dilində, sadə izahla danış. Lazım olan sualları 1, 2, 3 formatında qısa ver; hesab/fayl rekvizitlərini uydurma. Mövcud bağlı alət və repo konfiqurasiyasını əvvəl yoxla. Secretləri chat/repo/loga yazma.

V1 qurulma əmri M1–M6-nı əhatə edir; istifadəçi ayrıca mərhələ ilə məhdudlaşdırmayıbsa M1 və ya statik demo ilə dayanma. Bütün 12 modulun işlək axınlarını tamamla. M7 gələcək məhsul işidir. Müstəqil lokal işi çatışmayan xarici hesab/fayla görə saxlama. Xərc/production/DNS əməliyyatında mövcud istifadəçi səlahiyyətini əsas götür, eyni icazəni təkrar istəmə.

## Məcburi mühəndislik qaydaları

- Supabase backend, Vercel tətbiq yerləşdirməsi, Next.js/React/TS modul monolit. 15 əməkdaş, 2 500 müəssisə, aylıq 100 AZN-dək əlavə infrastruktur hədəfi; gələcək çox agentlikli təməl.
- Tenant, active membership, departament, obyekt, field və export icazələrini DB/serverdə qoru. View/RPC/Realtime/cache/storage/audit eyni sərhədi saxlayır; UI gizlətməsi kifayət deyil.
- Bir əməkdaş çox departamentdə ola bilər. Ayrı qutuya iş təyinatı yalnız həmin qutuya giriş verir. Təyinat mənbələrini izləyib ləğvdə digər qüvvədə olan hüquqları saxla.
- Qutunun creator, overall accountable, iş assignee-si və participants ayrı anlayışlardır. Qutunu/cavabdehi admin, creator, hazırkı overall accountable dəyişir. Adi iştirakçı ümumi redaktor deyil. Manual ilkin owner creator, webhook owner seçilmiş aktiv admin; retry sonradan dəyişən owner-i reset etmir.
- Dinamik rol adına görə hüquq yoxlama; sistem admini trusted məlumatdır. Fərdi allow/deny rol şablonunu əvəz edir, inherit roldan gəlir. Son aktiv admin və cross-tenant assignment qorunur.
- Müəssisə bazası agentlik komandasına görünür. Yeni müəssisə Excel importundan; import/düzəliş/pin adminə aiddir. Map read CRM/maliyyə/export hüququ deyil. Unknown webhook müəssisəsi intake-də qalır.
- To Do CRM-in eyni iş/tapşırıq qeydlərini göstərir. İlkin filtr öz işləri, ayrıca ortaq sifariş görünüşü, admin komanda görünüşüdür. Sifarişsiz task yaratma yoxdur. İş assignee-si yalnız öz statusunu dəyişir; ümumi owner bütün alt işlərə assignee sayılmır.
- Bir qutu çox departamentli işlərdən ibarətdir. Departament iş sətrindədir; kataloq/snapshot, ayrıca cavabdeh, qiymət və due_at var. Total aktiv iş qiymətlərinin cəmidir; manual total/endirim/mənfi iş qiyməti yoxdur. NULL və sıfır ayrıdır.
- Təsdiqdə və sonrakı mərhələlərdə müştəri, aktiv iş/assignee/department/qiymət/iş deadline-ları və ümumi deadline məcburidir. Alternativ API/import və geriyə keçid qaydanı keçmir.
- Datetime UTC saxlanır, Asia/Baku ilə işlənir. Child deadline parent-i keçmir; iki istiqamətdə və paralel yazmada yoxlanır. Tarix düzəlişi səbəb/auditlədir; səssiz kəsmə/uzatma etmə.
- İş qiymətini admin və ya commercials.write olan creator/current overall accountable dəyişir. Təsdiqdən sonra reason və bir financial delta adjustment; payment bölgüsünə toxunan azalma yalnız admin reconciliation ilədir.
- Balans finance.read veriləndə bütün tenant üçün açılır, default bağlıdır. commercials.read ayrı, ilkin görünən qutularda açıqdır. Creator finance.read bağlı olsa da öz qutusunun tək payment-ni daxil/düzəldə bilər. Overall owner olmaq payment hüququ vermir. Multi-order/avans/refund/sifarişsiz xərc adminə aiddir.
- Birdəfəlik alacaq təsdiqdə bir dəfə, aylıq alacaq contract_period mənbəyindən bir dəfə yaranır. Təhvil/status faktiki pul deyil. Maliyyə document-ləri silinmir, reversal/linked adjustment saxlanır; allocation limitləri atomikdir.
- Yeni müştəri 8 satış mərhələsidir. Dövri 3 iş mərhələsi + Ödəniş olunmayıb görünüşüdür. İş icrası payment alert altında davam edə bilər. Due gün bitib 2*P<C olduqda unpaid görünür; >=50% current work stage-ə döndərir, borcu bağlamır. C=0 payment tələb etmir; NULL hazır məbləğ deyil.
- Aylıq qutu/iş/alacaq avtomatik, period/template snapshot üzrə unikaldır. İlk dövr seçilmiş ödəniş tarixindədir, faktiki cash tarixində deyil. Billing day qısa ayda last-day olur, növbəti ay ilkin günə dönür. Parent initial deadline period_end-dən əvvəlki gün 23:59.
- Recurring yaradılma system source-dur, yaradan hüquqları hələlik admindədir. Template version/retry/deactivated assignee/error lease izlənir. Keçmiş ay yeni ayla overwrite edilmir.
- proration_policy=none: başlamış dövrün haqqı stop ilə dəyişmir; sonrakı dövrlər yaranmır. Admin reason ilə ayrıca düzəliş edə bilər. Bu S01 assistent seçimi olub “sayılmır” cavabının təfsiri kimi təqdim edilmir.
- Satış delivered açıq işlə mümkündür. Dövri recurring_done açıq işlə yalnız nonblank səbəb + açıq ID snapshot-u ilədir. Açıq işlər To Do/overdue-dan çıxmır. Payment display dönüşü yeni Bitdi/Portfel hadisəsi yaratmır.
- Lost səbəbi məcburi, qeyd optional; reopen səbəbli; maliyyə ləğvi ayrıca. Sales Portfel bir qutu/bir kart, monthly Portfel şirkətin unikal dövr intervallarıdır; overlap/future/gap günlərini şişirtmə. Reopen contribution inaktiv, re-done eyni contribution bərpasıdır.
- Chat məzmunu yalnız conversation üzvlərinədir; admin sırf roluna görə şəxsi mesajları oxumur. Tools rezervasiya/checkout capacity atomikdir; vaxtı keçmiş qaytarılmamış vahid boş sayılmır.
- V1 Drive/Gmail linkləri, daxili Meet təqvimi, in-app iş bildirişləri; Auth custom SMTP həqiqətən konfiqurasiya edilir. Sonraya saxlanmış API-lərə saxta connected statusu yazma.
- Hər kritik status/payment/audit/outbox əməliyyatında tranzaksiya, biznes mənbə idempotency və version/konflikt yoxlaması var. Cron işin davamlı növbəsini oyadır; background RAM promise-ə etibar etmə.
- Migrations, lockfile, modul sərhədləri və sabit semantic code-lar istifadə et. Mövcud istifadəçi işini qoru; əvvəlki planning-v0.11-original.zip aktiv spesifikasiya deyil.
- Supabase/Vercel/Google/runtime/plan məlumatını qurulmada rəsmi mənbə ilə yoxla. Platforma project ID, DNS, deployment URL və “test passed” nəticəsi uydurma.

## Yoxlama və hesabat

docs/05-merheleler-ve-qebul.md AC-01–76 meyarları əsasdır. Schema/RLS, iki tenant, çox-departament, dar payment hüququ, permission revocation, zero/NULL, deadline, retry, allocation/price concurrency, chat privacy və mobile flows yoxlanır. Ölçülməmiş performansı nəticə kimi göstərmə.

Hazırda kod yoxdur və lint/build/test əmri mövcud deyil. Kod yarananda real əmrləri README-yə yaz, mərhələyə uyğun yoxlamaları icra et. Gündəlik baza backup-u Storage obyektlərinin backup-u deyil; canlıdan əvvəl restore sınağı apar.

Finalda işlək nəticəni, həqiqətən icra olunmuş yoxlamaları, fayl keçidlərini və qalan real konfiqurasiya/limitləri ver. Sənəd paketinin yoxlanması tətbiqin işləməsi iddiası deyil.
