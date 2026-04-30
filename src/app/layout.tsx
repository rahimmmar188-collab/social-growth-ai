import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/layout/app-shell";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Social Growth AI — Intelligent Content Operating System",
  description:
    "Your AI-powered content strategist, viral psychology researcher, creative director, and professional copywriter — all in one platform. Discover trends, decode virality, and create content that grows.",
  keywords: ["social media", "AI", "content creation", "viral marketing", "growth strategy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[#0a0f1e]">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(17, 24, 39, 0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f0f0f5",
                backdropFilter: "blur(20px)",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
