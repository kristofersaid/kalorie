import { mealsBetween, allMeals, Totals } from './meals';
import { activitiesBetween } from './activities';
import { dayKey, parseDayKey } from '../lib/format';

export type DayTotal = Totals & { key: string; date: Date; spalone: number };

export type Averages = Totals & { spalone: number };

/** Sumy dzienne dla ostatnich `days` dni (włącznie z dziś). */
export async function dailyTotals(days: number): Promise<DayTotal[]> {
  const today = new Date();
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (days - 1),
  );
  const rows = await mealsBetween(dayKey(from), dayKey(today));
  const acts = await activitiesBetween(dayKey(from), dayKey(today));
  const burnedByKey = new Map<string, number>();
  for (const a of acts) {
    burnedByKey.set(a.dzien, (burnedByKey.get(a.dzien) ?? 0) + a.kcal);
  }
  const byKey = new Map<string, Totals>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    byKey.set(dayKey(d), { kcal: 0, bialko: 0, tluszcze: 0, wegle: 0 });
  }
  for (const m of rows) {
    const slot = byKey.get(m.dzien);
    if (!slot) continue;
    slot.kcal += m.kcal;
    slot.bialko += m.bialko;
    slot.tluszcze += m.tluszcze;
    slot.wegle += m.wegle;
  }
  return [...byKey.entries()].map(([key, t]) => ({
    key,
    date: parseDayKey(key),
    spalone: burnedByKey.get(key) ?? 0,
    ...t,
  }));
}

export async function averages(days: number): Promise<Averages> {
  const list = await dailyTotals(days);
  if (list.length === 0) {
    return { kcal: 0, bialko: 0, tluszcze: 0, wegle: 0, spalone: 0 };
  }
  let kcal = 0;
  let bialko = 0;
  let tluszcze = 0;
  let wegle = 0;
  let spalone = 0;
  for (const d of list) {
    kcal += d.kcal;
    bialko += d.bialko;
    tluszcze += d.tluszcze;
    wegle += d.wegle;
    spalone += d.spalone;
  }
  const n = list.length;
  return {
    kcal: kcal / n,
    bialko: bialko / n,
    tluszcze: tluszcze / n,
    wegle: wegle / n,
    spalone: spalone / n,
  };
}

/** Top N najczęściej jedzonych produktów (po znormalizowanej nazwie). */
export async function topProducts(
  limit = 5,
): Promise<{ nazwa: string; razy: number }[]> {
  const rows = await allMeals();
  const counts = new Map<string, { nazwa: string; razy: number }>();
  for (const m of rows) {
    const key = m.nazwa.trim().toLowerCase();
    if (key === '') continue;
    const cur = counts.get(key);
    if (cur) cur.razy += 1;
    else counts.set(key, { nazwa: m.nazwa.trim(), razy: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.razy - a.razy)
    .slice(0, limit);
}

/** Suma kcal na dzień dla danego miesiąca (kropki w kalendarzu). */
export async function monthKcal(
  year: number,
  month1based: number,
): Promise<Record<string, number>> {
  const from = `${year}-${String(month1based).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month1based, 0).getDate();
  const to = `${year}-${String(month1based).padStart(2, '0')}-${String(
    lastDay,
  ).padStart(2, '0')}`;
  const rows = await mealsBetween(from, to);
  const out: Record<string, number> = {};
  for (const m of rows) {
    out[m.dzien] = (out[m.dzien] ?? 0) + m.kcal;
  }
  return out;
}
