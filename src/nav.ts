export type TabParamList = {
  Start: undefined;
  Historia: undefined;
  Baza: undefined;
  Ulubione: undefined;
  Ustawienia: undefined;
};

export type AddMealTab = 'manual' | 'search' | 'camera';

export type RootStackParamList = {
  Tabs: undefined;
  AddMeal: { day: string; mealId?: number; tab?: AddMealTab };
  Creator: { editProductId?: number } | undefined;
  Activity: { day: string; activityId?: number };
  Scanner: undefined;
  Stats: undefined;
};
