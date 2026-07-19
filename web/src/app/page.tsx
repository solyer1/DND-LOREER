import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import HomeClient from "@/components/HomeClient";

export const revalidate = 10;

export default async function Home() {
  const loreEntries = await prisma.loreEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--accent-500)" }} />
          <p style={{ color: "var(--text-tertiary)" }}>Loading lore archive...</p>
        </div>
      </div>
    }>
      <HomeClient loreEntries={loreEntries} />
    </Suspense>
  );
}
