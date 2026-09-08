# Suallar və qərar jurnalı

Versiya: 1.0 · 08.09.2026 · Planlaşdırma yekunlaşıb; biznes sualı qalmayıb.

D01–D56 istifadəçinin birbaşa cavabları, D57 qalan seçimləri assistentə həvalə etməsidir. [S01–S33 sual–cavabları](07-yekun-suallar-ve-cavablar.md) həmin səlahiyyətlə seçilib və v1 üçün qüvvədədir. Onlar istifadəçinin hər birinə ayrıca “bəli” dediyi kimi təqdim olunmur. Yeni müsahibə başlatma; real hesab/fayl məlumatı [təhvil sənədinə](08-qurulma-tehvil.md) görə əldə edilir.

## Birbaşa qərarlar

| ID | Qərar | Mənbə / v1 qeydi |
| --- | --- | --- |
| D01 | Supabase backend, Vercel yerləşdirmə | İlkin istifadəçi tapşırığı |
| D02 | Sonradan başqa agentliklərə satılacaq | İstifadəçinin birbaşa seçimi; tenant izolyasiyası başlanğıcdan |
| D03 | İlkin komanda: təxminən 15 əməkdaş | “15” cavabı əməkdaş sayı kimi şərh edilib |
| D04 | Təxminən 2 500 müəssisə, mətn ünvanı və koordinatlar | İstifadəçinin birbaşa cavabı |
| D05 | Aylıq infrastruktur büdcəsi 100 AZN-dək | Domen/hostinqdən əlavə soruşulan məbləğ |
| D06 | Əməkdaş öz departamentinin bütün CRM qutularını görür | İstifadəçinin birbaşa seçimi; çox departament və ayrıca qutuya giriş D52 ilə tamamlanıb |
| D07 | To Do: admin hamını, əməkdaş öz və ortaq sifarişin işlərini görür | İlkin istifadəçi tapşırığı; D54 işlərin CRM-dən yaranmasını və əsas siyahıda öz adına təyinatları dəqiqləşdirir, ortaq sifarişə baxışı açıq şəkildə ləğv etmir |
| D08 | Gmail ilk versiyada yalnız keçiddir, tam inteqrasiya sonra | İstifadəçinin birbaşa seçimi |
| D09 | Qutu qiyməti ilkin olaraq əməkdaşlara açıqdır və paneldən məhdudlaşdırılır | Əvvəlki cavabın qiymət hissəsi qüvvədədir; Balans hissəsini sonrakı D18 əvəz edib |
| D10 | Agentliyə qoşulma dəvət linki və ya admin təsdiqi ilədir | İstifadəçinin birbaşa seçimi |
| D11 | Satış qıfında Portfel: təsdiqdə qaralama, təhvildə tamamlanmış iş | İstifadəçinin birbaşa seçimi; aylıq xidmətin şirkət üzrə müddət artımı D50-dədir |
| D12 | Deadline yaradılarkən ötürülə bilər, sifariş təsdiqində mütləqdir | İlkin istifadəçi tapşırığı |
| D13 | Mərkəzlənmiş menyu, 12 əsas bölmə, responsiv və minimalist UI | İlkin istifadəçi tapşırığı |
| D14 | Logo qurulma əmri veriləndə fayl kimi gələcək | İlkin istifadəçi tapşırığı |
| D15 | Excel import/ixrac, şərh, audit, iştirakçı bildirişi, webhook, genişlənmə | İlkin istifadəçi tapşırığı |
| D16 | Qutunu yaradan və hazırkı cavabdeh şəxs redaktə edir; sırf iştirakçı olmaq kifayət deyil | İstifadəçinin son cavabı; admin istisnası D20-dədir |
| D17 | İcazələr həm rol, həm konkret əməkdaş üzrə idarə olunur | İstifadəçi: “Hər ikisi üzrə” |
| D18 | Balans yalnız icazə verilmiş əməkdaşlara açıqdır; onlar bütün agentliyin maliyyəsini görür | D09-un əvvəlki Balans default-unu əvəz edir; qutu qiymətinin ayrıca default-u dəyişdirilməyib |
| D19 | Webhook-dan gələn lead-in ilkin cavabdehi həmin agentliyin adminidir | Sistem mənbəyi ilə cavabdeh təyinatı ayrıca saxlanır |
| D20 | Admin yaratmadığı və cavabdehi olmadığı qutuları da redaktə edir | Yalnız öz agentliyində; başqa agentliyə giriş deyil |
| D21 | Cavabdehi admin, yaradan və hazırkı cavabdeh dəyişə bilər | Yeni təyinat yaradan sahəsini dəyişmir |
| D22 | Rollar dinamikdir; admin paneldən əlavə edə və idarə edə bilir | Vəzifələrin sabit siyahısı kodda məcburi deyil |
| D23 | Bir qutu bir neçə departamentin işlərini əhatə edir; departament hər iş əlavə ediləndə seçilir | Əvvəlki bir əsas departament təklifini əvəz edir |
| D24 | Danışılmış qiymət ilk mərhələlərdə boş qala bilər, sifariş təsdiqində məcburidir | Deadline tələbindən əlavə təsdiqlənmiş şərt |
| D25 | Adminin idarə etdiyi xidmət kataloqu olur; qutudakı hər işin ayrıca qiyməti və cavabdehi var | Ümumi qutu cavabdehi ilə iş cavabdehi ayrı əlaqələrdir |
| D26 | Qutunun ümumi qiyməti həmişə işlərin cəmidir; ayrıca endirim yoxdur | Ayrı manual total da istifadə edilmir |
| D27 | İşin cavabdehi öz işinin statusunu yeniləyə bilir | Ümumi qutunun redaktə qaydası D16/D20 olaraq qalır |
| D28 | Qutunun ümumi deadline-ından əlavə hər işin ayrıca deadline-ı olur | Məcburilik v1-də S17/S18 ilə seçilib; vaxt sərhədi D30 ilə həll olunub |
| D29 | İşlər tamamlanmasa da qutu təhvil verilə bilər | İstifadəçi: “keçirilə bilər”; digər təsdiq, qiymət, deadline və giriş şərtləri saxlanır |
| D30 | İş deadline-ı ümumi qutu deadline-ını keçə bilməz; uzadıla bilər | Daha gec iş vaxtı üçün əvvəlcə ümumi deadline uyğun uzadılır; tarixlər avtomatik dəyişdirilmir |
| D31 | Əl ilə qutu yaradanda ilkin cavabdeh yaradan şəxsdir | İstifadəçi: “bəli yaradan olur”; webhook üçün D19 qüvvədədir |
| D32 | Qutu və iş deadline-ları tarix və saatla təyin edilir | İstifadəçinin birbaşa seçimi; eyni günün saatları da müqayisə edilir |
| D33 | İş qiymətini admin və ayrıca qiymət redaktəsi icazəsi olan qutu redaktorları dəyişə bilər | Digərləri üçün həm yaradan/hazırkı cavabdeh olmaq, həm commercials.write lazımdır |
| D34 | Deal Lost keçidində səbəb seçmək məcburi, əlavə mətn qeydi istəyə bağlıdır | İstifadəçinin birbaşa seçimi; səbəblərin siyahısı Q18-də açıqdır |
| D35 | Sifariş ödənişlərini admin və həmin qutunu yaradan şəxs daxil edib düzəldə bilər | İstifadəçi: “admin və qutunu yaradan şəxs”; ümumi Balans girişi ilə əlaqə D39-da həll edilib |
| D36 | Agentlikdən aylıq xidmət alan müştəri aylıq dövrə görə hesablanır | Avtomatik yaradılma D41 ilə həll olunub; v1 dövr/şablon qaydaları S01/S22 və D55/D56-dadır |
| D37 | Borclara frilanser, təchizatçı, əməkdaş haqqı və ofis xərclərinin hamısı daxildir | “Bəli” cavabından sonra kateqoriyalar istifadəçi tərəfindən açıq seçildi |
| D38 | Birdəfəlik sifariş təsdiqində alacaq bir dəfə yaranır; təhvildə ödənilməmiş qalıq göstərilir | İstifadəçi 1 000 AZN nümunəsində bir alacaq variantını seçdi; təhvil ikinci alacaq və ya avtomatik ödəniş yaratmır |
| D39 | Ümumi Balans bağlı olsa da qutunu yaradan şəxs öz qutusunda ödəniş yaza bilər | D18-in agentlik üzrə girişini genişləndirməyən ayrıca obyekt hüququ; D35-dəki düzəliş hüququ da öz qutusuna aiddir |
| D40 | Ödəniş günü hər aylıq müqavilə üçün ayrıca təyin edilir | İstifadəçi: “bəli ayrıca təyin edilsin” |
| D41 | Hər aylıq dövr üçün qutu, işlər və alacaq avtomatik yaranır | İlk dövr D43, gecikmiş ödənişdə yaradılma D44 ilə həll olunub |
| D42 | Yeni müştəri və Dövri qıfları ayrıdır; aylıq qutu yalnız Dövriyə düşür, işləri To Do-da görünür | İlkin üç icra sütununa D44 ilə Ödəniş olunmayıb əlavə edilib; əsas satış qıfının səkkiz mərhələsi saxlanır |
| D43 | İlk aylıq dövr təsdiqdən sonra seçilmiş ödəniş tarixindən başlayır; gecikən pul tarixi dövrü sürüşdürmür | İstifadəçi 5/12/15 nümunəsində 12-sini seçdi: “ödənişdə gecikmələr ola bilər” |
| D44 | Ödəniş gecikəndə qutu yenə yaranır və Dövri qıfındakı Ödəniş olunmayıb sütununa düşür | D48 üzrə 50% həddi bu xəbərdarlığın bitməsini müəyyən edir; Dövridə dörd görünən sütun var |
| D45 | Avtomatik aylıq qutuda insan yaradan hüquqları hələlik adminə aiddir | İstifadəçi: “hələlik default olaraq admində”; faktiki yaradılma mənbəyi sistem olaraq qalır |
| D46 | Qutu Ödəniş olunmayıb sütununda olarkən işə başlamaq və öz iş statusunu yeniləmək mümkündür | İstifadəçi: “bəli başlaya bilər”; obyekt/iş səlahiyyətləri dəyişmir |
| D47 | Ödəniş həddi tamamlananda qutu saxlanmış icra mərhələsinə avtomatik qayıdır | İstifadəçi: “bəli qayıtsın”; icra gedişi ödəniş xəbərdarlığı altında saxlanır |
| D48 | Ödəniş olunmayıb sütunundan çıxmaq üçün dövr məbləğinin ən azı 50%-i kifayətdir | İstifadəçi: “50% kifayətdir”; qalan borc bağlanmır, tam ödəniş kimi göstərilmir |
| D49 | Dövri qutu yarımçıq işlərlə Bitdi-yə keçirilə bilər, amma tamamlanmama səbəbi yazılmalıdır | İstifadəçi: “olsun amma niyə işlərin yarımçıq qaldığını qeyd edərək”; işlər öz statusları ilə qalır |
| D50 | Aylıq xidmət hər dövrdə yeni Portfel işi kimi görünmür; eyni şirkətə göstərilmiş xidmət müddəti artır | İstifadəçinin birbaşa seçimi; v1 hesablanma və reopen davranışı S25-də seçilib |
| D51 | Aylıq qutunun ilkin ümumi deadline-ı xidmət dövrünün son günüdür | İstifadəçi 12 sentyabr–11 oktyabr nümunəsinə “olsun” dedi; standart saat T13 təklifidir |
| D52 | Əməkdaş bir neçə departamentdə ola bilər; başqa departamentin qutusuna təyin olunanda yalnız həmin qutuya əlavə giriş alır | B01-ə “olsun”; təyinat bütöv departamentə və ümumi qutu redaktəsinə giriş vermir |
| D53 | Müəssisə/Map bazası agentliyin bütün aktiv əməkdaşlarına görünür; yeni müəssisələr Excel sənədindən əlavə olunur | B02: “hamı görə bilsin, əlavə edilmə excell sənədindən olacaq”; icraçı v1 delegasiyası ilə S15-də admin seçilib |
| D54 | To Do işləri CRM qutularından, əməkdaşın adına olan iş/tapşırıq təyinatlarından yaranır | B03-ün cavabı ayrıca To Do yaratma axınını əvəz edir; əsas siyahı öz işləridir, sərbəst sifarişsiz tapşırıq ilkin əhatədə deyil. Ortaq sifariş baxışı D07 üzrə qalır |
| D55 | Müqavilədə seçilmiş aylıq işlər, cavabdehlər və iş tarixlərinin planı növbəti aylarda avtomatik tətbiq olunur | B04: “avtomatik tədbiq olunsun”; texniki tarix/surət modeli T15-dir |
| D56 | Ödəniş üçün seçilən gün həmin ayda yoxdursa ayın son günü götürülür | B05: “götürülsün”; ilkin billing_day-ı qorumaq və hər ay ondan hesablamaq texniki tətbiqdir |
| D57 | Qalan sualları əvvəlki qərarların məntiqinə uyğun assistent cavablandırsın, cavabları yazıb qurulma paketini yekunlaşdırsın | 08.09.2026 son istifadəçi göstərişi; S01–S33 delegasiya əsasında seçilib, hər biri birbaşa istifadəçi cavabı deyil |

