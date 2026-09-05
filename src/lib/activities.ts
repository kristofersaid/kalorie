/** Typy treningów z wartościami MET (Compendium of Physical Activities). */
export type ActivityType = {
  id: string;
  nazwa: string;
  met: number;
};

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'spacer', nazwa: 'Spacer', met: 3.5 },
  { id: 'marsz', nazwa: 'Szybki marsz', met: 4.3 },
  { id: 'bieg_wolno', nazwa: 'Bieganie (wolno)', met: 8.0 },
  { id: 'bieg_szybko', nazwa: 'Bieganie (szybko)', met: 11.5 },
  { id: 'rower_wolno', nazwa: 'Rower (wolno)', met: 5.5 },
  { id: 'rower', nazwa: 'Rower (umiarkowanie)', met: 7.5 },
  { id: 'rower_szybko', nazwa: 'Rower (szybko)', met: 10.0 },
  { id: 'plywanie_wolno', nazwa: 'Pływanie (wolno)', met: 5.5 },
  { id: 'plywanie', nazwa: 'Pływanie (szybko)', met: 9.0 },
  { id: 'silownia', nazwa: 'Siłownia', met: 6.0 },
  { id: 'hiit', nazwa: 'HIIT / interwały', met: 8.0 },
  { id: 'pilka', nazwa: 'Piłka nożna', met: 8.0 },
  { id: 'kosz', nazwa: 'Koszykówka', met: 6.5 },
  { id: 'taniec', nazwa: 'Taniec', met: 5.0 },
  { id: 'joga', nazwa: 'Joga', met: 2.5 },
  { id: 'rozciaganie', nazwa: 'Rozciąganie', met: 2.0 },
  { id: 'rolki', nazwa: 'Rolki', met: 7.0 },
  { id: 'ogrod', nazwa: 'Prace w ogrodzie', met: 4.0 },
  { id: 'sprzatanie', nazwa: 'Sprzątanie', met: 3.3 },
];

/**
 * Spalone kcal = MET × waga (kg) × czas (h).
 * Dystans służy tylko informacji (np. tempo) — nie zmienia wyniku.
 */
export function calcBurned(
  met: number,
  weightKg: number,
  minutes: number,
): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.round(met * weightKg * (minutes / 60));
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
