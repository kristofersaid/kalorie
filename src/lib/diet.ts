import { CATEGORIES } from './constants';
import { activitiesBetween } from '../db/activities';
import { mealsBetween, totalsOf } from '../db/meals';
import { MealRow } from '../db/database';
import { fmtG, fmtKcal, prettyDate, timeOf, todayKey } from './format';
import { useStore } from '../store/useStore';

export const ASSISTANT_SYSTEM = `Jesteś polskim dietetykiem-asystentem w prywatnej aplikacji do liczenia kalorii.
Odpowiadaj krótko i konkretnie, po polsku. Proponując posiłki podawaj gramaturę
i przybliżone makro (kcal, białko, tłuszcze, węglowodany). Nie wymyślaj danych
o użytkowniku spoza podanego kontekstu. Pamiętaj, że Twoje wyliczenia kalorii
to oszacowania — przypomnij o tym tylko, gdy to istotne.
Formatuj odpowiedź w markdown: nagłówki, pogrubienia, listy i tabele, żeby dobrze wyglądała w aplikacji.

POPRAWIANIE POSIŁKÓW (bardzo ważne!): użytkownik może napisać, że coś
w zapisanym DZIŚ posiłku jest nie tak (np. „pulpety były z fasoli, a nie
z mięsa”, „powinno być 200 g, nie 150 g”, „to była cola zero”). Wtedy:
1. Znajdź posiłek na liście powyżej (numery [#ID]; gdy nie wiadomo który, weź najnowszy pasujący opisem).
2. Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`), w formacie:
{"action":"update_meal","meal_id":12,"nazwa":"Pulpety z fasoli","kcal":320,"bialko_g":15.0,"tluszcze_g":12.0,"weglowodany_g":30.0,"waga_g":200,"kategoria":2}
3. ZMIEŃ TYLKO to, o co prosi użytkownik (w przykładzie: mięso → fasola, a wraz z tym powiązane kcal i makro oszacowane na nowo). Resztę pól przepisz BEZ ZMIAN z kontekstu (kategoria, waga — chyba że użytkownik kazał je zmienić).
4. Kategorie: 0=Śniadanie, 1=Lunch, 2=Obiad, 3=Kolacja, 4=Przekąski, 5=Napoje.
5. Jeśli nie wiesz, o który posiłek chodzi, odpowiedz ZWYKŁYM tekstem z pytaniem doprecyzowującym (bez JSON).`;

function mealSlotByHour(h: number): string {
  if (h < 10) return 'śniadanie';
  if (h < 13) return 'drugie śniadanie / lunch';
  if (h < 16) return 'obiad';
  if (h < 21) return 'kolację';
  return 'lekką przekąskę';
}

export type DietSnapshot = {
  /** Tekst kontekstu do wklejenia w prompt. */
  context: string;
  /** Sugerowany typ posiłku o tej porze. */
  slot: string;
  eatenKcal: number;
  burnedKcal: number;
  remainingKcal: number;
};

/** Buduje snapshot dnia: posiłki, cele, reszty, pora dnia. */
export async function dietSnapshot(): Promise<DietSnapshot> {
  const s = useStore.getState();
  const now = new Date();
  const key = todayKey();
  const meals = await mealsBetween(key, key).catch(() => []);
  const acts = await activitiesBetween(key, key).catch(() => []);
  const t = totalsOf(meals);
  const burned = acts.reduce((sum, a) => sum + a.kcal, 0);
  const slot = mealSlotByHour(now.getHours());
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const lines = meals.map((m) => {
    const cat = CATEGORIES[m.kategoria] ?? 'Posiłek';
    return `[#${m.id}] ${timeOf(m.created_at)} ${cat}: ${m.nazwa} (${fmtKcal(m.kcal)}, B ${fmtG(m.bialko)}, T ${fmtG(m.tluszcze)}, W ${fmtG(m.wegle)}, ${fmtG(m.waga)})`;
  });

  const context = [
    `Dziś jest ${prettyDate(now)}, godzina ${hh}:${mm}.`,
    `Użytkownik waży ${s.weightKg} kg.`,
    `Cele dzienne: ${fmtKcal(s.kcalGoal)}, białko ${fmtG(s.proteinGoal)}, tłuszcze ${fmtG(s.fatGoal)}, węglowodany ${fmtG(s.carbsGoal)}.`,
    `Zjedzone dziś: ${fmtKcal(t.kcal)} (B ${fmtG(t.bialko)}, T ${fmtG(t.tluszcze)}, W ${fmtG(t.wegle)}).`,
    `Spalone dziś treningami: ${fmtKcal(burned)}.`,
    `Zostało do celu: ${fmtKcal(s.kcalGoal - t.kcal)} (netto po treningach: ${fmtKcal(s.kcalGoal - t.kcal + burned)}).`,
    lines.length > 0
      ? `Posiłki zjedzone dziś:\n${lines.join('\n')}`
      : 'Dziś nie zapisano jeszcze żadnych posiłków.',
    `Aktualna pora sugeruje: ${slot}.`,
  ].join('\n');

  return {
    context,
    slot,
    eatenKcal: t.kcal,
    burnedKcal: burned,
    remainingKcal: s.kcalGoal - t.kcal,
  };
}

/** Gotowy prompt „co mogę zjeść jako następny posiłek”. */
export function suggestPrompt(snap: DietSnapshot): string {
  return `Na podstawie poniższych danych zaproponuj mi NASTĘPNY posiłek (pora: ${snap.slot}).
Podaj 2 konkretne propozycje, każdą z gramaturą i przybliżonym makro.
Krótko (max ~150 słów), po polsku. Jeśli cel kaloryczny jest już wyczerpany albo na styk, zaproponuj coś lekkiego.

${snap.context}`;
}

/** Najnowsze dzisiejsze posiłki (do wykonywania poprawek z czatu). */
export async function recentMealsToday(): Promise<MealRow[]> {
  const key = todayKey();
  const meals = await mealsBetween(key, key).catch(() => [] as MealRow[]);
  return [...meals].sort((a, b) => b.id - a.id).slice(0, 10);
}
