import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="HandMeDown, go to browse">
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <rect width="32" height="32" rx="9" />
          <path d="M9 16.5V9.5h7l7 7-7 7z" />
          <circle cx="12.5" cy="12.5" r="1.6" />
        </svg>
      </span>
      <span>HandMeDown</span>
    </Link>
  );
}
