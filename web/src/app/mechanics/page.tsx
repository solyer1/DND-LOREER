import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import MechanicsClient from "@/components/MechanicsClient";

export const metadata = {
  title: "Combat & Mechanics — King's Sanctuary",
  description: "D&D 5e combat rules, dice mechanics, status conditions, death & dying, damage types, spellcasting, and rest & recovery reference.",
};

export const revalidate = 10;

export default async function MechanicsRoute() {
  const homebrewEntries = await prisma.loreEntry.findMany({
    where: {
      tags: {
        contains: "Rule",
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--accent-500)" }} />
          <p style={{ color: "var(--text-tertiary)" }}>Loading mechanics...</p>
        </div>
      </div>
    }>
      <MechanicsClient homebrewEntries={homebrewEntries} />
    </Suspense>
  );
}

