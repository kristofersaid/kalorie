const DAYS_PL = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
];

const MONTHS_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

const MONTHS_SHORT_PL = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Klucz dnia 'yyyy-MM-dd' (czas lokalny). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 'sobota, 6 września 2026'. */
export function prettyDate(d: Date): string {
  return `${DAYS_PL[d.getDay()]}, ${d.getDate()} ${
    MONTHS_PL[d.getMonth()]
  } ${d.getFullYear()}`;
}

/** '6 wrz'. */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT_PL[d.getMonth()]}`;
}

/** 'HH:mm' z daty ISO. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtKcal(v: number): string {
  return `${Math.round(v)} kcal`;
}

export function fmtG(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.049) return `${Math.round(v)} g`;
  return `${v.toFixed(1)} g`;
}

export function toDouble(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export type ScaledMacros = {
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
};

/** Przelicza wartości z 100 g na podaną gramaturę. */
export function scaleMacros(
  kcal100: number,
  bialko100: number,
  tluszcze100: number,
  wegle100: number,
  grams: number,
): ScaledMacros {
  const r1 = (v: number) => Math.round((v * grams) / 1000) / 10;
  return {
    kcal: Math.round((kcal100 * grams) / 100),
    bialko: r1(bialko100),
    tluszcze: r1(tluszcze100),
    wegle: r1(wegle100),
  };
}

/** Usuwa znaczniki ```json ... ``` z odpowiedzi modelu. */
export function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\n?/, '');
  }
  if (s.endsWith('```')) {
    s = s.slice(0, -3).trim();
  }
  return s;
}
