import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { ActivityRow } from '../db/database';
import { fmtKcal, timeOf } from '../lib/format';
import { formatPace, paceMinPerKm } from '../lib/activities';

/** Kafelek pojedynczej aktywności (treningu). */
export function ActivityCard({
  activity,
  onEdit,
  onDelete,
}: {
  activity: ActivityRow;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const pace = paceMinPerKm(activity.czas_min, activity.dystans_km);
  const details: string[] = [];
  if (activity.czas_min > 0) details.push(`${Math.round(activity.czas_min)} min`);
  if (activity.dystans_km > 0)
    details.push(`${activity.dystans_km} km`);
  if (pace != null) details.push(formatPace(pace));
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: '#2e7d32',
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text
          style={{ fontWeight: '700', color: colors.text, flex: 1, fontSize: 15 }}
          numberOfLines={2}>
          🏃 {activity.nazwa}
        </Text>
        <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
          {timeOf(activity.created_at)}
        </Text>
      </View>
      <Text
        style={{
          color: '#2e7d32',
          fontWeight: '800',
          fontSize: 15,
          marginTop: 2,
        }}>
        −{fmtKcal(activity.kcal)}
        {details.length > 0 && (
          <Text style={{ color: colors.text, opacity: 0.7, fontWeight: '400', fontSize: 13 }}>
            {'  •  '}{details.join('  •  ')}
          </Text>
        )}
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
