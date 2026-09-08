# Sonrakı tələb dəyişikliyi üçün prompt

Versiya: 1.0 · 08.09.2026. İlkin müsahibə bitib; bu prompt yalnız istifadəçi yeni dəyişiklik istəyəndədir.

```text
Bu CRM-in v1.0 sənədlərini oxu. Hələ tətbiqi qurma; bildirdiyim yeni tələbi mövcud plana işlə.

Əvvəl README.md, AGENTS.md, docs/06-suallar-ve-qerarlar.md və
docs/07-yekun-suallar-ve-cavablar.md, sonra təsirlənən texniki sənədləri oxu.
D01–D56 birbaşa cavablardır; D57 əsasında S01–S33 assistent tərəfindən seçilib.
B01–B18 və Q01–Q72 üçün cavablar tamamdır, əvvəlki müsahibəni yenidən başlatma.

Yeni tələbə uyğun mümkün olan konkret həlli hazırla. Əvvəlki qayda ilə həqiqi ziddiyyət
varsa izah et; səlahiyyətli rutin texniki seçimləri özün həll et.
Dəyişən biznes qaydası, schema/RLS, maliyyə/vaxt təsiri, qəbul meyarı və promptları
birlikdə uyğunlaşdır. İstifadəçinin dediyi ilə öz seçimini mənbə baxımından ayır.

Nəticə: yenilənmiş md sənədləri, dəyişən davranışın qısa izahı və lazım gələrsə
yalnız yeni ziddiyyətə aid qısa sual. Kodun qurulması ayrıca göstəriş tələb edir.
```
