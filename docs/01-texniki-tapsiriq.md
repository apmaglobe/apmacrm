# Agentlik CRM — texniki tapşırıq

Versiya: 1.0 · 08.09.2026 · Qurulmaya hazır spesifikasiya; tətbiq hələ implementasiya edilməyib.

Əsas mənbələr: istifadəçinin D01–D56 qərarları [jurnalda](06-suallar-ve-qerarlar.md), delegasiya əsasında seçilən S01–S33 qaydaları [yekun sual–cavabda](07-yekun-suallar-ve-cavablar.md). Yeni istifadəçi göstərişi bunlardan üstündür. Bu sənəd v1-in funksional əhatəsidir; canlı hesab identifikatorları ayrıca konfiqurasiyadır.

## Məqsəd və terminlər

Rəqəmsal agentliyin satış, icra, komanda, resurs, material və pul axınlarını bir sistemdə toplamaq. İlk komanda 15 əməkdaş, baza təxminən 2 500 müəssisədir. Gələcəkdə başqa agentliklərə satıla bilən quruluş başlanğıcdan nəzərdə tutulur.

| Termin | Mənası |
| --- | --- |
| Agentlik / tenant | Məlumatları digər agentliklərdən ayrılan iş sahəsi |
| Müəssisə | Excel-dən əlavə edilən sifarişçi; əlaqə şəxsləri və filialları ola bilər |
| Qutu | Lead/sifariş və ya konkret aylıq dövrün icra qeydi |
| Qutu yaradanı | Əl ilə qutunu yaradan dəyişməz şəxs; sistem mənbəyi ayrıca |
| Ümumi cavabdeh | Qutunu koordinasiya edən cari şəxs |
| İş cavabdehi | Konkret xidmət/işi icra edən şəxs |
| İştirakçı | Qutuda işə cəlb edilmiş əməkdaş; təkbaşına ümumi redaktor deyil |
| İş / xidmət sətri | Departamenti, qiyməti, cavabdehi və deadline-ı olan icra vahidi |
| Alt tapşırıq | Qutuya, istəyə bağlı işə bağlı icra addımı |
| Alacaq / borc | Müştəridən alınmalı / agentliyin ödəməli olduğu öhdəlik |
| Ödəniş / bölgü | Faktiki pul qeydi / həmin pulun konkret öhdəliyə ayrılmış hissəsi |

## NAV-01 — menyu və UI

Desktop menyu mərkəzdə; telefonda bütün bölmələri açan menyu paneli. İlk görünüş minimalist, açıq tema, bir vurğu rəngi, sadə tünd tema seçimi. Logo qurulmada əlavə edilir; gəlməyibsə dəyişdirilə bilən APMA CRM mətn nişanı. Ağır fon videosu və davamlı animasiya yoxdur.

| Sıra | Bölmə | Alt bölmə / məqsəd |
| --- | --- | --- |
| 1 | CRM | Yeni müştəri və Dövri qıfları |
| 2 | Map | Bakı xəritəsi, müəssisə və filial siyahısı |
| 3 | Tools | Kamera, GPT, Higgsfield və digər fiziki/rəqəmsal resurslar |
| 4 | Balans | Alacaq, alınmış pul, çıxış və agentliyin borcları |
| 5 | Inbox | Bildiriş, şəxsi və qrup mesajları |
| 6 | Overview | Satış, icra, yük və icazəli maliyyə statistikası |
| 7 | Portfel | Birdəfəlik işlər və şirkətin aylıq xidmət xülasəsi |
| 8 | Drive | Qutulardakı layihə/media linklərinin ümumi görünüşü |
| 9 | Aylıq Abonentlər | Development → Məhsul/Xidmət; Marketing → Aylıq xidmət/Tək çəkiliş |
| 10 | Meetlər | Əyani / Online |
| 11 | Userlər | Komanda profili, bacarıq və fəaliyyət |
| 12 | To Do | İş siyahısı, altında təqvim |

