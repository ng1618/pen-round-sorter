import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">📜 Round Sorter</h1>
        <p className="mt-2 italic text-muted">
          Choose your table, adventurer. The dice are already warm.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dm"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🗡️</span>
          <h2 className="mt-2 font-semibold text-accent">Running a round</h2>
          <p className="mt-1 text-sm text-muted">
            Post your quest — name, vibe, and how many seats.
          </p>
        </Link>

        <Link
          href="/rank"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🛡️</span>
          <h2 className="mt-2 font-semibold text-accent">Joining as a player</h2>
          <p className="mt-1 text-sm text-muted">
            Rank the tables you&apos;d most want to sit at.
          </p>
        </Link>

        <Link
          href="/admin"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🏰</span>
          <h2 className="mt-2 font-semibold text-accent">Innkeeper (admin)</h2>
          <p className="mt-1 text-sm text-muted">Seat everyone and run the draw.</p>
        </Link>
      </div>
    </div>
  );
}
