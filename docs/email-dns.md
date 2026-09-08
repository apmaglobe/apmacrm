# Auth email DNS konfiqurasiyası

Resend `auth.apma.store` domeni 08.09.2026-da `failed` idi. Mövcud DNS-də aşağıdakı TXT qeydləri tapılmadı. Məlumat Resend `get_domain` cavabındandır; uydurulmayıb. CRM host ünvanına dəyişiklik edilmir.

Cloudflare `apma.store` zonasında:

| Type | Name | Content | Priority | TTL |
|---|---|---|---|---|
| TXT | `resend._domainkey.auth` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDN4czOLyyo6qZx8l+xSXflEmsunQUdg9KXniRPMbMDCF5k7KcbXv336IEJOBcokzstODjG79Tj8vGTGSo8HoKgwMkYCjDGzrwYALFYpwUnLk/9aaWJjcOX1u8alJS1TxGLovOnPtOCCK1j3wGmVKRuWCzY6Ys8TlpQREGR+TcrJwIDAQAB` | — | Auto |
| MX | `send.auth` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | Auto |
| TXT | `send.auth` | `v=spf1 include:amazonses.com ~all` | — | Auto |

Təklif edilən göndərən: `APMA CRM <noreply@auth.apma.store>`. Secret API/SMTP açarı bu sənəddə saxlanmır. Mövcud əsas domenin MX/SPF qeydləri əvəz edilmir. DNS yazmadan əvvəl eyni ad/type qeydləri yenidən oxunmalıdır. Resend `verified` olmadan email çatdırılması tamamlandı sayılmır.
