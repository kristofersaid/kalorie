import { getDb, ActivityRow } from './database';

export type ActivityInput = {
  nazwa: string;
  kcal: number;
  czasMin: number;
  dystansKm: number;
  dzien: string;
};

export async function activitiesByDay(day: string): Promise<ActivityRow[]> {
  const db = await getDb();
  return db.getAllAsync<ActivityRow>(
    'SELECT * FROM activities WHERE dzien = ? ORDER BY created_at ASC',
    [day],
  );
}

export async function activitiesBetween(
  from: string,
  to: string,
): Promise<ActivityRow[]> {
  const db = await getDb();
  return db.getAllAsync<ActivityRow>(
    'SELECT * FROM activities WHERE dzien >= ? AND dzien <= ? ORDER BY dzien ASC',
    [from, to],
  );
}

export async function insertActivity(a: ActivityInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO activities (nazwa, kcal, czas_min, dystans_km, dzien, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      a.nazwa.trim() === '' ? 'Aktywność' : a.nazwa.trim(),
      a.kcal,
      a.czasMin,
      a.dystansKm,
      a.dzien,
      new Date().toISOString(),
    ],
  );
  return res.lastInsertRowId;
}

export async function updateActivity(
  id: number,
  a: ActivityInput,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE activities SET nazwa = ?, kcal = ?, czas_min = ?, dystans_km = ?, dzien = ? WHERE id = ?',
    [
      a.nazwa.trim() === '' ? 'Aktywność' : a.nazwa.trim(),
      a.kcal,
      a.czasMin,
      a.dystansKm,
      a.dzien,
      id,
    ],
  );
}

export async function deleteActivity(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM activities WHERE id = ?', [id]);
}

export function burnedOf(rows: ActivityRow[]): number {
  return rows.reduce((s, r) => s + r.kcal, 0);
}
