import type { DashboardData, HouseholdOption } from '../types/dashboard';

export const simulatedHouseholds: HouseholdOption[] = [
  { id: 'high-ac-home', name: 'Ahmed’s Home' },
  { id: 'efficient-flat', name: 'Nour’s Flat' },
  { id: 'family-villa', name: 'Family Villa' },
];

export const simulatedDashboards: Record<HouseholdOption['id'], DashboardData> =
  {
    'high-ac-home': {
      householdId: 'high-ac-home',
      householdName: 'Ahmed’s Home',
      billingPeriodLabel: '1–31 August 2026',
      currentConsumptionKwh: 382,
      currentEstimatedCostEgp: 820,
      predictedMonthEndBillEgp: 1430,
      projectedMonthlyKwh: 545,
      previousMonthBillEgp: 1222,
      changeFromPreviousMonthPercent: 17,
      priorityInsight: {
        kind: 'warning',
        title: 'High AC usage detected',
        message:
          'Air conditioning is driving your projected bill above last month.',
      },
      tariffStatus: {
        currentTier: 4,
        nextTier: 5,
        statusLabel: 'Approaching next tier',
        detail: '68 kWh remaining before the next simulated tariff tier.',
        levelPercent: 85,
        remainingKwh: 68,
        projectedToExceed: false,
      },
      applianceBreakdown: [
        {
          category: 'Air conditioner',
          consumptionKwh: 160.4,
          sharePercent: 42,
          confidence: 'High',
        },
        {
          category: 'Water heater',
          consumptionKwh: 68.8,
          sharePercent: 18,
          confidence: 'High',
        },
        {
          category: 'Refrigerator',
          consumptionKwh: 45.8,
          sharePercent: 12,
          confidence: 'High',
        },
        {
          category: 'Lighting',
          consumptionKwh: 34.4,
          sharePercent: 9,
          confidence: 'Medium',
        },
        {
          category: 'Other/unclassified',
          consumptionKwh: 72.6,
          sharePercent: 19,
          confidence: 'Medium',
        },
      ],
      recommendation: {
        title: 'Reduce daily AC runtime',
        description: 'Reduce AC use by one hour per day during the evening.',
        estimatedMonthlySavingKwh: 35,
      },
      simulated: true,
      updatedAt: '2026-08-22T08:45:00.000Z',
    },
    'efficient-flat': {
      householdId: 'efficient-flat',
      householdName: 'Nour’s Flat',
      billingPeriodLabel: '1–31 August 2026',
      currentConsumptionKwh: 214,
      currentEstimatedCostEgp: 398,
      predictedMonthEndBillEgp: 665,
      projectedMonthlyKwh: 326,
      previousMonthBillEgp: 701,
      changeFromPreviousMonthPercent: -5.1,
      priorityInsight: {
        kind: 'recommendation',
        title: 'Usage is trending efficiently',
        message: 'Current consumption is slightly lower than last month.',
      },
      tariffStatus: {
        currentTier: 2,
        nextTier: 3,
        statusLabel: 'Comfortable range',
        detail: '186 kWh remaining before the next simulated tariff tier.',
        levelPercent: 38,
        remainingKwh: 186,
        projectedToExceed: false,
      },
      applianceBreakdown: [
        {
          category: 'Air conditioner',
          consumptionKwh: 55.6,
          sharePercent: 26,
          confidence: 'High',
        },
        {
          category: 'Water heater',
          consumptionKwh: 38.5,
          sharePercent: 18,
          confidence: 'High',
        },
        {
          category: 'Refrigerator',
          consumptionKwh: 42.8,
          sharePercent: 20,
          confidence: 'High',
        },
        {
          category: 'Lighting',
          consumptionKwh: 25.7,
          sharePercent: 12,
          confidence: 'Medium',
        },
        {
          category: 'Other/unclassified',
          consumptionKwh: 51.4,
          sharePercent: 24,
          confidence: 'Medium',
        },
      ],
      recommendation: {
        title: 'Keep standby use low',
        description:
          'Switch off entertainment devices at the socket overnight.',
        estimatedMonthlySavingKwh: 12,
      },
      simulated: true,
      updatedAt: '2026-08-22T08:42:00.000Z',
    },
    'family-villa': {
      householdId: 'family-villa',
      householdName: 'Family Villa',
      billingPeriodLabel: '1–31 August 2026',
      currentConsumptionKwh: 467,
      currentEstimatedCostEgp: 1095,
      predictedMonthEndBillEgp: 1780,
      projectedMonthlyKwh: 672,
      previousMonthBillEgp: 1745,
      changeFromPreviousMonthPercent: 2,
      priorityInsight: {
        kind: 'warning',
        title: 'Water heating use is elevated',
        message:
          'Water-heater usage is higher than this household’s usual pattern.',
      },
      tariffStatus: {
        currentTier: 3,
        nextTier: 4,
        statusLabel: 'Moderate-high usage',
        detail: '92 kWh remaining before the next simulated tariff tier.',
        levelPercent: 64,
        remainingKwh: 92,
        projectedToExceed: false,
      },
      applianceBreakdown: [
        {
          category: 'Air conditioner',
          consumptionKwh: 149.4,
          sharePercent: 32,
          confidence: 'High',
        },
        {
          category: 'Water heater',
          consumptionKwh: 116.8,
          sharePercent: 25,
          confidence: 'High',
        },
        {
          category: 'Refrigerator',
          consumptionKwh: 60.7,
          sharePercent: 13,
          confidence: 'High',
        },
        {
          category: 'Lighting',
          consumptionKwh: 51.4,
          sharePercent: 11,
          confidence: 'Medium',
        },
        {
          category: 'Other/unclassified',
          consumptionKwh: 88.7,
          sharePercent: 19,
          confidence: 'Medium',
        },
      ],
      recommendation: {
        title: 'Schedule water heating',
        description:
          'Use a timer to avoid heating water continuously throughout the day.',
        estimatedMonthlySavingKwh: 42,
      },
      simulated: true,
      updatedAt: '2026-08-22T08:40:00.000Z',
    },
  };
