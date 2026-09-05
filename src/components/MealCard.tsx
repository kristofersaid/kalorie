import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MealRow } from '../db/database';
import { sourceLabel } from '../lib/constants';
import { fmtG, fmtKcal, timeOf } from '../lib/format';

/** Kafelek pojedynczego wpisu posiłku. */
export function MealCard({
  meal,
  onEdit,
  onDelete,
}: {
  meal: MealRow;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text
          style={{ fontWeight: '700', color: colors.text, flex: 1, fontSize: 15 }}
          numberOfLines={2}>
          {meal.nazwa}
        </Text>
        <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
          {timeOf(meal.created_at)}
        </Text>
      </View>
      <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13, marginTop: 4 }}>
        {fmtKcal(meal.kcal)}
        {meal.waga > 0 ? ` • ${fmtG(meal.waga)}` : ''} • {sourceLabel(meal.zrodlo)}
        {`\nB: ${fmtG(meal.bialko)}  T: ${fmtG(meal.tluszcze)}  W: ${fmtG(meal.wegle)}`}
      </Text>
      {(onEdit || onDelete) && (
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Edytuj
              </Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e53935',
              }}>
              <Text style={{ color: '#e53935', fontWeight: '600' }}>Usuń</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
