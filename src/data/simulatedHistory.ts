import type { HistoryPoint, UsageHistoryData } from '../types/history';

function point(
  date: string,
  kWh: number,
  baseline: number,
  ac: number,
  anomaly?: HistoryPoint['anomaly'],
): HistoryPoint {
  const cost = kWh * 2.15;
  const appliance = (share: number) => ({
    kWh: kWh * share,
    costEGP: cost * share,
  });
  return {
    timestamp: date,
    totalKWh: kWh,
    estimatedCostEGP: cost,
    baselineKWh: baseline,
    baselineCostEGP: baseline * 2.15,
    appliances: {
      airConditioner: appliance(ac),
      waterHeater: appliance(0.18),
      refrigerator: appliance(0.12),
      lighting: appliance(0.09),
      other: appliance(Math.max(1 - ac - 0.39, 0.05)),
    },
    anomaly,
  };
}

export const simulatedHistory: Record<'7d' | '4w', UsageHistoryData> = {
  '7d': {
    period: '7d',
    granularity: 'day',
    dateRangeLabel: '16–22 August 2026',
    points: [
      point('2026-08-16', 15.2, 15, 0.34),
      point('2026-08-17', 14.7, 15, 0.33),
      point('2026-08-18', 16.1, 15.1, 0.36),
      point('2026-08-19', 24.8, 15.2, 0.55, {
        title: 'AC usage spike',
        explanation:
          'AC runtime increased by about three hours. This event contributes to the higher month-end forecast.',
      }),
      point('2026-08-20', 19.3, 15.3, 0.44),
      point('2026-08-21', 17.2, 15.4, 0.4),
      point('2026-08-22', 16.5, 15.5, 0.38),
    ],
  },
  '4w': {
    period: '4w',
    granularity: 'week',
    dateRangeLabel: '26 July–22 August 2026',
    points: [
      point('2026-07-26', 101, 98, 0.35),
      point('2026-08-02', 108, 100, 0.37),
      point('2026-08-09', 116, 102, 0.41),
      point('2026-08-16', 124, 104, 0.46, {
        title: 'High-AC week',
        explanation:
          'The 19 August AC spike raised this week and influenced the current bill forecast.',
      }),
    ],
  },
};
