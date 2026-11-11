import { SkeletonCard } from "@/components/listing/ListingCard";

export default function Loading() {
  return (
    <div className="container page" aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ height: 32, width: "40%", marginBottom: 24 }} />
      <div className="grid">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
