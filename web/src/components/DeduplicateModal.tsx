"use client";

import React, { useEffect } from "react";

export default function DeduplicateModal({
  isOpen,
  onClose,
  entries,
}: {
  isOpen: boolean;
  onClose: () => void;
  entries: any[];
}) {
  useEffect(() => {
    if (isOpen) {
      alert(`SIMPLE Modal opened! Entries count: ${entries?.length}`);
    }
  }, [isOpen, entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-white p-10 rounded-xl text-black">
        <h2 className="text-2xl font-bold mb-4">Test Modal</h2>
        <p>If you can see this, the complex logic was crashing.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Close</button>
      </div>
    </div>
  );
}
