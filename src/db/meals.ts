import { getDb, MealRow } from './database';
import { CATEGORIES, SOURCE_MANUAL } from '../lib/constants';

export type MealInput = {
  nazwa: string;
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
  waga: number;
  kategoria: number;
  dzien: string;
  zrodlo?: string;
  zdjecie?: string | null;
};

export async function mealsByDay(day: string): Promise<MealRow[]> {
  const db = await getDb();
  return db.getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE dzien = ? ORDER BY created_at ASC',
    [day],
  );
}

export async function mealsBetween(
  from: string,
  to: string,
): Promise<MealRow[]> {
  const db = await getDb();
  return db.getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE dzien >= ? AND dzien <= ? ORDER BY dzien ASC, created_at ASC',
    [from, to],
  );
}

export async function allMeals(): Promise<MealRow[]> {
  const db = await getDb();
  return db.getAllAsync<MealRow>(
    'SELECT * FROM meals ORDER BY dzien ASC, created_at ASC',
  );
}

export async function insertMeal(m: MealInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO meals (nazwa, kcal, bialko, tluszcze, wegle, waga, kategoria, dzien, created_at, zrodlo, zdjecie)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.nazwa.trim() === '' ? 'Posiłek' : m.nazwa.trim(),
      m.kcal,
      m.bialko,
      m.tluszcze,
      m.wegle,
      m.waga,
      m.kategoria,
      m.dzien,
      new Date().toISOString(),
      m.zrodlo ?? SOURCE_MANUAL,
      m.zdjecie ?? null,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateMeal(id: number, m: MealInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE meals SET nazwa = ?, kcal = ?, bialko = ?, tluszcze = ?, wegle = ?,
     waga = ?, kategoria = ?, dzien = ?, zdjecie = ? WHERE id = ?`,
    [
      m.nazwa.trim() === '' ? 'Posiłek' : m.nazwa.trim(),
      m.kcal,
      m.bialko,
      m.tluszcze,
      m.wegle,
      m.waga,
      m.kategoria,
      m.dzien,
      m.zdjecie ?? null,
      id,
    ],
  );
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', [id]);
}

export type Totals = {
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
};

export function totalsOf(rows: MealRow[]): Totals {
  let kcal = 0;
  let bialko = 0;
  let tluszcze = 0;
  let wegle = 0;
  for (const m of rows) {
    kcal += m.kcal;
    bialko += m.bialko;
    tluszcze += m.tluszcze;
    wegle += m.wegle;
  }
  return { kcal, bialko, tluszcze, wegle };
}

/** Grupuje wpisy wg kategorii (indeksy z CATEGORIES). */
export function groupByCategory(rows: MealRow[]): MealRow[][] {
  const groups: MealRow[][] = CATEGORIES.map(() => []);
  const last = CATEGORIES.length - 1;
  for (const m of rows) {
    const k = m.kategoria >= 0 && m.kategoria < CATEGORIES.length ? m.kategoria : last;
    groups[k].push(m);
  }
  return groups;
}
