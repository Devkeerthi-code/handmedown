import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isMemberOf, requireMe } from "@/lib/auth";
import { getCollegeBySlug } from "@/lib/college";
import { ListingForm } from "@/components/sell/ListingForm";
import { MemberGate } from "@/components/college/MemberGate";

export const metadata: Metadata = { title: "Sell an item" };

export default async function SellPage({ params }: PageProps<"/c/[slug]/sell">) {
  const college = await getCollegeBySlug((await params).slug);
  if (!college) notFound();
  const base = `/c/${college.slug}`;
  const me = await requireMe(`${base}/sell`);

  if (!isMemberOf(me, college.id) || college.status !== "active") {
    return (
      <div className="container page">
        <MemberGate me={me} college={college} action="post listings" />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="sell">
        <div className="page__head">
          <h1>Sell, swap or give away</h1>
          <p>Takes about a minute. Only verified {college.shortName} students can message you about it.</p>
        </div>
      </div>
      <ListingForm
        userId={me.id}
        collegeId={college.id}
        base={base}
        pickupSpots={college.pickupSpots}
        categories={college.categories}
      />
    </div>
  );
}
