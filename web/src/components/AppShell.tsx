"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useBookmarks } from "./BookmarkProvider";
import DeduplicateModal from "./DeduplicateModal";
import { CATEGORIES, CATEGORY_CONFIG, getCategoryForEntry, type Category } from "./CategoryIcon";

interface AppShellProps {
  children: React.ReactNode;
  entries?: any[];
}

export default function AppShell({ children, entries = [] }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isDedupeOpen, setIsDedupeOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { bookmarks } = useBookmarks();
  const pathname = usePathname();

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((cat) => { counts[cat] = 0; });
    counts["Uncategorized"] = 0;
    entries.forEach((entry) => {
      const cat = getCategoryForEntry(entry.tags);
      if (cat) counts[cat]++;
      else counts["Uncategorized"]++;
    });
    return counts;
  }, [entries]);

  // Sub-tags per category
  const subTagsPerCategory = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    CATEGORIES.forEach((cat) => { result[cat] = {}; });
    entries.forEach((entry) => {
      const mainCat = getCategoryForEntry(entry.tags);
      if (!mainCat || !entry.tags) return;
      entry.tags.split(",").forEach((t: string) => {
        const tag = t.trim();
        if (tag && tag.toLowerCase() !== mainCat.toLowerCase()) {
          result[mainCat][tag] = (result[mainCat][tag] || 0) + 1;
        }
      });
    });
    return result;
  }, [entries]);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const bookmarkedCount = bookmarks.size;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "var(--bg-overlay)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`sidebar fixed top-0 left-0 z-50 h-full overflow-y-auto overflow-x-hidden transition-transform duration-300 ease-out lg:sticky lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "var(--sidebar-width)",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <Link href="/" className="flex items-center gap-3 group" onClick={() => setSidebarOpen(false)}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: "var(--accent-900)", border: "1px solid var(--border-accent)" }}>
                👑
              </div>
              <div>
                <h1 className="text-base font-serif font-bold tracking-wide" style={{ color: "var(--text-accent)" }}>
                  King's Sanctuary
                </h1>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
                  Lore Archive
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1">
            {/* Home / Lore */}
            <Link
              href="/"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === "/" ? "shadow-sm" : ""
              }`}
              style={{
                background: pathname === "/" ? "var(--sidebar-active)" : "transparent",
                color: pathname === "/" ? "var(--text-accent)" : "var(--text-secondary)",
                border: pathname === "/" ? "1px solid var(--border-accent)" : "1px solid transparent",
              }}
            >
              <span className="text-base">📜</span>
              <span>Lore Archive</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
                {entries.length}
              </span>
            </Link>

            {/* Mechanics */}
            <Link
              href="/mechanics"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === "/mechanics" ? "shadow-sm" : ""
              }`}
              style={{
                background: pathname === "/mechanics" ? "var(--sidebar-active)" : "transparent",
                color: pathname === "/mechanics" ? "var(--text-accent)" : "var(--text-secondary)",
                border: pathname === "/mechanics" ? "1px solid var(--border-accent)" : "1px solid transparent",
              }}
            >
              <span className="text-base">⚔️</span>
              <span>Combat & Mechanics</span>
            </Link>

            {/* Bookmarks */}
            <Link
              href="/?view=bookmarks"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid transparent",
              }}
            >
              <span className="text-base">⭐</span>
              <span>Bookmarks</span>
              {bookmarkedCount > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-900)", color: "var(--text-accent)" }}>
                  {bookmarkedCount}
                </span>
              )}
            </Link>

            {/* Divider */}
            <div className="py-3">
              <div className="h-px" style={{ background: "var(--border-subtle)" }} />
            </div>

            {/* Category Header */}
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
              Categories
            </p>

            {/* Category Tree */}
            <div className="space-y-0.5">
              {CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const count = categoryCounts[cat] || 0;
                const isExpanded = expandedCategories.has(cat);
                const subTags = subTagsPerCategory[cat] || {};
                const subTagEntries = Object.entries(subTags).sort((a, b) => b[1] - a[1]);
                const hasSubTags = subTagEntries.length > 0;

                return (
                  <div key={cat}>
                    <button
                      onClick={() => hasSubTags && toggleCategory(cat)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        color: count > 0 ? "var(--text-secondary)" : "var(--text-tertiary)",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--sidebar-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {hasSubTags && (
                        <svg
                          className="w-3 h-3 flex-shrink-0 accordion-chevron"
                          data-open={isExpanded ? "true" : "false"}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                      {!hasSubTags && <span className="w-3" />}
                      <span className="text-sm">{config.icon}</span>
                      <span className="truncate">{cat}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
                        {count}
                      </span>
                    </button>

                    {/* Sub-tags */}
                    {isExpanded && subTagEntries.length > 0 && (
                      <div className="ml-8 mt-0.5 space-y-0.5 animate-fade-in">
                        {subTagEntries.slice(0, 10).map(([tag, tagCount]) => (
                          <div
                            key={tag}
                            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            <span className="w-1 h-1 rounded-full" style={{ background: config.color }} />
                            <span className="truncate">{tag}</span>
                            <span className="ml-auto text-[10px]">{tagCount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="py-3">
              <div className="h-px" style={{ background: "var(--border-subtle)" }} />
            </div>

            {/* Admin Tools (Collapsible) */}
            <AdminToolsSection />
          </nav>

          {/* Footer */}
          <div className="p-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-2"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span className="text-base">{theme === "dark" ? "🌙" : "☀️"}</span>
              <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
            <button
              onClick={() => {
                alert("Sidebar button clicked!");
                setIsDedupeOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span className="text-base">✨</span>
              <span>Find Duplicates</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-w-0">
        {/* Top Bar */}
        <header
          className="topbar sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 py-3 backdrop-blur-xl no-print"
          style={{
            background: `color-mix(in srgb, var(--bg-primary) 80%, transparent)`,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {/* Mobile Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile Logo */}
          <Link href="/" className="lg:hidden font-serif font-bold text-sm" style={{ color: "var(--text-accent)" }}>
            👑 King's Sanctuary
          </Link>

          <div className="flex-1" />

          {/* Desktop Theme Toggle */}
          <button
            onClick={() => {
              alert("Topbar button clicked! Opening modal...");
              setIsDedupeOpen(true);
            }}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{ color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Find Duplicates"
          >
            ✨ Duplicates
          </button>
          <button
            onClick={toggleTheme}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{ color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </header>

        {/* Page Content */}
        <main className="relative">
          {children}
        </main>
      </div>

      <DeduplicateModal isOpen={isDedupeOpen} onClose={() => setIsDedupeOpen(false)} entries={entries} />
    </div>
  );
}

/* ═══ Admin Tools Sub-component ═══ */
function AdminToolsSection() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const testLoreApi = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/lore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Lore Entry",
          content: "This is a test lore entry generated by the API test button.",
          author: "Admin Test",
          channelName: "test-channel",
        }),
      });
      if (response.ok) {
        alert("✅ Lore API test successful! Reloading...");
        window.location.reload();
      } else {
        const data = await response.json();
        alert(`❌ API test failed: ${data.error}`);
      }
    } catch {
      alert("❌ API test failed due to network error.");
    } finally {
      setLoading(false);
    }
  };

  const testAiApi = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        alert(`✅ AI says: ${data.message}`);
      } else {
        const data = await response.json();
        alert(`❌ AI test failed: ${data.error}`);
      }
    } catch {
      alert("❌ AI test failed due to network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
        style={{ color: "var(--text-tertiary)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <svg
          className="w-3 h-3 accordion-chevron"
          data-open={open ? "true" : "false"}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span>🛠️ Admin Tools</span>
      </button>
      {open && (
        <div className="ml-6 mt-1 space-y-1 animate-fade-in">
          <button
            onClick={testLoreApi}
            disabled={loading}
            className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {loading ? "Testing..." : "Test Lore API"}
          </button>
          <button
            onClick={testAiApi}
            disabled={loading}
            className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all disabled:opacity-50"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {loading ? "Testing..." : "Test AI API"}
          </button>
        </div>
      )}
    </div>
  );
}
