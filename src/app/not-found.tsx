import Link from "next/link";
import { Illustration } from "@/components/Illustration";

export default function NotFound() {
  return (
    <div className="container page">
      <div className="state">
        <div className="state__art">
          <Illustration name="box" />
        </div>
        <h3>This one&apos;s already been handed down</h3>
        <p>The page doesn&apos;t exist, was removed, or you don&apos;t have access to it.</p>
        <div className="state__actions">
          <Link className="btn btn--primary btn--sm" href="/">
            Back to listings
          </Link>
        </div>
      </div>
    </div>
  );
}
