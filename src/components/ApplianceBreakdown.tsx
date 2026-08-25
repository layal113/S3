import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { ApplianceUsage } from '../types/dashboard';
import type { HistoryAppliance } from '../types/history';
import { formatNumber } from '../utils/format';

const chartColors = ['#2E7D4A', '#6B9F7D', '#A5B88D', '#D2B95B', '#84908A'];
export function ApplianceBreakdown({
  appliances,
  onAppliancePress,
}: {
  appliances: ApplianceUsage[];
  onAppliancePress: (appliance: HistoryAppliance) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = [...appliances].sort(
    (a, b) => b.sharePercent - a.sharePercent,
  )[0];
  const circumference = 2 * Math.PI * 48;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open appliance breakdown. ${top.category} is highest at ${top.sharePercent} percent.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.preview, pressed && styles.pressed]}
      >
        <View style={styles.previewIcon}>
          <Ionicons color={colors.primary} name="flash-outline" size={22} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.eyebrow}>APPLIANCE USAGE</Text>
          <Text style={styles.previewTitle}>
            {top.category === 'Air conditioner' ? 'AC' : top.category} is the
            highest consumer at {top.sharePercent}%
          </Text>
          <Text style={styles.link}>View breakdown</Text>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={22} />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Close appliance breakdown"
            onPress={() => setOpen(false)}
            style={styles.dismissArea}
          />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>
                Appliance breakdown
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
                style={styles.close}
              >
                <Ionicons color={colors.text} name="close" size={24} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.donutWrap}>
                <Svg height={130} width={130}>
                  {appliances.map((item, index) => {
                    const dash = (circumference * item.sharePercent) / 100;
                    const currentOffset = appliances
                      .slice(0, index)
                      .reduce(
                        (sum, previous) =>
                          sum + (circumference * previous.sharePercent) / 100,
                        0,
                      );
                    return (
                      <Circle
                        key={item.category}
                        cx="65"
                        cy="65"
                        fill="none"
                        origin="65,65"
                        r="48"
                        rotation="-90"
                        stroke={chartColors[index]}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-currentOffset}
                        strokeWidth="18"
                      />
                    );
                  })}
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutValue}>100%</Text>
                  <Text style={styles.donutLabel}>usage</Text>
                </View>
              </View>
              {appliances.map((item, index) => (
                <View key={item.category} style={styles.applianceRow}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: chartColors[index] },
                    ]}
                  />
                  <View style={styles.applianceCopy}>
                    <Text style={styles.applianceName}>{item.category}</Text>
                    <Text style={styles.confidence}>
                      {item.modelScoreLabel ?? item.confidence ?? 'N/A'} model score
                    </Text>
                  </View>
                  <View style={styles.values}>
                    <Text style={styles.percentage}>{item.sharePercent}%</Text>
                    <Text style={styles.kwh}>
                      {formatNumber(item.consumptionKwh)} kWh
                    </Text>
                  </View>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOpen(false);
                  onAppliancePress('total');
                }}
                style={styles.usageButton}
              >
                <Text style={styles.usageButtonText}>
                  Open complete Usage page
                </Text>
                <Ionicons
                  color={colors.surface}
                  name="arrow-forward"
                  size={18}
                />
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  preview: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 96,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  previewIcon: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  previewCopy: { flex: 1, gap: 2 },
  eyebrow: { ...typography.label, color: colors.primary, fontSize: 10 },
  previewTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  link: { ...typography.label, color: colors.teal },
  overlay: {
    backgroundColor: 'rgba(20,30,25,0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '82%',
    padding: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 5,
    marginBottom: spacing.md,
    width: 46,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitle: { ...typography.heading, color: colors.text },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  donutWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 150,
    justifyContent: 'center',
    width: 150,
  },
  donutCenter: { alignItems: 'center', position: 'absolute' },
  donutValue: { ...typography.heading, color: colors.text },
  donutLabel: { fontSize: 11, color: colors.textMuted },
  applianceRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
  },
  dot: { borderRadius: 6, height: 12, width: 12 },
  applianceCopy: { flex: 1 },
  applianceName: { ...typography.label, color: colors.text },
  confidence: { fontSize: 11, color: colors.textMuted },
  values: { alignItems: 'flex-end' },
  percentage: { ...typography.label, color: colors.text },
  kwh: { fontSize: 11, color: colors.textMuted },
  usageButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  usageButtonText: { ...typography.label, color: colors.surface },
});
