import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiqyasBrand } from '../components/MiqyasBrand';
import { Reveal } from '../components/Reveal';
import {
  useHouseholdProfile,
  type HouseholdProfile,
} from '../state/HouseholdProfileContext';
import {
  borders,
  colors,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} from '../theme';
import { feedback } from '../utils/feedback';

interface EditableProfile {
  userName: string;
  householdName: string;
  location: string;
  homeType: string;
  residents: string;
  billingCycleStart: string;
  tariffTier: string;
  simulated: boolean;
}

function createDraft(profile: HouseholdProfile): EditableProfile {
  return {
    userName: profile.userName,
    householdName: profile.householdName,
    location: profile.location,
    homeType: profile.homeType,
    residents: String(profile.residents),
    billingCycleStart: profile.billingCycleStart,
    tariffTier: String(profile.tariffTier),
    simulated: profile.simulated,
  };
}

const detailIcons = {
  householdName: 'home-outline',
  location: 'location-outline',
  homeType: 'business-outline',
  residents: 'people-outline',
  billingCycleStart: 'calendar-outline',
  tariffTier: 'speedometer-outline',
} as const;

const slotPatterns = [
  ['9:00 AM', '11:30 AM', '2:00 PM'],
  ['10:00 AM', '1:00 PM', '4:30 PM'],
  ['9:30 AM', '12:00 PM', '3:00 PM', '5:00 PM'],
  ['8:30 AM', '11:00 AM', '2:30 PM'],
];

function createBookingDays(count = 14) {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const year = date.getFullYear();
    const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
    const dayNumber = String(date.getDate()).padStart(2, '0');
    return {
      id: `${year}-${monthNumber}-${dayNumber}`,
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: String(date.getDate()),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      slots: slotPatterns[index % slotPatterns.length],
    };
  });
}

const bookingDays = createBookingDays();

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={styles.detailRow}
    >
      <View style={styles.detailIcon}>
        <Ionicons color={colors.teal} name={icon} size={21} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        selectionColor={colors.primary}
        style={[styles.input, focused && styles.focusedInput]}
        value={value}
      />
    </View>
  );
}

