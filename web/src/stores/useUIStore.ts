import { create } from 'zustand'

interface UIStore {
  // Current challenge navigation
  currentChallengeIndex: number
  setCurrentChallengeIndex: (index: number) => void
  
  // Editor settings
  editorTheme: 'vs-dark' | 'light'
  setEditorTheme: (theme: 'vs-dark' | 'light') => void
}

export const useUIStore = create<UIStore>((set) => ({
  // Challenge navigation
  currentChallengeIndex: 0,
  setCurrentChallengeIndex: (index) => set({ currentChallengeIndex: index }),
  
  // Editor settings
  editorTheme: 'vs-dark',
  setEditorTheme: (theme) => set({ editorTheme: theme }),
}))
