/**
 * Ludzkie wyjaśnienia kodów błędów HTTP — zamiast samego numeru
 * pokazujemy, co on znaczy i (w komunikatach) co zrobić.
 */

const MEANINGS: Record<number, string> = {
  400: 'błędne żądanie (np. zły klucz albo nazwa modelu)',
  401: 'brak autoryzacji — serwer odrzucił klucz API',
  403: 'brak dostępu — klucz zablokowany, z limitami albo z ograniczeniami',
  404: 'nie znaleziono — zły adres, model albo produkt',
  408: 'przekroczono czas oczekiwania',
  429: 'za dużo zapytań — odczekaj chwilę i spróbuj ponownie',
  500: 'wewnętrzny błąd serwera — spróbuj później',
  502: 'serwer pośredniczący nie odpowiada — spróbuj później',
  503: 'serwer chwilowo niedostępny lub przeciążony — spróbuj później',
  504: 'serwer nie odpowiedział na czas — spróbuj później',
};

/** Np. `błąd 503 (serwer chwilowo niedostępny lub przeciążony ...)`. */
export function httpMeaning(status: number): string {
  const m = MEANINGS[status] ?? 'nieoczekiwany błąd — spróbuj później';
  return `błąd ${status} (${m})`;
}
