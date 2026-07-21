"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface DuplicateGroup {
  original: any;
  duplicates: any[];
}

export default function DeduplicateModal({
  isOpen,
  onClose,
  entries,
}: {
  isOpen: boolean;
  onClose: () => void;
  entries: any[];
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Find duplicates
  const duplicateGroups = useMemo(() => {
    if (!entries) return [];
    
    const groups: DuplicateGroup[] = [];
    const processedIds = new Set<string>();

    // Sort by length descending (keep the longest as original)
    const sortedEntries = [...entries].sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));

    for (let i = 0; i < sortedEntries.length; i++) {
      const parent = sortedEntries[i];
      if (processedIds.has(parent.id)) continue;

      const currentGroup: DuplicateGroup = { original: parent, duplicates: [] };

      for (let j = i + 1; j < sortedEntries.length; j++) {
        const child = sortedEntries[j];
        if (processedIds.has(child.id)) continue;

        const pContent = parent.content?.trim().toLowerCase() || "";
        const cContent = child.content?.trim().toLowerCase() || "";

        if (cContent.length < 10) continue;

        // If child is a substring of parent (or exact match)
        if (pContent.includes(cContent)) {
          currentGroup.duplicates.push(child);
          processedIds.add(child.id);
        }
      }

      if (currentGroup.duplicates.length > 0) {
        groups.push(currentGroup);
      }
    }
    return groups;
  }, [entries]);

  // Pre-select duplicates for deletion
  useEffect(() => {
    if (isOpen) {
      const initialSelection = new Set<string>();
      duplicateGroups.forEach(group => {
        group.duplicates.forEach(d => initialSelection.add(d.id));
      });
      setSelectedIds(initialSelection);
    }
  }, [isOpen, duplicateGroups]);

  if (!isOpen) return null;

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} duplicate entries?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/lore/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete duplicates.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}
      >
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary)" }}>
          <div>
            <h2 className="text-2xl font-serif text-amber-500 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              Find Duplicates
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Found {duplicateGroups.length} group(s) of duplicates. The longest version is kept as original.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
              No duplicates found! Your wiki is clean.
            </div>
          ) : (
            duplicateGroups.map((group, idx) => (
              <div key={idx} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                <div className="px-4 py-2 text-sm font-semibold" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
                  Group {idx + 1}
                </div>
                
                <div className="p-4 flex flex-col gap-3">
                  {/* Original */}
                  <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--bg-tertiary)", border: "1px dashed var(--accent-500)" }}>
                    <input type="checkbox" checked={selectedIds.has(group.original.id)} onChange={() => toggleSelection(group.original.id)} className="mt-1" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 mb-1 block">Original (Kept)</span>
                      <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{group.original.title}</div>
                      <div className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{group.original.content}</div>
                    </div>
                  </div>

                  {/* Duplicates */}
                  {group.duplicates.map(dupe => (
                    <div key={dupe.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--bg-primary)" }}>
                      <input type="checkbox" checked={selectedIds.has(dupe.id)} onChange={() => toggleSelection(dupe.id)} className="mt-1" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-red-400 mb-1 block">Duplicate (To Delete)</span>
                        <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{dupe.title}</div>
                        <div className="text-xs line-clamp-2 opacity-70" style={{ color: "var(--text-secondary)" }}>{dupe.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button 
            onClick={handleBulkDelete}
            disabled={isDeleting || selectedIds.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{ background: "var(--accent-600)" }}
          >
            {isDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
