import { prisma } from "@/lib/prisma";
import ThemeProvider from "@/components/ThemeProvider";
import BookmarkProvider from "@/components/BookmarkProvider";
import AppShell from "@/components/AppShell";
import ChatPageClient from "@/components/ChatPageClient";

export const revalidate = 10;

export default async function ChatPage() {
  const lore = await prisma.loreEntry.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <ThemeProvider>
      <BookmarkProvider>
        <AppShell entries={lore}>
          <ChatPageClient />
        </AppShell>
      </BookmarkProvider>
    </ThemeProvider>
  );
}
