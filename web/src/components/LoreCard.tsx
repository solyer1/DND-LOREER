"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import TextareaAutosize from "react-textarea-autosize";

import { getCategoryConfig, getCategoryForEntry, CategoryBadge } from "./CategoryIcon";
import { useBookmarks } from "./BookmarkProvider";
import TableOfContents from "./TableOfContents";

export default React.memo(function LoreCard({
  entry,
  onClick,
  isModal = false,
  isReadingView = false,
  onClose,
  relatedEntries = [],
  onSelectRelated,
}: {
  entry: any;
  onClick?: (entry: any) => void;
  isModal?: boolean;
  isReadingView?: boolean;
  onClose?: () => void;
  relatedEntries?: any[];
  onSelectRelated?: (entry: any) => void;
}) {
  const router = useRouter();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [tags, setTags] = useState(entry.tags || "");
  const [imageUrl, setImageUrl] = useState(entry.imageUrl || "");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFixingTitle, setIsFixingTitle] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const tagsList = tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
  const catConfig = getCategoryConfig(entry.tags);
  const bookmarked = isBookmarked(entry.id);

  // View count from localStorage
  const viewCount = useMemo(() => {
    try {
      const counts = JSON.parse(localStorage.getItem("viewCounts") || "{}");
      return counts[entry.id] || 0;
    } catch { return 0; }
  }, [entry.id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lore entry?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lore/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        if (onClose) onClose();
      } else {
        alert("Failed to delete.");
        setIsDeleting(false);
      }
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lore/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, tags, imageUrl: imageUrl.trim() || null }),
      });
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        alert("Failed to update.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (onClick && !isEditing) onClick(entry);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFixTitle = async () => {
    setIsFixingTitle(true);
    try {
      const res = await fetch(`/api/lore/${entry.id}/fix-title`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTitle(data.data.title);
        router.refresh();
      } else {
        const err = await res.json();
        alert(`Failed to fix title: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fix title.");
    } finally {
      setIsFixingTitle(false);
    }
  };

  // ═══ EDIT MODE ═══
  if (isEditing) {
    return (
      <article
        className={`group relative p-6 sm:p-8 rounded-2xl transition-all duration-500 overflow-hidden flex flex-col gap-3 ${isModal ? "w-full" : ""}`}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--accent-500)",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg px-4 py-2 text-xl font-serif focus:outline-none transition-colors"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          placeholder="Title"
        />
        <TextareaAutosize
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="rounded-lg px-4 py-3 min-h-[300px] focus:outline-none font-mono text-sm resize-none transition-colors"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
          placeholder="Content (supports Markdown)"
          minRows={15}
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="rounded-lg px-4 py-2 text-sm focus:outline-none transition-colors"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
          placeholder="Tags (comma separated)"
        />
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="rounded-lg px-4 py-2 text-sm focus:outline-none transition-colors"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
          placeholder="Image URLs (comma separated)"
        />
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--accent-600)" }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </article>
    );
  }

  // ═══ DISPLAY MODE ═══
  return (
    <article
      onClick={handleCardClick}
      className={`print-content group relative rounded-2xl transition-all duration-300 overflow-hidden ${
        isModal
          ? "p-6 sm:p-8 w-full"
          : isReadingView
          ? "p-5 sm:p-6 cursor-pointer"
          : "p-5 sm:p-6 cursor-pointer"
      }`}
      style={{
        background: isModal ? "var(--bg-secondary)" : "var(--bg-secondary)",
        border: isModal
          ? `1px solid ${catConfig.color}33`
          : "1px solid var(--border-subtle)",
        boxShadow: isModal ? "var(--shadow-lg)" : "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        if (!isModal) {
          e.currentTarget.style.borderColor = `${catConfig.color}44`;
          e.currentTarget.style.boxShadow = `0 0 20px ${catConfig.color}11`;
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isModal) {
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 w-full h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(to right, transparent, ${catConfig.color}80, transparent)` }}
      />

      {/* Action Buttons */}
      <div className={`absolute top-3 right-3 flex items-center gap-1.5 transition-opacity no-print ${isModal ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        {/* Bookmark */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleBookmark(entry.id); }}
          className="p-1.5 rounded-lg transition-all"
          style={{
            background: "var(--bg-primary)",
            color: bookmarked ? "#fbbf24" : "var(--text-tertiary)",
            border: "1px solid var(--border-subtle)",
          }}
          title={bookmarked ? "Remove bookmark" : "Bookmark this entry"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>

        {isModal && (
          <>
            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
              title="Print / Export PDF"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}

        {/* Fix Title (AI) */}
        <button
          onClick={(e) => { e.stopPropagation(); handleFixTitle(); }}
          disabled={isFixingTitle}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: "var(--bg-primary)", color: isFixingTitle ? "#fbbf24" : "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
          title="AI: Regenerate Title"
        >
          {isFixingTitle ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          )}
        </button>

        {/* Edit */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          disabled={isDeleting}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>

      {/* Meta Row */}
      <div className="flex items-center justify-between mb-3 pr-24">
        <CategoryBadge tags={entry.tags} />
        <div className="flex items-center gap-3">
          {viewCount > 0 && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
              👁️ {viewCount}
            </span>
          )}
          <time className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            {new Date(entry.createdAt).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric",
            })}
          </time>
        </div>
      </div>

      {/* Title */}
      <h2
        className="text-xl sm:text-2xl font-serif mb-3 pr-16 transition-colors"
        style={{ color: "var(--text-primary)" }}
      >
        {bookmarked && <span className="text-amber-400 mr-1.5">⭐</span>}
        {entry.title}
      </h2>

      {/* Content */}
      {isModal ? (
        <div className="flex gap-6">
          <div
            className={`wiki-prose prose prose-invert prose-amber max-w-none text-sm leading-relaxed mb-6 prose-p:my-2 prose-headings:mt-5 prose-headings:mb-3 prose-hr:my-4 flex-1`}
            style={{ color: "var(--text-secondary)" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {entry.content.replace(/\n{3,}/g, (match: string) => "\n\n" + "&nbsp;\n\n".repeat(match.length - 2))}
            </ReactMarkdown>
          </div>
          {/* Modal TOC (for long content) */}
          {entry.content.length > 500 && (
            <div className="hidden xl:block w-48 flex-shrink-0 sticky top-4 self-start no-print">
              <TableOfContents content={entry.content} />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`prose prose-invert prose-amber max-w-none text-sm leading-relaxed mb-4 prose-p:my-2 ${isReadingView ? "line-clamp-[12]" : "line-clamp-5"}`}
          style={{ color: "var(--text-secondary)" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {entry.content.replace(/\n{3,}/g, (match: string) => "\n\n" + "&nbsp;\n\n".repeat(match.length - 2))}
          </ReactMarkdown>
        </div>
      )}

      {/* Images */}
      {entry.imageUrl && (
        <div className="mb-4 flex flex-col gap-3">
          {entry.imageUrl.split(",").map((url: string, index: number) => {
            const trimmedUrl = url.trim();
            if (!trimmedUrl || imgErrors.has(index)) {
              if (!trimmedUrl) return null;
              return (
                <div key={index} className="rounded-lg p-4 text-center" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>🖼️ Image unavailable (expired link)</p>
                </div>
              );
            }
            return (
              <div key={index} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                <img
                  src={trimmedUrl}
                  alt={`Lore Attachment ${index + 1}`}
                  loading="lazy"
                  {...(trimmedUrl.startsWith("/") ? {} : { referrerPolicy: "no-referrer", crossOrigin: "anonymous" })}
                  className="w-full h-auto object-cover max-h-96"
                  onError={() => setImgErrors((prev) => new Set(prev).add(index))}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Tags */}
      {tagsList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tagsList.map((tag: string, i: number) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-md"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-tertiary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center space-x-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}
          >
            {entry.author.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{entry.author}</span>
        </div>
        {entry.channelName && (
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            #{entry.channelName}
          </span>
        )}
      </div>

      {/* ═══ RELATED ENTRIES (modal only) ═══ */}
      {isModal && relatedEntries && relatedEntries.length > 0 && (
        <div className="mt-6 pt-6 no-print" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
            📎 Related Entries
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedEntries.map((related: any) => (
              <button
                key={related.id}
                onClick={() => onSelectRelated?.(related)}
                className="text-left p-3 rounded-xl transition-all"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <CategoryBadge tags={related.tags} size="sm" />
                <p className="text-sm font-serif mt-2 line-clamp-1" style={{ color: "var(--text-primary)" }}>
                  {related.title}
                </p>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
                  {related.content?.substring(0, 100)}...
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
});
