"use client";

import React, { useMemo } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  activeId?: string;
}

export function extractHeadings(content: string): TOCItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const items: TOCItem[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    items.push({ id, text, level: match[1].length });
  }
  return items;
}

export default function TableOfContents({ content, activeId }: TableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length < 2) return null;

  return (
    <nav className="space-y-1" aria-label="Table of Contents">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
        On this page
      </h3>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={`block text-sm py-1 transition-colors border-l-2 hover:border-current ${
            activeId === heading.id ? "font-medium" : ""
          }`}
          style={{
            paddingLeft: `${(heading.level - 1) * 12 + 12}px`,
            color: activeId === heading.id ? "var(--text-accent)" : "var(--text-tertiary)",
            borderColor: activeId === heading.id ? "var(--accent-500)" : "transparent",
          }}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}