Kateqoriya billing_interval-ı müəyyən etmir: Məhsul/Tək çəkiliş avtomatik aylıq borc yaratmır. Cədvəllərdə telefon üçün kart görünüşü, modalda tam ekran paneli, ən azı 44 px toxunma hədəfi, klaviatura idarəsi və aydın fokus vəziyyəti olsun. Səhifənin boş, yüklənmə, xəta və icazəsiz vəziyyətləri hazırlanır. Klikdən sonra saxlanma/konflikt nəticəsi görünür.

## CRM-01 — iki qıf, iki görünüş

Yeni müştəri satış qıfı:
1. Zəng ediləcək — to_call
2. Zəng edilib — called
3. Təklif göndərildi / edildi — proposal_sent
4. Görüşülüb — met
5. Sifariş təsdiqlənib — confirmed
6. İcradadır — in_progress
7. Təhvil verilib — delivered
8. Deal Lost — lost

Dövri qıfında dörd görünən sütun var: Ödəniş olunmayıb, İcra olunacaq, İcrada, Bitdi. Son üçü icra mərhələsidir; ödəniş sütunu ayrıca maliyyə xəbərdarlığının görünüşüdür.

Hər iki qıf Kanban və siyahı görünüşünü dəstəkləyir. Sütunların hündürlüyü ekran daxilində məhduddur və daxili scroll-u var; çox qutu bütün səhifəni uzatmır. Sütun üzrə cursor pagination, ilkin 30 kart, server filtrləri/axtarış; list və saylar eyni filtri tətbiq edir. Sürükləmə ilə yanaşı mərhələ menyusu var. Filtrlər departament, cavabdeh, iştirakçı, müştəri, tarix, gecikmə və mərhələni əhatə edir.

## CRM-02 — hüquqlar

Əməkdaş üzv olduğu departamentlərin bütün qutularını görür. Departamentlər qutunun aktiv iş sətirlərindən alınır; bir qutu bir neçə departamentə aid ola bilər. Başqa departament qutusuna iş/tapşırıq təyinatı həmin qutuya əlavə giriş verir, bütün departamenti açmır.

Qutunu və ümumi cavabdehi admin, yaradan və hazırkı ümumi cavabdeh dəyişir. İştirakçı və iş cavabdehi bu səbəbdən ümumi redaktor olmur. İş cavabdehi yalnız öz iş statusunu yeniləyə bilər; öz status endpoint-i qiymət, təyinat, departament və deadline qəbul etmir.

Rollar və fərdi icazələr paneldədir. Səlahiyyət görünən rol adına əsaslanmır. Agentlik admini yalnız öz agentliyində ümumi hüquqa malikdir. Təyinat ləğv ediləndə başqa qüvvədə olan giriş əsasları qalır; heç biri qalmırsa server/keş/Realtime girişi bağlanır.

## CRM-03 — yaratma və qutu məlumatı

Əl ilə yaradılmada müəssisə Excel bazasından seçilir və departamenti məlum ən azı bir iş əlavə olunur. Ümumi cavabdeh yaradan olur; hər işin ilkin cavabdehi də yaradanla doldurulur, qutu redaktoru bunu dəyişə bilər. Qutu adı boşdursa CRM-YYYY-000001 seriyası göstərilir; seriya hər il agentlik üzrə atomik ayrılır.

Qutu: ad/seriya, sifarişçi/filial, mənbə, işlər, ümumi cavabdeh, iştirakçılar, ümumi deadline, işlərdən hesablanan danışılmış qiymət. Yaradıcı, ümumi cavabdeh və iş cavabdehləri ayrı saxlanır. İştirakçılara uğurlu yaradılma/təyinatdan sonra bildiriş gəlir.

Webhook lead-inin ilkin cavabdehi həmin agentliyin seçilmiş aktiv adminidir. Mənbə sistemdir; insan yaradıcısı saxtalaşdırılmır. Bazada olmayan müəssisənin əlaqə məlumatı intake/lead-də saxlanır və sonra Excel müəssisəsinə bağlanır; Map-də avtomatik yeni müəssisə yaranmır. Retry qutunu çoxaltmır və sonradan dəyişən cavabdehi geri qaytarmır.

