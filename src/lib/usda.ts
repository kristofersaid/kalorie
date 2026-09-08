import { OffProduct, parseGrams } from './off';
import { httpMeaning } from './httpErrors';
import { toDouble } from './format';

/**
 * Drugie źródło online: USDA FoodData Central (amerykańska baza żywności).
 * Darmowy klucz DEMO_KEY wbudowany — bez rejestracji, z limitami.
 * Używane, gdy Open Food Facts nie odpowiada albo nie zna produktu.
 * Wartości w przeliczeniu na 100 g.
 */

const BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const API_KEY = 'DEMO_KEY';

type FdcNutrient = {
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type FdcFood = {
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  packageWeight?: string;
  foodNutrients?: FdcNutrient[];
};

function nutrient(
  list: FdcNutrient[] | undefined,
  names: string[],
  units: string[],
): number {
  if (!list) return 0;
  for (const n of list) {
    const nm = (n.nutrientName ?? '').toLowerCase();
    const un = (n.unitName ?? '').toUpperCase();
    if (
      names.some((x) => nm.includes(x)) &&
      units.includes(un) &&
      typeof n.value === 'number'
    ) {
      return n.value;
    }
  }
  return 0;
}

function fromFdc(f: FdcFood, barcode: string | null): OffProduct | null {
  const nutr = f.foodNutrients ?? [];
  let kcal = nutrient(nutr, ['energy'], ['KCAL']);
  if (kcal === 0) {
    const kj = nutrient(nutr, ['energy'], ['KJ']);
    if (kj > 0) kcal = kj / 4.184;
  }
  const bialko = nutrient(nutr, ['protein'], ['G']);
  const tluszcze = nutrient(nutr, ['total lipid'], ['G']);
  const wegle = nutrient(nutr, ['carbohydrate'], ['G']);
  if (kcal === 0 && bialko === 0 && tluszcze === 0 && wegle === 0) {
    return null;
  }
  const desc = (f.description ?? '').trim();
  if (desc === '') return null;
  const brand = (f.brandName ?? f.brandOwner ?? '').trim();
  let porcja: number | null = null;
  const ss = toDouble(f.servingSize, 0);
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  if (ss > 0 && ss <= 10000 && (unit === 'g' || unit === 'ml')) {
    porcja = Math.round(ss * 10) / 10;
  }
  return {
    nazwa: brand !== '' ? `${desc} (${brand})` : desc,
    kcal100: Math.round(kcal * 10) / 10,
    bialko100: Math.round(bialko * 10) / 10,
    tluszcze100: Math.round(tluszcze * 10) / 10,
    wegle100: Math.round(wegle * 10) / 10,
    kod: barcode ?? (typeof f.gtinUpc === 'string' ? f.gtinUpc : null),
    zdjecie: null,
    opakowanieG: parseGrams(f.packageWeight),
    porcjaG: porcja,
  };
}

async function fetchFoods(query: string): Promise<FdcFood[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(
      `${BASE}?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=10&api_key=${API_KEY}`,
      {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'KalorieApp/1.0 (Android; prywatny użytek)' },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) throw new Error('USDA_TIMEOUT');
    throw new Error(`USDA_NET: ${msg}`);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`USDA_HTTP_${res.status}`);
  try {
    const data = (await res.json()) as { foods?: FdcFood[] };
    return data.foods ?? [];
  } catch {
    throw new Error('USDA_JSON');
  }
}

/** Wyszukiwanie tekstowe w USDA (markowe produkty, USA). */
export async function searchUsda(query: string): Promise<OffProduct[]> {
  const q = query.trim();
  if (q === '') return [];
  // Kody kreskowe: FDC czasem trafia po cyfrach (gtinUpc).
  const foods = await fetchFoods(q);
  const out: OffProduct[] = [];
  for (const f of foods.slice(0, 10)) {
    const p = fromFdc(f, /^\d{8,14}$/.test(q) ? q : null);
    if (p) out.push(p);
    if (out.length >= 5) break;
  }
  return out;
}

/** Zamienia techniczny błąd USDA na czytelny komunikat po polsku. */
export function usdaErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('USDA_TIMEOUT')) {
    return 'Serwer USDA nie odpowiada (limit 20 s).';
  }
  if (msg.startsWith('USDA_NET')) {
    return 'Brak połączenia z serwerem USDA (sprawdź internet).';
  }
  const http = msg.match(/USDA_HTTP_(\d+)/);
  if (http) {
    const code = Number(http[1]);
    if (code === '429' || code === '403') {
      return 'Wyczerpano darmowy limit USDA na tę godzinę. Spróbuj później.';
    }
    return `USDA FoodData: ${httpMeaning(code)}.`;
  }
  if (msg.includes('USDA_JSON')) {
    return 'Serwer USDA zwrócił odpowiedź, której nie da się odczytać. Spróbuj w innej sieci.';
  }
  return `Błąd USDA: ${msg}`;
}
