import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MealRow } from '../db/database';
import { fmtKcal } from '../lib/format';
import { MealCard } from './MealCard';

/** Sekcja kategorii (np. "Śniadanie") z sumą kcal. */
export function CategorySection({
  title,
  meals,
  onEdit,
  onDelete,
}: {
  title: string;
  meals: MealRow[];
  onEdit?: (m: MealRow) => void;
  onDelete?: (m: MealRow) => void;
}) {
  const { colors } = useTheme();
  if (meals.length === 0) return null;
  const kcal = meals.reduce((p, m) => p + m.kcal, 0);
  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
          {title}
        </Text>
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {fmtKcal(kcal)}
          </Text>
        </View>
      </View>
      {meals.map((m) => (
        <MealCard
          key={m.id}
          meal={m}
          onEdit={onEdit ? () => onEdit(m) : undefined}
          onDelete={onDelete ? () => onDelete(m) : undefined}
        />
      ))}
    </View>
  );
}
