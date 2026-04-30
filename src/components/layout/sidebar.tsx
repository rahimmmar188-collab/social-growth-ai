"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Compass, Dna, PenTool, Type,
  Search, BarChart3, Bookmark, ChevronLeft, ChevronRight,
  Sparkles, Users, GitCompare,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/viral-dna", label: "Viral DNA", icon: Dna },
  { href: "/create", label: "Create", icon: PenTool },
  { href: "/caption-studio", label: "Caption Studio", icon: Type },
  { href: "/spy-recreate", label: "Spy & Recreate", icon: Search },
  { href: "/analyzer", label: "Analyzer", icon: BarChart3 },
  { href: "/saved", label: "Saved", icon: Bookmark },
];

const newNavItems = [
  { href: "/competitors", label: "Competitors", icon: Users, badge: "NEW" },
  { href: "/compare", label: "Gap Analysis", icon: GitCompare, badge: "NEW" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { ui, toggleSidebar } = useAppStore();
  const expanded = ui.sidebarExpanded;

  return (
    <aside className="h-full flex flex-col border-r border-white/[0.06] bg-[#080c18] overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg gradient-violet flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-heading font-bold text-sm text-white whitespace-nowrap"
            >
              Social Growth AI
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={`sidebar-nav-item ${isActive ? "active" : ""} ${!expanded ? "justify-center px-0" : ""}`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="pt-3 pb-1">
          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-2 mb-1 font-semibold"
              >
                Intelligence
              </motion.p>
            )}
          </AnimatePresence>
          {!expanded && <div className="h-px bg-white/[0.06] mx-1 mb-2" />}
        </div>

        {newNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={`sidebar-nav-item ${isActive ? "active" : ""} ${!expanded ? "justify-center px-0" : ""}`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden text-sm flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {expanded && item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet/20 text-violet flex-shrink-0">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-2 pb-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className={`sidebar-nav-item w-full ${!expanded ? "justify-center px-0" : ""}`}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <>
              <ChevronLeft className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-sm">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>
    </aside>
  );
}
