import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">📜 Rundenverteiler</h1>
        <p className="mt-2 italic text-muted">
          Such dir deinen Tisch aus. Die Würfel sind schon warm.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dm"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🗡️</span>
          <h2 className="mt-2 font-semibold text-accent">Du leitest eine Runde</h2>
          <p className="mt-1 text-sm text-muted">
            Trag ein, was du spielst — Titel, Stimmung, Plätze.
          </p>
        </Link>

        <Link
          href="/rank"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🛡️</span>
          <h2 className="mt-2 font-semibold text-accent">Du spielst mit</h2>
          <p className="mt-1 text-sm text-muted">
            Sag zu jedem Tisch, wie sehr du willst.
          </p>
        </Link>

        <Link
          href="/admin"
          className="rounded-lg border border-line bg-card p-4 hover:border-accent"
        >
          <span className="text-2xl">🏰</span>
          <h2 className="mt-2 font-semibold text-accent">Wirt (Verwaltung)</h2>
          <p className="mt-1 text-sm text-muted">Auslosen und alle an ihre Tische setzen.</p>
        </Link>
      </div>
    </div>
  );
}
