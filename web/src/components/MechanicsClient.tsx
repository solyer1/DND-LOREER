"use client";

import ThemeProvider from "@/components/ThemeProvider";
import BookmarkProvider from "@/components/BookmarkProvider";
import AppShell from "@/components/AppShell";
import MechanicsPage from "@/components/MechanicsPage";

export default function MechanicsClient({ homebrewEntries }: { homebrewEntries: any[] }) {
  return (
    <ThemeProvider>
      <BookmarkProvider>
        <AppShell>
          <MechanicsPage homebrewEntries={homebrewEntries} />
        </AppShell>
      </BookmarkProvider>
    </ThemeProvider>
  );
}
