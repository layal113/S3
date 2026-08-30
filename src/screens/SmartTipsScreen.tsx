import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { MiqyasBrand } from '../components/MiqyasBrand';
import { Reveal } from '../components/Reveal';
import { CardSkeleton, SkeletonBlock } from '../components/Skeleton';
import { useMobileBrowserBottomInset } from '../hooks/useMobileBrowserBottomInset';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { DashboardService, HistoryService } from '../services';
import {
  generateSmartTips,
  sendTipChatMessage,
} from '../services/geminiService';
import { useHouseholdProfile } from '../state/HouseholdProfileContext';
import {
  borders,
  colors,
  layout,
  motion,
  radii,
  shadows,
  spacing,
  typography,
} from '../theme';
import type {
  FullUsageData,
  HouseholdTipData,
  SmartTip,
  SmartTipCategory,
  TipChatMessage,
} from '../types/smartTips';
import { feedback } from '../utils/feedback';

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const tipIcons: Record<SmartTipCategory, keyof typeof Ionicons.glyphMap> = {
  heating: 'thermometer-outline',
  cooling: 'snow-outline',
  appliances: 'flash-outline',
  lighting: 'bulb-outline',
  behavior: 'people-outline',
};

function SparklePulse() {
  const scale = useMemo(() => new Animated.Value(0.8), []);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(scale, {
        duration: motion.normal,
        easing: Easing.out(Easing.back(1.4)),
        toValue: 1.18,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        duration: motion.fast,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reducedMotion, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons color={colors.surface} name="sparkles" size={25} />
    </Animated.View>
  );
}

function TypingIndicator() {
  const opacity = useMemo(() => new Animated.Value(0.35), []);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 420,
          toValue: 0.35,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return (
    <Animated.View style={[styles.typingBubble, { opacity }]}>
      <Text style={styles.typingText}>Miqyas is thinking…</Text>
    </Animated.View>
  );
}

interface CachedTips {
  inputSignature: string;
  generationId: string;
  savedAt: number;
  tips: SmartTip[];
}

function createMessage(
  role: TipChatMessage['role'],
  text: string,
): TipChatMessage {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, text };
}

function inputSignature(data: HouseholdTipData) {
  return JSON.stringify(data);
}

function cacheKey(householdId: string) {
  return `@miqyas/smart-tips-v1/${householdId}`;
}

function chatPrefix(householdId: string) {
  return `@miqyas/smart-tip-chat-v2/${householdId}/`;
}

function chatKey(householdId: string, generationId: string, tipId: string) {
  return `${chatPrefix(householdId)}${generationId}/${tipId}`;
}

async function clearHouseholdChats(householdId: string) {
  const prefix = chatPrefix(householdId);
  const legacyPrefix = `@miqyas/smart-tip-chat-v1/${householdId}/`;
  const keys = await AsyncStorage.getAllKeys();
  const householdChatKeys = keys.filter(
    (key) => key.startsWith(prefix) || key.startsWith(legacyPrefix),
  );
  if (householdChatKeys.length > 0) {
    await AsyncStorage.multiRemove(householdChatKeys);
  }
}

