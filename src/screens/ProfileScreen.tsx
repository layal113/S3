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
import {
  useHouseholdProfile,
  type HouseholdProfile,
} from '../state/HouseholdProfileContext';
import { colors, radii, shadows, spacing, typography } from '../theme';

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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        selectionColor={colors.primary}
        style={styles.input}
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

        <View style={styles.identityCard}>
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
        </View>

        <View style={styles.detailsCard}>
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
        </View>
      </ScrollView>

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
          <View style={styles.modalCard}>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
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
  pressed: { opacity: 0.72 },
  identityCard: {
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
    ...shadows.card,
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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(20, 31, 25, 0.5)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalCard: {
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
