import {
  GEMINI_LABEL_PROMPT,
  GEMINI_MODEL,
  GEMINI_PROMPT,
} from './constants';
import { stripFences, toDouble } from './format';

export type AiProviderId =
  | 'google'
  | 'openai'
  | 'xai'
  | 'anthropic'
  | 'openrouter';

export type AiProviderInfo = {
  id: AiProviderId;
  label: string;
  hint: string;
  keyUrl: string;
  defaultModel: string;
};

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'google',
    label: 'Google Gemini',
    hint: 'Tani i szybki. Klucz z Google AI Studio.',
    keyUrl: 'https://aistudio.google.com (Get API key)',
    defaultModel: GEMINI_MODEL,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'Modele GPT z wizją. Klucz z platform.openai.com.',
    keyUrl: 'https://platform.openai.com (API keys)',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    hint: 'Modele Grok z wizją. Klucz z console.x.ai.',
    keyUrl: 'https://console.x.ai (API Keys)',
    defaultModel: 'grok-2-vision-latest',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    hint: 'Modele Claude z wizją. Klucz z console.anthropic.com.',
    keyUrl: 'https://console.anthropic.com (API Keys)',
    defaultModel: 'claude-3-5-haiku-latest',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Jeden klucz do wielu modeli (OpenAI, Claude, Gemini…).',
    keyUrl: 'https://openrouter.ai (Keys)',
    defaultModel: 'openai/gpt-4o-mini',
  },
];

export function providerInfo(id: AiProviderId): AiProviderInfo {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

/** Konfiguracja wywołania AI (dostawca + klucz + model). */
export type AiConfig = {
  provider: AiProviderId;
  apiKey: string;
  /** Pusty = model domyślny dostawcy. */
  model: string;
};

export function resolveModel(cfg: AiConfig): string {
  const m = cfg.model.trim();
  return m === '' ? providerInfo(cfg.provider).defaultModel : m;
}

// ── Typy wyników ────────────────────────────────────────────

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

// ── Wywołania tekstowe per dostawca ─────────────────────────

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(t);
  }
}

function errTimeout(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('abort')) {
    return 'Przekroczono czas oczekiwania. Sprawdź internet.';
  }
  return null;
}

