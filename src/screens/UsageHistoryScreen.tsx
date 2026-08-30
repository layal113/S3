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
import { useHouseholdProfile } from '../state/HouseholdProfileContext';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type {
  HistoryAppliance,
  HistoryPeriod,
  HistoryUnit,
  UsageHistoryData,
} from '../types/history';
import { formatEgp, formatNumber } from '../utils/format';

const applianceLabels: Record<HistoryAppliance, string> = {
  total: 'Total home',
  airConditioner: 'AC',
  waterHeater: 'Water heater',
  refrigerator: 'Refrigerator',
  lighting: 'Lighting',
  washingMachine: 'Washing machine',
  oven: 'Oven',
  dishwasher: 'Dishwasher',
  electronics: 'Electronics',
  poolPump: 'Pool pump',
  other: 'Other',
};

function displayValue(value: number, unit: HistoryUnit) {
  return unit === 'kwh' ? `${formatNumber(value)} kWh` : formatEgp(value);
}

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
  const [loadedRequestKey, setLoadedRequestKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openAnomaly, setOpenAnomaly] = useState(false);
  const { dataRevision, selectedHouseholdId } = useHouseholdProfile();
  const requestKey = `${selectedHouseholdId}:${period}:${dataRevision}:${retry}`;

  useEffect(() => {
    let active = true;
    service
      .getHistory(selectedHouseholdId, period)
      .then((result) => {
        if (active) {
          setData(result);
          setLoadedRequestKey(requestKey);
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
  }, [dataRevision, period, requestKey, retry, selectedHouseholdId, service]);
  const currentData =
    data?.period === period && loadedRequestKey === requestKey ? data : null;
  const availableFilters: { id: HistoryAppliance; label: string }[] = [
    { id: 'total', label: applianceLabels.total },
    ...(currentData?.availableAppliances ?? []).map((id) => ({
      id,
      label: applianceLabels[id],
    })),
  ];
  const activeAppliance = availableFilters.some((item) => item.id === appliance)
    ? appliance
    : 'total';
  const selectedAnomaly = useMemo(
    () => currentData?.points[selectedIndex]?.anomaly,
    [currentData, selectedIndex],
  );
  const selectedRangeValue = useMemo(() => {
    if (!currentData) return 0;
    return currentData.points.reduce((sum, point) => {
      if (activeAppliance === 'total') {
        return sum + (unit === 'kwh' ? point.totalKWh : point.estimatedCostEGP);
      }
      const selected = point.appliances[activeAppliance];
      return (
        sum + (unit === 'kwh' ? (selected?.kWh ?? 0) : (selected?.costEGP ?? 0))
      );
    }, 0);
  }, [activeAppliance, currentData, unit]);
  const billingCycleTotal = currentData
    ? unit === 'kwh'
      ? currentData.billingCycleKWh
      : currentData.billingCycleCostEgp
    : 0;
  const projectedTotal = currentData
    ? unit === 'kwh'
      ? currentData.projectedMonthlyKWh
      : currentData.projectedMonthlyCostEgp
    : 0;
  const selectedBillingValue = currentData
    ? activeAppliance === 'total'
      ? billingCycleTotal
      : unit === 'kwh'
        ? (currentData.billingCycleAppliances[activeAppliance]?.kWh ?? 0)
        : (currentData.billingCycleAppliances[activeAppliance]?.costEGP ?? 0)
    : 0;
  const selectedBillingShare =
    billingCycleTotal > 0
      ? (selectedBillingValue / billingCycleTotal) * 100
      : 0;

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
          {availableFilters.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setAppliance(item.id)}
              style={[
                styles.filter,
                activeAppliance === item.id && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  activeAppliance === item.id && styles.activeFilterText,
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
            <View style={styles.reconciliationCard}>
              <View style={styles.reconciliationHeader}>
                <View style={styles.connectedIcon}>
                  <Ionicons color={colors.success} name="checkmark" size={17} />
                </View>
                <View style={styles.reconciliationCopy}>
                  <Text style={styles.reconciliationTitle}>
                    Matched with Home
                  </Text>
                  <Text style={styles.reconciliationScenario}>
                    {currentData.scenarioLabel} · simulation #
                    {currentData.simulationSeed ?? '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.summaryValue}
                  >
                    {displayValue(billingCycleTotal, unit)}
                  </Text>
                  <Text style={styles.summaryLabel}>Home · used so far</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.summaryValue}
                  >
                    {displayValue(projectedTotal, unit)}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Home · projected month
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.summaryValue}
                  >
                    {displayValue(selectedRangeValue, unit)}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {applianceLabels[activeAppliance]} · selected range
                  </Text>
                </View>
              </View>
              <Text style={styles.reconciliationNote}>
                The first two values exactly match Home. The selected-range
                subtotal covers {currentData.dateRangeLabel}, so it may differ
                from the full billing cycle.
              </Text>
            </View>
            <View style={styles.chartCard}>
              <View style={styles.chartHeading}>
                <View>
                  <Text style={styles.cardTitle}>
                    {applianceLabels[activeAppliance]}
                  </Text>
                  <Text style={styles.range}>
                    {currentData.dateRangeLabel} ·{' '}
                    {currentData.granularity === 'day'
                      ? 'daily'
                      : currentData.granularity === 'week'
                        ? 'weekly'
                        : 'monthly'}
                  </Text>
                  {activeAppliance !== 'total' ? (
                    <Text style={styles.contribution}>
                      {formatNumber(selectedBillingShare)}% of the current{' '}
                      {unit === 'kwh' ? 'usage' : 'estimated cost'}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.unit}>
                  {unit === 'kwh' ? 'kWh' : 'EGP'}
                </Text>
              </View>
              <UsageHistoryChart
                points={currentData.points}
                unit={unit}
                appliance={activeAppliance}
                granularity={currentData.granularity}
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
  reconciliationCard: {
    ...shadows.card,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reconciliationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  connectedIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  reconciliationCopy: { flex: 1 },
  reconciliationTitle: { ...typography.label, color: colors.text },
  reconciliationScenario: { color: colors.textMuted, fontSize: 11 },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm },
  summaryItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    padding: spacing.md,
  },
  summaryValue: {
    ...typography.heading,
    color: colors.primaryDark,
    fontSize: 16,
  },
  summaryLabel: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  reconciliationNote: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  chartHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { ...typography.heading, color: colors.text },
  range: { fontSize: 12, color: colors.textMuted },
  contribution: { color: colors.teal, fontSize: 11, marginTop: spacing.xs },
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
