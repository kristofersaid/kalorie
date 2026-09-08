import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AiConfig, ChatMessage, chatWithAi } from '../lib/ai';
import {
  ASSISTANT_SYSTEM,
  dietSnapshot,
  recentMealsToday,
  suggestPrompt,
} from '../lib/diet';
import { updateMeal } from '../db/meals';
import { MealRow } from '../db/database';
import { CATEGORIES, validCategory } from '../lib/constants';
import { fmtG, fmtKcal, stripFences, toDouble } from '../lib/format';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';

type Props = {
  route?: { params?: RootStackParamList['Assistant'] };
};

type Bubble = ChatMessage | { role: 'error'; text: string } | { role: 'info'; text: string };

const GREETING: Bubble = {
  role: 'info',
  text: 'Cześć! Widzę, co dziś zjadłeś, Twoje cele i która godzina. Zapytaj o dietę albo stuknij „Co mogę zjeść?”.',
};

/**
 * Asystent diety: czat z AI, które widzi Twój dzisiejszy dzień
 * (posiłki, cele, reszty, porę dnia) + przycisk propozycji posiłku.
 */
export function AssistantScreen({ route }: Props) {
  const { colors } = useTheme();
  const aiCfg: AiConfig = aiConfigOf({
    aiProvider: useStore((s) => s.aiProvider),
    aiKeys: useStore((s) => s.aiKeys),
    aiModels: useStore((s) => s.aiModels),
    apiKey: useStore((s) => s.apiKey),
  });
  const cfgRef = useRef(aiCfg);
  cfgRef.current = aiCfg;
  const [messages, setMessages] = useState<Bubble[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const autoAsked = useRef(false);

  /** Nowy czat: historia żyje tylko na ekranie — czyści bieżącą rozmowę. */
  const newChat = () => {
    if (busy) return;
    setMessages([GREETING]);
    setInput('');
  };

  const historyForAi = (list: Bubble[]): ChatMessage[] =>
    list
      .filter(
        (m): m is ChatMessage => m.role === 'user' || m.role === 'ai',
      )
      .slice(-10);

  const ask = async (question: string) => {
    const q = question.trim();
    if (q === '' || busy) return;
    setInput('');
    setBusy(true);
    try {
      const snap = await dietSnapshot();
      const userMsg: ChatMessage = { role: 'user', text: q };
      const base = [...messages, userMsg];
      setMessages(base);
      const system = `${ASSISTANT_SYSTEM}\n\nKontekst dnia użytkownika:\n${snap.context}`;
      const r = await chatWithAi(cfgRef.current, system, historyForAi(base));
      if (r.error) {
        setMessages((prev) => [...prev, { role: 'error', text: r.error as string }]);
      } else {
        const acted = await tryMealAction((r.text ?? '').trim());
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: acted ?? (r.text ?? '').trim() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: 'Błąd połączenia. Spróbuj ponownie.' },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  /**
   * Wykrywa odpowiedź-akcję (JSON update_meal), wykonuje poprawkę w bazie
   * i zwraca tekst potwierdzenia. Zwraca null dla zwykłych odpowiedzi.
   */
  const tryMealAction = async (text: string): Promise<string | null> => {
    let obj: unknown;
    try {
      obj = JSON.parse(stripFences(text));
    } catch {
      return null;
    }
    if (typeof obj !== 'object' || obj === null) return null;
    const o = obj as Record<string, unknown>;
    if (o['action'] !== 'update_meal') return null;
    const meals = await recentMealsToday().catch(() => [] as MealRow[]);
    if (meals.length === 0) {
      return 'Nie mam dziś żadnych posiłków do poprawy — dodaj najpierw jakiś.';
    }
    const idRaw = o['meal_id'];
    let target: MealRow | undefined;
    if (typeof idRaw === 'number') {
      target = meals.find((m) => m.id === idRaw);
    }
    if (!target && typeof o['nazwa'] === 'string') {
      const needle = o['nazwa'].toLowerCase();
      target =
        meals.find((m) => needle.includes(m.nazwa.toLowerCase())) ??
        meals.find((m) => m.nazwa.toLowerCase().includes(needle.split(' ')[0]));
    }
    if (!target) target = meals[0];
    const str = (v: unknown, fb: string): string =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : fb;
    const num = (v: unknown, fb: number): number => {
      const n = toDouble(v, NaN);
      return Number.isFinite(n) && n >= 0 ? n : fb;
    };
    const next = {
      nazwa: str(o['nazwa'], target.nazwa),
      kcal: num(o['kcal'], target.kcal),
      bialko: num(o['bialko_g'], target.bialko),
      tluszcze: num(o['tluszcze_g'], target.tluszcze),
      wegle: num(o['weglowodany_g'], target.wegle),
      waga: num(o['waga_g'], target.waga),
      kategoria: validCategory(o['kategoria'], target.kategoria),
      dzien: target.dzien,
    };
    try {
      await updateMeal(target.id, next);
    } catch {
      return 'Nie udało się zapisać poprawki w bazie. Spróbuj ponownie.';
    }
    useStore.getState().bump();
    const diff: string[] = [];
    if (next.nazwa !== target.nazwa) {
      diff.push(`nazwa: „${target.nazwa}” → „${next.nazwa}”`);
    }
    const cmp = (
      label: string,
      a: number,
      b: number,
      fmt: (v: number) => string,
    ) => {
      if (Math.abs(a - b) > 0.049) diff.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
    };
    cmp('kcal', target.kcal, next.kcal, (v) => fmtKcal(v));
    cmp('białko', target.bialko, next.bialko, (v) => fmtG(v));
    cmp('tłuszcze', target.tluszcze, next.tluszcze, (v) => fmtG(v));
    cmp('węgle', target.wegle, next.wegle, (v) => fmtG(v));
    cmp('waga', target.waga, next.waga, (v) => fmtG(v));
    if (next.kategoria !== target.kategoria) {
      diff.push(
        `kategoria: ${CATEGORIES[target.kategoria] ?? '?'} → ${CATEGORIES[next.kategoria] ?? '?'}`,
      );
    }
    if (diff.length === 0) {
      return `Sprawdziłem „${target.nazwa}” — nic do zmiany, zostawiam jak jest.`;
    }
    return `✅ Poprawiono „${target.nazwa}”:\n${diff.map((d) => `• ${d}`).join('\n')}`;
  };

  const askSuggestion = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const snap = await dietSnapshot();
      const q = suggestPrompt(snap);
      const base: Bubble[] = [
        ...messages,
        { role: 'user', text: '🍽️ Co mogę zjeść jako następny posiłek?' },
      ];
      setMessages(base);
      const system = `${ASSISTANT_SYSTEM}\n\nKontekst dnia użytkownika:\n${snap.context}`;
      const r = await chatWithAi(cfgRef.current, system, [
        ...historyForAi(base),
        { role: 'user', text: q },
      ]);
      if (r.error) {
        setMessages((prev) => [...prev, { role: 'error', text: r.error as string }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: (r.text ?? '').trim() }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: 'Błąd połączenia. Spróbuj ponownie.' },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  useEffect(() => {
    const autoAsk = route?.params?.autoAsk ?? false;
    if (autoAsk && !autoAsked.current) {
      autoAsked.current = true;
      const t = setTimeout(() => askSuggestion(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}>
      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 16 }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }>
        {messages.map((m, i) => {
          if (m.role === 'info') {
            return (
              <Text
                key={i}
                style={{
                  textAlign: 'center',
                  color: colors.text,
                  opacity: 0.6,
                  fontSize: 13,
                  marginVertical: 4,
                }}>
                {m.text}
              </Text>
            );
          }
          if (m.role === 'error') {
            return (
              <View
                key={i}
                style={{
                  backgroundColor: '#ffebee',
                  borderRadius: 12,
                  padding: 10,
                  alignSelf: 'stretch',
                }}>
                <Text style={{ color: '#b71c1c' }}>{m.text}</Text>
              </View>
            );
          }
          const mine = m.role === 'user';
          const mdStyle = {
            body: { color: colors.text, fontSize: 14 },
            heading1: { color: colors.text, fontSize: 18, fontWeight: '800' as const, marginVertical: 6 },
            heading2: { color: colors.text, fontSize: 16, fontWeight: '800' as const, marginVertical: 5 },
            heading3: { color: colors.text, fontSize: 15, fontWeight: '700' as const, marginVertical: 4 },
            strong: { color: colors.text, fontWeight: '700' as const },
            em: { color: colors.text, fontStyle: 'italic' as const },
            bullet_list: { marginVertical: 4 },
            ordered_list: { marginVertical: 4 },
            list_item: { color: colors.text, marginVertical: 2 },
            bullet_list_icon: { color: colors.primary },
            ordered_list_icon: { color: colors.primary },
            code_inline: {
              color: colors.text,
              backgroundColor: colors.border,
              borderRadius: 4,
              paddingHorizontal: 4,
            },
            fence: {
              backgroundColor: colors.border,
              borderRadius: 8,
              padding: 8,
            },
            code_block: { color: colors.text, fontSize: 13 },
            blockquote: {
              backgroundColor: colors.border,
              borderLeftColor: colors.primary,
              borderLeftWidth: 3,
              padding: 8,
              borderRadius: 6,
            },
            hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
            link: { color: colors.primary },
            table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6 },
            th: {
              color: colors.text,
              fontWeight: '700' as const,
              padding: 6,
              borderColor: colors.border,
              borderWidth: 1,
            },
            td: { color: colors.text, padding: 6, borderColor: colors.border, borderWidth: 1 },
            tr: { borderColor: colors.border, borderBottomWidth: 1 },
          };
          return (
            <View
              key={i}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? colors.primary : colors.card,
                borderWidth: mine ? 0 : 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: mine ? 10 : 4,
                paddingHorizontal: mine ? 10 : 12,
                maxWidth: '88%',
              }}>
              {mine ? (
                <Text style={{ color: '#fff' }}>{m.text}</Text>
              ) : (
                <Markdown style={mdStyle}>{m.text}</Markdown>
              )}
            </View>
          );
        })}
        {busy && (
          <View style={{ alignItems: 'flex-start' }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 12,
              }}>
              <ActivityIndicator size="small" />
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ padding: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={askSuggestion}
            disabled={busy}
            style={{
              flex: 1,
              backgroundColor: '#2e7d32',
              borderRadius: 12,
              padding: 13,
              alignItems: 'center',
              opacity: busy ? 0.5 : 1,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              🍽️ Co mogę zjeść?
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={newChat}
            disabled={busy}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              justifyContent: 'center',
              opacity: busy ? 0.5 : 1,
            }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>
              ＋ Nowy
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Zapytaj o dietę…"
            placeholderTextColor={colors.text + '66'}
            multiline
            onSubmitEditing={() => ask(input)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              color: colors.text,
              backgroundColor: colors.card,
              maxHeight: 110,
            }}
          />
          <TouchableOpacity
            onPress={() => ask(input)}
            disabled={busy}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 18,
              justifyContent: 'center',
              opacity: busy ? 0.5 : 1,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              ➤
            </Text>
          </TouchableOpacity>
        </View>
        <Text
          style={{
            textAlign: 'center',
            color: colors.text,
            opacity: 0.5,
            fontSize: 11,
          }}>
          AI widzi Twój dzisiejszy dzień. Możesz też poprawiać posiłki,
          np. „zmień mielonego na fasolowego”.
        </Text>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
