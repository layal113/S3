import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import type { HouseholdId, HouseholdOption } from '../types/dashboard';

export function HouseholdSelector({
  households,
  selectedId,
  onSelect,
}: {
  households: HouseholdOption[];
  selectedId: HouseholdId;
  onSelect: (id: HouseholdId) => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Household</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {households.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.selectedOption,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={selected ? colors.surface : colors.textMuted}
                name={selected ? 'home' : 'home-outline'}
                size={17}
              />
              <Text
                style={[styles.optionText, selected && styles.selectedText]}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textMuted },
  options: { gap: spacing.sm, paddingRight: spacing.lg },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  selectedOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.7 },
  optionText: { ...typography.label, color: colors.text },
  selectedText: { color: colors.surface },
});
