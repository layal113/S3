import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HouseholdProfile } from '../state/HouseholdProfileContext';
import { borders, colors, radii, shadows, spacing, typography } from '../theme';
import type { HouseholdId } from '../types/dashboard';
import type {
  OccupancyMode,
  SimulationConditions,
  SimulationOptions,
  SimulationRunResult,
  UsageIntensity,
} from '../types/simulation';
import { formatEgp, formatNumber } from '../utils/format';

const scenarioOptions: Record<HouseholdId, { id: string; label: string }[]> = {
  'high-ac-home': [
    { id: 'heatwave', label: 'Heatwave' },
    { id: 'busy-evening', label: 'Busy evening' },
    { id: 'workday', label: 'Workday' },
    { id: 'conservation', label: 'Conservation' },
  ],
  'efficient-flat': [
    { id: 'efficient-routine', label: 'Efficient routine' },
    { id: 'away-day', label: 'Away day' },
    { id: 'work-from-home', label: 'Work from home' },
    { id: 'laundry-weekend', label: 'Laundry weekend' },
  ],
  'family-villa': [
    { id: 'school-day', label: 'School day' },
    { id: 'family-gathering', label: 'Family gathering' },
    { id: 'quiet-villa', label: 'Quiet villa' },
    { id: 'hot-weekend', label: 'Hot weekend' },
  ],
};