## CRM-04 — qutunun içi

Ümumi məlumat, xidmət/işlər və alt tapşırıqlar, iştirakçılar, rəylər, mention, fəaliyyət tarixçəsi, material/linklər, görüşlər və icazəli maliyyə məlumatı. Auditdə actor/source, vaxt, əvvəlki/yeni dəyər və səbəb olur. Məxfi qiymət və ödəniş məlumatı rəy/audit/Realtime vasitəsilə sızmır. İştirakçı bildirimi bağlı qutuya gizli giriş yaratmır.

Əməkdaşın departament qutusunu görməsi avtomatik olaraq onun bütün tapşırıq detallarına baxış deyil. Öz işləri və iştirak etdiyi sifariş işləri To Do/qutu detalı/profil/təqvim/API-də eyni hüquqla açılır.

## CRM-05 — mərhələ keçidləri

Lead-də qiymət və tarixlər boş qala bilər. Təsdiq və sonrakı mərhələlərə keçiddə müəssisə əlaqəsi, ən azı bir aktiv iş, işlərin departamenti, aktiv cavabdehi, məlum qiyməti və deadline-ı, ümumi deadline məcburidir. API, webhook, import və sürükləmə eyni qaydanı saxlayır; sonrakı mərhələyə birbaşa keçmək təsdiqi keçmir.

Qutu redaktorları eyni qıfda irəli/geri keçə bilər. Təhvildən/Lost-dan geri açılmada səbəb məcburidir. İlk təsdiq/təhvil tarixi hadisə kimi qalır; təkrar təsdiq ikinci əsas alacaq yaratmır. Sifariş əvvəllər təsdiqlənibsə geriyə hərəkətlə qiymət/tarix məlumatı silinmir.

Təhvil üçün bütün işlərin bitməsi məcburi deyil. Qalan işlər avtomatik tamamlanmır və To Do/təqvim/gecikmədən çıxmır. Müştəri təhvil təsdiqi və link istəyə bağlıdır. Dövri Bitdi-də açıq iş/alt tapşırıq varsa tamamlanmama səbəbi mütləq yazılır; bu əlavə səbəb tələbi satış təhvilinə səssiz tətbiq edilmir.

Lost-da aktiv səbəb kataloqundan seçim məcburidir, əlavə qeyd istəyə bağlıdır. İlkin səbəblər S20-dədir. Lost ödənişləri və borcu silmir; maliyyə ləğvi ayrıca admin əməliyyatıdır.

## CRM-06 — xidmət və tapşırıq modeli

Kataloq admin tərəfindən idarə olunur. Hər işdə xidmət snapshot-u, departament, miqdar, həmin sətrin ümumi qiyməti, cavabdeh, status və deadline var. Kataloq dəyişikliyi mövcud sifarişi səssiz dəyişmir. Bir iş/alt tapşırıqda bir cavabdeh, statuslar Ediləcək/İcrada/Bitdi; əlavə iştirakçılar qutuda saxlanır. Alt tapşırıqlar qutuya və istəyə bağlı işə bağlıdır; ikinci hesablanacaq xidmət sayılmır.

Ümumi qiymət aktiv iş qiymətlərinin cəmidir; ayrıca endirim və manual total yoxdur. Bir qiymət NULL-dursa total naməlumdur; heç bir iş də məlum sıfır total sayılmır. Mənfi qiymət yoxdur; sıfır total səbəbli “ödəniş tələb olunmur” vəziyyətidir.

İşin deadline-ı qutu deadline-ını keçmir. Daha gec iş tarixi üçün əvvəl parent uzadılır; parent qısaldılanda da bütün işlər yoxlanır. Tarix+saat, paralel yazma, UTC/Asia-Baku eyni invariantı qoruyur. Keçmiş tarix xəbərdarlıqla saxlanır; sonradan dəyişmədə səbəb və audit var.

