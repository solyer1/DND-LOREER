import { prisma } from "@/lib/prisma";
import ApiTestButton from "@/components/ApiTestButton";
import LoreDashboard from "@/components/LoreDashboard";

export const revalidate = 10; // Revalidate every 10 seconds

export default async function Home() {
  const loreEntries = await prisma.loreEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-600/30">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-amber-900/20 to-transparent pointer-events-none"></div>

      <main className="relative w-full max-w-[95%] xl:max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-20">
        <header className="text-center mb-12 md:mb-16 space-y-4">
          <h1 className="text-5xl md:text-7xl font-serif tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600">
            King's Sanctuary
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Sanctuary of a King where,The Knowledge of the Universe is Stored.
          </p>
          <ApiTestButton />
        </header>

        <LoreDashboard initialEntries={loreEntries} />
      </main>
    </div>
  );
}
