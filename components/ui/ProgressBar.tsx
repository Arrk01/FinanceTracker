import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, FontWeight, Spacing } from '@/constants/theme';
import { formatINR } from '@/constants/config';

interface ProgressBarProps {
  label: string;
  current: number;
  limit: number;
  color?: string;
  showPercent?: boolean;
  showRemaining?: boolean;
  height?: number;
  animateWidth?: boolean;
}

export const ProgressBar = React.memo(({
  label,
  current,
  limit,
  color,
  showPercent = true,
  showRemaining = true,
  height = 9,
}: ProgressBarProps) => {
  // Guard against division by zero
  const safeCurrent = isFinite(current) ? Math.max(0, current) : 0;
  const safeLimit = isFinite(limit) && limit > 0 ? limit : 1;
  const ratio = Math.min(safeCurrent / safeLimit, 1);
  const pct = Math.round(ratio * 100);
  const isOver = safeCurrent > safeLimit;
  const barColor = isOver ? Colors.danger : (color ?? Colors.success);
  const glowColor = barColor + '33';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <View style={[styles.colorDot, { backgroundColor: barColor }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.labelRight}>
          <Text style={[styles.current, isOver && { color: Colors.dangerLight }]}>
            {formatINR(safeCurrent)}
          </Text>
          <Text style={styles.limit}> / {formatINR(safeLimit)}</Text>
        </View>
      </View>

      {/* Track */}
      <View style={[styles.track, { height, backgroundColor: isOver ? Colors.dangerDim + '55' : Colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%` as any,
              height,
              backgroundColor: barColor,
            },
          ]}
        />
        {/* Glow overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: Radius.full, backgroundColor: glowColor, width: `${pct}%` as any },
          ]}
        />
      </View>

      {(showPercent || showRemaining) && (
        <View style={styles.pctRow}>
          {showPercent && (
            <Text style={[styles.pct, { color: barColor }]}>
              {isOver
                ? `+${formatINR(safeCurrent - safeLimit)} over`
                : `${pct}% used`}
            </Text>
          )}
          {showRemaining && !isOver && (
            <Text style={styles.remaining}>{formatINR(safeLimit - safeCurrent)} left</Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 7 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  labelRight: { flexDirection: 'row', alignItems: 'baseline' },
  current: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  limit: { fontSize: FontSize.sm, color: Colors.textMuted },
  track: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: { borderRadius: Radius.full },
  pctRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pct: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  remaining: { fontSize: FontSize.xs, color: Colors.textMuted },
});
