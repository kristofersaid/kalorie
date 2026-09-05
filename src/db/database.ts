import * as SQLite from 'expo-sqlite';

export type MealRow = {
  id: number;
  nazwa: string;
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
  waga: number;
  kategoria: number;
  /** Dzień jako 'yyyy-MM-dd'. */
  dzien: string;
  /** ISO string momentu dodania. */
  created_at: string;
  zrodlo: string;
  /** Lokalne URI zdjęcia (z aparatu/galerii) albo null. */
  zdjecie: string | null;
};

export type FavoriteRow = {
  id: number;
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  kod: string | null;
  zdjecie: string | null;
  ulubione: number;
  /** Domyślna kategoria (indeks z CATEGORIES) przy dodawaniu „zjadłem”. */
  kategoria: number;
  /** Całkowita waga opakowania w g/ml (do chipu „Całość”), null gdy brak. */
  opakowanie_g: number | null;
  created_at: string;
};

export type TemplateRow = {
  id: number;
  nazwa: string;
  created_at: string;
};

export type TemplateItemRow = {
  id: number;
  template_id: number;
  nazwa: string;
  waga: number;
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
};

let db: SQLite.SQLiteDatabase | null = null;
let initDone = false;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = SQLite.openDatabaseSync('kalorie.db');
  }
  if (!initDone) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nazwa TEXT NOT NULL,
        kcal REAL NOT NULL DEFAULT 0,
        bialko REAL NOT NULL DEFAULT 0,
        tluszcze REAL NOT NULL DEFAULT 0,
        wegle REAL NOT NULL DEFAULT 0,
        waga REAL NOT NULL DEFAULT 0,
        kategoria INTEGER NOT NULL DEFAULT 4,
        dzien TEXT NOT NULL,
        created_at TEXT NOT NULL,
        zrodlo TEXT NOT NULL DEFAULT 'reczne',
        zdjecie TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_meals_dzien ON meals (dzien);
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nazwa TEXT NOT NULL,
        kcal100 REAL NOT NULL DEFAULT 0,
        bialko100 REAL NOT NULL DEFAULT 0,
        tluszcze100 REAL NOT NULL DEFAULT 0,
        wegle100 REAL NOT NULL DEFAULT 0,
        kod TEXT,
        zdjecie TEXT,
        ulubione INTEGER NOT NULL DEFAULT 1,
        kategoria INTEGER NOT NULL DEFAULT 4,
        opakowanie_g REAL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nazwa TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS template_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
        nazwa TEXT NOT NULL,
        waga REAL NOT NULL DEFAULT 0,
        kcal REAL NOT NULL DEFAULT 0,
        bialko REAL NOT NULL DEFAULT 0,
        tluszcze REAL NOT NULL DEFAULT 0,
        wegle REAL NOT NULL DEFAULT 0
      );
    `);
    // Migracja dla baz utworzonych przed v1.1: kolumna na zdjęcie posiłku.
    try {
      await db.execAsync('ALTER TABLE meals ADD COLUMN zdjecie TEXT;');
    } catch {
      // Kolumna już istnieje – nic do zrobienia.
    }
    // Migracja: domyślna kategoria wpisu w bazie (4 = Przekąski).
    try {
      await db.execAsync(
        'ALTER TABLE favorites ADD COLUMN kategoria INTEGER NOT NULL DEFAULT 4;',
      );
    } catch {
      // Kolumna już istnieje – nic do zrobienia.
    }
    // Migracja: całkowita waga opakowania (chip „Całość”).
    try {
      await db.execAsync('ALTER TABLE favorites ADD COLUMN opakowanie_g REAL;');
    } catch {
      // Kolumna już istnieje – nic do zrobienia.
    }
    initDone = true;
  }
  return db;
}

/** Usuwa WSZYSTKIE dane (historia, ulubione, szablony). */
export async function wipeAll(): Promise<void> {
  const d = await getDb();
  await d.execAsync(
    'DELETE FROM template_items; DELETE FROM templates; DELETE FROM favorites; DELETE FROM meals;',
  );
}
