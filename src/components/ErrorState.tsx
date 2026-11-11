import Link from "next/link";
import { Icon } from "@/components/Icon";

export function ErrorState({
  title,
  message = "Your connection dropped or our server is having a moment. Nothing you did is lost.",
  retryHref,
}: {
  title: string;
  message?: string;
  retryHref?: string;
}) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon">
        <Icon name="wifiOff" />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {retryHref ? (
        <div className="state__actions">
          <Link className="btn btn--primary btn--sm" href={retryHref}>
            <Icon name="refresh" />
            Try again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
