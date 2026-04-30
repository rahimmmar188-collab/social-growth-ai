"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, SavedItem } from "@/lib/store";
import GlassCard from "@/components/shared/glass-card";
import CopyButton from "@/components/shared/copy-button";
import { Bookmark, Trash2, Search, Filter, Heart, Tag, FolderOpen } from "lucide-react";

const typeColors: Record<string, string> = {
  caption: "bg-violet/10 text-violet border-violet/10",
  hook: "bg-teal/10 text-teal border-teal/10",
  report: "bg-amber-400/10 text-amber-400 border-amber-400/10",
  hashtags: "bg-blue-400/10 text-blue-400 border-blue-400/10",
};

export default function SavedPage() {
  const { savedItems, removeFromSaved } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFolder, setFilterFolder] = useState<string>("all");

  const folders = ["all", ...Array.from(new Set(savedItems.map((i) => i.folder).filter(Boolean)))];
  const types = ["all", "caption", "hook", "report", "hashtags"];

  const filtered = savedItems.filter((item) => {
    const matchSearch = !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || item.type === filterType;
    const matchFolder = filterFolder === "all" || item.folder === filterFolder;
    return matchSearch && matchType && matchFolder;
  });

  const getPreviewText = (item: SavedItem): string => {
    if (typeof item.content === "string") return item.content;
    if (item.content && typeof item.content === "object") {
      const c = item.content as Record<string, unknown>;
      return String(c.text || c.caption || c.angle || JSON.stringify(item.content).slice(0, 120));
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-pink-400" />
          </div>
          Saved Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {savedItems.length} saved item{savedItems.length !== 1 ? "s" : ""} across {folders.length - 1} folder{folders.length - 1 !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <GlassCard hover={false}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved items…"
              className="w-full glass-input pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Type:</span>
              {types.map((t) => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${filterType === t ? "gradient-violet text-white" : "bg-white/[0.04] text-muted-foreground hover:text-foreground border border-white/[0.06]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {folders.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Folder:</span>
              {folders.map((f) => (
                <button key={f} onClick={() => setFilterFolder(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${filterFolder === f ? "gradient-violet text-white" : "bg-white/[0.04] text-muted-foreground hover:text-foreground border border-white/[0.06]"}`}>
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Empty State */}
      {savedItems.length === 0 && (
        <GlassCard hover={false} className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-pink-400/10 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-pink-400" />
          </div>
          <h3 className="font-heading font-semibold text-foreground">No saved items yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Use the save button on any hook, caption, or report to build your library
          </p>
        </GlassCard>
      )}

      {/* No results */}
      {savedItems.length > 0 && filtered.length === 0 && (
        <GlassCard hover={false} className="text-center py-8">
          <p className="text-sm text-muted-foreground">No items match your filters</p>
          <button onClick={() => { setSearch(""); setFilterType("all"); setFilterFolder("all"); }}
            className="text-xs text-violet mt-2 hover:underline">Clear filters</button>
        </GlassCard>
      )}

      {/* Items Grid */}
      <AnimatePresence>
        <div className="grid gap-3">
          {filtered.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.03 }}>
              <GlassCard hover={false} className="group">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColors[item.type] || typeColors.report}`}>
                        {item.type}
                      </span>
                      {item.folder && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />{item.folder}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(item.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {/* Title */}
                    {item.title && <p className="text-sm font-medium text-foreground truncate">{item.title}</p>}
                    {/* Preview */}
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {getPreviewText(item)}
                    </p>
                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag, j) => (
                          <span key={j} className="text-xs flex items-center gap-0.5 text-muted-foreground/70">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <CopyButton text={getPreviewText(item)} size="sm" />
                    <button onClick={() => removeFromSaved(item.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
