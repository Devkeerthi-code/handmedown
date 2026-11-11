/**
 * Spots Indian mobile numbers typed into chat ("98765 43210", "+91-9876543210").
 * We only warn: people may still choose to share, but they should do it knowingly.
 */
export function containsPhoneNumber(text: string) {
  const digitsRuns = text.match(/(?:\+?91[\s-]?)?(?:\d[\s-]?){10,}/g) ?? [];
  return digitsRuns.some((run) => {
    const digits = run.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    return /^[6-9]\d{9}$/.test(digits);
  });
}
