import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, motion, radii, spacing, typography } from '../theme';
import type { HouseholdId, HouseholdOption } from '../types/dashboard';
import { feedback } from '../utils/feedback';

const householdMeta: Record<
  HouseholdId,
  { icon: keyof typeof Ionicons.glyphMap; subtitle: string }
> = {
  'high-ac-home': { icon: 'snow-outline', subtitle: 'High cooling use' },
  'efficient-flat': { icon: 'leaf-outline', subtitle: 'Efficient apartment' },
  'family-villa': { icon: 'business-outline', subtitle: 'Family villa' },
};

function HouseholdOptionCard({
  item,
  onSelect,
  selected,
}: {
  item: HouseholdOption;
  onSelect: (id: HouseholdId) => void;
  selected: boolean;
}) {
  const [progress] = useState(
    () => new Animated.Value(selected ? 1 : 0),
  );
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      duration: motion.fast,
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [progress, reducedMotion, selected]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.025],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => {
          void feedback.selection();
          onSelect(item.id);
        }}
        style={({ pressed }) => [
          styles.option,
          selected && styles.selectedOption,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.optionIcon, selected && styles.selectedIcon]}>
          <Ionicons
            color={selected ? colors.primary : colors.textMuted}
            name={householdMeta[item.id].icon}
            size={18}
          />
        </View>
        <View>
          <Text style={[styles.optionText, selected && styles.selectedText]}>
            {item.name}
          </Text>
          <Text
            style={[styles.optionMeta, selected && styles.selectedOptionMeta]}
          >
            {householdMeta[item.id].subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

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
            <HouseholdOptionCard
              item={item}
              key={item.id}
              onSelect={onSelect}
              selected={selected}
            />
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
    ...borders.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  selectedOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  selectedIcon: { backgroundColor: colors.surface },
  optionText: { ...typography.label, color: colors.text },
  selectedText: { color: colors.surface },
  optionMeta: { color: colors.textMuted, fontSize: 10 },
  selectedOptionMeta: { color: colors.tealSoft },
});
