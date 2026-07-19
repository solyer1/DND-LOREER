"use client";

import { useState, useMemo, useEffect, useDeferredValue, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import LoreCard from "./LoreCard";
import Breadcrumbs from "./Breadcrumbs";
import AlphabetBar from "./AlphabetBar";
import { CATEGORIES, CATEGORY_CONFIG, getCategoryForEntry } from "./CategoryIcon";
import { useBookmarks } from "./BookmarkProvider";

type ViewMode = "grid" | "reading";

export default function WikiDashboard({ initialEntries }: { initialEntries: any[] }) {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTab, setActiveTab] = useState("All");
  const [activeSubTab, setActiveSubTab] = useState("All");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const { bookmarks, isBookmarked } = useBookmarks();

  // Check for bookmarks view from URL
  const isBookmarksView = searchParams.get("view") === "bookmarks";

  const handleSelectEntry = useCallback((entry: any) => {
    setSelectedEntry(entry);
    // Increment view count
    try {
      const counts = JSON.parse(localStorage.getItem("viewCounts") || "{}");
      counts[entry.id] = (counts[entry.id] || 0) + 1;
      localStorage.setItem("viewCounts", JSON.stringify(counts));
    } catch { /* ignore */ }
  }, []);

  // Reset sub-tab when main tab changes
  useEffect(() => {
    setActiveSubTab("All");
    setActiveLetter(null);
  }, [activeTab]);

  // The 10 predefined Main Categories + All
  const topTabs = ["All", ...CATEGORIES];

  // Derive sub-tabs dynamically
  const subTabs = useMemo(() => {
    if (activeTab === "All") return [];
    const tagCounts: Record<string, number> = {};
    initialEntries.forEach((entry) => {
      const entryTagsStr = entry.tags ? entry.tags.toLowerCase() : "";
      if (entryTagsStr.includes(activeTab.toLowerCase())) {
        entry.tags.split(",").forEach((t: string) => {
          const tag = t.trim();
          const tagLower = tag.toLowerCase();
          if (tagLower && tagLower !== activeTab.toLowerCase()) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        });
      }
    });
    const sortedSubTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    return ["All", ...sortedSubTags];
  }, [initialEntries, activeTab]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let entries = initialEntries;

    // Bookmarks filter
    if (isBookmarksView) {
      entries = entries.filter((entry) => isBookmarked(entry.id));
    }

    return entries.filter((entry) => {
      // Tab Filter
      if (activeTab !== "All") {
        const entryTags = entry.tags ? entry.tags.toLowerCase() : "";
        if (!entryTags.includes(activeTab.toLowerCase())) return false;
      }
      // Sub-Tab Filter
      if (activeSubTab !== "All") {
        const entryTags = entry.tags ? entry.tags.toLowerCase() : "";
        if (!entryTags.includes(activeSubTab.toLowerCase())) return false;
      }
      // Letter filter
      if (activeLetter) {
        if (!entry.title?.toUpperCase().startsWith(activeLetter)) return false;
      }
      // Search Filter
      if (deferredSearchQuery.trim() !== "") {
        const query = deferredSearchQuery.toLowerCase();
        const titleMatch = entry.title?.toLowerCase().includes(query);
        const contentMatch = entry.content?.toLowerCase().includes(query);
        const authorMatch = entry.author?.toLowerCase().includes(query);
        const tagsMatch = entry.tags?.toLowerCase().includes(query);
        if (!titleMatch && !contentMatch && !authorMatch && !tagsMatch) return false;
      }
      return true;
    });
  }, [initialEntries, activeTab, activeSubTab, deferredSearchQuery, activeLetter, isBookmarksView, isBookmarked]);

  // Available letters for the alphabet bar
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    filteredEntries.forEach((entry) => {
      const firstChar = entry.title?.charAt(0)?.toUpperCase();
      if (firstChar && /[A-Z]/.test(firstChar)) letters.add(firstChar);
    });
    return letters;
  }, [filteredEntries]);

  // Related entries for modal
  const relatedEntries = useMemo(() => {
    if (!selectedEntry?.tags) return [];
    const selectedTags = selectedEntry.tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean);
    return initialEntries
      .filter((e) => {
        if (e.id === selectedEntry.id) return false;
        if (!e.tags) return false;
        const eTags = e.tags.split(",").map((t: string) => t.trim().toLowerCase());
        return selectedTags.some((st: string) => eTags.includes(st));
      })
      .slice(0, 6);
  }, [selectedEntry, initialEntries]);

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; onClick?: () => void }[] = [{ label: "🏠 Home", onClick: () => { setActiveTab("All"); setSelectedEntry(null); } }];
    if (isBookmarksView) {
      items.push({ label: "⭐ Bookmarks" });
    } else if (activeTab !== "All") {
      const config = CATEGORY_CONFIG[activeTab as keyof typeof CATEGORY_CONFIG];
      items.push({ label: `${config?.icon || ""} ${activeTab}`, onClick: () => setSelectedEntry(null) });
    }
    if (activeSubTab !== "All") {
      items.push({ label: activeSubTab });
    }
    if (selectedEntry) {
      items.push({ label: selectedEntry.title });
    }
    return items;
  }, [activeTab, activeSubTab, selectedEntry, isBookmarksView]);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* Page Title */}
      <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: "var(--text-accent)" }}>
            {isBookmarksView ? "⭐ Bookmarked Lore" : "Lore Archive"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            {activeTab !== "All" && ` in ${activeTab}`}
            {activeLetter && ` starting with "${activeLetter}"`}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div
          className="flex rounded-xl overflow-hidden no-print"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <button
            onClick={() => setViewMode("grid")}
            className="px-3 py-2 text-sm transition-all"
            style={{
              background: viewMode === "grid" ? "var(--accent-600)" : "transparent",
              color: viewMode === "grid" ? "white" : "var(--text-tertiary)",
            }}
            title="Grid View"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("reading")}
            className="px-3 py-2 text-sm transition-all"
            style={{
              background: viewMode === "reading" ? "var(--accent-600)" : "transparent",
              color: viewMode === "reading" ? "white" : "var(--text-tertiary)",
            }}
            title="Reading View"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!isBookmarksView && (
        <div className="flex flex-wrap gap-1.5 no-print">
          {topTabs.map((tab) => {
            const config = tab !== "All" ? CATEGORY_CONFIG[tab as keyof typeof CATEGORY_CONFIG] : null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === tab ? "shadow-md" : ""
                }`}
                style={{
                  background: activeTab === tab ? "var(--accent-600)" : "var(--bg-tertiary)",
                  color: activeTab === tab ? "white" : "var(--text-secondary)",
                  border: activeTab === tab ? "1px solid var(--accent-500)" : "1px solid var(--border-subtle)",
                }}
              >
                {config && <span className="text-xs">{config.icon}</span>}
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {/* Sub Tabs */}
      {subTabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 no-print">
          {subTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeSubTab === tab ? "rgba(99, 102, 241, 0.2)" : "var(--bg-elevated)",
                color: activeSubTab === tab ? "#a5b4fc" : "var(--text-tertiary)",
                border: activeSubTab === tab ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid var(--border-subtle)",
              }}
            >
              {tab === "All" ? `All ${activeTab}s` : tab}
            </button>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full sticky top-16 z-10 no-print">
        <input
          type="text"
          placeholder="Search lore by title, content, author, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm rounded-xl pl-10 pr-4 py-3 backdrop-blur-xl transition-all focus:outline-none"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: "var(--text-tertiary)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Alphabet Bar */}
      <AlphabetBar
        availableLetters={availableLetters}
        activeLetter={activeLetter}
        onLetterClick={setActiveLetter}
      />

      {/* Results */}
      {filteredEntries.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
            color: "var(--text-tertiary)",
          }}
        >
          <p className="text-4xl mb-4">📭</p>
          <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>No lore found</p>
          <p className="text-sm mt-2">Try adjusting your search, filters, or selecting a different category.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 space-y-5 stagger-children">
          {filteredEntries.map((entry: any) => (
            <div key={entry.id} className="break-inside-avoid">
              <LoreCard entry={entry} onClick={handleSelectEntry} />
            </div>
          ))}
        </div>
      ) : (
        /* Reading View — Single column, wider cards */
        <div className="max-w-4xl mx-auto space-y-4 stagger-children">
          {filteredEntries.map((entry: any) => (
            <LoreCard key={entry.id} entry={entry} onClick={handleSelectEntry} isReadingView />
          ))}
        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 pt-16 overflow-y-auto">
          <div
            className="absolute inset-0 backdrop-blur-sm transition-opacity"
            style={{ background: "var(--bg-overlay)" }}
            onClick={() => setSelectedEntry(null)}
          />
          <div
            className="relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in my-8"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-accent)" }}
          >
            <LoreCard
              entry={selectedEntry}
              isModal={true}
              onClose={() => setSelectedEntry(null)}
              relatedEntries={relatedEntries}
              onSelectRelated={(entry) => {
                setSelectedEntry(entry);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
