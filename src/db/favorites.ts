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
  kategoria?: number;
  opakowanieG?: number | null;
};

export async function insertFavorite(f: FavoriteInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO favorites (nazwa, kcal100, bialko100, tluszcze100, wegle100, kod, zdjecie, ulubione, kategoria, opakowanie_g, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      f.nazwa.trim() === '' ? 'Produkt' : f.nazwa.trim(),
      f.kcal100,
      f.bialko100,
      f.tluszcze100,
      f.wegle100,
      f.kod ?? null,
      f.zdjecie ?? null,
      f.ulubione === false ? 0 : 1,
      f.kategoria ?? 4,
      f.opakowanieG ?? null,
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
     wegle100 = ?, kod = ?, zdjecie = ?, kategoria = ?, opakowanie_g = ? WHERE id = ?`,
    [
      f.nazwa.trim(),
      f.kcal100,
      f.bialko100,
      f.tluszcze100,
      f.wegle100,
      f.kod ?? null,
      f.zdjecie ?? null,
      f.kategoria ?? 4,
      f.opakowanieG ?? null,
      id,
    ],
  );
}

export async function deleteFavorite(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE id = ?', [id]);
}

/** Szuka produktu w LOKALNEJ bazie po kodzie (z wariantami UPC/EAN). */
export async function findLocalByBarcode(
  barcode: string,
): Promise<FavoriteRow | null> {
  const c = barcode.trim().replace(/\s+/g, '');
  if (c === '') return null;
  const variants = [c];
  if (/^\d{12}$/.test(c)) variants.push(`0${c}`);
  if (/^\d{13}$/.test(c) && c.startsWith('0')) variants.push(c.slice(1));
  const db = await getDb();
  const placeholders = variants.map(() => '?').join(',');
  const rows = await db.getAllAsync<FavoriteRow>(
    `SELECT * FROM favorites WHERE kod IN (${placeholders}) LIMIT 1`,
    variants,
  );
  return rows[0] ?? null;
}
