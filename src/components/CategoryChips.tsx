import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { CATEGORIES } from '../lib/constants';

/** Rząd chipów z kategoriami posiłków. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (i: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORIES.map((c, i) => {
        const active = value === i;
        return (
          <TouchableOpacity
            key={c}
            onPress={() => onChange(i)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 13,
              borderRadius: 16,
              backgroundColor: active ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text
              style={{
                color: active ? '#fff' : colors.text,
                fontWeight: '600',
                fontSize: 13,
              }}>
              {c}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
