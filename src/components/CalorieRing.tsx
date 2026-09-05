import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@react-navigation/native';

const SIZE = 200;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Okrągły wykres: spożyte kcal vs cel. */
export function CalorieRing({
  eaten,
  goal,
}: {
  eaten: number;
  goal: number;
}) {
  const { colors } = useTheme();
  const safeGoal = goal > 0 ? goal : 2000;
  const ratio = Math.min(1, Math.max(0, eaten / safeGoal));
  const main =
    eaten < safeGoal * 0.9
      ? '#4caf50'
      : eaten <= safeGoal * 1.1
        ? '#f9a825'
        : '#e53935';
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.border}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={main}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * ratio} ${CIRC}`}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 38, fontWeight: '800', color: main }}>
            {Math.round(eaten)}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text, opacity: 0.7 }}>
            / {Math.round(safeGoal)} kcal
          </Text>
          <Text style={{ fontSize: 13, color: colors.text, opacity: 0.6 }}>
            {Math.round(ratio * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
}
