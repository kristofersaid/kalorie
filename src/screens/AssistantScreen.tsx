import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AiConfig, ChatMessage, chatWithAi } from '../lib/ai';
import { ASSISTANT_SYSTEM, dietSnapshot, suggestPrompt } from '../lib/diet';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';

type Props = NativeStackScreenProps<RootStackParamList, 'Assistant'>;

type Bubble = ChatMessage | { role: 'error'; text: string } | { role: 'info'; text: string };

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
  const [messages, setMessages] = useState<Bubble[]>([
    {
      role: 'info',
      text: 'Cześć! Widzę, co dziś zjadłeś, Twoje cele i która godzina. Zapytaj o dietę albo stuknij „Co mogę zjeść?”.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const autoAsked = useRef(false);

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
    if (route.params?.autoAsk && !autoAsked.current) {
      autoAsked.current = true;
      const t = setTimeout(() => askSuggestion(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          return (
            <View
              key={i}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? colors.primary : colors.card,
                borderWidth: mine ? 0 : 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 10,
                maxWidth: '88%',
              }}>
              <Text style={{ color: mine ? '#fff' : colors.text }}>
                {m.text}
              </Text>
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
        <TouchableOpacity
          onPress={askSuggestion}
          disabled={busy}
          style={{
            backgroundColor: '#2e7d32',
            borderRadius: 12,
            padding: 13,
            alignItems: 'center',
            opacity: busy ? 0.5 : 1,
          }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
            🍽️ Co mogę zjeść jako następny posiłek?
          </Text>
        </TouchableOpacity>
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
  );
}
