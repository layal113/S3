import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  background: '#E9EDEA',
  surface: '#F7F9F7',
  surfaceElevated: '#FBFCFB',
  surfaceMuted: '#EEF2EF',
  surfaceStrong: '#E2E9E4',
  primary: '#2E7D4A',
  primaryDark: '#1E5D36',
  teal: '#4B8C68',
  tealSoft: '#DFECE4',
  blueSoft: '#E3EBE6',
  text: '#26312B',
  textMuted: '#66716B',
  border: '#CDD5D0',
  success: '#257247',
  successSoft: '#E0EDE5',
  warning: '#8A6100',
  warningSoft: '#FFF5CF',
  warningBorder: '#EACB64',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  overlay: 'rgba(20, 31, 25, 0.48)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radii = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const typography = {
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  } satisfies TextStyle,
  heading: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
  } satisfies TextStyle,
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle,
  label: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  } satisfies TextStyle,
  value: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
} as const;
export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(38, 49, 43, 0.07)' },
    default: {
      shadowColor: '#26312B',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
  }) satisfies ViewStyle,
  elevated: Platform.select({
    web: { boxShadow: '0 12px 32px rgba(28, 47, 36, 0.16)' },
    default: {
      shadowColor: '#1C2F24',
      shadowOffset: { width: 0, height: 9 },
      shadowOpacity: 0.15,
      shadowRadius: 18,
      elevation: 8,
    },
  }) satisfies ViewStyle,
} as const;

export const borders = {
  card: {
    borderColor: colors.border,
    borderWidth: 1,
  } satisfies ViewStyle,
  subtle: {
    borderColor: 'rgba(102, 113, 107, 0.18)',
    borderWidth: 1,
  } satisfies ViewStyle,
} as const;

export const layout = {
  screenContent: {
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  } satisfies ViewStyle,
} as const;

export const motion = {
  fast: 180,
  normal: 280,
  deliberate: 520,
} as const;
