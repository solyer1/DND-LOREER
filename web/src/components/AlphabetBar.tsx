"use client";

import React from "react";

interface AlphabetBarProps {
  availableLetters: Set<string>;
  activeLetter: string | null;
  onLetterClick: (letter: string | null) => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function AlphabetBar({ availableLetters, activeLetter, onLetterClick }: AlphabetBarProps) {
  return (
    <div className="alphabet-bar flex flex-wrap items-center gap-0.5 py-2 px-1 no-print">
      <button
        onClick={() => onLetterClick(null)}
        className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all ${
          activeLetter === null
            ? "text-white shadow-md"
            : "hover:text-white"
        }`}
        style={{
          background: activeLetter === null ? "var(--accent-600)" : "transparent",
          color: activeLetter === null ? "white" : "var(--text-tertiary)",
        }}
      >
        All
      </button>
      {ALPHABET.map((letter) => {
        const isAvailable = availableLetters.has(letter);
        const isActive = activeLetter === letter;
        return (
          <button
            key={letter}
            onClick={() => isAvailable && onLetterClick(isActive ? null : letter)}
            disabled={!isAvailable}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-mono font-semibold transition-all ${
              isActive
                ? "text-white shadow-md"
                : isAvailable
                ? "hover:text-white"
                : "cursor-not-allowed"
            }`}
            style={{
              background: isActive ? "var(--accent-600)" : "transparent",
              color: isActive ? "white" : isAvailable ? "var(--text-secondary)" : "var(--text-tertiary)",
              opacity: isAvailable ? 1 : 0.3,
            }}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