## Texniki seçimlərin yekunu

T01 Next.js/React/TS; T02 tenant RLS/composite əlaqələr; T03 minimal Supabase Pro/Vercel Pro; T04 fərdi allow/deny üstünlüyü; T05 AZ/AZN/Asia-Baku; T06 mərkəzli desktop/mobil menyu; T07 Drive linkləri; T08 archive/audit/davamlı iş; T09 webhook intake departamenti; T10 qiymət/payment ayrı hüquqlar; T11 work stage/payment alert ayrı; T12 aylıq Portfel xülasəsi; T13 dövrün son günü 23:59; T14 admin import və unknown-customer intake; T15 versiyalı aylıq şablon.

Bu ilkin təkliflər S01–S33 və docs/01–05-də konkretləşdirilib. T12 reopen/as-of qaydası S25, T14 icraçısı S15, platformanın faktiki əlçatanlıq/xərc yoxlaması S28/S32 üzrədir.

## B01–B18 yekun statusu

18/18 qərar bağlanıb. B01–B05 birbaşa cavablandırılıb; B06–B18 assistent tərəfindən delegasiya əsasında seçilib. B06 əvvəlki qeyri-müəyyən ifadədən çıxarılmayıb, S01 yeni başlanğıc seçimidir.

| ID | Mövzu | Cavabın mənbəyi |
| --- | --- | --- |
| B01 | Çox departament və tək əlavə qutu girişi | D52 |
| B02 | Map görünməsi və əlavə olunma | D53; admin icraçısı S15 |
| B03 | To Do mənbəyi | D54 |
| B04 | Aylıq iş şablonu | D55 |
| B05 | Qısa ay günü | D56 |
| B06 | Dövr ortasında dayandırılma haqqı | S01 |
| B07 | Balans əhatəsi | S02 |
| B08 | Sonrakı qiymət düzəlişi | S03 |
| B09 | Çox sifarişə pul bölgüsü | S04 |
| B10 | Drive | S05 |
| B11 | Meetlər | S06 |
| B12 | Inbox | S07 |
| B13 | Tools | S08 |
| B14 | Import əhatəsi | S09 |
| B15 | Webhook | S10 |
| B16 | Export hüquqları | S11 |
| B17 | Bildiriş kanalı | S12 |
| B18 | Pilot və tam v1 | S13 |

