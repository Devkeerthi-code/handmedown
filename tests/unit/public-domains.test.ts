import { expect, it } from "vitest";
import { emailDomain, isPublicEmailDomain } from "@/lib/public-domains";

it("blocks public webmail as a college domain, but not college domains", () => {
  for (const d of ["gmail.com", "Outlook.com", "hotmail.com", "yahoo.co.in", "icloud.com", "proton.me", "rediffmail.com"]) {
    expect(isPublicEmailDomain(d)).toBe(true);
  }
  for (const d of ["nitc.ac.in", "iitm.ac.in", "students.vit.ac.in", "demo-dit.example.com"]) {
    expect(isPublicEmailDomain(d)).toBe(false);
  }
});

it("takes the domain from an email", () => {
  expect(emailDomain("Asha@CSE.NITC.ac.in")).toBe("cse.nitc.ac.in");
  expect(emailDomain("nope")).toBe("");
});
