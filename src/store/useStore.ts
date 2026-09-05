import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_CARBS_GOAL,
  DEFAULT_FAT_GOAL,
  DEFAULT_KCAL_GOAL,
  DEFAULT_PROTEIN_GOAL,
} from '../lib/constants';

export type ThemeChoice = 'system' | 'light' | 'dark';

type Goals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

type SettingsState = {
  kcalGoal: number;
  proteinGoal: number;
  fatGoal: number;
  carbsGoal: number;
  apiKey: string;
  theme: ThemeChoice;
  /** Licznik unieważniający listy po każdej mutacji bazy. */
  tick: number;
  hydrated: boolean;
  setGoals: (g: Goals) => void;
  setApiKey: (key: string) => void;
  setTheme: (t: ThemeChoice) => void;
  bump: () => void;
};

export const useStore = create<SettingsState>()(
  persist(
    (set) => ({
      kcalGoal: DEFAULT_KCAL_GOAL,
      proteinGoal: DEFAULT_PROTEIN_GOAL,
      fatGoal: DEFAULT_FAT_GOAL,
      carbsGoal: DEFAULT_CARBS_GOAL,
      apiKey: '',
      theme: 'system',
      tick: 0,
      hydrated: false,
      setGoals: (g) =>
        set({
          kcalGoal: g.kcal,
          proteinGoal: g.protein,
          fatGoal: g.fat,
          carbsGoal: g.carbs,
        }),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setTheme: (t) => set({ theme: t }),
      bump: () => set((s) => ({ tick: s.tick + 1 })),
    }),
    {
      name: 'kalorie-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        kcalGoal: s.kcalGoal,
        proteinGoal: s.proteinGoal,
        fatGoal: s.fatGoal,
        carbsGoal: s.carbsGoal,
        apiKey: s.apiKey,
        theme: s.theme,
        tick: s.tick,
        hydrated: s.hydrated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