Qiymət yazma: admin və ya commercials.write olan qutu yaradanı/hazırkı cavabdehi. Təsdiqdən sonrakı dəyişiklik səbəblədir və alacaq fərq düzəlişi ilə uyğunlaşdırılır (S03). Sadəcə Balans oxuma qiymət yazma hüququ vermir.

## CRM-07 və SUB-01 — aylıq abonent və dövri icra

Müqavilə müəssisə, xidmət tipi, mənbə satış, başlanğıc/son tarix, billing_day, aylıq iş/qiymət/təyinat/tarix şablonu, sənəd linki və status saxlayır. Müqavilələri admin idarə edir. İlk dövr təsdiqdən sonra seçilmiş ödəniş tarixindən başlayır: plan 12-si, pul 15-i olsa da başlanğıc 12-sidir.

billing_day müqavilə üzrə ayrıdır. Həmin gün yoxdursa ayın son günü; ilkin gün yadda qalır: 31 yanvar → 28/29 fevral → 31 mart. Dövr [period_start, period_end) saxlanır. Aylıq qutunun ilkin ümumi deadline-ı növbəti dövr başlanğıcından əvvəlki yerli gün, saat 23:59-dur. İş tarixləri müqavilənin nisbi tarix planından hesablanır.

Hər dövr başlayanda bir qutu, bir iş dəsti və bir əsas alacaq yaranır. Müqavilə şablonunun versiyası/surəti həmin dövrə bağlanır. Yeni dövrə əvvəlki iş statusları, comment/audit və ödənişlər kopyalanmır. Retry yeni versiyaları qarışdırmır və əl ilə edilmiş dəyişiklikləri əvəz etmir. Yanlış deadline/passiv cavabdeh görünən konfiqurasiya xətasıdır; iş bərpa edilə bilir, hazır kimi göstərilmir.

Avtomatik qutunun yaradan hüquqları hələlik admindədir. İlkin satış/müqavilə yaradanına insan created_by hüququ miras verilmir. Ayrıca ümumi cavabdeh normal qutu redaktəsini əldə edə bilər; bu, ödəniş yazma hüququ yaratmır.

Ödənişin son günü yerli 23:59:59-dək keçib xalis dövr alacağının 50%-dən azı ayrılmış faktiki pul ilə ödənibsə qutu Ödəniş olunmayıb sütununda görünür. İcra mərhələsi ayrıca saxlanır və işlər başlana bilər. Hədd tamamlananda qutu saxlanmış cari icra sütununa qayıdır. 1 000 AZN-dən 500 AZN ödənməsi qutu görünüşünü qaytarır; 500 AZN borc qalır. Sıfır xalis alacaq üçün xəbərdarlıq yoxdur. Ödəniş reversal/düzəlişi həddi yenidən hesablayır, iş tarixçəsini silmir.

Bitdi-də açıq iş varsa səbəb, həmin anın açıq iş ID-ləri, müəllif və vaxt keçidlə atomik saxlanır. Ödənişə görə əvvəlki Bitdi görünüşünə dönüş yeni completion deyil. İşlərin tamamlanması qutunu avtomatik tamamlamır.

Son tarixsiz müqavilə dayandırılana qədər davam edir, son tarixlidə avtomatik uzatma yoxdur. Dayandırılma sonrakı dövrləri saxlayır, başlamış dövrün haqqını avtomatik dəyişmir (S01). Qalan işlər yerində qalır. Yenidən başlatma növbəti ilkin billing_day-dan olur; dayandırılmış boşluq üçün borc yaranmır. Şablon/aylıq qiymət dəyişikliyi sonrakı yaranmamış dövrlərə, cari dövr düzəlişi S03-ə tabedir.

## MAP-01 — müəssisələr və Bakı xəritəsi

