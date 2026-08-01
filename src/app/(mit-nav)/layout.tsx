import NavBar from "@/components/NavBar";

/**
 * Fuer den Wirt: Startseite und `/admin`. Hier ist Navigation erwuenscht.
 */
export default function MitNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
