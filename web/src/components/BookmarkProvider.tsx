"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface BookmarkContextType {
  bookmarks: Set<string>;
  toggleBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType>({
  bookmarks: new Set(),
  toggleBookmark: () => {},
  isBookmarked: () => false,
});

export function useBookmarks() {
  return useContext(BookmarkContext);
}

export default function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bookmarks");
      if (stored) {
        setBookmarks(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("bookmarks", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.has(id),
    [bookmarks]
  );

  return (
    <BookmarkContext.Provider value={{ bookmarks, toggleBookmark, isBookmarked }}>
      {children}
    </BookmarkContext.Provider>
  );
}