export function SmartTipsScreen({
  historyService,
  service,
}: {
  historyService: HistoryService;
  service: DashboardService;
}) {
  const { dataRevision, selectedHouseholdId, selectedProfile } =
    useHouseholdProfile();
  const [tips, setTips] = useState<SmartTip[]>([]);
  const [generationId, setGenerationId] = useState('');
  const [fullUsageData, setFullUsageData] = useState<FullUsageData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTip, setSelectedTip] = useState<SmartTip | null>(null);
  const [generalChatOpen, setGeneralChatOpen] = useState(false);

  const loadTips = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        if (forceRefresh) {
          setTips([]);
          setGenerationId('');
          setSelectedTip(null);
          setGeneralChatOpen(false);
          await clearHouseholdChats(selectedHouseholdId);
        }
        const [dashboard, recentDaily, recentWeekly, olderMonthly] =
          await Promise.all([
            service.getDashboard(selectedHouseholdId),
            historyService
              .getHistory(selectedHouseholdId, '7d')
              .catch(() => null),
            historyService
              .getHistory(selectedHouseholdId, '4w')
              .catch(() => null),
            historyService
              .getHistory(selectedHouseholdId, '6m')
              .catch(() => null),
          ]);
        if (dashboard.householdId !== selectedHouseholdId) {
          throw new Error(
            'The backend returned data for a different household. Please retry.',
          );
        }
        const historyResponses = [recentDaily, recentWeekly, olderMonthly];
        if (
          historyResponses.some(
            (history) =>
              history !== null && history.householdId !== selectedHouseholdId,
          )
        ) {
          throw new Error(
            'The backend returned usage history for a different household. Please retry.',
          );
        }
        const elapsedDays = Math.max(new Date().getDate(), 1);
        const input: HouseholdTipData = {
          householdId: selectedHouseholdId,
          homeType: selectedProfile.homeType,
          occupants: selectedProfile.residents,
          avgKwh: Number(
            (dashboard.currentConsumptionKwh / elapsedDays).toFixed(1),
          ),
          anomaliesSummary: `Active simulation: ${dashboard.simulationScenario}. ${dashboard.priorityInsight.title}: ${dashboard.priorityInsight.message}`,
          peakHours:
            dashboard.simulationEvents.length > 0
              ? dashboard.simulationEvents
                  .map((event) => `${event.time} ${event.title}`)
                  .join('; ')
              : 'Not available from the current dataset',
        };
        setFullUsageData({
          datasetMetadata: {
            selectedHouseholdId,
            simulationRevision: dataRevision,
            dashboardUpdatedAt: dashboard.updatedAt,
            capturedAt: new Date().toISOString(),
          },
          household: {
            id: selectedHouseholdId,
            name: selectedProfile.householdName,
            userName: selectedProfile.userName,
            homeType: selectedProfile.homeType,
            location: selectedProfile.location,
            occupants: selectedProfile.residents,
          },
          dashboard,
          history: { recentDaily, recentWeekly, olderMonthly },
          historyPolicy:
            'Full daily detail for the latest 7 days, weekly summaries for 4 weeks, and monthly summaries for the older 6-month view.',
        });
        const signature = inputSignature(input);

        if (!forceRefresh) {
          const stored = await AsyncStorage.getItem(
            cacheKey(selectedHouseholdId),
          );
          if (stored) {
            try {
              const cached = JSON.parse(stored) as CachedTips;
              if (
                cached.inputSignature === signature &&
                Date.now() - cached.savedAt < CACHE_DURATION_MS &&
                Array.isArray(cached.tips) &&
                cached.tips.length === 4
              ) {
                setTips(cached.tips);
                setGenerationId(
                  cached.generationId || `legacy-${cached.savedAt}`,
                );
                return;
              }
            } catch {
              await AsyncStorage.removeItem(cacheKey(selectedHouseholdId));
            }
          }
        }

        const generated = await generateSmartTips(input);
        const nextGenerationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setTips(generated);
        setGenerationId(nextGenerationId);
        await AsyncStorage.setItem(
          cacheKey(selectedHouseholdId),
          JSON.stringify({
            inputSignature: signature,
            generationId: nextGenerationId,
            savedAt: Date.now(),
            tips: generated,
          }),
        );
      } catch (loadError) {
        setTips([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load Smart Tips.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      dataRevision,
      selectedHouseholdId,
      selectedProfile.householdName,
      selectedProfile.homeType,
      selectedProfile.location,
      selectedProfile.residents,
      selectedProfile.userName,
      historyService,
      service,
    ],
  );

  useEffect(() => {
    const task = setTimeout(() => void loadTips(dataRevision > 0), 0);
    return () => clearTimeout(task);
  }, [dataRevision, loadTips]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && tips.length > 0}
            onRefresh={() => void loadTips(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <MiqyasBrand />
            <Text style={styles.title}>Smart Tips</Text>
            <Text style={styles.subtitle}>
              Personalized for {selectedProfile.householdName}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Generate new smart tips"
            disabled={isLoading}
            onPress={() => {
              void feedback.selection();
              void loadTips(true);
            }}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={colors.primary} name="refresh" size={22} />
          </Pressable>
        </View>

        {isLoading && tips.length === 0 ? (
          <View style={styles.tipSkeletons}>
            <SkeletonBlock height={72} />
            <CardSkeleton compact />
            <CardSkeleton compact />
            <CardSkeleton compact />
            <Text style={styles.stateText}>
              Reviewing this household’s latest usage…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Ionicons
              color={colors.warning}
              name="alert-circle-outline"
              size={38}
            />
            <Text style={styles.stateTitle}>Smart Tips couldn’t load</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void loadTips(true)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.tipList}>
            {fullUsageData ? (
              <View style={styles.latestContext}>
                <Ionicons color={colors.success} name="sync" size={15} />
                <Text style={styles.latestContextText}>
                  Based on the latest{' '}
                  {fullUsageData.dashboard.simulationScenario.toLowerCase()}{' '}
                  simulation
                </Text>
              </View>
            ) : null}
            <Pressable
              accessibilityHint="Opens a general conversation about this household's energy use"
              accessibilityRole="button"
              onPress={() => setGeneralChatOpen(true)}
              style={({ pressed }) => [
                styles.startChatCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.chatIconBox}>
                <SparklePulse />
              </View>
              <View style={styles.tipBody}>
                <Text style={styles.startChatTitle}>Start a Chat</Text>
                <Text style={styles.startChatText}>
                  Ask about your home’s usage, costs, appliances, or savings.
                </Text>
              </View>
              <Ionicons color={colors.surface} name="arrow-forward" size={21} />
            </Pressable>
            {tips.map((tip, index) => (
              <Reveal delay={index * 55} key={tip.id}>
                <Pressable
                  accessibilityHint="Opens a conversation about this recommendation"
                  onPress={() => setSelectedTip(tip)}
                  style={({ pressed }) => [
                    styles.tipCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.categoryAccent} />
                  <View style={styles.iconBox}>
                    <Ionicons
                      color={colors.primary}
                      name={tipIcons[tip.category]}
                      size={24}
                    />
                  </View>
                  <View style={styles.tipBody}>
                    <View style={styles.tipTopRow}>
                      <Text style={styles.tipNumber}>TIP {index + 1}</Text>
                      <Text style={styles.category}>
                        {tip.category.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipSummary}>{tip.summary}</Text>
                    <View style={styles.savingsRow}>
                      <Ionicons
                        color={colors.success}
                        name="trending-down"
                        size={16}
                      />
                      <Text style={styles.savings}>{tip.estimatedSavings}</Text>
                    </View>
                  </View>
                  <Ionicons
                    color={colors.textMuted}
                    name="chevron-forward"
                    size={20}
                  />
                </Pressable>
              </Reveal>
            ))}
            <Text style={styles.disclaimer}>
              AI-generated guidance may be inaccurate. Confirm safety-critical
              changes with a qualified technician.
            </Text>
          </View>
        )}
      </ScrollView>

      {selectedTip && fullUsageData ? (
        <TipChatModal
          fullUsageData={fullUsageData}
          generationId={generationId}
          householdId={selectedHouseholdId}
          key={`${generationId}:${selectedTip.id}`}
          onClose={() => setSelectedTip(null)}
          tip={selectedTip}
        />
      ) : null}
      {generalChatOpen && fullUsageData ? (
        <TipChatModal
          fullUsageData={fullUsageData}
          generationId={generationId}
          householdId={selectedHouseholdId}
          key={`${generationId}:general`}
          onClose={() => setGeneralChatOpen(false)}
          tip={null}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TipChatModal({
  fullUsageData,
  generationId,
  householdId,
  onClose,
  tip,
}: {
  fullUsageData: FullUsageData;
  generationId: string;
  householdId: string;
  onClose: () => void;
  tip: SmartTip | null;
}) {
  const [messages, setMessages] = useState<TipChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const browserBottomInset = useMobileBrowserBottomInset();
  const headerTopInset = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0);
  const composerBottomInset = Math.max(
    insets.bottom,
    browserBottomInset,
    spacing.sm,
  );
  const storageKey = useMemo(
    () => chatKey(householdId, generationId, tip?.id ?? 'general'),
    [generationId, householdId, tip?.id],
  );

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (!stored) return setMessages([]);
        const restored = JSON.parse(stored) as unknown;
        setMessages(Array.isArray(restored) ? restored : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setIsHydrating(false));
  }, [storageKey]);

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending || isHydrating) return;
    const userMessage = createMessage('user', text);
    const history = [...messages, userMessage];
    setMessages(history);
    setDraft('');
    setError(null);
    setIsSending(true);
    void feedback.selection();
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(history));
      const reply = await sendTipChatMessage(
        tip,
        fullUsageData,
        messages,
        text,
      );
      const updated = [...history, createMessage('model', reply)];
      setMessages(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Could not send your message.',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible
    >
      <View style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFlex}
        >
          <View
            style={[
              styles.modalHeaderSafeArea,
              {
                paddingLeft: Math.max(insets.left, 0),
                paddingRight: Math.max(insets.right, 0),
                paddingTop: headerTopInset,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityLabel="Close tip conversation"
                accessibilityRole="button"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Ionicons color={colors.text} name="close" size={25} />
              </Pressable>
              <View style={styles.modalHeading}>
                <Text numberOfLines={1} style={styles.modalTitle}>
                  {tip?.title ?? 'Miqyas Energy Advisor'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {tip
                    ? 'Ask about this tip'
                    : 'Ask about your home energy use'}
                </Text>
              </View>
            </View>
          </View>
          <FlatList
            contentContainerStyle={styles.messages}
            data={messages}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              tip ? (
                <View style={styles.contextCard}>
                  <Text style={styles.contextSummary}>{tip.summary}</Text>
                  <Text style={styles.savings}>{tip.estimatedSavings}</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.emptyChat}>
                {tip
                  ? 'Ask how to apply this tip, what it may cost, or what alternatives fit your home.'
                  : 'Ask anything about this home’s energy use, appliances, bill forecast, tariff, or ways to save.'}
              </Text>
            }
            ListFooterComponent={isSending ? <TypingIndicator /> : null}
            renderItem={({ item }) => (
              <Reveal>
                <View
                  style={[
                    styles.bubble,
                    item.role === 'user'
                      ? styles.userBubble
                      : styles.modelBubble,
                  ]}
                >
                  <Text
                    style={
                      item.role === 'user'
                        ? styles.userBubbleText
                        : styles.modelBubbleText
                    }
                  >
                    {item.text}
                  </Text>
                </View>
              </Reveal>
            )}
          />
          {error ? <Text style={styles.chatError}>{error}</Text> : null}
          <View
            style={[
              styles.composerSafeArea,
              {
                paddingBottom: composerBottomInset,
                paddingLeft: Math.max(insets.left, 0),
                paddingRight: Math.max(insets.right, 0),
              },
            ]}
          >
            <View style={styles.composer}>
              <TextInput
                editable={!isSending && !isHydrating}
                multiline
                onChangeText={setDraft}
                onSubmitEditing={() => void send()}
                placeholder={
                  isHydrating
                    ? 'Restoring conversation…'
                    : 'Ask about this tip…'
                }
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                disabled={!draft.trim() || isSending || isHydrating}
                onPress={() => void send()}
                style={[
                  styles.sendButton,
                  (!draft.trim() || isSending || isHydrating) &&
                    styles.disabledButton,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Ionicons color={colors.surface} name="send" size={20} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    ...layout.screenContent,
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  tipSkeletons: { gap: spacing.md },
  state: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.xxl,
    ...shadows.card,
  },
  stateTitle: {
    ...typography.heading,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stateText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryButtonText: { ...typography.label, color: colors.surface },
  tipList: { gap: spacing.md },
  startChatCard: {
    ...shadows.elevated,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  chatIconBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  startChatTitle: { ...typography.heading, color: colors.surface },
  startChatText: {
    ...typography.body,
    color: colors.tealSoft,
    marginTop: spacing.xs,
  },
  tipCard: {
    ...borders.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
    overflow: 'hidden',
  },
  categoryAccent: {
    backgroundColor: colors.teal,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  tipBody: { flex: 1 },
  tipTopRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  tipNumber: { ...typography.label, color: colors.primary, fontSize: 11 },
  category: { ...typography.label, color: colors.textMuted, fontSize: 10 },
  tipTitle: { ...typography.heading, marginTop: spacing.xs },
  tipSummary: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  savingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  savings: { ...typography.label, color: colors.success },
  disclaimer: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  modalSafeArea: { backgroundColor: colors.background, flex: 1 },
  modalFlex: { flex: 1 },
  modalHeaderSafeArea: { backgroundColor: colors.surface },
  modalHeader: {
    ...layout.screenContent,
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: spacing.lg,
  },
  closeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalHeading: { flex: 1, marginLeft: spacing.sm },
  modalTitle: { ...typography.heading },
  modalSubtitle: { ...typography.body, color: colors.textMuted, fontSize: 13 },
  messages: {
    ...layout.screenContent,
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  contextCard: {
    ...borders.subtle,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  contextSummary: { ...typography.body, color: colors.text },
  emptyChat: {
    ...typography.body,
    color: colors.textMuted,
    padding: spacing.xl,
    textAlign: 'center',
  },
  bubble: {
    borderRadius: radii.lg,
    maxWidth: '84%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  modelBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  userBubbleText: { ...typography.body, color: colors.surface },
  modelBubbleText: { ...typography.body, color: colors.text },
  chatError: {
    ...typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  composer: {
    ...layout.screenContent,
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  composerSafeArea: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  disabledButton: { opacity: 0.45 },
  latestContext: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  latestContextText: {
    ...typography.label,
    color: colors.success,
    fontSize: 11,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radii.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  typingText: { ...typography.body, color: colors.textMuted, fontSize: 13 },
});
