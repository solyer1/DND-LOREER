import { prisma } from "@/lib/prisma";
import ApiTestButton from "@/components/ApiTestButton";
import LoreCard from "@/components/LoreCard";

export const revalidate = 10; // Revalidate every 10 seconds

export default async function Home() {
  const loreEntries = await prisma.loreEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-600/30">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-amber-900/20 to-transparent pointer-events-none"></div>

      <main className="relative max-w-5xl mx-auto px-6 py-20">
        <header className="text-center mb-20 space-y-4">
          <h1 className="text-5xl md:text-7xl font-serif tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600">
            Campaign Chronicles
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Echoes from the realm, captured and preserved for eternity.
          </p>
          <ApiTestButton />
        </header>

        {loreEntries.length === 0 ? (
          <div className="text-center py-20 text-neutral-500 border border-neutral-800/50 rounded-2xl bg-neutral-900/20 backdrop-blur-sm">
            <p className="text-xl">The archives are empty.</p>
            <p className="text-sm mt-2">Awaiting new tales from the Discord realm...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {loreEntries.map((entry) => (
              <LoreCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
