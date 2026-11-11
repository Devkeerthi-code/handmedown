import type { IllustrationName } from "@/lib/catalog";

/** Flat line illustrations (brown line + palette fills) that re-tint in dark mode. Used when a listing has no photo. */
const ART: Record<IllustrationName, string> = {
  books: "<rect x=\"28\" y=\"84\" width=\"104\" height=\"16\" rx=\"3\" fill=\"var(--ill-a)\"/><path d=\"M40 84v16M120 84v16\"/> <rect x=\"36\" y=\"66\" width=\"92\" height=\"18\" rx=\"3\" fill=\"var(--ill-b)\"/><path d=\"M48 66v18M116 72h-48\"/> <rect x=\"32\" y=\"50\" width=\"98\" height=\"16\" rx=\"3\" fill=\"var(--ill-c)\"/><path d=\"M44 50v16M70 58h40\"/> <path d=\"M104 50V30l8 6 8-6v20\" fill=\"var(--ill-a)\"/>",
  calculator: "<rect x=\"52\" y=\"14\" width=\"56\" height=\"92\" rx=\"9\" fill=\"var(--ill-b)\"/><rect x=\"61\" y=\"24\" width=\"38\" height=\"20\" rx=\"3\" fill=\"var(--ill-c)\"/> <path d=\"M89 34h4\"/> <circle cx=\"66\" cy=\"56\" r=\"3.6\" /><circle cx=\"66\" cy=\"69\" r=\"3.6\" /><circle cx=\"66\" cy=\"82\" r=\"3.6\" /><circle cx=\"66\" cy=\"95\" r=\"3.6\" /><circle cx=\"80\" cy=\"56\" r=\"3.6\" /><circle cx=\"80\" cy=\"69\" r=\"3.6\" /><circle cx=\"80\" cy=\"82\" r=\"3.6\" /><circle cx=\"80\" cy=\"95\" r=\"3.6\" /><circle cx=\"94\" cy=\"56\" r=\"3.6\" /><circle cx=\"94\" cy=\"69\" r=\"3.6\" /><circle cx=\"94\" cy=\"82\" r=\"3.6\" /><circle cx=\"94\" cy=\"95\" r=\"3.6\" fill=\"var(--ill-a)\"/>",
  cycle: "<circle cx=\"44\" cy=\"82\" r=\"22\" fill=\"var(--ill-b)\"/><circle cx=\"116\" cy=\"82\" r=\"22\" fill=\"var(--ill-b)\"/><circle cx=\"44\" cy=\"82\" r=\"3\"/><circle cx=\"116\" cy=\"82\" r=\"3\"/> <path d=\"M44 82 68 50h38l10 32M68 50l14 32 24-32M82 82H44\" /><path d=\"M62 42h14M106 50l-4-14h10\" /> <circle cx=\"82\" cy=\"82\" r=\"5\" fill=\"var(--ill-a)\"/>",
  cooler: "<rect x=\"48\" y=\"14\" width=\"64\" height=\"86\" rx=\"10\" fill=\"var(--ill-b)\"/> <rect x=\"58\" y=\"26\" width=\"44\" height=\"40\" rx=\"4\" fill=\"var(--ill-c)\"/><path d=\"M58 36h44M58 46h44M58 56h44\"/> <circle cx=\"68\" cy=\"80\" r=\"4\" fill=\"var(--ill-a)\"/><path d=\"M80 80h20\"/><path d=\"M58 100v6M102 100v6\"/>",
  mattress: "<rect x=\"18\" y=\"58\" width=\"124\" height=\"34\" rx=\"10\" fill=\"var(--ill-b)\"/><path d=\"M18 74h124\"/> <rect x=\"28\" y=\"40\" width=\"44\" height=\"20\" rx=\"9\" fill=\"var(--ill-c)\"/> <circle cx=\"92\" cy=\"66\" r=\"1.5\"/><circle cx=\"112\" cy=\"66\" r=\"1.5\"/><circle cx=\"132\" cy=\"66\" r=\"1.5\"/> <circle cx=\"40\" cy=\"83\" r=\"1.5\"/><circle cx=\"64\" cy=\"83\" r=\"1.5\"/><circle cx=\"88\" cy=\"83\" r=\"1.5\"/><circle cx=\"112\" cy=\"83\" r=\"1.5\"/> <path d=\"M24 92v8M136 92v8\"/>",
  labcoat: "<path d=\"M62 16 50 22 34 44l10 10 10-10v58h52V44l10 10 10-10-16-22-12-6-18 20z\" fill=\"var(--ill-b)\"/> <path d=\"M62 16l18 30 18-30M80 46v56\"/><rect x=\"88\" y=\"66\" width=\"12\" height=\"12\" rx=\"2\" fill=\"var(--ill-c)\"/> <circle cx=\"74\" cy=\"60\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"74\" cy=\"76\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"74\" cy=\"92\" r=\"1.6\" fill=\"currentColor\"/> <path d=\"M92 66v-6\" stroke=\"var(--ill-a)\"/>",
  kettle: "<path d=\"M54 46h50l6 48H48z\" fill=\"var(--ill-b)\"/><path d=\"M60 46c0-14 38-14 38 0\"/> <path d=\"M104 54c14 0 16 26 2 28\"/><path d=\"M54 58 38 46\" /><rect x=\"44\" y=\"94\" width=\"70\" height=\"10\" rx=\"3\" fill=\"var(--ill-a)\"/> <path d=\"M66 70h26\" />",
  lamp: "<rect x=\"40\" y=\"96\" width=\"56\" height=\"10\" rx=\"4\" fill=\"var(--ill-a)\"/><path d=\"M68 96 52 58l40-26\"/> <circle cx=\"52\" cy=\"58\" r=\"4\" fill=\"var(--ill-b)\"/><path d=\"M84 24l26 20-10 12-26-20z\" fill=\"var(--ill-c)\"/><path d=\"M100 56l8 14\" stroke-dasharray=\"2 5\"/>",
  drafter: "<rect x=\"22\" y=\"22\" width=\"116\" height=\"80\" rx=\"4\" fill=\"var(--ill-b)\"/><path d=\"M30 34h100\" stroke-width=\"5\"/> <path d=\"M44 92 44 46 96 92z\" fill=\"var(--ill-c)\"/><path d=\"M54 84V66l20 18z\"/><path d=\"M104 44l24 24\" /><circle cx=\"104\" cy=\"44\" r=\"5\" fill=\"var(--ill-a)\"/>",
  hoodie: "<path d=\"M60 22c4-8 36-8 40 0l22 12 14 34-14 6-6-14v46H44V60l-6 14-14-6 14-34z\" fill=\"var(--ill-b)\"/> <path d=\"M60 22c2 16 38 16 40 0\"/><path d=\"M72 36v12M88 36v12\"/><rect x=\"62\" y=\"78\" width=\"36\" height=\"16\" rx=\"4\" fill=\"var(--ill-c)\"/>",
  headphones: "<path d=\"M38 74V64a42 42 0 0 1 84 0v10\" /><rect x=\"30\" y=\"66\" width=\"22\" height=\"36\" rx=\"8\" fill=\"var(--ill-a)\"/> <rect x=\"108\" y=\"66\" width=\"22\" height=\"36\" rx=\"8\" fill=\"var(--ill-a)\"/><path d=\"M52 76h-6M108 76h6\" /> <path d=\"M44 64a36 36 0 0 1 72 0\" stroke-dasharray=\"3 6\"/>",
  bucket: "<path d=\"M38 50h66l-8 52H46z\" fill=\"var(--ill-b)\"/><path d=\"M38 50c0-32 66-32 66 0\" fill=\"none\"/><path d=\"M40 62h62\"/> <path d=\"M108 70h20l-2 30h-16z\" fill=\"var(--ill-a)\"/><path d=\"M128 76c8 0 8 16 0 16\"/>",
  box: "<path d=\"M30 46 80 28l50 18v50l-50 18-50-18z\" fill=\"var(--ill-b)\"/><path d=\"M30 46l50 18 50-18M80 64v50\"/> <path d=\"M30 46 18 62l50 18 12-16\" fill=\"var(--ill-c)\"/><path d=\"M130 46l12 16-50 18-12-16\" fill=\"var(--ill-c)\"/>",
};

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg
      className={className ? `ill ${className}` : "ill"}
      viewBox="0 0 160 120"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ART[name] ?? ART.box }}
    />
  );
}
