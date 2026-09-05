import { getDb, FavoriteRow } from './database';

export async function listFavorites(): Promise<FavoriteRow[]> {
  const db = await getDb();
  return db.getAllAsync<FavoriteRow>(
    'SELECT * FROM favorites ORDER BY created_at DESC',
  );
}

export async function searchFavorites(q: string): Promise<FavoriteRow[]> {
  const db = await getDb();
  const needle = q.trim();
  if (needle === '') return listFavorites();
  return db.getAllAsync<FavoriteRow>(
    'SELECT * FROM favorites WHERE nazwa LIKE ? ESCAPE ? ORDER BY created_at DESC',
    [`%${needle.replace(/[%_\\]/g, (c) => `\\${c}`)}%`, '\\'],
  );
}

export type FavoriteInput = {
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  kod?: string | null;
  zdjecie?: string | null;
  ulubione?: boolean;
};

export async function insertFavorite(f: FavoriteInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO favorites (nazwa, kcal100, bialko100, tluszcze100, wegle100, kod, zdjecie, ulubione, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      f.nazwa.trim() === '' ? 'Produkt' : f.nazwa.trim(),
      f.kcal100,
      f.bialko100,
      f.tluszcze100,
      f.wegle100,
      f.kod ?? null,
      f.zdjecie ?? null,
      f.ulubione === false ? 0 : 1,
      new Date().toISOString(),
    ],
  );
  return res.lastInsertRowId;
}

export async function toggleStar(id: number, current: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE favorites SET ulubione = ? WHERE id = ?', [
    current === 1 ? 0 : 1,
    id,
  ]);
}

export async function updateFavorite(
  id: number,
  f: FavoriteInput,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE favorites SET nazwa = ?, kcal100 = ?, bialko100 = ?, tluszcze100 = ?,
     wegle100 = ?, kod = ?, zdjecie = ? WHERE id = ?`,
    [
      f.nazwa.trim(),
      f.kcal100,
      f.bialko100,
      f.tluszcze100,
      f.wegle100,
      f.kod ?? null,
      f.zdjecie ?? null,
      id,
    ],
  );
}

export async function deleteFavorite(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE id = ?', [id]);
}