## Tam sual–cavab xəritəsi

“Sonrakı versiya” olan funksiyanın hazırkı cavabı əhatədən çıxarılmasıdır; bu, v1 üçün cavabsız biznes qaydası deyil. Real hesab, fayl, ad və tarix faktları ayrıca konfiqurasiya kimi qalır.

| ID | Sual | Yekun cavab | Mənbə |
| --- | --- | --- | --- |
| Q01 | Rollar sabit olsun? | Dinamik rol və fərdi icazə paneli; sistem admini ayrıca. | D22/S14 |
| Q02 | Bir neçə departament və başqa qutuya təyinat mümkündür? | Bəli; təyinat yalnız həmin qutuya əlavə giriş verir. | D52 |
| Q03 | Qutunu kim dəyişir? | Admin, yaradan və hazırkı ümumi cavabdeh. | D16/D20 |
| Q04 | İcazə hansı səviyyədə idarə olunur? | Rol və konkret əməkdaş üzrə. | D17 |
| Q05 | Dəvətsiz qeydiyyat necə qoşulur? | Agentliyin qoşulma linkindən pending müraciət, admin approval. | S14 |
| Q06 | MFA və işdən ayrılma necədir? | Admin TOTP; üzvlük dayandırılır, iş təhvil siyahısı saxlanır. | S14 |
| Q07 | Map-i kim görür/yazır? | Hamı görür; müəssisə Excel-dən, import/düzəliş admində. | D53/S15 |
| Q08 | User fəaliyyətini kim görür? | Profil metadata-sı komanda, fəaliyyət yalnız icazəli mənbə üzrə. | S16 |
| Q09 | SaaS satış və müştəri kabineti nə vaxtdır? | Tenant təməli indi, self-service satış/kabinet sonrakı versiyada. | D02/S31 |
| Q10 | İlkin modul prioriteti nədir? | M1–M3 pilot, sonra M6-ya qədər bütün 12 bölmə. | S13 |
| Q11 | Bir qutuda neçə departament ola bilər? | Bir neçə; departament iş sətrində seçilir. | D23 |
| Q12 | Lead və təsdiqdə hansı sahələr məcburidir? | Manual lead müəssisə+iş/departament; webhook intake; təsdiqdə bütün iş/qiymət/assignee/tarix. | D24/S17 |
| Q13 | Təsdiqdən sonra qiymət dəyişikliyi necədir? | Mövcud price hüququ+səbəb, versiyalı financial adjustment; payment-ə toxunan halda admin. | D33/S03 |
| Q14 | Xidmət kataloqu və qiymətlər necədir? | Admin kataloqu, hər sifariş işində ayrıca qiymət/cavabdeh snapshot-u. | D25 |
| Q15 | Seriya formatı və illik sıra nədir? | CRM-YYYY-000001, tenant/il üzrə atomik sıra. | S18 |
| Q16 | İş deadline-ı nə vaxt məcburidir, keçmiş vaxt mümkündür? | Təsdiqdə məcburi; keçmiş vaxt xəbərdarlıq/səbəblə, parent sərhədi qorunur. | D28/D30/D32/S18 |
| Q17 | Mərhələlərdə irəli/geri keçid necədir? | Qutu redaktoru, server invariantları ilə; reopen səbəbi məcburi. | S19 |
| Q18 | Lost səbəbləri və təkrar əlaqə necədir? | S20 başlanğıc kataloqu; səbəb məcburi, əlavə qeyd/follow-up istəyə bağlı. | D34/S20 |
| Q19 | Təhvil üçün bütün işlər və müştəri təsdiqi lazımdır? | Açıq işlə təhvil olar; müştəri təsdiqi/link istəyə bağlı. | D29/S19 |
| Q20 | Reopen Portfel və maliyyəni necə dəyişir? | Eyni kart draft/arxiv, dövr contribution inaktiv; alacaq avtomatik silinmir. | S19/S25 |
| Q21 | To Do-da ayrıca tapşırıq yaradılır? | Xeyr, CRM-in təyin olunmuş işləri; redaktorlar CRM-də idarə edir. | D54 |
| Q22 | Tapşırıq məsulu/statusları nədir? | Bir cavabdeh; Ediləcək/İcrada/Bitdi. | S21 |
| Q23 | Tapşırıq şablonu/asılılıqları necədir? | Aylıq avtomatik; kataloqda istəyə bağlı alt şablon; məcburi dependency yoxdur. | D55/S21 |
| Q24 | Təqvim və iş saatları necədir? | Deadline, optional start/end; ilkin B.e.–C. 09:00–18:00 göstərim ayarıdır. | S21 |
| Q25 | Deadline bildirişi nə vaxt/haradan gəlir? | Daxili 24h/2h; adminə gündəlik gecikmə xülasəsi. | S12 |
| Q26 | Borc kateqoriyaları hansılardır? | Freelancer, təchizatçı, əməkdaş haqqı, ofis xərcləri. | D37 |
| Q27 | Valyuta, vergi, avans, refund, sıfır qiymət necədir? | AZN, vergi avtomatik deyil; avans/refund admin; səbəbli sıfır olar, NULL deyil. | S02/S04/S23 |
| Q28 | Balansın görünmə həcmi nədir? | İcazə verilən əməkdaş üçün bütün tenant, başqa tenant bağlı. | D18 |
| Q29 | Ödəniş yazma, təsdiq və qəbz qaydası nədir? | Admin/creator dar hüququ; ayrıca approval yoxdur, qəbz optional, düzəliş səbəbli. | D35/D39/S23 |
| Q30 | Alacaq təsdiqdə və təhvildə necədir? | Birdəfəlik təsdiqdə bir alacaq, təhvildə həmin qalıq. | D38 |
| Q31 | Bir ödəniş bir neçə qutuya bölünür? | Admin eyni customer/currency daxilində bölür; qalan hissə avansdır. | S04 |
| Q32 | Kassa/bank, başlanğıc qalıq və PDF lazımdır? | Panel hesabları/opening balances, export/çap çıxarışı; rəsmi faktura/bank API yoxdur. | S02/S24 |
| Q33 | Müqavilə müddəti bitəndə uzansın? | Sonsuz müqavilə davam edir, end-date olan yalnız admin uzatması ilə. | D40/D43/S22 |
| Q34 | Aylıq qutu/iş/təyinat/tarix necə yaranır? | Hər dövrdə avtomatik; snapshot şablon, initial parent dövr sonu 23:59. | D41/D51/D55 |
| Q35 | Qısa ay, yarımçıq dövr və qiymət dəyişikliyi necədir? | Gün yoxdursa son gün; proration none, cari haqq qalır; şablon qiyməti gələcək dövrə. | D56/S01/S03/S22 |
| Q36 | Abonent menyusunun kateqoriyaları qalsın? | Bəli; billing_interval kateqoriyadan ayrıdır. | S26 |
| Q37 | Tools sayı/lisenziya tutumu necədir? | Admin real vahid/tutumu paneldə daxil edir; fiziki vahid ayrıca. | S08 |
| Q38 | Rezervasiya, götürmə/qaytarma, nasazlıq necədir? | Hamısı v1-də; öz əməliyyatı əməkdaşda, admin hamısı, əlavə approval yoxdur. | S08 |
| Q39 | GPT/Higgsfield inteqrasiyası hansı səviyyədədir? | Resurs siyahısı və istifadə; API sonrakı versiyada. | S08 |
| Q40 | Calendar/Meet və xarici dəvət necədir? | Daxili görüş/manual link və .ics; API/avtomatik xarici dəvət sonrakı. | S06 |
| Q41 | Inbox chat əhatəsi nədir? | Şəxsi/qrup mətn-link, read/search, 15 dəqiqə edit/tombstone; files/calls sonrakı. | S07 |
| Q42 | Bütün aktivlik hansı məlumatdır? | Qutu/iş/audit fəaliyyəti; time tracker/ekran izləmə yoxdur, source hüquqları qalır. | S16 |
| Q43 | Drive link, yoxsa API? | V1 linklər; API sonrakı. | S05 |
| Q44 | Gmail, Workspace, My Drive, Shared Drive hansıdır? | V1 üçün API seçilmir; real hesab tipi yalnız gələcək Google bağlantısında yoxlanır. | S05/S32 |
| Q45 | Media saxlanması və hüquqları necədir? | Böyük media Drive-da, linklər source hüquqlu, v1 avtomatik Google share/delete yoxdur. | S05/S29 |
| Q46 | Excel-in real sütunları və filial formatı nədir? | Qurulmada fayldan oxunacaq fakt; mapping UI artıq seçilib. | S15/S32 |
| Q47 | Dublikat və boş xana qaydası nədir? | Source ID üstün, konflikt preview-də adminə; boş xana silmir, filial/pin qorunur. | S15 |
| Q48 | Excel başqa modulları import etsin? | V1 yalnız müəssisə/əlaqə/filial; geniş import sonrakı. | S09 |
| Q49 | Export sütunları/hüquqları necədir? | Modul filtri+read+export+field permission; admin və ayrıca icazəli əməkdaş. | S11 |
| Q50 | Koordinatı olmayan məkan necə tapılır? | Admin manual pin; kütləvi geocoding yoxdur. | S27 |
| Q51 | Webhook mənbəsi və payload-u nədir? | Tətbiqin öz HMAC JSON schema-sı; sayt/n8n tipli göndərənlər uyğunlaşır. | S10 |
| Q52 | İctimai Portfel lazımdır? | V1 daxili; public paylaşım sonrakı. | S25/S31 |
| Q53 | Domen/hostinq/DNS nədir? | crm.<mövcud-domen>; dəqiq rekvizitlər real hesabdan, uydurulmur. | S32 |
| Q54 | Brend, dil, tema, valyuta/timezone nədir? | Müvəqqəti APMA CRM, AZ, light/dark, AZN/Asia-Baku; logo sonra. | S30 |
| Q55 | SaaS paket/limit/domen planı nədir? | V1-ə daxil deyil; tenant izolyasiyası hazır təməldədir. | S31 |
| Q56 | Backup və bərpa hədəfi nədir? | RPO 24h/RTO 8 iş saatı hədəfi, DB+ayrı Storage backup və restore testi. | S29 |
| Q57 | Silinmə/saxlanma/müştəri merge necədir? | Business archive/restore, avtomatik daimi silmə yoxdur; temporary fayl TTL, kütləvi merge yoxdur. | S15/S29 |
| Q58 | Admin hansı kataloqları/mərhələləri idarə edir? | S26 kataloqları; stage label/color, sabit semantic workflow; arbitrary builder yoxdur. | S26 |
| Q59 | Load və gələcək agentlik həcmi nədir? | 15/2500 real başlanğıc; 10k qutu/40k iş sintetik test, gələcək satış sayı uydurulmur. | S33 |
| Q60 | Pilot tarixi və iştirakçılar kimdir? | M3-dən sonra pilot imkanı; admin+iki departament üzvü real adlarla qurulmada seçilir, tarix uydurulmur. | S13/S33 |
| Q61 | Admin hər qutunu redaktə edə bilər? | Öz tenantında bəli. | D20 |
| Q62 | Cavabdehi kim dəyişir? | Admin, creator və hazırkı ümumi accountable. | D21 |
| Q63 | Bir neçə admin olduqda webhook kimə getsin? | Paneldə bir active default admin seçilir; yoxdursa visible assignment error/intake qorunur. | D19/S10 |
| Q64 | Qiymət həmişə işlərin cəmidir? | Bəli; ayrıca endirim/manual total yoxdur. | D26 |
| Q65 | İş cavabdehi öz statusunu dəyişir? | Bəli; başqa field/ümumi qutu hüququ vermir. | D27 |
| Q66 | Hər işin ayrıca deadline-ı var? | Bəli; təsdiqdə məcburi və parent-i keçmir. | D28/D30/S18 |
| Q67 | Gecikmiş ödənişdə aylıq qutu yaransın? | Bəli; unpaid göstərimi 50% həddinə tabedir. | D44/D48 |
| Q68 | Dövri qutuda yaradan hüquqları kimdədir? | Hələlik admin, sistem mənbəyi qalır. | D45 |
| Q69 | Dövri Bitdi/açıq iş və Portfel necədir? | Səbəblə yarımçıq Bitdi, şirkət müddəti; ayrıca aylıq Portfel işi yoxdur. | D49/D50/S25 |
| Q70 | Ödənişsiz işə başlamaq olur? | Bəli; öz iş statusu və mövcud qutu hüquqları ilə. | D46 |
| Q71 | Ödəniş həddində əvvəlki mərhələyə qayıdır? | Saxlanmış cari icra mərhələsinə avtomatik. | D47 |
| Q72 | Ödəniş həddi nə qədərdir? | Dövrün xalis alacağının ən azı 50%-i həmin dövrə ayrılmış etibarlı faktiki pulla ödənməlidir; qalan borc qalır. | D48 |