const applianceOptions = [
  ['electronics', 'Electronics'],
  ['oven', 'Oven'],
  ['washing_machine', 'Washer'],
  ['dishwasher', 'Dishwasher'],
  ['pool_pump', 'Pool pump'],
] as const;

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, value === option.value && styles.selectedChip]}
          >
            <Text
              style={[
                styles.chipText,
                value === option.value && styles.selectedChipText,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const simulationStages = [
  'Generating household activity',
  'Processing appliance usage',
  'Updating forecast and tariff',
  'Refreshing Insights and Smart Tips',
];

function SimulationProgress() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setActiveStep((current) => Math.min(current + 1, 3)),
      650,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <View accessibilityRole="progressbar" style={styles.progressPanel}>
      <View style={styles.progressIcon}>
        <ActivityIndicator color={colors.surface} size="small" />
      </View>
      <View style={styles.progressHeading}>
        <Text style={styles.sheetTitle}>Building your scenario</Text>
        <Text style={styles.helper}>This normally takes only a moment.</Text>
      </View>
      <View style={styles.progressStages}>
        {simulationStages.map((stage, index) => {
          const completed = index < activeStep;
          const active = index === activeStep;
          return (
            <View key={stage} style={styles.progressStage}>
              <View
                style={[
                  styles.progressDot,
                  (completed || active) && styles.activeProgressDot,
                ]}
              >
                {completed ? (
                  <Ionicons color={colors.surface} name="checkmark" size={14} />
                ) : active ? (
                  <View style={styles.innerProgressDot} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.progressText,
                  (completed || active) && styles.activeProgressText,
                ]}
              >
                {stage}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SimulationSetupSheet({
  householdId,
  isRunning,
  profile,
  visible,
  onClose,
  onRun,
}: {
  householdId: HouseholdId;
  isRunning: boolean;
  profile: HouseholdProfile;
  visible: boolean;
  onClose: () => void;
  onRun: (options: SimulationOptions) => void;
}) {
  const scenarios = scenarioOptions[householdId];
  const [mode, setMode] = useState<'surprise' | 'custom'>('surprise');
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [useProfile, setUseProfile] = useState(false);
  const [temperatureC, setTemperatureC] = useState(30);
  const [thermostatC, setThermostatC] = useState(24);
  const [acHours, setAcHours] = useState('6');
  const [occupancy, setOccupancy] = useState<OccupancyMode>('home');
  const [dayType, setDayType] = useState<'weekday' | 'weekend'>('weekday');
  const [usageIntensity, setUsageIntensity] =
    useState<UsageIntensity>('typical');
  const [appliances, setAppliances] = useState<string[]>([
    'electronics',
    'oven',
  ]);

  const selectedScenarioId = scenarios.some((item) => item.id === scenarioId)
    ? scenarioId
    : scenarios[0].id;

  const profileInput = useProfile
    ? {
        homeType: profile.homeType,
        occupants: profile.residents,
        location: profile.location,
      }
    : undefined;

  const run = () => {
    if (mode === 'surprise') {
      onRun({ mode: 'surprise', useProfile, profile: profileInput });
      return;
    }
    const conditions: SimulationConditions = {
      label: `Custom ${dayType} · ${temperatureC}°C`,
      temperatureC,
      thermostatC,
      acHours: Math.max(0, Math.min(18, Number(acHours) || 0)),
      occupancy,
      dayType,
      usageIntensity,
      appliances,
    };
    onRun({
      mode: 'custom',
      scenarioId: selectedScenarioId,
      useProfile,
      profile: profileInput,
      conditions,
    });
  };

  const toggleAppliance = (id: string) => {
    setAppliances((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close simulation setup"
          onPress={isRunning ? undefined : onClose}
          style={styles.dismissArea}
        />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.headingCopy}>
              <Text style={styles.sheetTitle}>Simulate this household</Text>
              <Text style={styles.sheetSubtitle}>
                Quick by default, detailed only if you want it.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              disabled={isRunning}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons color={colors.text} name="close" size={24} />
            </Pressable>
          </View>
          {isRunning ? (
            <SimulationProgress />
          ) : (
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modeGrid}>
                <Pressable
                  onPress={() => setMode('surprise')}
                  style={[
                    styles.modeCard,
                    mode === 'surprise' && styles.selectedMode,
                  ]}
                >
                  <Ionicons
                    color={
                      mode === 'surprise' ? colors.surface : colors.primary
                    }
                    name="sparkles"
                    size={24}
                  />
                  <Text
                    style={[
                      styles.modeTitle,
                      mode === 'surprise' && styles.selectedModeText,
                    ]}
                  >
                    Surprise me
                  </Text>
                  <Text
                    style={[
                      styles.modeText,
                      mode === 'surprise' && styles.selectedModeText,
                    ]}
                  >
                    Instantly rotate to a meaningful scenario.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('custom')}
                  style={[
                    styles.modeCard,
                    mode === 'custom' && styles.selectedMode,
                  ]}
                >
                  <Ionicons
                    color={mode === 'custom' ? colors.surface : colors.primary}
                    name="options"
                    size={24}
                  />
                  <Text
                    style={[
                      styles.modeTitle,
                      mode === 'custom' && styles.selectedModeText,
                    ]}
                  >
                    Customize
                  </Text>
                  <Text
                    style={[
                      styles.modeText,
                      mode === 'custom' && styles.selectedModeText,
                    ]}
                  >
                    Choose conditions and appliance behavior.
                  </Text>
                </Pressable>
              </View>

              <View style={styles.profileRow}>
                <View style={styles.profileCopy}>
                  <Text style={styles.fieldLabel}>
                    Use saved household profile
                  </Text>
                  <Text style={styles.helper}>
                    {profile.homeType} · {profile.residents} residents ·{' '}
                    {profile.location}
                  </Text>
                </View>
                <Switch
                  onValueChange={setUseProfile}
                  trackColor={{ true: colors.teal }}
                  value={useProfile}
                />
              </View>

              {mode === 'custom' ? (
                <View style={styles.customFields}>
                  <ChoiceRow
                    label="Starting scenario"
                    options={scenarios.map((item) => ({
                      value: item.id,
                      label: item.label,
                    }))}
                    value={selectedScenarioId}
                    onChange={setScenarioId}
                  />
                  <ChoiceRow
                    label="Temperature"
                    options={[24, 30, 36].map((value) => ({
                      value: String(value),
                      label: `${value}°C`,
                    }))}
                    value={String(temperatureC)}
                    onChange={(value) => setTemperatureC(Number(value))}
                  />
                  <ChoiceRow
                    label="People at home"
                    options={[
                      { value: 'away', label: 'Away' },
                      { value: 'partial', label: 'Some' },
                      { value: 'home', label: 'Everyone' },
                    ]}
                    value={occupancy}
                    onChange={setOccupancy}
                  />
                  <ChoiceRow
                    label="Day"
                    options={[
                      { value: 'weekday', label: 'Weekday' },
                      { value: 'weekend', label: 'Weekend' },
                    ]}
                    value={dayType}
                    onChange={setDayType}
                  />
                  <ChoiceRow
                    label="Usage level"
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'typical', label: 'Typical' },
                      { value: 'high', label: 'Heavy' },
                    ]}
                    value={usageIntensity}
                    onChange={setUsageIntensity}
                  />
                  <View style={styles.numberGrid}>
                    <View style={styles.numberField}>
                      <Text style={styles.fieldLabel}>AC hours</Text>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={setAcHours}
                        style={styles.input}
                        value={acHours}
                      />
                    </View>
                    <View style={styles.numberField}>
                      <Text style={styles.fieldLabel}>Thermostat</Text>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() =>
                            setThermostatC((value) => Math.max(18, value - 1))
                          }
                          style={styles.stepButton}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepValue}>{thermostatC}°C</Text>
                        <Pressable
                          onPress={() =>
                            setThermostatC((value) => Math.min(30, value + 1))
                          }
                          style={styles.stepButton}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Extra appliances</Text>
                    <View style={styles.chips}>
                      {applianceOptions.map(([id, label]) => (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: appliances.includes(id),
                          }}
                          key={id}
                          onPress={() => toggleAppliance(id)}
                          style={[
                            styles.chip,
                            appliances.includes(id) && styles.selectedChip,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              appliances.includes(id) &&
                                styles.selectedChipText,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.easyNote}>
                  <Ionicons
                    color={colors.primary}
                    name="information-circle-outline"
                    size={20}
                  />
                  <Text style={styles.helper}>
                    No setup required. You’ll still get a full explanation,
                    comparison, and replay option afterward.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={isRunning}
            onPress={run}
            style={[styles.runButton, isRunning && styles.disabled]}
          >
            <Ionicons
              color={colors.surface}
              name={mode === 'surprise' ? 'sparkles' : 'play'}
              size={20}
            />
            <Text style={styles.runButtonText}>
              {isRunning
                ? 'Generating scenario…'
                : mode === 'surprise'
                  ? 'Surprise me'
                  : 'Run custom simulation'}
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function SimulationResultSheet({
  isReplaying,
  result,
  visible,
  onClose,
  onReplay,
}: {
  isReplaying: boolean;
  result: SimulationRunResult | null;
  visible: boolean;
  onClose: () => void;
  onReplay: () => void;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState(0);
  useEffect(() => {
    if (!timelineOpen || !result || visibleEvents >= result.events.length)
      return;
    const timer = setTimeout(() => setVisibleEvents((value) => value + 1), 650);
    return () => clearTimeout(timer);
  }, [result, timelineOpen, visibleEvents]);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setTimelineOpen(false);
      setVisibleEvents(0);
    }, 0);
    return () => clearTimeout(timer);
  }, [result?.seed, visible]);

  const differences = useMemo(() => {
    if (!result) return null;
    return {
      kwh: result.after.projectedMonthlyKwh - result.before.projectedMonthlyKwh,
      bill:
        result.after.predictedMonthEndBillEgp -
        result.before.predictedMonthEndBillEgp,
      tier:
        result.after.tariffStatus.currentTier -
        result.before.tariffStatus.currentTier,
    };
  }, [result]);
  if (!result || !differences) return null;

  const signed = (value: number, suffix = '') =>
    `${value > 0 ? '+' : ''}${formatNumber(value)}${suffix}`;
  const selectedAppliances =
    result.configuration.selected_appliances ??
    result.configuration.selectedAppliances;
  const conditions = result.configuration.conditions;
  const conditionSummary =
    conditions && typeof conditions === 'object'
      ? Object.entries(conditions as Record<string, unknown>)
          .filter(([key]) =>
            [
              'temperatureC',
              'temperature_c',
              'acHours',
              'ac_hours',
              'occupancy',
              'dayType',
              'day_type',
              'usageIntensity',
              'usage_intensity',
            ].includes(key),
          )
          .map(([key, value]) => {
            const labels: Record<string, string> = {
              temperatureC: 'Temperature',
              temperature_c: 'Temperature',
              acHours: 'AC hours',
              ac_hours: 'AC hours',
              occupancy: 'Occupancy',
              dayType: 'Day',
              day_type: 'Day',
              usageIntensity: 'Usage',
              usage_intensity: 'Usage',
            };
            const suffix = key.toLowerCase().includes('temperature')
              ? '°C'
              : key === 'acHours' || key === 'ac_hours'
                ? 'h'
                : '';
            return `${labels[key]}: ${String(value)}${suffix}`;
          })
          .join(' · ')
      : '';
  const forecastDirection =
    differences.bill > 0 ? 'raised' : differences.bill < 0 ? 'lowered' : 'kept';

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close simulation result"
          onPress={onClose}
          style={styles.dismissArea}
        />
        <SafeAreaView edges={['bottom']} style={styles.resultSheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>SIMULATION COMPLETE</Text>
              <Text style={styles.sheetTitle}>{result.scenarioLabel}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons color={colors.text} name="close" size={24} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.resultContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.summaryCard}>
              <Ionicons
                color={colors.primary}
                name={
                  differences.bill > 0
                    ? 'trending-up'
                    : differences.bill < 0
                      ? 'trending-down'
                      : 'swap-horizontal'
                }
                size={26}
              />
              <Text style={styles.summaryTitle}>
                This scenario {forecastDirection} the forecast
              </Text>
              <Text style={styles.summaryText}>
                Projected usage is now{' '}
                {formatNumber(result.after.projectedMonthlyKwh)} kWh and the
                bill estimate is{' '}
                {formatEgp(result.after.predictedMonthEndBillEgp)}.
              </Text>
            </View>

            <View style={styles.comparisonCard}>
              <Text style={styles.cardTitle}>
                Compared with the previous run
              </Text>
              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {signed(differences.kwh, ' kWh')}
                  </Text>
                  <Text style={styles.comparisonLabel}>Monthly use</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {differences.bill > 0 ? '+' : ''}
                    {formatEgp(differences.bill)}
                  </Text>
                  <Text style={styles.comparisonLabel}>Bill forecast</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonValue}>
                    {differences.tier === 0
                      ? 'No change'
                      : signed(differences.tier)}
                  </Text>
                  <Text style={styles.comparisonLabel}>Tariff tiers</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>What was simulated</Text>
              <Text style={styles.infoText}>
                Seed #{result.seed} ·{' '}
                {String(result.configuration.mode ?? 'surprise')} mode
              </Text>
              {conditionSummary ? (
                <Text style={styles.infoText}>{conditionSummary}</Text>
              ) : null}
              {Array.isArray(selectedAppliances) &&
              selectedAppliances.length > 0 ? (
                <Text style={styles.infoText}>
                  Appliances:{' '}
                  {selectedAppliances
                    .map((item) => String(item).replaceAll('_', ' '))
                    .join(', ')}
                </Text>
              ) : null}
              <Text style={styles.infoText}>
                Profile:{' '}
                {(result.configuration.profile_applied ??
                result.configuration.profileApplied)
                  ? 'Applied'
                  : 'Not applied'}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setTimelineOpen((value) => !value);
                setVisibleEvents(0);
              }}
              style={styles.timelineButton}
            >
              <Ionicons color={colors.primary} name="time-outline" size={21} />
              <View style={styles.timelineButtonCopy}>
                <Text style={styles.cardTitle}>
                  {timelineOpen ? 'Hide day playback' : 'Play simulated day'}
                </Text>
                <Text style={styles.helper}>
                  Watch the major usage events in sequence.
                </Text>
              </View>
              <Ionicons
                color={colors.textMuted}
                name={timelineOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
              />
            </Pressable>
            {timelineOpen ? (
              <View style={styles.timeline}>
                {result.events.slice(0, visibleEvents).map((event) => (
                  <View
                    key={`${event.time}-${event.title}`}
                    style={styles.timelineEvent}
                  >
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <View style={styles.eventDot} />
                    <View style={styles.eventCopy}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.helper}>{event.detail}</Text>
                    </View>
                  </View>
                ))}
                {visibleEvents < result.events.length ? (
                  <Text style={styles.playingText}>Playing day…</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.resultActions}>
            <Pressable
              disabled={isReplaying}
              onPress={onReplay}
              style={[styles.secondaryButton, isReplaying && styles.disabled]}
            >
              <Ionicons color={colors.primary} name="repeat" size={19} />
              <Text style={styles.secondaryButtonText}>
                {isReplaying ? 'Replaying…' : 'Replay exact scenario'}
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.runButtonText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: { flex: 1 },
  sheet: {
    ...shadows.elevated,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '90%',
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
  },
  resultSheet: {
    ...shadows.elevated,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    height: '88%',
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
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
  headingCopy: { flex: 1 },
  sheetTitle: { ...typography.heading, color: colors.text },
  sheetSubtitle: { ...typography.body, color: colors.textMuted },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sheetContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  modeGrid: { flexDirection: 'row', gap: spacing.md },
  modeCard: {
    ...borders.card,
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.xs,
    minHeight: 128,
    padding: spacing.md,
  },
  selectedMode: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeTitle: { ...typography.label, color: colors.text },
  modeText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedModeText: { color: colors.surface },
  profileRow: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  profileCopy: { flex: 1 },
  helper: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  customFields: { gap: spacing.lg },
  field: { gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...typography.label, color: colors.textMuted, fontSize: 12 },
  selectedChipText: { color: colors.surface },
  numberGrid: { flexDirection: 'row', gap: spacing.md },
  numberField: { flex: 1, gap: spacing.sm },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  stepper: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  stepButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 42,
  },
  stepText: { ...typography.heading, color: colors.primary },
  stepValue: { ...typography.label, color: colors.text },
  easyNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  runButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  runButtonText: { ...typography.label, color: colors.surface },
  resultContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  summaryCard: {
    ...shadows.card,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  summaryTitle: { ...typography.heading, color: colors.text },
  summaryText: { ...typography.body, color: colors.text },
  comparisonCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: { ...typography.label, color: colors.text },
  comparisonGrid: { flexDirection: 'row', gap: spacing.sm },
  comparisonItem: { flex: 1 },
  comparisonValue: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 16,
  },
  comparisonLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 11,
  },
  infoCard: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  infoText: { ...typography.body, color: colors.textMuted, fontSize: 12 },
  timelineButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  timelineButtonCopy: { flex: 1 },
  timeline: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  timelineEvent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventTime: { ...typography.label, color: colors.primary, width: 42 },
  eventDot: {
    backgroundColor: colors.teal,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  eventCopy: { flex: 1 },
  eventTitle: { ...typography.label, color: colors.text },
  playingText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
  },
  resultActions: { flexDirection: 'row', gap: spacing.md },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryButtonText: { ...typography.label, color: colors.primary },
  doneButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  disabled: { opacity: 0.5 },
  progressPanel: {
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 360,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxl,
  },
  progressIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  progressHeading: { alignItems: 'center', gap: spacing.xs },
  progressStages: { alignSelf: 'stretch', gap: spacing.md },
  progressStage: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  progressDot: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  activeProgressDot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  innerProgressDot: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  progressText: { ...typography.body, color: colors.textMuted },
  activeProgressText: {
    color: colors.text,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
});