export function ProfileScreen() {
  const { selectedProfile: profile, updateSelectedProfile } =
    useHouseholdProfile();
  const [draft, setDraft] = useState<EditableProfile>(() =>
    createDraft(profile),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isBookingsOpen, setIsBookingsOpen] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState<string>(
    bookingDays[0].id,
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<string | null>(null);
  const selectedDay =
    bookingDays.find((day) => day.id === selectedBookingDate) ?? bookingDays[0];

  const openEditor = () => {
    setDraft(createDraft(profile));
    setIsEditing(true);
  };

  const saveProfile = () => {
    const parsedResidents = Number.parseInt(draft.residents, 10);
    const parsedTariffTier = Number.parseInt(draft.tariffTier, 10);
    updateSelectedProfile({
      userName: draft.userName.trim() || profile.userName,
      householdName: draft.householdName.trim() || profile.householdName,
      location: draft.location.trim() || profile.location,
      homeType: draft.homeType.trim() || profile.homeType,
      residents:
        Number.isFinite(parsedResidents) && parsedResidents > 0
          ? parsedResidents
          : profile.residents,
      billingCycleStart:
        draft.billingCycleStart.trim() || profile.billingCycleStart,
      tariffTier:
        Number.isFinite(parsedTariffTier) && parsedTariffTier > 0
          ? parsedTariffTier
          : profile.tariffTier,
      simulated: draft.simulated,
    });
    void feedback.success();
    setIsEditing(false);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MiqyasBrand />
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Profile
            </Text>
            <Text style={styles.subtitle}>Household information</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openEditor}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={colors.surface} name="create-outline" size={18} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>

        <Reveal style={styles.identityCard}>
          <View style={styles.profileIcon}>
            <Ionicons color={colors.primary} name="person" size={42} />
          </View>
          <Text style={styles.userName}>{profile.userName}</Text>
          <Text style={styles.householdSummary}>{profile.householdName}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {profile.simulated ? 'Simulated Data' : 'Live Data'}
            </Text>
          </View>
        </Reveal>

        <Reveal delay={60} style={styles.detailsCard}>
          <ProfileDetail
            icon={detailIcons.householdName}
            label="Household name"
            value={profile.householdName}
          />
          <ProfileDetail
            icon={detailIcons.location}
            label="Location"
            value={profile.location}
          />
          <ProfileDetail
            icon={detailIcons.homeType}
            label="Home type"
            value={profile.homeType}
          />
          <ProfileDetail
            icon={detailIcons.residents}
            label="Residents"
            value={`${profile.residents} people`}
          />
          <ProfileDetail
            icon={detailIcons.billingCycleStart}
            label="Billing-cycle start"
            value={profile.billingCycleStart}
          />
          <ProfileDetail
            icon={detailIcons.tariffTier}
            label="Current tariff tier"
            value={`Tier ${profile.tariffTier}`}
          />
        </Reveal>

        <Reveal delay={120} style={styles.bookingsSection}>
          <Text style={styles.sectionLabel}>MY BOOKINGS</Text>
          <Pressable
            accessibilityLabel={`Open CT clamp installation bookings. ${confirmedBooking ?? 'No installation booked'}.`}
            accessibilityRole="button"
            onPress={() => setIsBookingsOpen(true)}
            style={({ pressed }) => [
              styles.bookingsCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.bookingIcon}>
              <Ionicons
                color={colors.primary}
                name="calendar-outline"
                size={24}
              />
            </View>
            <View style={styles.bookingCopy}>
              <Text style={styles.bookingTitle}>CT Clamp Installation</Text>
              <Text style={styles.bookingStatus}>
                {confirmedBooking ?? 'No installation booked'}
              </Text>
            </View>
            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={22}
            />
          </Pressable>
        </Reveal>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsBookingsOpen(false)}
        transparent
        visible={isBookingsOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close bookings"
            onPress={() => setIsBookingsOpen(false)}
            style={styles.backdrop}
          />
          <SafeAreaView edges={['bottom']} style={styles.bookingModalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Book CT clamp installation
                </Text>
                <Text style={styles.modalSubtitle}>
                  Choose when a technician can install your CT clamp.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setIsBookingsOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>

            <View style={styles.pickerHeader}>
              <Text style={styles.pickerLabel}>SELECT A DATE</Text>
              <Text style={styles.swipeHint}>Swipe for more →</Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.dateOptions}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {bookingDays.map((day) => {
                const selected = day.id === selectedBookingDate;
                return (
                  <Pressable
                    key={day.id}
                    accessibilityLabel={`${day.weekday}, ${day.month} ${day.day}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void feedback.selection();
                      setSelectedBookingDate(day.id);
                      setSelectedSlot(null);
                    }}
                    style={[
                      styles.dateOption,
                      selected && styles.selectedDateOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateWeekday,
                        selected && styles.selectedDateText,
                      ]}
                    >
                      {day.weekday}
                    </Text>
                    <Text
                      style={[
                        styles.dateDay,
                        selected && styles.selectedDateText,
                      ]}
                    >
                      {day.day}
                    </Text>
                    <Text
                      style={[
                        styles.dateMonth,
                        selected && styles.selectedDateText,
                      ]}
                    >
                      {day.month}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.pickerLabel}>AVAILABLE SLOTS</Text>
            <View style={styles.slotGrid}>
              {selectedDay.slots.map((slot) => {
                const selected = slot === selectedSlot;
                return (
                  <Pressable
                    key={slot}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void feedback.selection();
                      setSelectedSlot(slot);
                    }}
                    style={[styles.slot, selected && styles.selectedSlot]}
                  >
                    <Ionicons
                      color={selected ? colors.surface : colors.teal}
                      name="time-outline"
                      size={17}
                    />
                    <Text
                      style={[
                        styles.slotText,
                        selected && styles.selectedSlotText,
                      ]}
                    >
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedSlot }}
              disabled={!selectedSlot}
              onPress={() => {
                if (!selectedSlot) return;
                setConfirmedBooking(
                  `${selectedDay.weekday}, ${selectedDay.month} ${selectedDay.day} at ${selectedSlot}`,
                );
                void feedback.success();
                setIsBookingsOpen(false);
              }}
              style={({ pressed }) => [
                styles.confirmBookingButton,
                !selectedSlot && styles.disabledButton,
                pressed && selectedSlot && styles.pressed,
              ]}
            >
              <Text style={styles.saveButtonText}>Confirm installation</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsEditing(false)}
        transparent
        visible={isEditing}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityLabel="Close profile editor"
            onPress={() => setIsEditing(false)}
            style={styles.backdrop}
          />
          <SafeAreaView edges={['bottom']} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit household</Text>
                <Text style={styles.modalSubtitle}>
                  Changes are saved on this device.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setIsEditing(false)}
                style={styles.closeButton}
              >
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <EditField
                label="User name"
                onChangeText={(userName) =>
                  setDraft((current) => ({ ...current, userName }))
                }
                value={draft.userName}
              />
              <EditField
                label="Household name"
                onChangeText={(householdName) =>
                  setDraft((current) => ({ ...current, householdName }))
                }
                value={draft.householdName}
              />
              <EditField
                label="Location"
                onChangeText={(location) =>
                  setDraft((current) => ({ ...current, location }))
                }
                value={draft.location}
              />
              <EditField
                label="Home type"
                onChangeText={(homeType) =>
                  setDraft((current) => ({ ...current, homeType }))
                }
                value={draft.homeType}
              />
              <EditField
                keyboardType="number-pad"
                label="Number of residents"
                onChangeText={(residents) =>
                  setDraft((current) => ({ ...current, residents }))
                }
                value={draft.residents}
              />
              <EditField
                label="Billing-cycle start date"
                onChangeText={(billingCycleStart) =>
                  setDraft((current) => ({ ...current, billingCycleStart }))
                }
                value={draft.billingCycleStart}
              />
              <EditField
                keyboardType="number-pad"
                label="Current tariff tier"
                onChangeText={(tariffTier) =>
                  setDraft((current) => ({ ...current, tariffTier }))
                }
                value={draft.tariffTier}
              />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Data status</Text>
                <View style={styles.statusOptions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: draft.simulated }}
                    onPress={() =>
                      setDraft((current) => ({ ...current, simulated: true }))
                    }
                    style={[
                      styles.statusOption,
                      draft.simulated && styles.selectedStatusOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        draft.simulated && styles.selectedStatusOptionText,
                      ]}
                    >
                      Simulated Data
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !draft.simulated }}
                    onPress={() =>
                      setDraft((current) => ({ ...current, simulated: false }))
                    }
                    style={[
                      styles.statusOption,
                      !draft.simulated && styles.selectedStatusOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        !draft.simulated && styles.selectedStatusOptionText,
                      ]}
                    >
                      Live Data
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={saveProfile}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveButtonText}>Save changes</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  editButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editButtonText: { ...typography.label, color: colors.surface },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  identityCard: {
    ...borders.card,
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  profileIcon: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    height: 82,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 82,
  },
  userName: { ...typography.heading, color: colors.text },
  householdSummary: { ...typography.body, color: colors.textMuted },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  statusText: { ...typography.label, color: colors.success },
  detailsCard: {
    ...borders.card,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    paddingVertical: spacing.md,
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  detailText: { flex: 1 },
  detailLabel: { ...typography.label, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: '600' },
  bookingsSection: { gap: spacing.sm },
  sectionLabel: {
    ...typography.label,
    color: colors.teal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  bookingsCard: {
    ...borders.card,
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 88,
    padding: spacing.lg,
  },
  bookingIcon: {
    alignItems: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bookingCopy: { flex: 1 },
  bookingTitle: { ...typography.heading, color: colors.text, fontSize: 17 },
  bookingStatus: { ...typography.body, color: colors.textMuted, fontSize: 13 },
  bookingModalCard: {
    ...shadows.elevated,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    maxHeight: '90%',
    padding: spacing.xl,
  },
  pickerLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  pickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swipeHint: { ...typography.label, color: colors.teal, fontSize: 11 },
  dateOptions: { gap: spacing.sm, paddingRight: spacing.lg },
  dateOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedDateOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateWeekday: { ...typography.label, color: colors.textMuted, fontSize: 11 },
  dateDay: { ...typography.heading, color: colors.text },
  dateMonth: { ...typography.label, color: colors.textMuted, fontSize: 11 },
  selectedDateText: { color: colors.surface },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedSlot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: { ...typography.label, color: colors.text },
  selectedSlotText: { color: colors.surface },
  confirmBookingButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    padding: spacing.md,
  },
  disabledButton: { opacity: 0.42 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalCard: {
    ...shadows.elevated,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.md,
    maxHeight: '92%',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 5,
    width: 44,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: { ...typography.heading, color: colors.text },
  modalSubtitle: { ...typography.body, color: colors.textMuted, fontSize: 13 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  formContent: { gap: spacing.md, paddingBottom: spacing.sm },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.text },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  focusedInput: { borderColor: colors.primary, borderWidth: 2 },
  statusOptions: { flexDirection: 'row', gap: spacing.sm },
  statusOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selectedStatusOption: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.primary,
  },
  statusOptionText: { ...typography.label, color: colors.textMuted },
  selectedStatusOptionText: { color: colors.primaryDark },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  saveButtonText: { ...typography.label, color: colors.surface, fontSize: 15 },
});
