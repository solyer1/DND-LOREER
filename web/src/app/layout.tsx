import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "King's Sanctuary — D&D Lore Archive",
  description:
    "A comprehensive wiki-style archive of D&D campaign lore, combat mechanics, and world-building knowledge.",
  keywords: ["D&D", "Dungeons and Dragons", "Lore", "Campaign", "Wiki", "Archive"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${cinzel.variable} h-full antialiased font-sans`}
      suppressHydrationWarning
    >
      <head suppressHydrationWarning>
        {/* Prevent FOUC for theme */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'light' || t === 'dark') {
                  document.documentElement.setAttribute('data-theme', t);
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
