"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dna,
  Type,
  Users,
  Bookmark,
} from "lucide-react";

const mobileNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/viral-dna", label: "Viral DNA", icon: Dna },
  { href: "/caption-studio", label: "Captions", icon: Type },
  { href: "/competitors", label: "Intel", icon: Users },
  { href: "/saved", label: "Saved", icon: Bookmark },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#080c18]/95 backdrop-blur-xl show-mobile-only">
      <div className="flex items-center justify-around py-2 px-1">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "text-violet"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
