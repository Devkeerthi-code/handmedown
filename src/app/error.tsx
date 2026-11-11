"use client";

import { Icon } from "@/components/Icon";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container page">
      <div className="state state--error" role="alert">
        <span className="state__icon">
          <Icon name="wifiOff" />
        </span>
        <h3>Something went wrong</h3>
        <p>Your connection dropped or our server is having a moment. Nothing you did is lost.</p>
        <div className="state__actions">
          <button className="btn btn--primary btn--sm" type="button" onClick={reset}>
            <Icon name="refresh" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
