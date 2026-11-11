/** Mirrors app.is_public_email_domain() so the UI can explain before the database refuses. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.in", "hotmail.com", "hotmail.co.uk", "live.com",
  "live.in", "msn.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com", "icloud.com",
  "me.com", "mac.com", "proton.me", "protonmail.com", "pm.me", "aol.com", "zoho.com", "zohomail.in",
  "gmx.com", "gmx.net", "mail.com", "yandex.com", "yandex.ru", "rediffmail.com", "tutanota.com", "tuta.io",
  "fastmail.com", "hey.com", "qq.com", "163.com", "example.org", "mailinator.com", "temp-mail.org",
]);

export function emailDomain(email: string) {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

export function isPublicEmailDomain(domain: string) {
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}