Excel müəssisə, əlaqə və filial məlumatı mənbəyidir. Bütün aktiv agentlik üzvləri bazanı görür; admin import/düzəliş/pin edə bilər. Bağlı CRM/maliyyə məlumatı ayrıca qorunur. Önbaxış, mapping, sətir xətası və dublikat seçimi var. Filiallar ayrıca məkanlardır. Koordinatsız müəssisə siyahıda qalır, uydurma pin qoyulmur.

Leaflet + Geoapify tile qatı, marker cluster və görünən ərazi üzrə yükləmə. Geoapify hesab açarı və attribution qurulmada konfiqurasiya edilir. Admin əl ilə pin dəqiqləşdirir; kütləvi geocoding v1-də yoxdur. Xəritə açılmasa siyahı işləyir.

## TOOL-01 — resurslar

Kamera və rəqəmsal alətlər: ad, fiziki/rəqəmsal növ, vahid/tutum, aktiv/nasaz status, cari istifadəçi, rezervasiya və götürmə/qaytarma tarixçəsi. Tutum üst-üstə düşən intervallarda atomik qorunur. Əməkdaş öz boş rezervasiyasını/götürmə/qaytarmasını, admin bütün qeydləri idarə edir. Qaytarılmamış avadanlıq yalnız vaxt keçməsi ilə boş sayılmır. Parol/token saxlanmır; GPT/Higgsfield API əməliyyatları v1-də yoxdur.

## FIN-01 — Balans

AZN, iki onluq rəqəm. Alacaq, alınmış pul, agentliyin ödəməli olduğu borc və faktiki çıxış ayrıdır. Birdəfəlik işlər təsdiqdə bir dəfə alacaq yaradır, təhvildə həmin alacağın qalıq məbləği görünür. Aylıq işdə mənbə müqavilə dövrüdür; satış/müqavilə/dövri görünüşləri eyni xidməti təkrar borclandırmır.

Məbləğlər dəyişməz maliyyə sənədləri və səbəbli düzəlişlərdən hesablanır. Qalıq = xalis öhdəlik − etibarlı ayrılmış ödəniş. Pulun artıq hissəsi ayrıca avansdır; mənfi qalıq adı ilə gizlənmir. Hissəli və çox sifarişli ödənişlər S04, qiymət fərqləri S03, refund/sıfır qiymət S23 üzrədir. Mərhələ keçidi faktiki pul yazmır.

Balans yalnız finance.read verilmiş əməkdaşlara bütün agentlik üzrə açılır; default bağlıdır. Bu, başqa departamentin tam CRM qutusunu açmır. commercials.read ayrı olub ilkin olaraq görünən qutularda açıqdır. Ödənişi admin və qutunu yaradan daxil/düzəliş edə bilər; yaradanın Balansı bağlı olsa da öz qutusunda dar hüququ qalır. Çox sifarişli bölgü, avans/refund və sifarişsiz xərcləri admin idarə edir.

Xərc borcları freelancer, təchizatçı, əməkdaş haqqı və ofis xərcləridir. Kassa/bank hesabı və başlanğıc qalıqları S24 üzrə paneldə idarə edilir. Qəbz istəyə bağlı, düzəliş səbəbi məcburidir. V1 vergi, bank API-si və avtomatik əməkhaqqı sistemi deyil. Filtrli XLSX/CSV və hesablaşma çıxarışı var.

## INBOX-01 — bildirişlər və mesajlar

Bildirişin səbəbi, müəllifi, vaxtı, oxunma statusu və icazəli obyektə keçid görünür. İşlər üçün 24 saat/2 saat xatırlatma və adminə gündəlik gecikmə xülasəsi; deadline dəyişəndə köhnə plan ləğv edilir. Yeni təyin olunan əməkdaşa yalnız cari etibarlı bildiriş çatır.

Şəxsi/qrup mətn mesajları, linklər, oxundu vəziyyəti və axtarış; məzmun yalnız söhbət iştirakçılarına görünür. Öz mesajında ilk 15 dəqiqə redaktə/silinmiş işarəsi; edit audit-i qorunan saxlanır. Admin statusu şəxsi chat-a avtomatik giriş vermir. Fayl/səs/video və işlər üçün email/push v1-dən sonradır; Auth emailləri ilk gündən var.