async function googleText(
  cfg: AiConfig,
  base64: string,
  prompt: string,
  mimeType: string,
): Promise<{ text?: string; error?: string }> {
  try {
    const res = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        resolveModel(cfg),
      )}:generateContent?key=${encodeURIComponent(cfg.apiKey.trim())}`,
      {},
      {
        system_instruction: { parts: [{ text: prompt }] },
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
      },
      60000,
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 400 && txt.includes('API key')) {
        return { error: 'Nieprawidłowy klucz API Google.' };
      }
      return {
        error: `Błąd Google Gemini (${res.status}). Sprawdź klucz, model i internet.`,
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
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

type OpenAiCompatibleTarget = {
  baseUrl: string;
  extraHeaders?: Record<string, string>;
  badKeyHint: string;
};

async function openAiCompatibleText(
  cfg: AiConfig,
  base64: string,
  prompt: string,
  mimeType: string,
  target: OpenAiCompatibleTarget,
  label: string,
): Promise<{ text?: string; error?: string }> {
  try {
    const res = await postJson(
      target.baseUrl,
      {
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
        ...(target.extraHeaders ?? {}),
      },
      {
        model: resolveModel(cfg),
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
      },
      60000,
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const hint = extractApiMessage(txt) ?? `${label} (${res.status})`;
      if (res.status === 401 || res.status === 403) {
        return { error: `Nieprawidłowy klucz API. ${target.badKeyHint}` };
      }
      if (res.status === 404) {
        return {
          error: `Nie znaleziono modelu "${resolveModel(
            cfg,
          )}". Sprawdź nazwę modelu w Ustawieniach.`,
        };
      }
      return { error: `Błąd ${hint}. Sprawdź klucz, model i internet.` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    const text = (typeof content === 'string' ? content : '').trim();
    if (!text) return { error: `Pusta odpowiedź z ${label}.` };
    return { text };
  } catch (e) {
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

/** Wyciąga czytelny komunikat z ciała błędu API (best effort). */
function extractApiMessage(txt: string): string | null {
  try {
    const j = JSON.parse(txt) as {
      error?: { message?: unknown } | string;
    };
    const e = j.error;
    if (typeof e === 'string' && e.trim() !== '') {
      return e.length > 200 ? `${e.slice(0, 200)}…` : e;
    }
    if (e != null && typeof e === 'object' && typeof e.message === 'string') {
      const m = e.message;
      return m.length > 200 ? `${m.slice(0, 200)}…` : m;
    }
  } catch {
    /* nie-JSON */
  }
  return null;
}

async function anthropicText(
  cfg: AiConfig,
  base64: string,
  prompt: string,
  mimeType: string,
): Promise<{ text?: string; error?: string }> {
  try {
    const res = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': cfg.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      {
        model: resolveModel(cfg),
        max_tokens: 1024,
        system: prompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      60000,
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          error:
            'Nieprawidłowy klucz API Anthropic. Sprawdź klucz w Ustawieniach.',
        };
      }
      if (res.status === 404) {
        return {
          error: `Nie znaleziono modelu "${resolveModel(
            cfg,
          )}". Sprawdź nazwę modelu w Ustawieniach.`,
        };
      }
      return {
        error: `Błąd Anthropic Claude (${res.status}). Sprawdź klucz, model i internet.`,
      };
    }
    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    if (!text) return { error: 'Pusta odpowiedź z Claude.' };
    return { text };
  } catch (e) {
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

/** Pobiera listę modeli Google dostępnych dla klucza (do wyboru w Ustawieniach). */
export async function listGoogleModels(
  apiKey: string,
): Promise<{ models: string[]; error?: string }> {
  const key = apiKey.trim();
  if (key === '') {
    return { models: [], error: 'Wklej najpierw klucz API.' };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          key,
        )}&pageSize=50`,
        { signal: ctrl.signal },
      );
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      if (res.status === 400) {
        return { models: [], error: 'Nieprawidłowy klucz API Google.' };
      }
      return { models: [], error: `Błąd Google (${res.status}).` };
    }
    const data = (await res.json()) as {
      models?: {
        name?: string;
        supportedGenerationMethods?: string[];
      }[];
    };
    const names = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((n) => n !== '');
    if (names.length === 0) {
      return { models: [], error: 'Brak dostępnych modeli dla tego klucza.' };
    }
    return { models: names };
  } catch {
    return { models: [], error: 'Brak internetu lub błąd połączenia.' };
  }
}

/** Wysyła zdjęcie + prompt do wybranego dostawcy, zwraca surowy tekst. */
async function aiText(
  cfg: AiConfig,
  base64: string,
  prompt: string,
  mimeType: string,
): Promise<{ text?: string; error?: string }> {
  if (cfg.apiKey.trim() === '') {
    return {
      error: `Brak klucza API (${providerInfo(cfg.provider).label}). Dodaj go w Ustawieniach.`,
    };
  }
  switch (cfg.provider) {
    case 'openai':
      return openAiCompatibleText(
        cfg,
        base64,
        prompt,
        mimeType,
        {
          baseUrl: 'https://api.openai.com/v1/chat/completions',
          badKeyHint: 'Sprawdź klucz w Ustawieniach.',
        },
        'OpenAI',
      );
    case 'xai':
      return openAiCompatibleText(
        cfg,
        base64,
        prompt,
        mimeType,
        {
          baseUrl: 'https://api.x.ai/v1/chat/completions',
          badKeyHint: 'Sprawdź klucz w console.x.ai.',
        },
        'Grok',
      );
    case 'openrouter':
      return openAiCompatibleText(
        cfg,
        base64,
        prompt,
        mimeType,
        {
          baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
          extraHeaders: {
            'HTTP-Referer': 'https://kalorie.app',
            'X-Title': 'Kalorie',
          },
          badKeyHint: 'Sprawdź klucz w openrouter.ai.',
        },
        'OpenRouter',
      );
    case 'anthropic':
      return anthropicText(cfg, base64, prompt, mimeType);
    case 'google':
    default:
      return googleText(cfg, base64, prompt, mimeType);
  }
}

// ── Parsowanie wyników ──────────────────────────────────────

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

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stripFences(text));
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Analizuje zdjęcie posiłku (składniki + makro). */
export async function analyzeImage(
  cfg: AiConfig,
  base64: string,
  mimeType = 'image/jpeg',
): Promise<AiResult> {
  const r = await aiText(cfg, base64, GEMINI_PROMPT, mimeType);
  if (r.error || !r.text) return aiError(r.error ?? 'Błąd analizy.');
  const obj = parseJsonObject(r.text);
  if (!obj) {
    return aiError('Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.');
  }
  if (typeof obj['error'] === 'string') return aiError(obj['error']);
  const list = Array.isArray(obj['skladniki']) ? obj['skladniki'] : [];
  const skladniki = (list as RawIngredient[]).map(toIngredient);
  const lacznie = obj['lacznie'];
  let kcal = 0;
  let bialko = 0;
  let tluszcze = 0;
  let wegle = 0;
  if (lacznie != null && typeof lacznie === 'object') {
    const l = lacznie as Record<string, unknown>;
    kcal = toDouble(l['kcal']);
    bialko = toDouble(l['bialko_g']);
    tluszcze = toDouble(l['tluszcze_g']);
    wegle = toDouble(l['weglowodany_g']);
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
}

export function labelError(message: string): LabelResult {
  return {
    nazwa: '',
    kcal100: 0,
    bialko100: 0,
    tluszcze100: 0,
    wegle100: 0,
    porcjaG: null,
    opakowanieG: null,
    error: message,
  };
}

/** Odczytuje tabelę wartości odżywczych ze zdjęcia (na 100 g/ml). */
export async function analyzeLabel(
  cfg: AiConfig,
  base64: string,
  mimeType = 'image/jpeg',
): Promise<LabelResult> {
  const r = await aiText(cfg, base64, GEMINI_LABEL_PROMPT, mimeType);
  if (r.error || !r.text) return labelError(r.error ?? 'Błąd analizy.');
  const obj = parseJsonObject(r.text);
  if (!obj) {
    return labelError(
      'Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.',
    );
  }
  if (typeof obj['error'] === 'string') return labelError(obj['error']);
  const posOrNull = (v: unknown): number | null => {
    const n = toDouble(v, NaN);
    return Number.isFinite(n) && n > 0 && n <= 10000
      ? Math.round(n * 10) / 10
      : null;
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

const CLASSIFY_PROMPT = `Jesteś klasyfikatorem zdjęć. Określ, co widać na zdjęciu.
Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`json), w jednym z formatów:
{"type":"kod","kod":"5901234567890"} — gdy widać kod kreskowy (przepisz dokładnie wszystkie cyfry)
{"type":"etykieta"} — gdy widać tabelę wartości odżywczych na opakowaniu
{"type":"posilek"} — gdy widać gotowy posiłek, jedzenie lub danie
{"type":"brak"} — w przeciwnym razie`;

export type PhotoKind =
  | { type: 'kod'; kod: string }
  | { type: 'etykieta' }
  | { type: 'posilek' }
  | { type: 'brak'; error?: string };

/**
 * Klasyfikuje zdjęcie: kod kreskowy / etykieta / posiłek / brak.
 * Używane przez inteligentny aparat (jedno zdjęcie → właściwa akcja).
 */
export async function classifyPhoto(
  cfg: AiConfig,
  base64: string,
  mimeType = 'image/jpeg',
): Promise<PhotoKind> {
  const r = await aiText(cfg, base64, CLASSIFY_PROMPT, mimeType);
  if (r.error || !r.text) return { type: 'brak', error: r.error };
  const obj = parseJsonObject(r.text);
  if (!obj || typeof obj['type'] !== 'string') {
    return { type: 'brak', error: 'Nie udało się rozpoznać zdjęcia.' };
  }
  switch (obj['type']) {
    case 'kod': {
      const digits = String(obj['kod'] ?? '').replace(/\D/g, '');
      if (/^\d{8,14}$/.test(digits)) return { type: 'kod', kod: digits };
      return { type: 'brak', error: 'Widać kod, ale nie odczytano cyfr.' };
    }
    case 'etykieta':
      return { type: 'etykieta' };
    case 'posilek':
      return { type: 'posilek' };
    default:
      return { type: 'brak', error: 'Nie rozpoznano jedzenia na zdjęciu.' };
  }
}

// ── Czat tekstowy (asystent diety) ───────────────────────────

export type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

async function googleChat(
  cfg: AiConfig,
  system: string,
  history: ChatMessage[],
): Promise<{ text?: string; error?: string }> {
  try {
    const contents = history.map((m) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));
    const res = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        resolveModel(cfg),
      )}:generateContent?key=${encodeURIComponent(cfg.apiKey.trim())}`,
      {},
      {
        system_instruction: { parts: [{ text: system }] },
        contents,
      },
      60000,
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 400 && txt.includes('API key')) {
        return { error: 'Nieprawidłowy klucz API Google.' };
      }
      if (res.status === 404) {
        return {
          error: `Nie znaleziono modelu "${resolveModel(cfg)}". Wybierz model z listy w Ustawieniach.`,
        };
      }
      return { error: `Błąd Google Gemini (${res.status}).` };
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
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

async function openAiCompatibleChat(
  cfg: AiConfig,
  system: string,
  history: ChatMessage[],
  target: OpenAiCompatibleTarget,
  label: string,
): Promise<{ text?: string; error?: string }> {
  try {
    const res = await postJson(
      target.baseUrl,
      {
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
        ...(target.extraHeaders ?? {}),
      },
      {
        model: resolveModel(cfg),
        max_tokens: 1024,
        messages: [
          { role: 'system', content: system },
          ...history.map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
          })),
        ],
      },
      60000,
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { error: `Nieprawidłowy klucz API. ${target.badKeyHint}` };
      }
      if (res.status === 404) {
        return {
          error: `Nie znaleziono modelu "${resolveModel(cfg)}". Sprawdź nazwę w Ustawieniach.`,
        };
      }
      const txt = await res.text().catch(() => '');
      return {
        error: `Błąd ${extractApiMessage(txt) ?? label + ' (' + res.status + ')'}.`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    const text = (typeof content === 'string' ? content : '').trim();
    if (!text) return { error: `Pusta odpowiedź z ${label}.` };
    return { text };
  } catch (e) {
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

async function anthropicChat(
  cfg: AiConfig,
  system: string,
  history: ChatMessage[],
): Promise<{ text?: string; error?: string }> {
  try {
    const res = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': cfg.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      {
        model: resolveModel(cfg),
        max_tokens: 1024,
        system,
        messages: history.map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
      },
      60000,
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { error: 'Nieprawidłowy klucz API Anthropic.' };
      }
      if (res.status === 404) {
        return {
          error: `Nie znaleziono modelu "${resolveModel(cfg)}". Sprawdź nazwę w Ustawieniach.`,
        };
      }
      return { error: `Błąd Anthropic Claude (${res.status}).` };
    }
    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    if (!text) return { error: 'Pusta odpowiedź z Claude.' };
    return { text };
  } catch (e) {
    return { error: errTimeout(e) ?? 'Brak internetu lub błąd połączenia.' };
  }
}

/** Czat tekstowy z wybranym dostawcą (historia + prompt systemowy). */
export async function chatWithAi(
  cfg: AiConfig,
  system: string,
  history: ChatMessage[],
): Promise<{ text?: string; error?: string }> {
  if (cfg.apiKey.trim() === '') {
    return {
      error: `Brak klucza API (${providerInfo(cfg.provider).label}). Dodaj go w Ustawieniach.`,
    };
  }
  switch (cfg.provider) {
    case 'openai':
      return openAiCompatibleChat(
        cfg,
        system,
        history,
        {
          baseUrl: 'https://api.openai.com/v1/chat/completions',
          badKeyHint: 'Sprawdź klucz w Ustawieniach.',
        },
        'OpenAI',
      );
    case 'xai':
      return openAiCompatibleChat(
        cfg,
        system,
        history,
        {
          baseUrl: 'https://api.x.ai/v1/chat/completions',
          badKeyHint: 'Sprawdź klucz w console.x.ai.',
        },
        'Grok',
      );
    case 'openrouter':
      return openAiCompatibleChat(
        cfg,
        system,
        history,
        {
          baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
          extraHeaders: {
            'HTTP-Referer': 'https://kalorie.app',
            'X-Title': 'Kalorie',
          },
          badKeyHint: 'Sprawdź klucz w openrouter.ai.',
        },
        'OpenRouter',
      );
    case 'anthropic':
      return anthropicChat(cfg, system, history);
    case 'google':
    default:
      return googleChat(cfg, system, history);
  }
}
