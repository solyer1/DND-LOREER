"use client";

import React from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}


interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm no-print">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
          {item.onClick || item.href ? (
            <button
              onClick={item.onClick}
              className="transition-colors hover:underline underline-offset-4"
              style={{ color: i === items.length - 1 ? "var(--text-primary)" : "var(--text-tertiary)" }}
            >
              {item.label}
            </button>
          ) : (
            <span
              className="font-medium"
              style={{ color: i === items.length - 1 ? "var(--text-accent)" : "var(--text-tertiary)" }}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