## OVR-01 — statistika

Mərhələ sayları, yeni lead, ilk dəfə qazanılmış satış, cari tamamlanmış sifariş/iş, gecikmiş iş, əməkdaş yükü, aylıq dövr icrası və icazəli alacaq/pul/borc. Satış üçün first_confirmed_at, təhvil hadisəsi üçün delivered_at, faktiki pul üçün payment_date istifadə edilir. Yenidən açılma tarixçəsi saxlanır, təkrar təsdiq yeni satış sayılmır; cari və tarixi göstəricilər etiketlənir.

Filtr dövrünün lead kohortu üzrə konversiya = həmin kohortdan ilk dəfə təsdiqlənmiş qutular / kohort lead sayı; boş məxrəcdə faiz göstərilmir. Dövri qutular yeni lead/qazanılmış satış deyil. Departament məbləği öz iş sətirlərindən hesablanır; ortaq qutu cəmləri şişirtmir. Təhvil qalan işləri gecikmə/yükdən çıxarmır. Bütün saylar oxuyanın icazəli məlumatından hesablanır.

## PORT-01 və DRIVE-01

Satışda təsdiq bir qaralama Portfel kartı yaradır, təhvil eyni kartı tamamlanmış edir; retry çoxaltmır. Yenidən açılma/Lost davranışı S19-dadır. Aylıq dövrlər yeni layihə kartı yaratmır, eyni şirkətin xidmət müddətini S25 üzrə artırır. Açıq işlə Bitdi səbəbi görünür; Portfel statusu bütün alt işlərin bitməsi iddiası deyil. İctimai paylaşım v1-də yoxdur.

Drive ekranı qutu/müştəriyə bağlı resource_links qeydlərini göstərir; eyni link ayrıca kopyalanmır. URL, başlıq, provider, kateqoriya və müəllif saxlanır. HTTPS linklər yoxlanır, server naməlum link məzmununu avtomatik fetch etmir. Google icazələri dəyişdirilmir. Kiçik logo/avatar private Storage-da, böyük media Drive-da qalır.

## MEET-01, USER-01 və TODO-01

Meetlərdə mövzu, qutu/müştəri, start/end, iştirakçılar, məkan/online link, gündəlik və nəticə. Admin bütün görüşləri, əməkdaş iştirak etdiyi və ya görə bildiyi qutuya bağlı görüşü görür; məxfi qeydlər source hüququnu saxlayır. Yaradıcı və admin görüşü dəyişir. Görüş bildirimi daxili, .ics endirmə istəyə bağlıdır.

Userlər: qoşulma tarixi, üzvlük statusu, bacarıqlar və icazəli fəaliyyət popup-u. Tam audit yalnız admin/obyekt hüququ ilə. Register, email təsdiqi, invite/admin approval, login/logout/reset password, MFA və offboarding S14 üzrədir.

To Do ayrıca iş yaradan sistem deyil; Yeni müştəri və Dövri qutularının eyni iş/tapşırıq qeydlərini göstərir. Əsas “Mənim işlərim” siyahısı, altında təqvim; “Ortaq sifarişlər” baxışı və admin komanda filtri var. İşləri qutu redaktorları yaradır/təyin edir, iş cavabdehi öz statusunu dəyişir. Təyinat dəyişəndə iş yeni cavabdehin şəxsi siyahısına keçir; status/tarix kopyası saxlanmır.

## Əhatənin sərhədi

V1 bütün 12 bölməni işlək əsas axınlarla əhatə edir. Tam Google API, müştəri kabineti, ictimai Portfel, SaaS satış/billing, WhatsApp/Meta adapterləri, bank/vergi/əməkhaqqı, kütləvi geocoding və geniş workflow builder sonrakı mərhələdir. Baza buna uyğun modulludur; bu funksiyalar hazır kimi göstərilmir.
