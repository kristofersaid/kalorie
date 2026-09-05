import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { averages, dailyTotals, Averages, DayTotal, topProducts } from '../db/stats';
import { fmtG, fmtKcal, shortDate } from '../lib/format';
import { useStore } from '../store/useStore';

const W = Dimensions.get('window').width - 32;

export function StatsScreen() {
  const { colors, dark } = useTheme();
  const tick = useStore((s) => s.tick);
  const kcalGoal = useStore((s) => s.kcalGoal);
  const proteinGoal = useStore((s) => s.proteinGoal);
  const fatGoal = useStore((s) => s.fatGoal);
  const carbsGoal = useStore((s) => s.carbsGoal);
  const [range, setRange] = useState(7);
  const [daily, setDaily] = useState<DayTotal[]>([]);
  const [avg7, setAvg7] = useState<Averages | null>(null);
  const [avgR, setAvgR] = useState<Averages | null>(null);
  const [top, setTop] = useState<{ nazwa: string; razy: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(async () => {
    try {
      const [d, a7, ar, t] = await Promise.all([
        dailyTotals(range),
        averages(7),
        averages(range),
        topProducts(5),
      ]);
      setDaily(d);
      setAvg7(a7);
      setAvgR(ar);
      setTop(t);
    } catch {
      /* ignoruj */
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load, tick]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const chartCfg = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (o = 1) => (dark ? `rgba(129, 199, 132, ${o})` : `rgba(46, 125, 50, ${o})`),
    labelColor: () => (dark ? '#ccc' : '#555'),
    propsForDots: { r: range <= 14 ? '3' : '0' },
  };

  const labels = daily.map((d) =>
    `${d.date.getDate()}.${d.date.getMonth() + 1}`,
  );
  const kcalData =
    daily.length > 0 ? daily.map((d) => Math.round(d.kcal)) : [0];
  const goalData =
    daily.length > 0 ? daily.map(() => Math.round(kcalGoal)) : [Math.round(kcalGoal)];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[7, 14, 30].map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => {
              setRange(r);
              setLoading(true);
            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: range === r ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text
              style={{
                color: range === r ? '#fff' : colors.text,
                fontWeight: '700',
              }}>
              {r} dni
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Kalorie dziennie
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        {loading ? (
          <ActivityIndicator style={{ height: 220 }} />
        ) : (
          <LineChart
            data={{
              labels: labels.length > 0 ? labels : ['–'],
              datasets: [
                { data: kcalData },
                {
                  data: goalData,
                  withDots: false,
                  color: () => '#e53935',
                },
                {
                  data:
                    daily.length > 0
                      ? daily.map((d) => Math.round(d.spalone))
                      : [0],
                  withDots: false,
                  color: () => '#2e7d32',
                },
              ],
              legend: ['kcal', 'cel', 'spalone'],
            }}
            width={W - 16}
            height={220}
            chartConfig={chartCfg}
            bezier
            style={{ borderRadius: 12 }}
          />
        )}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Średnie makro (ostatnie 7 dni)
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        {loading || !avg7 ? (
          <ActivityIndicator style={{ height: 220 }} />
        ) : (
          <BarChart
            data={{
              labels: ['Białko', 'Tłuszcze', 'Węgle'],
              datasets: [
                {
                  data: [
                    Math.round(avg7.bialko * 10) / 10,
                    Math.round(avg7.tluszcze * 10) / 10,
                    Math.round(avg7.wegle * 10) / 10,
                  ],
                },
              ],
            }}
            width={W - 16}
            height={220}
            yAxisLabel=""
            yAxisSuffix=" g"
            chartConfig={{
              ...chartCfg,
              color: (o = 1) =>
                dark ? `rgba(100, 181, 246, ${o})` : `rgba(25, 118, 210, ${o})`,
              barPercentage: 0.6,
            }}
            style={{ borderRadius: 12 }}
          />
        )}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Podsumowanie
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}>
        {loading || !avgR ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={{ color: colors.text }}>
              Średnie dzienne z ostatnich {range} dni:
            </Text>
            <Row label="Kalorie" value={fmtKcal(avgR.kcal)} />
            <Row label="Spalone (treningi)" value={`−${fmtKcal(avgR.spalone)}`} />
            <Row label="Bilans netto" value={fmtKcal(avgR.kcal - avgR.spalone)} />
            <Row label="Białko" value={fmtG(avgR.bialko)} />
            <Row label="Tłuszcze" value={fmtG(avgR.tluszcze)} />
            <Row label="Węglowodany" value={fmtG(avgR.wegle)} />
            <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
              Cel dzienny: {fmtKcal(kcalGoal)} • B {fmtG(proteinGoal)} • T{' '}
              {fmtG(fatGoal)} • W {fmtG(carbsGoal)}
            </Text>
          </>
        )}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Najczęściej jedzone (top 5)
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        {loading ? (
          <ActivityIndicator style={{ margin: 12 }} />
        ) : top.length === 0 ? (
          <Text style={{ color: colors.text, opacity: 0.6, padding: 12 }}>
            Brak danych. Dodaj kilka posiłków, aby zobaczyć ranking.
          </Text>
        ) : (
          top.map((t, i) => (
            <View
              key={`${t.nazwa}${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 10,
                gap: 10,
              }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>
                {t.nazwa}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                ×{t.razy}
              </Text>
            </View>
          ))
        )}
      </View>
      <Text style={{ color: colors.text, opacity: 0.5, fontSize: 11 }}>
        {shortDate(new Date())} • czerwona linia = cel dzienny
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
      }}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
