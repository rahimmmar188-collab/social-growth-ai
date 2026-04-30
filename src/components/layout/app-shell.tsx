"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import Sidebar from "./sidebar";
import TopBar from "./top-bar";
import RightPanel from "./right-panel";
import MobileNav from "./mobile-nav";
import OnboardingModal from "@/components/onboarding/onboarding-modal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { ui, userProfile } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-screen flex bg-[#0a0f1e]">
        <div className="w-[72px] flex-shrink-0 border-r border-white/[0.06] bg-[#080c18]" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-14 flex-shrink-0 border-b border-white/[0.06]" />
          <div className="flex-1 overflow-y-auto" />
        </div>
      </div>
    );
  }

  const sidebarW = ui.sidebarExpanded ? 240 : 72;

  return (
    <div className="h-screen flex overflow-hidden bg-[#0a0f1e]">
      {/* Onboarding overlay */}
      {!userProfile.onboardingComplete && <OnboardingModal />}

      {/* ── Sidebar (desktop only) ── */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: sidebarW }}
      >
        <Sidebar />
      </div>

      {/* ── Center Column ── */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <div className="flex-shrink-0">
          <TopBar />
        </div>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-[880px] mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Mobile Nav */}
        <MobileNav />
      </div>

      {/* ── Right Panel (large desktop only) ── */}
      {ui.rightPanelOpen && (
        <div className="hidden lg:flex flex-col flex-shrink-0 h-screen w-[280px] sticky top-0">
          <RightPanel />
        </div>
      )}
    </div>
  );
}
