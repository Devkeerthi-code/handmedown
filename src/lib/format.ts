const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatInr(rupees: number) {
  return `₹${inr.format(rupees)}`;
}

const UNITS: [number, string][] = [
  [60, "s"],
  [60, "min"],
  [24, "h"],
  [7, "d"],
  [4.35, "w"],
  [12, "mo"],
];

/** "35 min ago", "2h ago", "3d ago". `now` is injectable for tests. */
export function timeAgo(date: Date | string, now: Date = new Date()) {
  let value = Math.max(0, (now.getTime() - new Date(date).getTime()) / 1000);
  if (value < 45) return "just now";
  for (const [step, unit] of UNITS) {
    if (value < step) return `${Math.floor(value)}${unit === "min" ? " min" : unit} ago`;
    value /= step;
  }
  return `${Math.floor(value)}y ago`;
}

/** Server components take the request time from here so render stays pure. */
export function requestTime() {
  return Date.now();
}

export function clockTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function formatBytes(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function initials(name: string) {
  // Only words that start with a letter, so "Karthik S. (demo)" gives "KS", not "K(".
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
