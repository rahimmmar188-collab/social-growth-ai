"use client";

import React, { useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore, SavedItem } from "@/lib/store";
import { toast } from "sonner";

interface SaveButtonProps {
  item: Omit<SavedItem, "id" | "savedAt">;
  className?: string;
}

export default function SaveButton({ item, className }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const { addSavedItem } = useAppStore();

  const handleSave = useCallback(() => {
    if (saved) return;

    const newItem: SavedItem = {
      ...item,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    };

    addSavedItem(newItem);
    setSaved(true);
    toast.success("Saved to library", {
      description: "You can find this in your Saved tab",
    });
  }, [item, saved, addSavedItem]);

  return (
    <button
      onClick={handleSave}
      className={cn(
        "p-1.5 rounded-md hover:bg-white/[0.06] transition-all duration-200",
        saved ? "text-red-400" : "text-muted-foreground hover:text-foreground",
        className
      )}
      title="Save to library"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={saved ? "saved" : "unsaved"}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Heart
            className={cn("w-3.5 h-3.5", saved && "fill-current")}
          />
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
