import { OFF_PRODUCT_URL, OFF_SEARCH_URL } from './constants';
import { toDouble } from './format';
import { FavoriteRow } from '../db/database';

export type OffProduct = {
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  kod: string | null;
  zdjecie: string | null;
  /** Waga całego opakowania w gramach (z pola quantity), jeśli udało się odczytać. */
  opakowanieG: number | null;
  /** Waga jednej porcji w gramach (z pola serving_size), jeśli podana. */
  porcjaG: number | null;
  /** Kategoria z MOJEJ bazy (tylko dla wyników lokalnych). */
  kategoria?: number | null;
};

function pickName(p: Record<string, unknown>): string {
  for (const k of [
    'product_name_pl',
    'product_name',
    'generic_name_pl',
    'generic_name',
  ]) {
    const v = p[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return 'Produkt';
}

function num100(nutr: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = nutr[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function fromJson(
  p: Record<string, unknown>,
  barcode: string | null,
): OffProduct {
  const nutrRaw = p['nutriments'];
  const nutr: Record<string, unknown> =
    nutrRaw != null && typeof nutrRaw === 'object'
      ? (nutrRaw as Record<string, unknown>)
      : {};
  let kcal = num100(nutr, ['energy-kcal_100g', 'energy_kcal_100g']);
  if (kcal === 0) {
    const kj = num100(nutr, ['energy_100g']);
    if (kj > 0) kcal = kj / 4.184;
  }
  const code = p['code'];
  const img = p['image_url'];
  return {
    nazwa: pickName(p),
    kcal100: Math.round(kcal * 10) / 10,
    bialko100: num100(nutr, ['proteins_100g']),
    tluszcze100: num100(nutr, ['fat_100g']),
    wegle100: num100(nutr, ['carbohydrates_100g']),
    kod: barcode ?? (typeof code === 'string' ? code : null),
    zdjecie: typeof img === 'string' ? img : null,
    opakowanieG: parseGrams(p['quantity']),
    porcjaG: parseGrams(p['serving_size']),
  };
}

/**
 * Wyciąga wagę w gramach z tekstów typu "150 g", "1 l", "6 x 25 g",
 * "porcja 30 g". Zwraca null, gdy nie da się odczytać.
 * Mililitry traktowane są jak gramy (przybliżenie dla płynów).
 */
export function parseGrams(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  // Najpierw multipaki: "6 x 25 g" -> 150.
  const multi = text.match(
    /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|cl)\b/i,
  );
  if (multi) {
    const count = parseInt(multi[1], 10);
    const one = toGrams(parseFloat(multi[2].replace(',', '.')), multi[3]);
    if (Number.isFinite(count) && count > 0 && one != null) {
      const total = Math.round(count * one);
      if (total > 0 && total <= 10000) return total;
    }
  }
  const re = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|cl)\b/gi;
  let m: RegExpExecArray | null;
  let last: number | null = null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) continue;
    const g = toGrams(n, m[2]);
    if (g != null && g > 0 && g <= 10000) last = Math.round(g);
  }
  return last;
}

function toGrams(n: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u === 'kg' || u === 'l') return n * 1000;
  if (u === 'cl') return n * 10;
  if (u === 'g' || u === 'ml') return n;
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'KalorieApp/1.0 (Android; prywatny użytek)' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) throw new Error('OFF_TIMEOUT');
    throw new Error(`OFF_NET: ${msg}`);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`OFF_HTTP_${res.status}`);
  return await res.json();
}

/** Zamienia techniczny błąd OFF na czytelny komunikat po polsku. */
export function offErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('OFF_TIMEOUT')) {
    return 'Serwer Open Food Facts nie odpowiada (limit 20 s). Spróbuj ponownie.';
  }
  if (msg.startsWith('OFF_NET')) {
    return 'Brak połączenia z internetem albo zablokowany adres world.openfoodfacts.org (sprawdź Wi-Fi/dane, VPN, blokery reklam).';
  }
  const http = msg.match(/OFF_HTTP_(\d+)/);
  if (http) {
    const code = http[1];
    if (code === '429') {
      return 'Open Food Facts ograniczył zapytania (za dużo prób). Odczekaj minutę.';
    }
    return `Serwer Open Food Facts zwrócił błąd ${code}. Spróbuj później.`;
  }
  return `Błąd wyszukiwania: ${msg}`;
}

