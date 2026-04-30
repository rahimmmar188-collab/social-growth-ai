"use client";

import React, { useState } from "react";
import { useAppStore, Platform } from "@/lib/store";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "@/components/auth/auth-modal";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

export default function TopBar() {
  const { userProfile, ui, setActivePlatform } = useAppStore();
  const activePlatform = ui.activePlatform;
  const { user, loading, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <>
      <header className="h-14 border-b border-white/[0.06] bg-[#080c18]/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
        {/* Left: Platform Switcher */}
        <div className="flex items-center gap-2">
          {platforms.map((p) => (
            <button
              key={p.value}
              onClick={() => setActivePlatform(p.value)}
              className={`pill-tab ${activePlatform === p.value ? "active" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Center: Niche Context */}
        <div className="hidden md:flex items-center gap-2">
          {userProfile.niche && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-teal" />
              <span className="text-xs text-muted-foreground">
                Niche: <span className="text-foreground font-medium">{userProfile.niche}</span>
              </span>
            </div>
          )}
        </div>

        {/* Right: Notifications + Auth */}
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
            <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet" />
          </button>

          {!loading && (
            <>
              {user ? (
                /* Logged-in state */
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-violet/20 text-violet text-xs font-medium">
                        {(user.email?.[0] ?? "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 glass-card p-1 shadow-2xl z-50">
                      <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {user.user_metadata?.full_name ?? user.email}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { signOut(); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Logged-out state */
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet/10 border border-violet/20 hover:bg-violet/20 transition-colors text-sm font-medium text-violet"
                >
                  <User className="w-3.5 h-3.5" />
                  Sign In
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
