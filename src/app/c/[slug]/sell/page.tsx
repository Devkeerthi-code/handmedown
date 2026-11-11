import type { Metadata } from "next";
import { requireMe } from "@/lib/auth";
import { allowedDomains } from "@/app/actions/auth";
import { ListingForm } from "@/components/sell/ListingForm";
import { VerifyGate } from "@/components/sell/VerifyGate";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Sell an item" };

export default async function SellPage() {
  const me = await requireMe("/sell");

  if (me.banned) {
    return (
      <div className="container page">
        <p className="notice notice--error">
          <Icon name="ban" />
          Your account can&apos;t post listings. If you think this is a mistake, contact the HandMeDown admins.
        </p>
      </div>
    );
  }

  if (!me.verified) {
    return (
      <div className="container page">
        <VerifyGate domains={await allowedDomains()} currentEmail={me.email} />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="sell">
        <div className="page__head">
          <h1>Sell, swap or give away</h1>
          <p>Takes about a minute. You can edit or mark it sold any time.</p>
        </div>
      </div>
      <ListingForm userId={me.id} />
    </div>
  );
}
