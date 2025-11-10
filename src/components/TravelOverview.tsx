"use client";

export default function TravelOverview({
  photoCount,
  visitedCountries,
  visitedStates,
  visitedCities,
}: {
  photoCount: number;
  visitedCountries: string[];
  visitedStates: string[];
  visitedCities: string[];
}) {
  return (
    <section className="card">
      <h2 className="text-xl font-semibold">Your Travel Overview</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Photos captured" value={`${photoCount}`} />
        <StatTile label="Countries" value={`${visitedCountries.length}/197`} />
        <StatTile label="States (US)" value={`${visitedStates.length}/50`} />
        <StatTile label="Cities" value={`${visitedCities.length}`} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Counts are cumulative and unique (repeat visits don’t increase totals).
      </div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  );
}