## Dəyişiklik tarixçəsi — əvvəlki qeydlər aktiv tələb deyil

Əvvəlki versiyalarda “açıq” yazılan tarixi hadisələr həmin günün vəziyyətidir; yuxarıdakı v1 cavabları indi qüvvədədir. Orijinal 0.11 sənədləri ayrıca planning-v0.11-original.zip-də qorunub.

| Tarix / versiya | Dəyişiklik | Təsirlənən hissələr |
| --- | --- | --- |
| 07.09.2026 / 0.2 | Yaradan/cavabdeh redaktəsi, adminin ümumi istisnası və cavabdehin dəyişdirilməsi qəbul edildi | CRM-02/03, data modeli, AC-34/35, promptlar |
| 07.09.2026 / 0.2 | Webhook lead-inin ilkin cavabdehi admin olaraq müəyyənləşdirildi | CRM-03, data modeli, webhook axını, AC-19 |
| 07.09.2026 / 0.2 | Balansın əvvəlki hamıya açıq default-u ləğv edildi; seçilmiş istifadəçilərə agentlik üzrə giriş verildi | D09/D18, FIN-01, icazə matrisi, AC-05, README və promptlar |
| 07.09.2026 / 0.2 | Rol və əməkdaş üzrə icazə idarəsi, dinamik rol yaratma qəbul edildi | USER-01, rol modeli, M1, AC-33, AGENTS.md və promptlar |
| 07.09.2026 / 0.3 | Qutunun departamentləri iş sətirlərindən müəyyənləşdirildi; xidmət kataloqu və hər iş üçün qiymət/cavabdeh qəbul edildi | CRM-03/06, data modeli/diaqram/indekslər, M3, AC-36/37 |
| 07.09.2026 / 0.3 | Qiymət ilkin mərhələdə boş, təsdiqdə məcburi oldu; total həmişə işlərin cəmidir, ayrıca endirim yoxdur | CRM-05/06, FIN-01, kommersiya modeli, webhook/ixrac, AC-08/38 |
| 07.09.2026 / 0.3 | İş cavabdehinin öz statusunu yeniləməsi və hər işin ayrıca deadline-ı qəbul edildi | CRM-06, iş modeli və icazələri, AC-39, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.4 | Açıq işlərlə təhvil və əl ilə yaradılmada yaradanın ilkin cavabdeh olması qəbul edildi | D29/D31, CRM-03/05, To Do/Overview/Portfel, data modeli, AC-07/21/40, promptlar |
| 07.09.2026 / 0.4 | Tarix+saat və iş deadline-ının ümumi qutu deadline-ını keçməməsi, sərhəd daxilində uzatma qəbul edildi | D30/D32, CRM-06, tranzaksiya invariantları, AC-41, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.4 | Qiymət redaktorları və Lost üçün məcburi səbəb/istəyə bağlı qeyd dəqiqləşdirildi | D33/D34, CRM-05/06, icazə matrisi və səbəb modeli, inteqrasiya qaydaları, AC-42/43, promptlar |
| 07.09.2026 / 0.5 | Ödəniş redaktorları admin və qutunu yaradan şəxs olaraq, aylıq xidmətin hesablanması aylıq əsasda müəyyən edildi | D35/D36, FIN-01/SUB-01, icazə modeli, maliyyə qəbul meyarları, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.5 | Borc kateqoriyaları, təsdiqdə bir alacaq/təhvildə qalıq və Balans bağlı halda yaradanın dar ödəniş hüququ dəqiqləşdirilib qəbul edildi | D37–D39, Q26/Q29/Q30, FIN-01, icazə modeli, AC-05/44–46, promptlar |
| 07.09.2026 / 0.6 | Müqavilə üzrə ayrıca ödəniş günü, avtomatik aylıq qutu/iş/alacaq və ayrı üç mərhələli Dövri qıfı qəbul edildi | D40–D42, NAV-01/CRM-01/07/SUB-01, qıf/dövr modeli, qəbul meyarları, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.7 | İlk dövr seçilmiş ödəniş tarixinə bağlandı; gecikən ödənişdə qutu yaranması və Ödəniş olunmayıb sütunu, avtomatik qutuda admin hüquqları qəbul edildi | D43–D45, Q33/Q67/Q68, CRM-07/SUB-01, icazə və dövr modeli, AC-47/49–53, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.8 | Ödənişsiz icra, saxlanmış mərhələyə avtomatik dönüş və minimum 50% ödəniş həddi qəbul edildi | D46–D48, Q70–Q72, CRM-07/SUB-01, ödəniş/icra modeli, AC-53–56, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.9 | Dövri Bitdi-də yarımçıq iş səbəbi, şirkət üzrə Portfel xidmət müddəti və dövrün son günü ilkin deadline qəbul edildi; müzakirə 18 əsas suala endirildi | D49–D51, T12/T13, Q34/Q69, B01–B18, CRM-07/PORT-01/SUB-01, data modeli, AC-57–59 və promptlar |
| 07.09.2026 / 0.10 | Çox departamentli üzvlük və tək qutu istisnası, agentlik üzrə Map görünməsi/Excel mənbəyi, CRM-dən yaranan To Do qəbul edildi; 15 əsas sual qalıb | D52–D54, T14, Q02/Q07/Q21, B01–B03, CRM/MAP/TODO, icazələr və import, AC-60–62, README/AGENTS.md və promptlar |
| 07.09.2026 / 0.11 | Aylıq iş şablonunun avtomatik tətbiqi və qısa ayda son gün seçimi qəbul edildi; “sayılmır” cavabı məbləğ dəqiqləşdirməsi kimi saxlandı | D55/D56, T15, B04/B05 tamamlandı, B06 açıq; Q23/Q34/Q35, SUB-01, data modeli, AC-63/64, README/AGENTS.md və promptlar |
| 08.09.2026 / 1.0 | İstifadəçi qalan cavabları assistentə həvalə etdi; bütün biznes seçimləri bağlandı və qurulma paketi yekunlaşdı | D57, S01–S33, Q01–Q72/B01–B18, docs/01–08, README/AGENTS, promptlar, AC-65–76 |
