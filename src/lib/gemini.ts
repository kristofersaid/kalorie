import { GEMINI_LABEL_PROMPT, GEMINI_MODEL, GEMINI_PROMPT } from './constants';
import { stripFences, toDouble } from './format';

export type AiIngredient = {
  nazwa: string;
  waga: number;
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
  selected: boolean;
};

export type AiResult = {
  danie: string;
  skladniki: AiIngredient[];
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
  error?: string;
};

export function aiError(message: string): AiResult {
  return {
    danie: '',
    skladniki: [],
    kcal: 0,
    bialko: 0,
    tluszcze: 0,
    wegle: 0,
    error: message,
  };
}

type RawIngredient = {
  nazwa?: unknown;
  waga_g?: unknown;
  kcal?: unknown;
  bialko_g?: unknown;
  tluszcze_g?: unknown;
  weglowodany_g?: unknown;
};

function toIngredient(raw: RawIngredient): AiIngredient {
  return {
    nazwa:
      typeof raw.nazwa === 'string' && raw.nazwa.trim() !== ''
        ? raw.nazwa
        : 'Składnik',
    waga: toDouble(raw.waga_g),
    kcal: toDouble(raw.kcal),
    bialko: toDouble(raw.bialko_g),
    tluszcze: toDouble(raw.tluszcze_g),
    wegle: toDouble(raw.weglowodany_g),
    selected: true,
  };
}

/** Wysyła zdjęcie (base64) do Gemini i zwraca surowy tekst odpowiedzi. */
async function geminiText(
  apiKey: string,
  base64: string,
  prompt: string,
  mimeType: string,
): Promise<{ text?: string; error?: string }> {
  const key = apiKey.trim();
  if (key === '') {
    return { error: 'Brak klucza API Gemini. Dodaj go w Ustawieniach.' };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
          key,
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: prompt }] },
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
          }),
        },
      );
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 400 && txt.includes('API key')) {
        return { error: 'Nieprawidłowy klucz API Gemini.' };
      }
      return {
        error: `Błąd Gemini (${res.status}). Sprawdź klucz i internet.`,
      };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) return { error: 'Pusta odpowiedź z Gemini.' };
    return { text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) {
      return { error: 'Przekroczono czas oczekiwania. Sprawdź internet.' };
    }
    return { error: 'Brak internetu lub błąd połączenia.' };
  }
}

export type LabelResult = {
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  porcjaG: number | null;
  opakowanieG: number | null;
  error?: string;
};

/**
 * Odczytuje tabelę wartości odżywczych ze zdjęcia.
 * Zwraca wartości w przeliczeniu na 100 g/ml.
 */
export async function analyzeLabel(
  apiKey: string,
  base64: string,
  mimeType = 'image/jpeg',
): Promise<LabelResult> {
  const fail = (error: string): LabelResult => ({
    nazwa: '',
    kcal100: 0,
    bialko100: 0,
    tluszcze100: 0,
    wegle100: 0,
    porcjaG: null,
    opakowanieG: null,
    error,
  });
  const r = await geminiText(apiKey, base64, GEMINI_LABEL_PROMPT, mimeType);
  if (r.error || !r.text) return fail(r.error ?? 'Błąd analizy.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(r.text));
  } catch {
    return fail('Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return fail('Nieprawidłowa odpowiedź z Gemini.');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj['error'] === 'string') return fail(obj['error']);
  const posOrNull = (v: unknown): number | null => {
    const n = toDouble(v, NaN);
    return Number.isFinite(n) && n > 0 && n <= 10000 ? Math.round(n * 10) / 10 : null;
  };
  return {
    nazwa:
      typeof obj['nazwa_produktu'] === 'string' &&
      obj['nazwa_produktu'].trim() !== ''
        ? obj['nazwa_produktu'].trim()
        : 'Produkt z etykiety',
    kcal100: Math.round(toDouble(obj['kcal_100g']) * 10) / 10,
    bialko100: toDouble(obj['bialko_100g']),
    tluszcze100: toDouble(obj['tluszcze_100g']),
    wegle100: toDouble(obj['weglowodany_100g']),
    porcjaG: posOrNull(obj['porcja_g']),
    opakowanieG: posOrNull(obj['opakowanie_g']),
  };
}
export async function analyzeImage(
  apiKey: string,
  base64: string,
  mimeType = 'image/jpeg',
): Promise<AiResult> {
  const key = apiKey.trim();
  if (key === '') {
    return aiError('Brak klucza API Gemini. Dodaj go w Ustawieniach.');
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
          key,
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: GEMINI_PROMPT }] },
            contents: [
              {
                parts: [
                  { text: GEMINI_PROMPT },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
          }),
        },
      );
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 400 && txt.includes('API key')) {
        return aiError('Nieprawidłowy klucz API Gemini.');
      }
      return aiError(`Błąd Gemini (${res.status}). Sprawdź klucz i internet.`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) return aiError('Pusta odpowiedź z Gemini.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch {
      return aiError('Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return aiError('Nieprawidłowa odpowiedź z Gemini.');
    }
    const obj = parsed as Record<string, unknown> & {
      lacznie?: Record<string, unknown>;
    };
    if (typeof obj['error'] === 'string') {
      return aiError(obj['error']);
    }
    const list = Array.isArray(obj['skladniki']) ? obj['skladniki'] : [];
    const skladniki = (list as RawIngredient[]).map(toIngredient);
    let kcal = 0;
    let bialko = 0;
    let tluszcze = 0;
    let wegle = 0;
    if (obj.lacznie && typeof obj.lacznie === 'object') {
      kcal = toDouble(obj.lacznie['kcal']);
      bialko = toDouble(obj.lacznie['bialko_g']);
      tluszcze = toDouble(obj.lacznie['tluszcze_g']);
      wegle = toDouble(obj.lacznie['weglowodany_g']);
    } else {
      for (const s of skladniki) {
        kcal += s.kcal;
        bialko += s.bialko;
        tluszcze += s.tluszcze;
        wegle += s.wegle;
      }
    }
    return {
      danie:
        typeof obj['danie'] === 'string' && obj['danie'].trim() !== ''
          ? obj['danie']
          : 'Posiłek ze zdjęcia',
      skladniki,
      kcal,
      bialko,
      tluszcze,
      wegle,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort')) {
      return aiError('Przekroczono czas oczekiwania. Sprawdź internet.');
    }
    return aiError('Brak internetu lub błąd połączenia.');
  }
}
