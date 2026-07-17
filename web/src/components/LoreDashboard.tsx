"use client";

import { useState, useMemo, useEffect } from "react";
import LoreCard from "./LoreCard";

export default function LoreDashboard({ initialEntries }: { initialEntries: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [activeSubTab, setActiveSubTab] = useState("All");

  // Reset sub-tab when main tab changes
  useEffect(() => {
    setActiveSubTab("All");
  }, [activeTab]);

  // The 10 predefined Main Categories + All
  const topTabs = [
    "All", "Story", "Character", "Location", "History", 
    "Item", "Faction", "Magic", "Terminology", "Event", "Rule"
  ];

  // Derive sub-tabs dynamically when a specific main tab is selected
  const subTabs = useMemo(() => {
    if (activeTab === "All") return [];
    
    const tagCounts: Record<string, number> = {};
    initialEntries.forEach((entry) => {
      const entryTagsStr = entry.tags ? entry.tags.toLowerCase() : "";
      if (entryTagsStr.includes(activeTab.toLowerCase())) {
        entry.tags.split(",").forEach((t: string) => {
          const tag = t.trim();
          const tagLower = tag.toLowerCase();
          // Exclude the main tab itself
          if (tagLower && tagLower !== activeTab.toLowerCase()) {
            // Store original casing in the key, but we'll normalize when picking
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
    return initialEntries.filter((entry) => {
      // 1. Tab Filter
      if (activeTab !== "All") {
        const entryTags = entry.tags ? entry.tags.toLowerCase() : "";
        if (!entryTags.includes(activeTab.toLowerCase())) {
          return false;
        }
      }

      // 1.5. Sub-Tab Filter
      if (activeSubTab !== "All") {
        const entryTags = entry.tags ? entry.tags.toLowerCase() : "";
        if (!entryTags.includes(activeSubTab.toLowerCase())) {
          return false;
        }
      }

      // 2. Search Filter (Title, Content, Author, AND Tags)
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const titleMatch = entry.title?.toLowerCase().includes(query);
        const contentMatch = entry.content?.toLowerCase().includes(query);
        const authorMatch = entry.author?.toLowerCase().includes(query);
        const tagsMatch = entry.tags?.toLowerCase().includes(query);
        if (!titleMatch && !contentMatch && !authorMatch && !tagsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [initialEntries, activeTab, activeSubTab, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Search and Tabs */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 backdrop-blur-md shadow-lg sticky top-6 z-10">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {topTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.3)]"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search lore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-700/50 text-neutral-200 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-neutral-600"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Sub Tabs */}
        {subTabs.length > 1 && (
          <div className="mt-4 pt-4 border-t border-neutral-800/50 flex flex-wrap gap-2">
            {subTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === tab
                    ? "bg-indigo-600/80 text-white shadow-[0_0_8px_rgba(79,70,229,0.4)] border border-indigo-500/50"
                    : "bg-indigo-950/30 text-indigo-300 border border-indigo-900/50 hover:bg-indigo-900/50 hover:text-indigo-200"
                }`}
              >
                {tab === "All" ? `All ${activeTab}s` : tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-20 text-neutral-500 border border-neutral-800/50 rounded-2xl bg-neutral-900/20 backdrop-blur-sm">
          <p className="text-xl">No lore found matching your criteria.</p>
          <p className="text-sm mt-2">Try adjusting your search or selecting a different tab.</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 gap-8 space-y-8">
          {filteredEntries.map((entry: any) => (
            <div key={entry.id} className="break-inside-avoid">
              <LoreCard entry={entry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
