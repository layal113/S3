import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { colors, radii, spacing, typography } from '../theme';
import type {
  HistoryAppliance,
  HistoryPoint,
  HistoryUnit,
} from '../types/history';
import { formatNumber } from '../utils/format';

const width = 340;
const height = 210;
const plot = { left: 42, right: 12, top: 18, bottom: 34 };

function valueOf(
  point: HistoryPoint,
  unit: HistoryUnit,
  appliance: HistoryAppliance,
) {
  if (appliance === 'total')
    return unit === 'kwh' ? point.totalKWh : point.estimatedCostEGP;
  return unit === 'kwh'
    ? point.appliances[appliance].kWh
    : point.appliances[appliance].costEGP;
}

export function UsageHistoryChart({
  points,
  unit,
  appliance,
  selectedIndex,
  onSelect,
}: {
  points: HistoryPoint[];
  unit: HistoryUnit;
  appliance: HistoryAppliance;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const values = points.map((item) => valueOf(item, unit, appliance));
  const baselines = points.map((item) =>
    unit === 'kwh' ? item.baselineKWh : item.baselineCostEGP,
  );
  const maxValue =
    Math.max(...values, ...(appliance === 'total' ? baselines : []), 1) * 1.15;
  const x = (index: number) =>
    plot.left +
    (index * (width - plot.left - plot.right)) / Math.max(points.length - 1, 1);
  const y = (value: number) =>
    plot.top + (1 - value / maxValue) * (height - plot.top - plot.bottom);
  const linePath = values
    .map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`)
    .join(' ');
  const baselinePath = baselines
    .map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`)
    .join(' ');
  const selected = points[selectedIndex];
  const unitLabel = unit === 'kwh' ? 'kWh' : 'EGP';

  return (
    <View style={styles.container}>
      <Svg
        accessibilityLabel={`Usage history chart in ${unitLabel}`}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        {[0, 0.5, 1].map((ratio) => {
          const gridY = y(maxValue * ratio);
          return (
            <Line
              key={ratio}
              x1={plot.left}
              x2={width - plot.right}
              y1={gridY}
              y2={gridY}
              stroke={colors.border}
              strokeWidth="1"
            />
          );
        })}
        <SvgText fill={colors.textMuted} fontSize="10" x="2" y={plot.top + 3}>
          {formatNumber(maxValue, 0)}
        </SvgText>
        <SvgText
          fill={colors.textMuted}
          fontSize="10"
          x="8"
          y={height - plot.bottom + 3}
        >
          0
        </SvgText>
        {appliance === 'total' ? (
          <Path
            d={baselinePath}
            fill="none"
            stroke={colors.textMuted}
            strokeDasharray="5 4"
            strokeWidth="2"
          />
        ) : null}
        <Path
          d={linePath}
          fill="none"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((item, index) => (
          <Circle
            key={item.timestamp}
            cx={x(index)}
            cy={y(values[index])}
            fill={item.anomaly ? colors.warning : colors.surface}
            onPress={() => onSelect(index)}
            r={index === selectedIndex ? 6 : 4}
            stroke={item.anomaly ? colors.warning : colors.primary}
            strokeWidth="3"
          />
        ))}
        {points.map((item, index) => (
          <SvgText
            key={`label-${item.timestamp}`}
            fill={colors.textMuted}
            fontSize="9"
            textAnchor="middle"
            x={x(index)}
            y={height - 10}
          >
            {new Date(item.timestamp).toLocaleDateString('en-EG', {
              day: 'numeric',
              month: points.length <= 4 ? 'short' : undefined,
            })}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.solidLine} />
          <Text style={styles.legendText}>Selected usage</Text>
        </View>
        {appliance === 'total' ? (
          <View style={styles.legendItem}>
            <View style={styles.dashedLine} />
            <Text style={styles.legendText}>Baseline</Text>
          </View>
        ) : null}
        <View style={styles.legendItem}>
          <View style={styles.anomalyDot} />
          <Text style={styles.legendText}>Anomaly</Text>
        </View>
      </View>
      <View style={styles.tooltip}>
        <Text style={styles.tooltipDate}>
          {new Date(selected.timestamp).toLocaleDateString('en-EG', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        <Text style={styles.tooltipValue}>
          {formatNumber(values[selectedIndex])} {unitLabel}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pointButtons}
      >
        {points.map((item, index) => (
          <Pressable
            key={item.timestamp}
            accessibilityRole="button"
            accessibilityLabel={`Select ${new Date(item.timestamp).toLocaleDateString('en-EG')}, ${formatNumber(values[index])} ${unitLabel}`}
            accessibilityState={{ selected: index === selectedIndex }}
            onPress={() => onSelect(index)}
            style={[
              styles.pointButton,
              index === selectedIndex && styles.selectedPoint,
            ]}
          >
            <Text
              style={[
                styles.pointText,
                index === selectedIndex && styles.selectedPointText,
              ]}
            >
              {index + 1}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  legendText: { fontSize: 11, color: colors.textMuted },
  solidLine: { backgroundColor: colors.primary, height: 3, width: 20 },
  dashedLine: {
    borderColor: colors.textMuted,
    borderStyle: 'dashed',
    borderTopWidth: 2,
    width: 20,
  },
  anomalyDot: {
    backgroundColor: colors.warning,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  tooltipDate: { ...typography.label, color: colors.text },
  tooltipValue: { ...typography.heading, color: colors.primaryDark },
  pointButtons: { gap: spacing.sm },
  pointButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  selectedPoint: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pointText: { ...typography.label, color: colors.textMuted },
  selectedPointText: { color: colors.surface },
});
