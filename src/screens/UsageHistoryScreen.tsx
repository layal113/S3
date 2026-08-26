import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiqyasBrand } from '../components/MiqyasBrand';
import { UsageHistoryChart } from '../components/UsageHistoryChart';
import type { HistoryService } from '../services';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type {
  HistoryAppliance,
  HistoryPeriod,
  HistoryUnit,
  UsageHistoryData,
} from '../types/history';

const appliances: { id: HistoryAppliance; label: string }[] = [
  { id: 'total', label: 'Total home' },
  { id: 'airConditioner', label: 'AC' },
  { id: 'waterHeater', label: 'Water heater' },
  { id: 'refrigerator', label: 'Refrigerator' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'other', label: 'Other' },
];

function Toggle<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.toggle}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityState={{ selected: item.id === value }}
          onPress={() => onChange(item.id)}
          style={[
            styles.toggleButton,
            item.id === value && styles.activeToggle,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              item.id === value && styles.activeToggleText,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function UsageHistoryScreen({
  service,
  initialAppliance,
}: {
  service: HistoryService;
  initialAppliance?: HistoryAppliance;
}) {
  const [period, setPeriod] = useState<HistoryPeriod>('7d');
  const [unit, setUnit] = useState<HistoryUnit>('kwh');
  const [appliance, setAppliance] = useState<HistoryAppliance>(
    initialAppliance ?? 'total',
  );
  const [data, setData] = useState<UsageHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openAnomaly, setOpenAnomaly] = useState(false);

  useEffect(() => {
    let active = true;
    service
      .getHistory(period)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
          setSelectedIndex(0);
        }
      })
      .catch(() => {
        if (active) setError('Usage history could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [period, retry, service]);
  const currentData = data?.period === period ? data : null;
  const selectedAnomaly = useMemo(
    () => currentData?.points[selectedIndex]?.anomaly,
    [currentData, selectedIndex],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <MiqyasBrand />
          <Text accessibilityRole="header" style={styles.title}>
            Usage history
          </Text>
          <Text style={styles.subtitle}>
            See when and why energy use changed.
          </Text>
        </View>
        <Toggle
          items={[
            { id: '7d', label: '7 days' },
            { id: '4w', label: '4 weeks' },
            { id: '6m', label: '6 months' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.applianceFilters}
        >
          {appliances.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setAppliance(item.id)}
              style={[
                styles.filter,
                appliance === item.id && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  appliance === item.id && styles.activeFilterText,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Toggle
          items={[
            { id: 'kwh', label: 'kWh' },
            { id: 'egp', label: 'Estimated EGP' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        {!currentData ? (
          <View style={styles.state}>
            {error ? (
              <>
                <Text style={styles.stateTitle}>Unable to load history</Text>
                <Text style={styles.subtitle}>{error}</Text>
                <Pressable
                  onPress={() => setRetry((value) => value + 1)}
                  style={styles.retry}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.subtitle}>Loading usage history…</Text>
              </>
            )}
          </View>
        ) : currentData.points.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No usage recorded</Text>
            <Text style={styles.subtitle}>
              There is no data for {currentData.dateRangeLabel}. Try another
              period.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.chartCard}>
              <View style={styles.chartHeading}>
                <View>
                  <Text style={styles.cardTitle}>
                    {appliances.find((item) => item.id === appliance)?.label}
                  </Text>
                  <Text style={styles.range}>
                    {currentData.dateRangeLabel} ·{' '}
                    {currentData.granularity === 'day'
                      ? 'daily'
                      : currentData.granularity === 'week'
                        ? 'weekly'
                        : 'monthly'}
                  </Text>
                </View>
                <Text style={styles.unit}>
                  {unit === 'kwh' ? 'kWh' : 'EGP'}
                </Text>
              </View>
              <UsageHistoryChart
                points={currentData.points}
                unit={unit}
                appliance={appliance}
                selectedIndex={selectedIndex}
                onSelect={(index) => {
                  setSelectedIndex(index);
                  setOpenAnomaly(false);
                }}
              />
            </View>
            {selectedAnomaly ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpenAnomaly((value) => !value)}
                style={styles.anomaly}
              >
                <Ionicons
                  color={colors.warning}
                  name="warning-outline"
                  size={23}
                />
                <View style={styles.anomalyCopy}>
                  <Text style={styles.anomalyTitle}>
                    {selectedAnomaly.title}
                  </Text>
                  <Text style={styles.anomalyAction}>
                    {openAnomaly
                      ? 'Hide explanation'
                      : 'Open anomaly explanation'}
                  </Text>
                  {openAnomaly ? (
                    <Text style={styles.anomalyText}>
                      {selectedAnomaly.explanation}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  toggle: {
    backgroundColor: colors.border,
    borderRadius: radii.md,
    flexDirection: 'row',
    padding: 3,
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  activeToggle: { backgroundColor: colors.surface },
  toggleText: { ...typography.label, color: colors.textMuted },
  activeToggleText: { color: colors.primaryDark },
  applianceFilters: { gap: spacing.sm },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  activeFilter: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { ...typography.label, color: colors.textMuted },
  activeFilterText: { color: colors.surface },
  chartCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  chartHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { ...typography.heading, color: colors.text },
  range: { fontSize: 12, color: colors.textMuted },
  unit: { ...typography.label, color: colors.primary },
  state: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 300,
  },
  stateTitle: { ...typography.heading, color: colors.text },
  retry: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  retryText: { ...typography.label, color: colors.surface },
  anomaly: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  anomalyCopy: { flex: 1, gap: spacing.xs },
  anomalyTitle: { ...typography.heading, color: colors.text },
  anomalyAction: { ...typography.label, color: colors.warning },
  anomalyText: { ...typography.body, color: colors.textMuted },
});
