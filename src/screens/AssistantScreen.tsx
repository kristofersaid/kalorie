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
import { ASSISTANT_SYSTEM, dietSnapshot, suggestPrompt } from '../lib/diet';
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
          AI widzi Twój dzisiejszy dzień. Wyliczenia traktuj orientacyjnie.
        </Text>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
