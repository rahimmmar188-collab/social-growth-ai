import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Platform = 'instagram' | 'linkedin' | 'facebook';
export type CreatorType = 'personal' | 'business' | 'agency' | 'beginner';
export type Tone = 'motivational' | 'funny' | 'educational' | 'personal' | 'professional';
export type CaptionLength = 'short' | 'medium' | 'long';

export interface UserProfile {
  niche: string;
  platform: Platform;
  creatorType: CreatorType;
  onboardingComplete: boolean;
}

export interface SavedItem {
  id: string;
  type: 'hook' | 'caption' | 'reel' | 'hashtag_set' | 'report' | 'analysis' | 'hashtags';
  content: Record<string, unknown>;
  tags: string[];
  folder: string;
  savedAt: string;
  title: string;
}

export interface AgentSession {
  id: string;
  agentName: string;
  input: string;
  output: Record<string, unknown>;
  createdAt: string;
}

interface UIState {
  sidebarExpanded: boolean;
  rightPanelOpen: boolean;
  activePlatform: Platform;
}

interface AppState {
  // User profile
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  completeOnboarding: () => void;

  // UI
  ui: UIState;
  toggleSidebar: () => void;
  setRightPanel: (open: boolean) => void;
  setActivePlatform: (platform: Platform) => void;

  // Saved items
  savedItems: SavedItem[];
  addSavedItem: (item: SavedItem) => void;
  removeSavedItem: (id: string) => void;
  removeFromSaved: (id: string) => void;

  // Sessions
  recentSessions: AgentSession[];
  addSession: (session: AgentSession) => void;

  // Usage
  usageCount: number;
  incrementUsage: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User profile
      userProfile: {
        niche: '',
        platform: 'instagram',
        creatorType: 'personal',
        onboardingComplete: false,
      },
      setUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile },
        })),
      completeOnboarding: () =>
        set((state) => ({
          userProfile: { ...state.userProfile, onboardingComplete: true },
        })),

      // UI
      ui: {
        sidebarExpanded: true,
        rightPanelOpen: true,
        activePlatform: 'instagram',
      },
      toggleSidebar: () =>
        set((state) => ({
          ui: { ...state.ui, sidebarExpanded: !state.ui.sidebarExpanded },
        })),
      setRightPanel: (open) =>
        set((state) => ({
          ui: { ...state.ui, rightPanelOpen: open },
        })),
      setActivePlatform: (platform) =>
        set((state) => ({
          ui: { ...state.ui, activePlatform: platform },
        })),

      // Saved items
      savedItems: [],
      addSavedItem: (item) =>
        set((state) => ({
          savedItems: [item, ...state.savedItems],
        })),
      removeSavedItem: (id) =>
        set((state) => ({
          savedItems: state.savedItems.filter((item) => item.id !== id),
        })),
      removeFromSaved: (id) =>
        set((state) => ({
          savedItems: state.savedItems.filter((item) => item.id !== id),
        })),

      // Sessions
      recentSessions: [],
      addSession: (session) =>
        set((state) => ({
          recentSessions: [session, ...state.recentSessions].slice(0, 50),
        })),

      // Usage
      usageCount: 0,
      incrementUsage: () =>
        set((state) => ({ usageCount: state.usageCount + 1 })),
    }),
    {
      name: 'social-growth-ai-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        return persistedState as AppState;
      },
      partialize: (state) => ({
        userProfile: state.userProfile,
        savedItems: state.savedItems,
        recentSessions: state.recentSessions,
        usageCount: state.usageCount,
        ui: {
          sidebarExpanded: state.ui.sidebarExpanded,
          activePlatform: state.ui.activePlatform,
          rightPanelOpen: state.ui.rightPanelOpen,
        },
      }),
    }
  )
);