/** Wyszukiwanie produktów po nazwie. */
export async function searchOff(query: string): Promise<OffProduct[]> {
  const q = query.trim();
  if (q === '') return [];
  const url =
    `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(q)}` +
    '&search_simple=1&action=process&json=1' +
    '&fields=product_name,product_name_pl,nutriments,image_url,code,quantity,serving_size&page_size=20';
  const data = (await fetchJson(url)) as {
    products?: Record<string, unknown>[];
  };
  const out: OffProduct[] = [];
  for (const p of data.products ?? []) {
    const prod = fromJson(p, null);
    if (prod.nazwa !== 'Produkt' && (prod.kcal100 > 0 || prod.bialko100 > 0)) {
      out.push(prod);
    }
  }
  return out;
}

/** Mapuje wiersz lokalnej bazy na produkt (do wspólnego UI porcji). */
export function offFromFavorite(f: FavoriteRow): OffProduct {
  return {
    nazwa: f.nazwa,
    kcal100: f.kcal100,
    bialko100: f.bialko100,
    tluszcze100: f.tluszcze100,
    wegle100: f.wegle100,
    kod: f.kod,
    zdjecie: f.zdjecie,
    opakowanieG:
      f.opakowanie_g != null && f.opakowanie_g > 0
        ? Math.round(f.opakowanie_g)
        : null,
    porcjaG: null,
    kategoria: f.kategoria,
  };
}

/** Pobranie produktu po kodzie EAN. Zwraca null, gdy nie znaleziono. */
export async function productByBarcode(
  barcode: string,
): Promise<OffProduct | null> {
  const code = barcode.trim().replace(/\s+/g, '');
  if (code === '') return null;
  // Warianty kodu: UPC-A (12 cyfr) bywa indeksowany jako EAN-13 z zerem.
  const variants = [code];
  if (/^\d{12}$/.test(code)) variants.push(`0${code}`);
  if (/^\d{13}$/.test(code) && code.startsWith('0')) {
    variants.push(code.slice(1));
  }
  // Pierwszy wariant rzuca błąd sieci (do rozróżnienia offline vs brak).
  const first = await byBarcodeExact(code);
  if (first) return first;
  for (const v of variants.slice(1)) {
    try {
      const p = await byBarcodeExact(v);
      if (p) return p;
    } catch {
      /* próbuj dalej */
    }
  }
  // Fallback: wyszukiwanie tekstowe po kodzie (indeks bywa pełniejszy).
  try {
    return await searchByCode(code);
  } catch {
    return null;
  }
}

async function byBarcodeExact(code: string): Promise<OffProduct | null> {
  const data = (await fetchJson(
    `${OFF_PRODUCT_URL}/${encodeURIComponent(code)}.json`,
  )) as { status?: unknown; product?: Record<string, unknown> };
  if (toDouble(data.status, 0) !== 1 || !data.product) return null;
  return fromJson(data.product, code);
}

/** Szuka produktu po kodzie przez wyszukiwarkę tekstową OFF. */
async function searchByCode(code: string): Promise<OffProduct | null> {
  const url =
    `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(code)}` +
    '&search_simple=1&action=process&json=1' +
    `&fields=product_name,product_name_pl,nutriments,image_url,code,quantity,serving_size&page_size=5`;
  const data = (await fetchJson(url)) as {
    products?: Record<string, unknown>[];
  };
  for (const p of data.products ?? []) {
    const prod = fromJson(p, null);
    if (prod.nazwa !== 'Produkt' && (prod.kcal100 > 0 || prod.bialko100 > 0)) {
      return prod;
    }
  }
  return null;
}
