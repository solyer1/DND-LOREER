"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export default function LoreCard({ entry }: { entry: any }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [tags, setTags] = useState(entry.tags || "");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tagsList = tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lore entry?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lore/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
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
        body: JSON.stringify({ title, content, tags }),
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

  if (isEditing) {
    return (
      <article className="group relative p-8 rounded-3xl bg-neutral-900/80 border border-amber-500/50 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all duration-500 overflow-hidden flex flex-col gap-4">
        <input 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          className="bg-neutral-950/50 border border-neutral-800 rounded-lg px-4 py-2 text-xl font-serif text-amber-50 focus:outline-none focus:border-amber-500"
          placeholder="Title"
        />
        <textarea 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          className="bg-neutral-950/50 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-300 min-h-[300px] focus:outline-none focus:border-amber-500 font-mono text-sm"
          placeholder="Content"
          rows={15}
        />
        <input 
          type="text" 
          value={tags} 
          onChange={(e) => setTags(e.target.value)} 
          className="bg-neutral-950/50 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-400 focus:outline-none focus:border-amber-500"
          placeholder="Tags (comma separated)"
        />
        <div className="flex justify-end gap-3 mt-2">
          <button 
            onClick={() => setIsEditing(false)} 
            className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative p-8 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-md hover:bg-neutral-800/40 hover:border-amber-900/50 transition-all duration-500 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/0 to-transparent group-hover:via-amber-600/50 transition-all duration-700"></div>
      
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button onClick={() => setIsEditing(true)} className="p-2 text-neutral-400 hover:text-amber-400 bg-neutral-950/50 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button onClick={handleDelete} disabled={isDeleting} className="p-2 text-neutral-400 hover:text-red-400 bg-neutral-950/50 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-900/20 text-amber-400 border border-amber-900/30">
          {entry.channelName}
        </span>
        <time className="text-xs text-neutral-500 font-mono">
          {new Date(entry.createdAt).toLocaleDateString(undefined, { 
            year: 'numeric', month: 'long', day: 'numeric' 
          })}
        </time>
      </div>

      <h2 className="text-2xl font-serif text-amber-50 mb-3 group-hover:text-amber-200 transition-colors pr-16">
        {entry.title}
      </h2>
      
      <div className="prose prose-invert prose-amber max-w-none text-neutral-300 leading-relaxed mb-6">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{entry.content}</ReactMarkdown>
      </div>

      {entry.imageUrl && (
        <div className="mb-6 rounded-lg overflow-hidden border border-neutral-800/50">
          <img src={entry.imageUrl} alt="Lore Attachment" className="w-full h-auto object-cover max-h-96" />
        </div>
      )}

      {tagsList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tagsList.map((tag: string, i: number) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-indigo-900/30 text-indigo-300 border border-indigo-900/50">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-neutral-800/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-xs text-neutral-400 border border-neutral-700">
            {entry.author.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-neutral-400">{entry.author}</span>
        </div>
      </div>
    </article>
  );
}
