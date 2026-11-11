import Image from "next/image";

const PX = { sm: 32, md: 44, lg: 72 } as const;

/** Up to 5 characters fit the tile; longer short names fall back to their first 4. */
export function monogramText(shortName: string) {
  const compact = shortName.replace(/\s+/g, "").toUpperCase();
  return compact.length <= 5 ? compact : compact.slice(0, 4);
}

/**
 * The college's uploaded logo, or a monogram tile of its short name painted in the
 * college accent (reads --accent / --on-accent, so it follows the nearest [data-college]).
 */
export function CollegeLogo({
  name,
  shortName,
  logoUrl,
  size = "md",
  decorative = false,
}: {
  name: string;
  shortName: string;
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
  /** Set when the college name is printed right next to the logo, so screen readers don't hear it twice. */
  decorative?: boolean;
}) {
  const px = PX[size];
  if (logoUrl) {
    return (
      <span className={`clogo clogo--${size} clogo--img`}>
        <Image src={logoUrl} alt={decorative ? "" : `${name} logo`} width={px} height={px} unoptimized />
      </span>
    );
  }
  const text = monogramText(shortName || name.slice(0, 2));
  return (
    <span
      className={`clogo clogo--${size} clogo--mono`}
      data-len={Math.min(text.length, 5)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${name} logo`}
      aria-hidden={decorative ? true : undefined}
    >
      {text}
    </span>
  );
}
