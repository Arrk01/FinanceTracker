import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import {
  formatINR,
  parseDate,
  BUDGET_CONFIG,
  CATEGORIES,
  PAYMENT_MODES,
  MONTH_NAMES,
  getBudgetGrade,
} from '@/constants/config';
import { useTransactions } from '@/hooks/useTransactions';
import { PieChart, BarChart } from 'react-native-gifted-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_W = Math.max(200, SCREEN_WIDTH - Spacing.md * 4);

const AVAILABLE_MONTHS = [
  { label: 'Jan 2026', month: 0, year: 2026 },
  { label: 'Feb 2026', month: 1, year: 2026 },
  { label: 'Mar 2026', month: 2, year: 2026 },
  { label: 'Apr 2026', month: 3, year: 2026 },
  { label: 'May 2026', month: 4, year: 2026 },
  { label: 'Jun 2026', month: 5, year: 2026 },
];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions } = useTransactions();

  const now = new Date();
  const defaultIdx = AVAILABLE_MONTHS.findIndex(
    m => m.month === now.getMonth() && m.year === now.getFullYear(),
  );
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 3);

  const sel = AVAILABLE_MONTHS[selectedIdx] ?? AVAILABLE_MONTHS[3];

  // ── Monthly transactions for selected month ────────────────────────────
  // Exclude Transfer and CardPayment types to prevent double-counting in analytics
  const monthlyTx = useMemo(() =>
    transactions.filter(tx => {
      const d = parseDate(tx.date);
      const inMonth = d.getMonth() === sel.month && d.getFullYear() === sel.year;
      const isRealSpend = tx.type !== 'Transfer' && tx.type !== 'CardPayment' && !tx.isIncome;
      return inMonth && isRealSpend;
    }),
    [transactions, sel],
  );

  // ── Totals (single pass) ───────────────────────────────────────────────
  const totals = useMemo(() => {
    let needs = 0, wants = 0, savings = 0, total = 0;
    for (const tx of monthlyTx) {
      const amt = Math.max(0, tx.amount);
      total += amt;
      if (tx.type === 'Need') needs += amt;
      else if (tx.type === 'Want') wants += amt;
      else savings += amt;
    }
    return { needs, wants, savings, total };
  }, [monthlyTx]);

  // ── Category breakdown ─────────────────────────────────────────────────
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyTx) map[tx.category] = (map[tx.category] || 0) + tx.amount;
    return CATEGORIES
      .map((cat, i) => ({
        cat,
        amount: map[cat] || 0,
        pct: totals.total > 0 ? ((map[cat] || 0) / totals.total) * 100 : 0,
        color: Colors.chart[i % Colors.chart.length],
      }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyTx, totals.total]);

  // ── Payment mode breakdown ─────────────────────────────────────────────
  const payBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyTx) map[tx.paymentMode] = (map[tx.paymentMode] || 0) + tx.amount;
    return PAYMENT_MODES
      .map(mode => ({
        mode,
        amount: map[mode] || 0,
        pct: totals.total > 0 ? Math.round(((map[mode] || 0) / totals.total) * 100) : 0,
        color: Colors.paymentModes[mode],
      }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyTx, totals.total]);

  // ── Top 5 biggest expenses ─────────────────────────────────────────────
  const top5 = useMemo(() =>
    [...monthlyTx].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [monthlyTx],
  );

  // ── Month-over-month bar chart data ────────────────────────────────────
  const momData = useMemo(() =>
    AVAILABLE_MONTHS.map((m, i) => {
      const total = transactions
        .filter(tx => {
          const d = parseDate(tx.date);
          const inMonth = d.getMonth() === m.month && d.getFullYear() === m.year;
          const isRealSpend = tx.type !== 'Transfer' && tx.type !== 'CardPayment' && !tx.isIncome;
          return inMonth && isRealSpend;
        })
        .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
      return {
        label: m.label.split(' ')[0],
        value: total,
        frontColor: i === selectedIdx ? Colors.accentLight : Colors.primary + '99',
        topLabelComponent: () => (
          <Text style={{
            fontSize: 9,
            color: i === selectedIdx ? Colors.accentLight : Colors.textMuted,
            marginBottom: 3,
            fontWeight: '700',
          }}>
            {total > 0 ? `${(total / 1000).toFixed(0)}k` : ''}
          </Text>
        ),
      };
    }),
    [transactions, selectedIdx],
  );

  // ── Derived ratios ─────────────────────────────────────────────────────
  const needsPct = totals.total > 0 ? Math.round((totals.needs / totals.total) * 100) : 0;
  const wantsPct = totals.total > 0 ? Math.round((totals.wants / totals.total) * 100) : 0;
  const savingsPct = totals.total > 0 ? Math.round((totals.savings / totals.total) * 100) : 0;
  const savingRate = Math.round((totals.savings / BUDGET_CONFIG.salary) * 100);
  const needsVsBudgetPct = Math.round((totals.needs / BUDGET_CONFIG.needs) * 100);
  const wantsVsBudgetPct = Math.round((totals.wants / BUDGET_CONFIG.wants) * 100);
  const grade = getBudgetGrade(needsPct, wantsPct, savingsPct);

  const piePayData = payBreakdown.map(p => ({
    value: p.amount,
    color: p.color,
    text: `${p.pct}%`,
  }));

  const catPieData = catBreakdown.map(c => ({
    value: c.amount,
    color: c.color,
  }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + 90 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Analytics</Text>
        <Text style={styles.pageSub}>Deep spending insights</Text>
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.monthRow}>
          {AVAILABLE_MONTHS.map((m, i) => (
            <Pressable
              key={m.label}
              style={({ pressed }) => [
                styles.monthBtn,
                selectedIdx === i && styles.monthBtnActive,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedIdx(i)}
            >
              {selectedIdx === i && (
                <LinearGradient
                  colors={[Colors.accentDim + 'CC', Colors.accent + '33']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <Text style={[styles.monthBtnTxt, selectedIdx === i && styles.monthBtnTxtActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {monthlyTx.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="bar-chart" size={56} color={Colors.textDim} />
          <Text style={styles.emptyTitle}>No data for {sel.label}</Text>
          <Text style={styles.emptyText}>Add transactions to see analytics</Text>
        </View>
      ) : (
        <>
          {/* Summary hero */}
          <LinearGradient colors={['#0D1F38', '#111827']} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <SumItem label="Total Spent" value={formatINR(totals.total)} color={Colors.dangerLight} />
              <View style={styles.sumDiv} />
              <SumItem label="Needs" value={formatINR(totals.needs)} color={totals.needs > BUDGET_CONFIG.needs ? Colors.dangerLight : Colors.successLight} />
              <View style={styles.sumDiv} />
              <SumItem label="Wants" value={formatINR(totals.wants)} color={totals.wants > BUDGET_CONFIG.wants ? Colors.dangerLight : Colors.warningLight} />
              <View style={styles.sumDiv} />
              <SumItem label="Saved" value={formatINR(totals.savings)} color={Colors.primaryLight} />
            </View>
            <View style={styles.savingRateRow}>
              <Text style={styles.savingRateLbl}>Saving Rate</Text>
              <Text style={[
                styles.savingRateVal,
                { color: savingRate >= 20 ? Colors.successLight : savingRate >= 10 ? Colors.warningLight : Colors.dangerLight },
              ]}>
                {savingRate}%
              </Text>
              <Text style={styles.savingRateSub}>of ₹50k salary</Text>
            </View>
          </LinearGradient>

          {/* Budget health grade */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="military-tech" size={18} color={Colors.accentLight} />
              <Text style={styles.cardTitle}>Budget Health Score</Text>
              <View style={[styles.scoreBadge, { backgroundColor: grade.color + '22', borderColor: grade.color + '55' }]}>
                <Text style={[styles.scoreBadgeTxt, { color: grade.color }]}>Score: {grade.score}/100</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.gradeRow}>
              <View style={styles.gradeLeft}>
                <Text style={styles.gradeDesc}>50 : 30 : 20 rule alignment</Text>
                <View style={styles.gradeRatioRow}>
                  {[
                    { label: 'Need', val: needsPct, target: 50, color: Colors.success },
                    { label: 'Want', val: wantsPct, target: 30, color: Colors.warning },
                    { label: 'Save', val: savingsPct, target: 20, color: Colors.primaryLight },
                  ].map(r => (
                    <View key={r.label} style={styles.ratioItem}>
                      <Text style={[styles.ratioVal, { color: r.color }]}>{r.val}%</Text>
                      <Text style={styles.ratioLbl}>{r.label}</Text>
                      <Text style={styles.ratioTarget}>goal {r.target}%</Text>
                    </View>
                  ))}
                </View>
                {/* vs Budget indicators */}
                <View style={styles.vsRow}>
                  <View style={[styles.vsChip, { backgroundColor: needsVsBudgetPct > 100 ? Colors.dangerDim + '88' : Colors.successDim + '88', borderColor: needsVsBudgetPct > 100 ? Colors.danger + '55' : Colors.success + '55' }]}>
                    <Text style={[styles.vsTxt, { color: needsVsBudgetPct > 100 ? Colors.dangerLight : Colors.successLight }]}>
                      Needs {needsVsBudgetPct}% of budget
                    </Text>
                  </View>
                  <View style={[styles.vsChip, { backgroundColor: wantsVsBudgetPct > 100 ? Colors.dangerDim + '88' : Colors.successDim + '88', borderColor: wantsVsBudgetPct > 100 ? Colors.danger + '55' : Colors.success + '55' }]}>
                    <Text style={[styles.vsTxt, { color: wantsVsBudgetPct > 100 ? Colors.dangerLight : Colors.successLight }]}>
                      Wants {wantsVsBudgetPct}% of budget
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.gradeCircle, { borderColor: grade.color, ...Shadow.glow(grade.color) }]}>
                <Text style={[styles.gradeText, { color: grade.color }]}>{grade.grade}</Text>
                <Text style={[styles.gradeLbl, { color: grade.color + 'BB' }]}>{grade.label}</Text>
              </View>
            </View>
          </View>

          {/* Month-over-month bar chart */}
          {momData.filter(d => d.value > 0).length > 1 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="bar-chart" size={18} color={Colors.accentLight} />
                <Text style={styles.cardTitle}>Monthly Trend</Text>
              </View>
              <View style={styles.divider} />
              <BarChart
                data={momData}
                width={CHART_W}
                height={160}
                barWidth={Math.max(26, Math.floor(CHART_W / momData.length) - 18)}
                barBorderRadius={7}
                noOfSections={4}
                yAxisColor={Colors.border}
                xAxisColor={Colors.border}
                yAxisTextStyle={{ color: Colors.textMuted, fontSize: 9 }}
                xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}
                hideRules
                isAnimated
                showGradient
                gradientColor={Colors.primaryDim + '55'}
                backgroundColor="transparent"
                xAxisThickness={1}
                yAxisThickness={0}
                spacing={10}
              />
            </View>
          )}

          {/* Category breakdown table */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="category" size={18} color={Colors.accentLight} />
              <Text style={styles.cardTitle}>Category Breakdown</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Category</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Amount</Text>
              <Text style={[styles.th, { width: 48, textAlign: 'right' }]}>%</Text>
            </View>
            {catBreakdown.map((item, i) => (
              <View key={item.cat} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                <View style={[styles.catRowLeft, { flex: 2 }]}>
                  <View style={[styles.catColorBar, { backgroundColor: item.color }]} />
                  <Text style={styles.tdText} numberOfLines={1}>{item.cat.split(' ')[0] + ' ' + (item.cat.split(' ')[1] || '')}</Text>
                </View>
                <Text style={[styles.tdBold, { flex: 1, textAlign: 'right' }]}>
                  {formatINR(item.amount)}
                </Text>
                <View style={{ width: 48, alignItems: 'flex-end' }}>
                  <View style={[styles.pctBadge, { backgroundColor: item.color + '22' }]}>
                    <Text style={[styles.pctTxt, { color: item.color }]}>
                      {Math.round(item.pct)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {/* Total row */}
            <View style={[styles.tableRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 }]}>
              <Text style={[styles.tdBold, { flex: 2, color: Colors.textPrimary }]}>Total</Text>
              <Text style={[styles.tdBold, { flex: 1, textAlign: 'right', color: Colors.dangerLight }]}>
                {formatINR(totals.total)}
              </Text>
              <Text style={[styles.tdBold, { width: 48, textAlign: 'right' }]}>100%</Text>
            </View>
          </View>

          {/* Payment mode split */}
          {piePayData.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="credit-card" size={18} color={Colors.accentLight} />
                <Text style={styles.cardTitle}>Payment Mode Split</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.payRow}>
                <PieChart
                  data={piePayData}
                  donut
                  radius={76}
                  innerRadius={46}
                  innerCircleColor={Colors.surface}
                  strokeColor={Colors.background}
                  strokeWidth={2}
                  centerLabelComponent={() => (
                    <Text style={{ fontSize: 9, color: Colors.textMuted, textAlign: 'center' }}>
                      {payBreakdown.length}{'\n'}modes
                    </Text>
                  )}
                />
                <View style={styles.payLegend}>
                  {payBreakdown.map(p => (
                    <View key={p.mode} style={styles.payLegendRow}>
                      <View style={[styles.payDot, { backgroundColor: p.color }]} />
                      <Text style={styles.payMode} numberOfLines={1}>
                        {p.mode === 'Bank Transfer' ? 'Bank Transfer' : p.mode}
                      </Text>
                      <Text style={[styles.payAmt, { color: p.color }]}>{formatINR(p.amount)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Top 5 biggest */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="local-fire-department" size={18} color={Colors.dangerLight} />
              <Text style={styles.cardTitle}>Biggest Expenses</Text>
            </View>
            <View style={styles.divider} />
            {top5.map((tx, i) => {
              const pctOfTotal = totals.total > 0 ? Math.round((tx.amount / totals.total) * 100) : 0;
              return (
                <View key={tx.id} style={[styles.top5Row, i < top5.length - 1 && styles.top5Border]}>
                  <LinearGradient
                    colors={i === 0
                      ? [Colors.accentDim + 'CC', Colors.accentDim + '33']
                      : [Colors.surfaceElevated, Colors.surfaceElt]}
                    style={styles.rankBadge}
                  >
                    <Text style={[styles.rankNum, { color: i === 0 ? Colors.accentLight : Colors.textMuted }]}>
                      #{i + 1}
                    </Text>
                  </LinearGradient>
                  <View style={styles.top5Info}>
                    <Text style={styles.top5Desc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.top5Meta}>{tx.date} · {tx.category.split(' ')[0]}</Text>
                    {/* Mini bar showing % of total */}
                    <View style={styles.top5BarTrack}>
                      <View style={[
                        styles.top5BarFill,
                        {
                          width: `${pctOfTotal}%` as any,
                          backgroundColor: i === 0 ? Colors.accent : Colors.primaryLight,
                        },
                      ]} />
                    </View>
                  </View>
                  <View style={styles.top5Right}>
                    <Text style={[styles.top5Amt, i === 0 && { color: Colors.accentLight, fontSize: FontSize.lg }]}>
                      {formatINR(tx.amount)}
                    </Text>
                    <Text style={styles.top5Pct}>{pctOfTotal}%</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Subscriptions detected */}
          {monthlyTx.filter(tx =>
            ['Netflix', 'Spotify', 'Amazon', 'Gym', 'Internet', 'Mobile'].some(kw =>
              tx.description.toLowerCase().includes(kw.toLowerCase()),
            ),
          ).length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="repeat" size={18} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Recurring / Subscriptions</Text>
              </View>
              <View style={styles.divider} />
              {monthlyTx
                .filter(tx =>
                  ['netflix', 'spotify', 'amazon', 'gym', 'internet', 'mobile', 'sip', 'ppf', 'fd', 'rent'].some(kw =>
                    tx.description.toLowerCase().includes(kw),
                  ),
                )
                .slice(0, 8)
                .map((tx, i, arr) => (
                  <View key={tx.id} style={[styles.subRow, i < arr.length - 1 && styles.top5Border]}>
                    <MaterialIcons name="repeat" size={14} color={Colors.primaryLight} />
                    <Text style={styles.subDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.subAmt}>{formatINR(tx.amount)}</Text>
                  </View>
                ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function SumItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLbl}>{label}</Text>
      <Text style={[styles.summaryVal, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { paddingTop: Spacing.sm },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  pageSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  monthRow: { flexDirection: 'row', gap: 8, paddingRight: Spacing.md, paddingVertical: 4 },
  monthBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  monthBtnActive: { borderColor: Colors.accent + '88' },
  monthBtnTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  monthBtnTxtActive: { color: Colors.accentLight },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptyText: { fontSize: FontSize.body, color: Colors.textMuted },

  summaryCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryLbl: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  sumDiv: { width: 1, height: 28, backgroundColor: Colors.border },
  savingRateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  savingRateLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  savingRateVal: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  savingRateSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: -4 },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  scoreBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  gradeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  gradeLeft: { flex: 1, gap: 10 },
  gradeDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  gradeRatioRow: { flexDirection: 'row', gap: 16 },
  ratioItem: { alignItems: 'center', gap: 2 },
  ratioVal: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  ratioLbl: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  ratioTarget: { fontSize: 9, color: Colors.textMuted },
  vsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  vsChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  vsTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  gradeCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    flexShrink: 0,
  },
  gradeText: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy },
  gradeLbl: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  tableHead: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 9, alignItems: 'center' },
  tableRowAlt: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  catRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catColorBar: { width: 3, height: 18, borderRadius: 2, flexShrink: 0 },
  tdText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  tdBold: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  pctBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  pctTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  payLegend: { flex: 1, gap: 9 },
  payLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  payMode: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  payAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  top5Row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  top5Border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankBadge: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankNum: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
  top5Info: { flex: 1, gap: 3 },
  top5Desc: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  top5Meta: { fontSize: FontSize.xs, color: Colors.textMuted },
  top5BarTrack: { height: 3, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden', marginTop: 3 },
  top5BarFill: { height: '100%', borderRadius: Radius.full },
  top5Right: { alignItems: 'flex-end', gap: 2 },
  top5Amt: { fontSize: FontSize.md, fontWeight: FontWeight.heavy, color: Colors.dangerLight },
  top5Pct: { fontSize: FontSize.xs, color: Colors.textMuted },

  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  subDesc: { flex: 1, fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  subAmt: { fontSize: FontSize.body, fontWeight: FontWeight.heavy, color: Colors.primaryLight },
});
