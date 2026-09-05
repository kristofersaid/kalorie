import * as FileSystem from 'expo-file-system/legacy';
import { allMeals } from '../db/meals';
import { getDb } from '../db/database';

const HEADER = [
  'id',
  'nazwa',
  'kcal',
  'bialko',
  'tluszcze',
  'wegle',
  'waga',
  'kategoria',
  'dzien',
  'created_at',
  'zrodlo',
];

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function toNum(v: string | undefined): number {
  if (v == null) return 0;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: string | undefined, fb: number): number {
  if (v == null) return fb;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fb;
}

/** Eksportuje historię do pliku CSV, zwraca URI pliku. */
export async function exportCsv(): Promise<string> {
  const rows = await allMeals();
  const lines = [HEADER.join(',')];
  for (const m of rows) {
    lines.push(
      [
        m.id,
        esc(m.nazwa),
        m.kcal,
        m.bialko,
        m.tluszcze,
        m.wegle,
        m.waga,
        m.kategoria,
        m.dzien,
        m.created_at,
        m.zrodlo,
      ].join(','),
    );
  }
  const uri = `${FileSystem.documentDirectory}kalorie_historia_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(uri, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

/** Importuje historię z pliku CSV. Zwraca liczbę wierszy. */
export async function importCsv(uri: string): Promise<number> {
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length <= 1) return 0;
  const db = await getDb();
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    try {
      const c = parseLine(lines[i]);
      if (c.length < 11) continue;
      const nazwa = (c[1] ?? '').trim();
      if (nazwa === '') continue;
      const dzien = /^\d{4}-\d{2}-\d{2}$/.test(c[8] ?? '')
        ? c[8]
        : new Date().toISOString().slice(0, 10);
      await db.runAsync(
        `INSERT INTO meals (nazwa, kcal, bialko, tluszcze, wegle, waga, kategoria, dzien, created_at, zrodlo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nazwa,
          toNum(c[2]),
          toNum(c[3]),
          toNum(c[4]),
          toNum(c[5]),
          toNum(c[6]),
          toInt(c[7], 4),
          dzien,
          c[9] || new Date().toISOString(),
          c[10] || 'reczne',
        ],
      );
      count++;
    } catch {
      continue;
    }
  }
  return count;
}
