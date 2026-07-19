import React from "react";

// ═══════════════════════════════════════════
// CATEGORY CONFIG — Colors + Icons
// ═══════════════════════════════════════════

export const CATEGORIES = [
  "Story", "Character", "Location", "History",
  "Item", "Faction", "Magic", "Terminology", "Event", "Rule"
] as const;

export type Category = (typeof CATEGORIES)[number];

interface CategoryConfig {
  icon: string;
  color: string;
  bgClass: string;
  cssClass: string;
  label: string;
}

export const CATEGORY_CONFIG: Record<Category, CategoryConfig> = {
  Story:       { icon: "📜", color: "#f59e0b", bgClass: "bg-amber-900/20 text-amber-400 border-amber-900/30", cssClass: "cat-story", label: "Story" },
  Character:   { icon: "👤", color: "#a78bfa", bgClass: "bg-violet-900/20 text-violet-400 border-violet-900/30", cssClass: "cat-character", label: "Character" },
  Location:    { icon: "🗺️", color: "#34d399", bgClass: "bg-emerald-900/20 text-emerald-400 border-emerald-900/30", cssClass: "cat-location", label: "Location" },
  History:     { icon: "📚", color: "#fb923c", bgClass: "bg-orange-900/20 text-orange-400 border-orange-900/30", cssClass: "cat-history", label: "History" },
  Item:        { icon: "⚔️", color: "#22d3ee", bgClass: "bg-cyan-900/20 text-cyan-400 border-cyan-900/30", cssClass: "cat-item", label: "Item" },
  Faction:     { icon: "🏰", color: "#fb7185", bgClass: "bg-rose-900/20 text-rose-400 border-rose-900/30", cssClass: "cat-faction", label: "Faction" },
  Magic:       { icon: "✨", color: "#818cf8", bgClass: "bg-indigo-900/20 text-indigo-400 border-indigo-900/30", cssClass: "cat-magic", label: "Magic" },
  Terminology: { icon: "📖", color: "#2dd4bf", bgClass: "bg-teal-900/20 text-teal-400 border-teal-900/30", cssClass: "cat-terminology", label: "Terminology" },
  Event:       { icon: "⚡", color: "#facc15", bgClass: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30", cssClass: "cat-event", label: "Event" },
  Rule:        { icon: "📋", color: "#94a3b8", bgClass: "bg-slate-800/30 text-slate-400 border-slate-700/30", cssClass: "cat-rule", label: "Rule" },
};

export function getCategoryForEntry(tags: string | null): Category | null {
  if (!tags) return null;
  const tagsLower = tags.toLowerCase();
  for (const cat of CATEGORIES) {
    if (tagsLower.includes(cat.toLowerCase())) {
      return cat;
    }
  }
  return null;
}

export function getCategoryConfig(tags: string | null): CategoryConfig {
  const cat = getCategoryForEntry(tags);
  if (cat) return CATEGORY_CONFIG[cat];
  return { icon: "📄", color: "#a1a1aa", bgClass: "bg-neutral-800/30 text-neutral-400 border-neutral-700/30", cssClass: "", label: "Uncategorized" };
}

export function CategoryBadge({ tags, size = "sm" }: { tags: string | null; size?: "sm" | "md" }) {
  const config = getCategoryConfig(tags);
  const sizeClass = size === "md" ? "text-sm px-3 py-1.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bgClass} ${sizeClass}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
