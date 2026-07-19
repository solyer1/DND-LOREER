"use client";

import ThemeProvider from "@/components/ThemeProvider";
import BookmarkProvider from "@/components/BookmarkProvider";
import AppShell from "@/components/AppShell";
import WikiDashboard from "@/components/WikiDashboard";

export default function HomeClient({ loreEntries }: { loreEntries: any[] }) {
  return (
    <ThemeProvider>
      <BookmarkProvider>
        <AppShell entries={loreEntries}>
          <WikiDashboard initialEntries={loreEntries} />
        </AppShell>
      </BookmarkProvider>
    </ThemeProvider>
  );
}
