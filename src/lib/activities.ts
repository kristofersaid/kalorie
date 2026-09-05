/**
 * Wyliczanie spalonych kcal WYŁĄCZNIE z: typu aktywności + dystansu + czasu
 * (+ wagi ciała). Nie ma ręcznego wyboru „szybko/wolno” — tempo liczone
 * jest z dystansu i czasu, a MET dobierany automatycznie do tempa.
 *
 * Wartości MET na podstawie Compendium of Physical Activities (przybliżenia).
 */

export type PaceBracket = {
  /** Górna granica prędkości w km/h dla tego przedziału. */
  maxSpeedKmh: number;
  met: number;
};

export type ActivityType = {
  id: string;
  nazwa: string;
  /** Stały MET (aktywności bez tempa). */
  fixedMet?: number;
  /** Tabela MET od tempa (aktywności dystansowe). */
  paceTable?: PaceBracket[];
  /** MET zapasowy, gdy nie podano dystansu. */
  baseMet?: number;
};

export const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'spacer',
    nazwa: 'Spacer',
    baseMet: 3.0,
    paceTable: [
      { maxSpeedKmh: 3.2, met: 2.5 },
      { maxSpeedKmh: 4.8, met: 3.3 },
      { maxSpeedKmh: 6.4, met: 5.0 },
      { maxSpeedKmh: 999, met: 6.0 },
    ],
  },
  {
    id: 'bieganie',
    nazwa: 'Bieganie',
    baseMet: 9.0,
    paceTable: [
      { maxSpeedKmh: 8, met: 7.0 },
      { maxSpeedKmh: 9.7, met: 8.3 },
      { maxSpeedKmh: 11.3, met: 9.8 },
      { maxSpeedKmh: 12.9, met: 11.0 },
      { maxSpeedKmh: 14.5, met: 11.8 },
      { maxSpeedKmh: 999, met: 12.8 },
    ],
  },
  {
    id: 'rower',
    nazwa: 'Jazda na rowerze',
    baseMet: 7.0,
    paceTable: [
      { maxSpeedKmh: 14, met: 4.0 },
      { maxSpeedKmh: 18, met: 6.0 },
      { maxSpeedKmh: 22, met: 8.0 },
      { maxSpeedKmh: 26, met: 10.0 },
      { maxSpeedKmh: 999, met: 12.0 },
    ],
  },
  {
    id: 'plywanie',
    nazwa: 'Pływanie',
    baseMet: 6.5,
    paceTable: [
      { maxSpeedKmh: 2, met: 5.0 },
      { maxSpeedKmh: 3, met: 7.0 },
      { maxSpeedKmh: 999, met: 9.0 },
    ],
  },
  {
    id: 'rolki',
    nazwa: 'Rolki',
    baseMet: 6.5,
    paceTable: [
      { maxSpeedKmh: 15, met: 5.0 },
      { maxSpeedKmh: 20, met: 7.0 },
      { maxSpeedKmh: 999, met: 9.0 },
    ],
  },
  { id: 'silownia', nazwa: 'Siłownia', fixedMet: 6.0 },
  { id: 'hiit', nazwa: 'HIIT / interwały', fixedMet: 8.0 },
  { id: 'pilka', nazwa: 'Piłka nożna', fixedMet: 8.0 },
  { id: 'kosz', nazwa: 'Koszykówka', fixedMet: 6.5 },
  { id: 'taniec', nazwa: 'Taniec', fixedMet: 5.0 },
  { id: 'joga', nazwa: 'Joga', fixedMet: 2.5 },
  { id: 'rozciaganie', nazwa: 'Rozciąganie', fixedMet: 2.0 },
  { id: 'ogrod', nazwa: 'Prace w ogrodzie', fixedMet: 4.0 },
  { id: 'sprzatanie', nazwa: 'Sprzątanie', fixedMet: 3.3 },
];

/** Prędkość w km/h z dystansu i czasu (null, gdy brak danych). */
export function speedKmh(km: number, minutes: number): number | null {
  if (!(km > 0) || !(minutes > 0)) return null;
  return km / (minutes / 60);
}

/** Dobiera MET do typu + tempa (lub stały / zapasowy). */
export function metFor(
  type: ActivityType,
  km: number,
  minutes: number,
): number {
  if (type.fixedMet != null) return type.fixedMet;
  const speed = speedKmh(km, minutes);
  if (speed != null && type.paceTable) {
    const hit = type.paceTable.find((b) => speed <= b.maxSpeedKmh);
    if (hit) return hit.met;
    return type.paceTable[type.paceTable.length - 1].met;
  }
  return type.baseMet ?? 5.0;
}

export type BurnedResult = {
  kcal: number;
  met: number;
  speedKmh: number | null;
};

/**
 * Spalone kcal = MET × waga (kg) × czas (h).
 * MET zależy tylko od typu i tempa (dystans/czas) — nie da się
 * „podbić” wyniku wyborem wariantu szybkości.
 */
export function calcBurned(
  type: ActivityType,
  weightKg: number,
  minutes: number,
  km = 0,
): BurnedResult {
  if (!(weightKg > 0) || !(minutes > 0)) {
    return { kcal: 0, met: 0, speedKmh: speedKmh(km, minutes) };
  }
  const met = metFor(type, km, minutes);
  return {
    kcal: Math.round(met * weightKg * (minutes / 60)),
    met,
    speedKmh: speedKmh(km, minutes),
  };
}

/** Tempo w min/km albo null, gdy brak danych. */
export function paceMinPerKm(
  minutes: number,
  km: number,
): number | null {
  if (!(minutes > 0) || !(km > 0)) return null;
  return minutes / km;
}

export function formatPace(pace: number): string {
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${s < 10 ? '0' : ''}${s} min/km`;
}
