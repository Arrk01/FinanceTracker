import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Dimensions,
  RefreshControl,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import {
  formatINR,
  parseDate,
  formatDateDisplay,
  CATEGORIES,
  MONTH_NAMES,
  getWeekBounds,
  generateInsights,
  FinancialInsight,
} from '@/constants/config';
import { useTransactions } from '@/hooks/useTransactions';
import { useSalary } from '@/hooks/useSalary';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PieChart } from 'react-native-gifted-charts';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, isLoading, refresh } = useTransactions();
  const { getSalary, setSalary } = useSalary();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  // ── Per-month salary & derived budget limits ───────────────────────────
  const salary = getSalary(currentYear, currentMonth);
  const needsLimit   = Math.round(salary * 0.50);
  const wantsLimit   = Math.round(salary * 0.30);
  const savingsLimit = Math.round(salary * 0.20);
  const weeklyLimit  = Math.round(salary / 4.33);

  // ── Salary edit modal ──────────────────────────────────────────────────
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');

  const openSalaryModal = useCallback(() => {
    setSalaryInput(salary.toString());
    setShowSalaryModal(true);
  }, [salary]);

  const handleSaveSalary = useCallback(async () => {
    const val = parseFloat(salaryInput.replace(/,/g, ''));
    if (!isFinite(val) || val <= 0) return;
    await setSalary(currentYear, currentMonth, val);
    setShowSalaryModal(false);
  }, [salaryInput, currentYear, currentMonth, setSalary]);

  // ── Monthly transactions ───────────────────────────────────────────────
  const monthlyTransactions = useMemo(() =>
    transactions.filter(tx => {
      const d = parseDate(tx.date);
      const inMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      const isRealSpend = tx.type !== 'Transfer' && tx.type !== ('CardPayment' as string) && !tx.isIncome;
      return inMonth && isRealSpend;
    }),
    [transactions, currentMonth, currentYear],
  );

  // ── Totals ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let needs = 0, wants = 0, savings = 0, total = 0;
    for (const tx of monthlyTransactions) {
      const amt = Math.max(0, tx.amount);
      total += amt;
      if (tx.type === 'Need') needs += amt;
      else if (tx.type === 'Want') wants += amt;
      else savings += amt;
    }
    return { needs, wants, savings, total };
  }, [monthlyTransactions]);

  // ── Weekly spend ───────────────────────────────────────────────────────
  const weeklySpend = useMemo(() => {
    const { start, end } = getWeekBounds(now);
    return transactions
      .filter(tx => { const d = parseDate(tx.date); return d >= start && d <= end; })
      .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
  }, [transactions]);

  // ── Category totals for pie ────────────────────────────────────────────
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyTransactions) map[tx.category] = (map[tx.category] || 0) + tx.amount;
    return map;
  }, [monthlyTransactions]);

  const pieData = useMemo(() =>
    CATEGORIES
      .filter(cat => (categoryTotals[cat] || 0) > 0)
      .map((cat, i) => ({ value: categoryTotals[cat] || 0, color: Colors.chart[i % Colors.chart.length], label: cat })),
    [categoryTotals],
  );

  // ── Last 5 ────────────────────────────────────────────────────────────
  const last5 = useMemo(() =>
    [...transactions].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()).slice(0, 5),
    [transactions],
  );

  // ── Insights ───────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const topCat = CATEGORIES.reduce((top, cat) =>
      (categoryTotals[cat] || 0) > (categoryTotals[top] || 0) ? cat : top, CATEGORIES[0]);
    const daysElapsed = now.getDate();
    const avgDaily = daysElapsed > 0 ? totals.total / daysElapsed : 0;
    return generateInsights({
      salary,
      totalSpent: totals.total,
      needs: totals.needs,
      wants: totals.wants,
      savings: totals.savings,
      weeklySpend,
      weeklyLimit,
      topCategory: topCat,
      txCount: monthlyTransactions.length,
      avgDaily,
    });
  }, [totals, weeklySpend, weeklyLimit, categoryTotals, monthlyTransactions.length, salary]);

  const budgetRemaining = salary - totals.total;
  const weekPct = Math.min((weeklySpend / weeklyLimit) * 100, 100);
  const weekOver = weeklySpend > weeklyLimit;
  const spentPct = totals.total > 0 ? Math.round((totals.total / salary) * 100) : 0;

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading finances...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.accentLight} />}
      >
        {/* ── Hero gradient header ── */}
        <LinearGradient
          colors={['#0D1F38', '#0A1628', '#080E1C']}
          style={[styles.heroGrad, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroMonth}>{monthLabel.toUpperCase()}</Text>
              <Text style={styles.heroTitle}>My Finances</Text>
            </View>
            {/* Tappable salary pill */}
            <Pressable
              style={({ pressed }) => [styles.salaryPill, pressed && { opacity: 0.75 }]}
              onPress={openSalaryModal}
              hitSlop={8}
            >
              <MaterialIcons name="account-balance" size={11} color={Colors.accentLight} />
              <Text style={styles.salaryAmt}>{formatINR(salary)}</Text>
              <Text style={styles.salaryLbl}>/mo</Text>
              <MaterialIcons name="edit" size={10} color={Colors.accent + 'CC'} />
            </Pressable>
          </View>

          {/* Big spent number */}
          <View style={styles.heroSpent}>
            <Text style={styles.heroSpentLbl}>TOTAL SPENT</Text>
            <Text style={styles.heroSpentAmt}>{formatINR(totals.total)}</Text>
            <View style={styles.heroUsageTrack}>
              <View style={[styles.heroUsageFill, {
                width: `${Math.min(spentPct, 100)}%` as any,
                backgroundColor: spentPct > 90 ? Colors.danger : spentPct > 70 ? Colors.warning : Colors.success,
              }]} />
            </View>
            <Text style={styles.heroUsageLbl}>{spentPct}% of {formatINR(salary)} salary used</Text>
            <View style={[styles.heroBudgetBadge, {
              backgroundColor: budgetRemaining >= 0 ? Colors.successDim + '88' : Colors.dangerDim + '88',
            }]}>
              <MaterialIcons
                name={budgetRemaining >= 0 ? 'trending-down' : 'trending-up'}
                size={13}
                color={budgetRemaining >= 0 ? Colors.successLight : Colors.dangerLight}
              />
              <Text style={[styles.heroBudgetTxt, { color: budgetRemaining >= 0 ? Colors.successLight : Colors.dangerLight }]}>
                {budgetRemaining >= 0
                  ? `${formatINR(budgetRemaining)} remaining`
                  : `${formatINR(-budgetRemaining)} over budget`}
              </Text>
            </View>
          </View>

          {/* 4 stat mini-cards */}
          <View style={styles.statsRow}>
            <StatCard label="Needs" value={formatINR(totals.needs)} sub={`of ${formatINR(needsLimit)}`} color={Colors.success} icon="home" over={totals.needs > needsLimit} />
            <StatCard label="Wants" value={formatINR(totals.wants)} sub={`of ${formatINR(wantsLimit)}`} color={Colors.warning} icon="shopping-bag" over={totals.wants > wantsLimit} />
            <StatCard label="Savings" value={formatINR(totals.savings)} sub={`of ${formatINR(savingsLimit)}`} color={Colors.primaryLight} icon="savings" over={false} />
            <StatCard label="Entries" value={`${monthlyTransactions.length}`} sub="this month" color={Colors.accentLight} icon="receipt-long" over={false} />
          </View>
        </LinearGradient>

        <View style={styles.body}>

          {/* ── AI Insights ── */}
          {insights.length > 0 && (
            <View style={styles.insightScroll}>
              <View style={styles.sectionHeaderRow}>
                <MaterialIcons name="auto-awesome" size={15} color={Colors.accentLight} />
                <Text style={styles.sectionHeader}>Smart Insights</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 10, paddingRight: Spacing.md }}>
                  {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Budget progress ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="donut-small" size={17} color={Colors.accentLight} />
              <Text style={styles.cardTitle}>50 · 30 · 20 Budget</Text>
              <View style={styles.ruleTag}>
                <Text style={styles.ruleTxt}>50% Needs · 30% Wants · 20% Save</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.progressStack}>
              <ProgressBar label={`Needs · ${formatINR(needsLimit)}`} current={totals.needs} limit={needsLimit} color={Colors.success} />
              <ProgressBar label={`Wants · ${formatINR(wantsLimit)}`} current={totals.wants} limit={wantsLimit} color={Colors.warning} />
              <ProgressBar label={`Savings · ${formatINR(savingsLimit)}`} current={totals.savings} limit={savingsLimit} color={Colors.primaryLight} />
            </View>
          </View>

          {/* ── Weekly + Split ── */}
          <View style={styles.twoCol}>
            <View style={[styles.card, styles.flex1]}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="date-range" size={15} color={weekOver ? Colors.dangerLight : Colors.successLight} />
                <Text style={styles.cardTitle}>This Week</Text>
              </View>
              <Text style={[styles.weekAmt, weekOver && { color: Colors.dangerLight }]}>{formatINR(weeklySpend)}</Text>
              <Text style={styles.weekLimit}>of {formatINR(weeklyLimit)} limit</Text>
              <View style={styles.weekTrack}>
                <View style={[styles.weekFill, { width: `${weekPct}%` as any, backgroundColor: weekOver ? Colors.danger : Colors.success }]} />
              </View>
              {weekOver ? (
                <View style={styles.overBadge}>
                  <MaterialIcons name="warning" size={10} color={Colors.dangerLight} />
                  <Text style={styles.overBadgeTxt}>+{formatINR(weeklySpend - weeklyLimit)}</Text>
                </View>
              ) : (
                <Text style={styles.weekOkTxt}>{Math.round(weekPct)}% of limit</Text>
              )}
            </View>

            <View style={[styles.card, styles.flex1]}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="pie-chart" size={15} color={Colors.accentLight} />
                <Text style={styles.cardTitle}>Split</Text>
              </View>
              <View style={styles.stackBar}>
                {totals.needs > 0 && <View style={[styles.seg, { flex: totals.needs, backgroundColor: Colors.success }]} />}
                {totals.wants > 0 && <View style={[styles.seg, { flex: totals.wants, backgroundColor: Colors.warning }]} />}
                {totals.savings > 0 && <View style={[styles.seg, { flex: totals.savings, backgroundColor: Colors.primaryLight }]} />}
              </View>
              <View style={styles.splitGrid}>
                {[
                  { label: 'Needs', color: Colors.success, val: totals.needs },
                  { label: 'Wants', color: Colors.warning, val: totals.wants },
                  { label: 'Save', color: Colors.primaryLight, val: totals.savings },
                ].map(({ label, color, val }) => (
                  <View key={label} style={styles.splitItem}>
                    <View style={[styles.splitDot, { backgroundColor: color }]} />
                    <Text style={[styles.splitPct, { color }]}>
                      {totals.total > 0 ? Math.round((val / totals.total) * 100) : 0}%
                    </Text>
                    <Text style={styles.splitLbl}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* ── Category donut chart ── */}
          {pieData.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="donut-large" size={17} color={Colors.accentLight} />
                <Text style={styles.cardTitle}>Spending by Category</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.chartRow}>
                <PieChart
                  data={pieData}
                  donut
                  radius={Math.min(92, (SCREEN_W - 200) / 2)}
                  innerRadius={Math.min(58, (SCREEN_W - 200) / 3)}
                  innerCircleColor={Colors.surface}
                  strokeColor={Colors.background}
                  strokeWidth={3}
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text style={styles.pieCenterAmt} adjustsFontSizeToFit numberOfLines={1}>{formatINR(totals.total)}</Text>
                      <Text style={styles.pieCenterLbl}>total</Text>
                    </View>
                  )}
                />
                <View style={styles.pieLegend}>
                  {pieData.map(item => (
                    <View key={item.label} style={styles.pieLegendRow}>
                      <View style={[styles.pieLegendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.pieLegendName} numberOfLines={1}>{item.label.split(' ').slice(0, 2).join(' ')}</Text>
                      <Text style={[styles.pieLegendVal, { color: item.color }]}>
                        {totals.total > 0 ? Math.round((item.value / totals.total) * 100) : 0}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── Recent transactions ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="history" size={17} color={Colors.accentLight} />
              <Text style={styles.cardTitle}>Recent</Text>
            </View>
            <View style={styles.divider} />
            {last5.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="inbox" size={36} color={Colors.textDim} />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              <View style={styles.txList}>
                {last5.map((tx, idx) => {
                  const catColor = Colors.categories[tx.category];
                  const modeColor = Colors.paymentModes[tx.paymentMode];
                  return (
                    <View key={tx.id} style={[styles.txRow, idx < last5.length - 1 && styles.txBorder]}>
                      <View style={[styles.txIcon, { backgroundColor: catColor.bg, borderColor: catColor.border }]}>
                        <View style={[styles.txIconDot, { backgroundColor: catColor.dot }]} />
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                        <View style={styles.txMeta}>
                          <Text style={styles.txDate}>{formatDateDisplay(tx.date)}</Text>
                          <View style={[styles.txModeBadge, { backgroundColor: modeColor + '22' }]}>
                            <Text style={[styles.txModeText, { color: modeColor }]}>
                              {tx.paymentMode === 'Bank Transfer' ? 'Bank'
                                : tx.paymentMode === 'Credit Card' ? 'CC'
                                : tx.paymentMode === 'Debit Card' ? 'DC'
                                : tx.paymentMode}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={styles.txAmt}>{formatINR(tx.amount)}</Text>
                        <Text style={[styles.txType, { color: Colors.types[tx.type]?.dot ?? Colors.textMuted }]}>{tx.type}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Salary Edit Modal ── */}
      <Modal visible={showSalaryModal} transparent animationType="slide" onRequestClose={() => setShowSalaryModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={() => setShowSalaryModal(false)}>
            <View style={modalStyles.sheet}>
              <View style={modalStyles.handle} />
              <View style={modalStyles.titleRow}>
                <MaterialIcons name="account-balance" size={20} color={Colors.accentLight} />
                <Text style={modalStyles.title}>Set {monthLabel} Salary</Text>
              </View>
              <Text style={modalStyles.sub}>
                Budget limits auto-adjust: 50% Needs · 30% Wants · 20% Savings
              </Text>

              {/* Quick presets */}
              <View style={modalStyles.presetsRow}>
                {[30000, 40000, 50000, 60000, 75000, 100000].map(preset => (
                  <Pressable
                    key={preset}
                    style={({ pressed }) => [
                      modalStyles.preset,
                      salaryInput === preset.toString() && modalStyles.presetActive,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => setSalaryInput(preset.toString())}
                  >
                    <Text style={[
                      modalStyles.presetTxt,
                      salaryInput === preset.toString() && { color: Colors.accentLight },
                    ]}>
                      {preset >= 100000 ? '₹1L' : preset >= 75000 ? '₹75k' : `₹${preset / 1000}k`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Manual input */}
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.rupeeSign}>₹</Text>
                <TextInput
                  style={modalStyles.input}
                  value={salaryInput}
                  onChangeText={setSalaryInput}
                  placeholder="Enter your salary"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                />
              </View>

              {/* Budget preview */}
              {(() => {
                const val = parseFloat(salaryInput.replace(/,/g, ''));
                if (!isFinite(val) || val <= 0) return null;
                return (
                  <View style={modalStyles.preview}>
                    <Text style={modalStyles.previewTitle}>Budget Preview</Text>
                    {[
                      { label: 'Needs (50%)', amt: Math.round(val * 0.5), color: Colors.success },
                      { label: 'Wants (30%)', amt: Math.round(val * 0.3), color: Colors.warning },
                      { label: 'Savings (20%)', amt: Math.round(val * 0.2), color: Colors.primaryLight },
                      { label: 'Weekly limit', amt: Math.round(val / 4.33), color: Colors.accentLight },
                    ].map(row => (
                      <View key={row.label} style={modalStyles.previewRow}>
                        <Text style={modalStyles.previewLbl}>{row.label}</Text>
                        <Text style={[modalStyles.previewAmt, { color: row.color }]}>{formatINR(row.amt)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              <View style={modalStyles.btnRow}>
                <Pressable style={modalStyles.cancelBtn} onPress={() => setShowSalaryModal(false)}>
                  <Text style={modalStyles.cancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable style={modalStyles.saveBtn} onPress={handleSaveSalary}>
                  <LinearGradient colors={[Colors.accent, Colors.accentDim + 'FF']} style={modalStyles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={modalStyles.saveTxt}>Save</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── Sub components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon, over }: {
  label: string; value: string; sub: string; color: string; icon: string; over: boolean;
}) {
  return (
    <View style={[statStyles.card, over && { borderColor: Colors.danger + '66' }]}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <Text style={[statStyles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.sub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function InsightCard({ insight }: { insight: FinancialInsight }) {
  const colorMap = { warning: Colors.dangerLight, success: Colors.successLight, info: Colors.primaryLight, tip: Colors.accentLight };
  const bgMap = { warning: Colors.dangerDim + '44', success: Colors.successDim + '44', info: Colors.primaryDim + '44', tip: Colors.accentDim + '44' };
  const borderMap = { warning: Colors.danger + '55', success: Colors.success + '55', info: Colors.primary + '55', tip: Colors.accent + '55' };
  const c = colorMap[insight.type];
  const bg = bgMap[insight.type];
  const bc = borderMap[insight.type];
  return (
    <View style={[insightStyles.card, { backgroundColor: bg, borderColor: bc }]}>
      <View style={[insightStyles.iconWrap, { backgroundColor: c + '22' }]}>
        <MaterialIcons name={insight.icon as any} size={16} color={c} />
      </View>
      <Text style={[insightStyles.title, { color: c }]}>{insight.title}</Text>
      <Text style={insightStyles.msg} numberOfLines={3}>{insight.message}</Text>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  card: { width: 200, borderRadius: Radius.lg, padding: 12, gap: 7, borderWidth: 1, ...Shadow.sm },
  iconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  msg: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
});

const statStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.md, padding: 9, gap: 2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  value: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, textAlign: 'center' },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  sub: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceElt,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.md,
    paddingBottom: 48,
    gap: Spacing.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderMid,
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.borderMid, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18, marginTop: -8 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
  },
  presetActive: { backgroundColor: Colors.accentDim + '55', borderColor: Colors.accent + '88' },
  presetTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.accentLight + '55',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  rupeeSign: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.accentLight },
  input: { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  preview: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.border,
  },
  previewTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLbl: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: Radius.md, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: FontSize.body, fontWeight: FontWeight.heavy, color: '#000' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.body },
  heroGrad: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.md },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroMonth: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold, letterSpacing: 1.5 },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary, marginTop: 2 },
  salaryPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.accentDim + '55', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 6, gap: 4,
    borderWidth: 1, borderColor: Colors.accent + '44',
  },
  salaryAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accentLight },
  salaryLbl: { fontSize: FontSize.xs, color: Colors.accent },
  heroSpent: { alignItems: 'center', paddingVertical: Spacing.xs, gap: 6 },
  heroSpentLbl: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold, letterSpacing: 2 },
  heroSpentAmt: { fontSize: FontSize.hero, fontWeight: FontWeight.heavy, color: Colors.textPrimary, letterSpacing: -1 },
  heroUsageTrack: { width: '72%', height: 5, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  heroUsageFill: { height: '100%', borderRadius: Radius.full },
  heroUsageLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  heroBudgetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  heroBudgetTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  statsRow: { flexDirection: 'row', gap: 7 },
  body: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeader: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5 },
  insightScroll: { gap: 0 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  flex1: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  ruleTag: { backgroundColor: Colors.accentDim + '33', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.accent + '33' },
  ruleTxt: { fontSize: 9, color: Colors.accent, fontWeight: FontWeight.semibold },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: -4 },
  progressStack: { gap: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  weekAmt: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  weekLimit: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: -6 },
  weekTrack: { height: 7, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  weekFill: { height: '100%', borderRadius: Radius.full },
  overBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dangerDim + '55', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.danger + '44' },
  overBadgeTxt: { fontSize: FontSize.xs, color: Colors.dangerLight, fontWeight: FontWeight.semibold },
  weekOkTxt: { fontSize: FontSize.xs, color: Colors.textMuted },
  stackBar: { flexDirection: 'row', height: 10, borderRadius: Radius.full, overflow: 'hidden', gap: 2 },
  seg: { height: '100%' },
  splitGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  splitItem: { alignItems: 'center', gap: 4 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitPct: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  splitLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pieCenter: { alignItems: 'center', paddingHorizontal: 4 },
  pieCenterAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: Colors.textPrimary, textAlign: 'center' },
  pieCenterLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  pieLegend: { flex: 1, gap: 10 },
  pieLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieLegendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  pieLegendName: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  pieLegendVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  txList: {},
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  txIconDot: { width: 11, height: 11, borderRadius: 5.5 },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  txModeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  txModeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  txRight: { alignItems: 'flex-end', gap: 3 },
  txAmt: { fontSize: FontSize.md, fontWeight: FontWeight.heavy, color: Colors.dangerLight },
  txType: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  empty: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 8 },
  emptyText: { fontSize: FontSize.body, color: Colors.textMuted },
});
