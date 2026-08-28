import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { HouseholdId } from '../types/dashboard';

export interface HouseholdProfile {
  userName: string;
  householdName: string;
  location: string;
  homeType: string;
  residents: number;
  billingCycleStart: string;
  tariffTier: number;
  simulated: boolean;
}

type ProfilesByHousehold = Record<HouseholdId, HouseholdProfile>;

interface PersistedProfileState {
  selectedHouseholdId: HouseholdId;
  profiles: ProfilesByHousehold;
}

interface HouseholdProfileContextValue extends PersistedProfileState {
  selectedProfile: HouseholdProfile;
  dataRevision: number;
  selectHousehold: (householdId: HouseholdId) => void;
  notifyHouseholdDataChanged: (householdId: HouseholdId) => void;
  updateSelectedProfile: (updates: Partial<HouseholdProfile>) => void;
}

const STORAGE_KEY = '@miqyas/household-profiles-v1';

const defaultProfiles: ProfilesByHousehold = {
  'high-ac-home': {
    userName: 'Ahmed Hassan',
    householdName: 'Hussams’s Home',
    location: 'New Cairo, Cairo',
    homeType: 'Apartment',
    residents: 4,
    billingCycleStart: '1 August 2026',
    tariffTier: 4,
    simulated: true,
  },
  'efficient-flat': {
    userName: 'Ahmed Hassan',
    householdName: 'Nour’s Flat',
    location: 'Heliopolis, Cairo',
    homeType: 'Apartment',
    residents: 2,
    billingCycleStart: '1 August 2026',
    tariffTier: 2,
    simulated: true,
  },
  'family-villa': {
    userName: 'Ahmed Hassan',
    householdName: 'Family Villa',
    location: 'Sheikh Zayed, Giza',
    homeType: 'Villa',
    residents: 6,
    billingCycleStart: '1 August 2026',
    tariffTier: 3,
    simulated: true,
  },
};

const householdIds: HouseholdId[] = [
  'high-ac-home',
  'efficient-flat',
  'family-villa',
];

const HouseholdProfileContext = createContext<
  HouseholdProfileContextValue | undefined
>(undefined);

function mergePersistedState(value: unknown): PersistedProfileState | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Partial<PersistedProfileState>;
  const selectedHouseholdId = householdIds.includes(
    saved.selectedHouseholdId as HouseholdId,
  )
    ? (saved.selectedHouseholdId as HouseholdId)
    : 'high-ac-home';

  const profiles = householdIds.reduce<ProfilesByHousehold>(
    (result, householdId) => {
      const savedProfile = saved.profiles?.[householdId];
      result[householdId] = {
        ...defaultProfiles[householdId],
        ...(savedProfile && typeof savedProfile === 'object'
          ? savedProfile
          : {}),
      };
      return result;
    },
    { ...defaultProfiles },
  );

  return { profiles, selectedHouseholdId };
}

export function HouseholdProfileProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [profiles, setProfiles] = useState(defaultProfiles);
  const [selectedHouseholdId, setSelectedHouseholdId] =
    useState<HouseholdId>('high-ac-home');
  const [dataRevisions, setDataRevisions] = useState<
    Record<HouseholdId, number>
  >({ 'high-ac-home': 0, 'efficient-flat': 0, 'family-villa': 0 });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedValue) => {
        if (!active || !storedValue) return;
        const restored = mergePersistedState(JSON.parse(storedValue));
        if (!restored) return;
        setProfiles(restored.profiles);
        setSelectedHouseholdId(restored.selectedHouseholdId);
      })
      .catch(() => {
        // Defaults remain usable if local storage is unavailable or corrupted.
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profiles, selectedHouseholdId }),
    );
  }, [hydrated, profiles, selectedHouseholdId]);

  const selectHousehold = useCallback((householdId: HouseholdId) => {
    setSelectedHouseholdId(householdId);
  }, []);

  const notifyHouseholdDataChanged = useCallback((householdId: HouseholdId) => {
    setDataRevisions((current) => ({
      ...current,
      [householdId]: current[householdId] + 1,
    }));
  }, []);

  const updateSelectedProfile = useCallback(
    (updates: Partial<HouseholdProfile>) => {
      setProfiles((current) => ({
        ...current,
        [selectedHouseholdId]: {
          ...current[selectedHouseholdId],
          ...updates,
        },
      }));
    },
    [selectedHouseholdId],
  );

  const value = useMemo<HouseholdProfileContextValue>(
    () => ({
      profiles,
      selectedHouseholdId,
      selectedProfile: profiles[selectedHouseholdId],
      dataRevision: dataRevisions[selectedHouseholdId],
      selectHousehold,
      notifyHouseholdDataChanged,
      updateSelectedProfile,
    }),
    [
      dataRevisions,
      notifyHouseholdDataChanged,
      profiles,
      selectHousehold,
      selectedHouseholdId,
      updateSelectedProfile,
    ],
  );

  return (
    <HouseholdProfileContext.Provider value={value}>
      {children}
    </HouseholdProfileContext.Provider>
  );
}

export function useHouseholdProfile() {
  const value = useContext(HouseholdProfileContext);
  if (!value) {
    throw new Error(
      'useHouseholdProfile must be used inside HouseholdProfileProvider',
    );
  }
  return value;
}
