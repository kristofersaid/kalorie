import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_CARBS_GOAL,
  DEFAULT_FAT_GOAL,
  DEFAULT_KCAL_GOAL,
  DEFAULT_PROTEIN_GOAL,
} from '../lib/constants';
import { AI_PROVIDERS, AiConfig, AiProviderId } from '../lib/ai';

export type ThemeChoice = 'system' | 'light' | 'dark';

type Goals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type AiKeys = Record<AiProviderId, string>;
export type AiModels = Record<AiProviderId, string>;

const emptyKeys = (): AiKeys => ({
  google: '',
  openai: '',
  xai: '',
  anthropic: '',
  openrouter: '',
});

const emptyModels = (): AiModels => ({
  google: '',
  openai: '',
  xai: '',
  anthropic: '',
  openrouter: '',
});

type SettingsState = {
  kcalGoal: number;
  proteinGoal: number;
  fatGoal: number;
  carbsGoal: number;
  /** Klucz Google (starsze pole, dla zgodności wstecznej). */
  apiKey: string;
  aiProvider: AiProviderId;
  aiKeys: AiKeys;
  aiModels: AiModels;
  theme: ThemeChoice;
  /** Licznik unieważniający listy po każdej mutacji bazy. */
  tick: number;
  hydrated: boolean;
  setGoals: (g: Goals) => void;
  setApiKey: (key: string) => void;
  setAiProvider: (p: AiProviderId) => void;
  setAiKey: (p: AiProviderId, key: string) => void;
  setAiModel: (p: AiProviderId, model: string) => void;
  setTheme: (t: ThemeChoice) => void;
  bump: () => void;
};

/** Zwraca kompletną konfigurację AI dla wybranego dostawcy. */
export function aiConfigOf(s: {
  aiProvider: AiProviderId;
  aiKeys: AiKeys;
  aiModels: AiModels;
  apiKey: string;
}): AiConfig {
  const fallbackKey =
    s.aiProvider === 'google' && s.aiKeys.google === '' ? s.apiKey : '';
  return {
    provider: s.aiProvider,
    apiKey: s.aiKeys[s.aiProvider] || fallbackKey,
    model: s.aiModels[s.aiProvider] || '',
  };
}

export function defaultModelOf(provider: AiProviderId): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? '';
}

export const useStore = create<SettingsState>()(
  persist(
    (set) => ({
      kcalGoal: DEFAULT_KCAL_GOAL,
      proteinGoal: DEFAULT_PROTEIN_GOAL,
      fatGoal: DEFAULT_FAT_GOAL,
      carbsGoal: DEFAULT_CARBS_GOAL,
      apiKey: '',
      aiProvider: 'google',
      aiKeys: emptyKeys(),
      aiModels: emptyModels(),
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
      setAiProvider: (p) => set({ aiProvider: p }),
      setAiKey: (p, key) =>
        set((s) => ({ aiKeys: { ...s.aiKeys, [p]: key.trim() } })),
      setAiModel: (p, model) =>
        set((s) => ({ aiModels: { ...s.aiModels, [p]: model.trim() } })),
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
        aiProvider: s.aiProvider,
        aiKeys: { ...emptyKeys(), ...(s.aiKeys ?? {}) },
        aiModels: { ...emptyModels(), ...(s.aiModels ?? {}) },
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
