import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { fmtG } from '../lib/format';

/** Poziomy słupek makroskładnika: aktualne vs cel. */
export function MacroBar({
  label,
  current,
  goal,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
}) {
  const { colors } = useTheme();
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.min(1, Math.max(0, current / safeGoal));
  return (
    <View style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 5,
        }}>
        <Text style={{ fontWeight: '600', color: colors.text }}>{label}</Text>
        <Text style={{ color: colors.text, opacity: 0.7, fontSize: 12 }}>
          {fmtG(current)} / {fmtG(safeGoal)}
        </Text>
      </View>
      <View
        style={{
          height: 10,
          borderRadius: 6,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}>
        <View
          style={{
            height: 10,
            borderRadius: 6,
            width: `${ratio * 100}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}
