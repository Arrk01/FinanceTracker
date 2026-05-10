import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import {
  CATEGORIES,
  PAYMENT_MODES,
  CATEGORY_TYPE_MAP,
  Transaction,
  Category,
  PaymentMode,
  TransactionType,
  formatINR,
  formatDateDisplay,
  parseDate,
  MONTH_NAMES,
  dateToString,
} from '@/constants/config';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/useToast';
import { useAlert } from '@/template';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CategoryBadge, TypeBadge } from '@/components/ui/CategoryBadge';

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type TypeFilter = 'All' | TransactionType;

const TYPE_FILTERS: TypeFilter[] = ['All', 'Need', 'Want', 'Saving'];
const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'newest', label: 'Newest', icon: 'arrow-downward' },
  { key: 'oldest', label: 'Oldest', icon: 'arrow-upward' },
  { key: 'highest', label: 'Highest', icon: 'trending-up' },
  { key: 'lowest', label: 'Lowest', icon: 'trending-down' },
];

const CURRENT_YEAR = 2026;
const MONTH_FILTERS = [
  'All',
  ...MONTH_NAMES.slice(0, 9).map(m => `${m} ${CURRENT_YEAR}`),
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction, updateTransaction } = useTransactions();
  const { toasts, showToast, removeToast } = useToast();
  const { showAlert } = useAlert();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [sort, setSort] = useState<SortOption>('newest');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Edit state
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState<Category>('Life Infrastructure');
  const [editAmount, setEditAmount] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMode>('UPI');
  const [editType, setEditType] = useState<TransactionType>('Need');
  const [editNotes, setEditNotes] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  // ── Filtered + sorted list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...transactions];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.notes.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.paymentMode.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'All') list = list.filter(tx => tx.type === typeFilter);
    if (monthFilter !== 'All') {
      const [mon, yr] = monthFilter.split(' ');
      const monthIdx = MONTH_NAMES.indexOf(mon);
      const year = parseInt(yr, 10);
      list = list.filter(tx => {
        const d = parseDate(tx.date);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      });
    }

    list.sort((a, b) => {
      if (sort === 'newest') return parseDate(b.date).getTime() - parseDate(a.date).getTime();
      if (sort === 'oldest') return parseDate(a.date).getTime() - parseDate(b.date).getTime();
      if (sort === 'highest') return b.amount - a.amount;
      return a.amount - b.amount;
    });
    return list;
  }, [transactions, search, typeFilter, monthFilter, sort]);

  const totalFiltered = useMemo(() =>
    filtered.reduce((sum, tx) => sum + Math.max(0, tx.amount), 0),
    [filtered],
  );

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback((tx: Transaction) => {
    showAlert(
      'Delete Expense?',
      `"${tx.description}"\n${formatINR(tx.amount)} · ${tx.date}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(tx.id);
            showToast('Expense deleted', 'info');
          },
        },
      ],
    );
  }, [deleteTransaction, showAlert, showToast]);

  // ── Edit ───────────────────────────────────────────────────────────────
  const handleEditOpen = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setEditDate(tx.date);
    setEditDesc(tx.description);
    setEditCat(tx.category);
    setEditAmount(tx.amount.toString());
    setEditPayment(tx.paymentMode);
    setEditType(tx.type);
    setEditNotes(tx.notes);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingTx) return;
    const trimmedDesc = editDesc.trim();
    const amt = parseFloat(editAmount);
    if (!trimmedDesc) { showToast('Enter a description', 'error'); return; }
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    await updateTransaction(editingTx.id, {
      date: editDate.trim() || editingTx.date,
      description: trimmedDesc,
      category: editCat,
      amount: Math.round(amt * 100) / 100,
      paymentMode: editPayment,
      type: editType,
      notes: editNotes.trim(),
    });
    showToast('Expense updated', 'success');
    setEditingTx(null);
  }, [editingTx, editDate, editDesc, editCat, editAmount, editPayment, editType, editNotes, updateTransaction, showToast]);

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const header = 'Date,Description,Category,Amount,Payment Mode,Type,Notes';
    const rows = transactions
      .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
      .map(tx => [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.category,
        tx.amount.toFixed(2),
        tx.paymentMode,
        tx.type,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
      ].join(','));
    const csv = [header, ...rows].join('\n');
    showAlert(
      'Export CSV',
      `${transactions.length} transactions ready.\n\nFormat: Date, Description, Category, Amount, Payment Mode, Type, Notes\n\nCopy from below:\n\n${csv.slice(0, 400)}${csv.length > 400 ? '...' : ''}`,
      [{ text: 'Got it' }],
    );
  }, [transactions, showAlert]);

  // ── Row renderer (memoized for FlatList performance) ──────────────────
  const renderItem = useCallback(({ item: tx, index }: { item: Transaction; index: number }) => {
    const catColor = Colors.categories[tx.category];
    const modeColor = Colors.paymentModes[tx.paymentMode];
    const modeShort = tx.paymentMode === 'Bank Transfer' ? 'Bank'
      : tx.paymentMode === 'Credit Card' ? 'CC'
      : tx.paymentMode === 'Debit Card' ? 'DC'
      : tx.paymentMode;

    return (
      <View style={styles.txCard}>
        <View style={[styles.txAccent, { backgroundColor: catColor.dot }]} />
        <View style={styles.txMain}>
          {/* Row 1: icon + desc + amount */}
          <View style={styles.txTopRow}>
            <View style={[styles.txIconInner, { backgroundColor: catColor.bg, borderColor: catColor.border }]}>
              <View style={[styles.txIconDot, { backgroundColor: catColor.dot }]} />
            </View>
            <View style={styles.txDesc}>
              <Text style={styles.txDescTxt} numberOfLines={1}>{tx.description}</Text>
              <Text style={styles.txDateTxt}>{formatDateDisplay(tx.date)}</Text>
            </View>
            <View style={styles.txAmtCol}>
              <Text style={styles.txAmt}>{formatINR(tx.amount)}</Text>
              <View style={[styles.modeChip, { backgroundColor: modeColor + '22', borderColor: modeColor + '44' }]}>
                <Text style={[styles.modeChipTxt, { color: modeColor }]}>{modeShort}</Text>
              </View>
            </View>
          </View>

          {/* Row 2: badges + actions */}
          <View style={styles.txBotRow}>
            <View style={styles.txTags}>
              <CategoryBadge category={tx.category} size="xs" />
              <TypeBadge type={tx.type} size="xs" />
            </View>
            <View style={styles.txActions}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleEditOpen(tx)}
                hitSlop={10}
              >
                <MaterialIcons name="edit" size={13} color={Colors.primaryLight} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleDelete(tx)}
                hitSlop={10}
              >
                <MaterialIcons name="delete-outline" size={13} color={Colors.dangerLight} />
              </Pressable>
            </View>
          </View>

          {tx.notes ? (
            <Text style={styles.txNotes} numberOfLines={1}>
              {'💬 '}{tx.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }, [handleEditOpen, handleDelete]);

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Transactions</Text>
          <Text style={styles.countLbl}>
            {filtered.length} entries · {formatINR(totalFiltered)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.75 }]}
          onPress={handleExportCSV}
        >
          <MaterialIcons name="file-download" size={14} color={Colors.accentLight} />
          <Text style={styles.exportTxt}>CSV</Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, category, mode..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <MaterialIcons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Type filter + Sort */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.chipRow}>
            {TYPE_FILTERS.map(t => {
              const isActive = typeFilter === t;
              const dotColor = t === 'All' ? Colors.textMuted : Colors.types[t as TransactionType].dot;
              return (
                <Pressable
                  key={t}
                  style={[styles.chip, isActive && { backgroundColor: dotColor + '22', borderColor: dotColor + '77' }]}
                  onPress={() => setTypeFilter(t)}
                >
                  {t !== 'All' && (
                    <View style={[styles.chipDot, { backgroundColor: isActive ? dotColor : Colors.textDim }]} />
                  )}
                  <Text style={[styles.chipTxt, isActive && { color: Colors.textPrimary }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Pressable
          style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShowSortPicker(true)}
        >
          <MaterialIcons name="sort" size={14} color={Colors.accentLight} />
          <Text style={styles.sortBtnTxt}>{SORT_OPTIONS.find(s => s.key === sort)?.label}</Text>
        </Pressable>
      </View>

      {/* Month filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        <View style={styles.chipRow}>
          {MONTH_FILTERS.map(m => {
            const isActive = monthFilter === m;
            return (
              <Pressable
                key={m}
                style={[
                  styles.monthChip,
                  isActive && { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
                ]}
                onPress={() => setMonthFilter(m)}
              >
                <Text style={[styles.monthChipTxt, isActive && { color: Colors.accentLight }]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={12}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <MaterialIcons name="search-off" size={48} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try different keywords' : 'Adjust filters to see transactions'}
            </Text>
          </View>
        )}
      />

      {/* Edit Modal */}
      <Modal visible={editingTx !== null} transparent animationType="slide" onRequestClose={() => setEditingTx(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditingTx(null)}>
            <View style={styles.editSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.editTitle}>Edit Expense</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.editForm}>
                  <EField label="Date">
                    <TextInput style={styles.eInput} value={editDate} onChangeText={setEditDate} placeholderTextColor={Colors.textMuted} />
                  </EField>
                  <EField label="Description">
                    <TextInput style={styles.eInput} value={editDesc} onChangeText={setEditDesc} placeholderTextColor={Colors.textMuted} />
                  </EField>
                  <EField label="Amount (₹)">
                    <TextInput style={styles.eInput} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
                  </EField>
                  <EField label="Category">
                    <Pressable style={styles.eDrop} onPress={() => setShowCatPicker(true)}>
                      <CategoryBadge category={editCat} size="sm" />
                      <MaterialIcons name="expand-more" size={18} color={Colors.textSecondary} />
                    </Pressable>
                  </EField>
                  <EField label="Payment Mode">
                    <Pressable style={styles.eDrop} onPress={() => setShowPayPicker(true)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.payDot, { backgroundColor: Colors.paymentModes[editPayment] }]} />
                        <Text style={styles.eDropTxt}>{editPayment}</Text>
                      </View>
                      <MaterialIcons name="expand-more" size={18} color={Colors.textSecondary} />
                    </Pressable>
                  </EField>
                  <EField label="Type">
                    <View style={styles.typeRow}>
                      {(['Need', 'Want', 'Saving'] as TransactionType[]).map(t => {
                        const isActive = editType === t;
                        const tc = Colors.types[t];
                        return (
                          <Pressable
                            key={t}
                            style={[styles.typeBtn, isActive && { backgroundColor: tc.bg, borderColor: tc.border }]}
                            onPress={() => setEditType(t)}
                          >
                            <View style={[styles.typeDot, { backgroundColor: tc.dot }]} />
                            <Text style={[styles.typeTxt, isActive && { color: tc.text }]}>{t}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </EField>
                  <EField label="Notes">
                    <TextInput
                      style={[styles.eInput, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      placeholderTextColor={Colors.textMuted}
                      placeholder="Optional notes..."
                    />
                  </EField>
                  <View style={styles.editBtns}>
                    <Pressable style={styles.cancelBtn} onPress={() => setEditingTx(null)}>
                      <Text style={styles.cancelTxt}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.saveBtn} onPress={handleEditSave}>
                      <LinearGradient colors={[Colors.primary, Colors.primaryDim]} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.saveTxt}>Save Changes</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sub-pickers inside edit modal */}
      <Modal visible={showCatPicker} transparent animationType="slide" onRequestClose={() => setShowCatPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCatPicker(false)}>
          <View style={styles.editSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.editTitle}>Category</Text>
            {CATEGORIES.map(cat => {
              const c = Colors.categories[cat];
              return (
                <Pressable
                  key={cat}
                  style={[styles.pickerItem, editCat === cat && { backgroundColor: c.bg, borderColor: c.border }]}
                  onPress={() => { setEditCat(cat); setEditType(CATEGORY_TYPE_MAP[cat]); setShowCatPicker(false); }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: c.dot }]} />
                  <Text style={[styles.pickerTxt, { flex: 1 }]}>{cat}</Text>
                  {editCat === cat && <MaterialIcons name="check-circle" size={17} color={c.dot} />}
                </Pressable>
              );
            })}
            <View style={{ height: 16 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showPayPicker} transparent animationType="slide" onRequestClose={() => setShowPayPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPayPicker(false)}>
          <View style={styles.editSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.editTitle}>Payment Mode</Text>
            {PAYMENT_MODES.map(mode => {
              const color = Colors.paymentModes[mode];
              return (
                <Pressable
                  key={mode}
                  style={[styles.pickerItem, editPayment === mode && { backgroundColor: color + '22', borderColor: color + '55' }]}
                  onPress={() => { setEditPayment(mode); setShowPayPicker(false); }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: color }]} />
                  <Text style={[styles.pickerTxt, { flex: 1 }]}>{mode}</Text>
                  {editPayment === mode && <MaterialIcons name="check-circle" size={17} color={color} />}
                </Pressable>
              );
            })}
            <View style={{ height: 16 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort picker */}
      <Modal visible={showSortPicker} transparent animationType="slide" onRequestClose={() => setShowSortPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortPicker(false)}>
          <View style={styles.editSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.editTitle}>Sort By</Text>
            {SORT_OPTIONS.map(s => (
              <Pressable
                key={s.key}
                style={[
                  styles.pickerItem,
                  sort === s.key && { backgroundColor: Colors.primaryDim + '33', borderColor: Colors.primaryLight + '55' },
                ]}
                onPress={() => { setSort(s.key); setShowSortPicker(false); }}
              >
                <MaterialIcons name={s.icon as any} size={18} color={sort === s.key ? Colors.primaryLight : Colors.textMuted} />
                <Text style={[styles.pickerTxt, { flex: 1, color: sort === s.key ? Colors.primaryLight : Colors.textPrimary }]}>
                  {s.label}
                </Text>
                {sort === s.key && <MaterialIcons name="check-circle" size={17} color={Colors.primaryLight} />}
              </Pressable>
            ))}
            <View style={{ height: 16 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </View>
  );
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.eLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  countLbl: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentDim + '44',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  exportTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accentLight },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  searchInput: { flex: 1, fontSize: FontSize.body, color: Colors.textPrimary },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: Spacing.md,
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 7,
    alignItems: 'center',
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim + '33',
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    flexShrink: 0,
  },
  sortBtnTxt: { fontSize: FontSize.xs, color: Colors.accentLight, fontWeight: FontWeight.bold },

  monthScroll: { marginBottom: Spacing.xs },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthChipTxt: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold },

  listContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingTop: 4 },

  // Transaction card
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  txAccent: { width: 3, flexShrink: 0 },
  txMain: { flex: 1, padding: 11, gap: 8 },
  txTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  txIconInner: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  txIconDot: { width: 10, height: 10, borderRadius: 5 },
  txDesc: { flex: 1 },
  txDescTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  txDateTxt: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  txAmtCol: { alignItems: 'flex-end', gap: 4 },
  txAmt: { fontSize: FontSize.md, fontWeight: FontWeight.heavy, color: Colors.dangerLight },
  modeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  modeChipTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  txBotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txTags: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  txActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 27,
    height: 27,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteBtn: { borderColor: Colors.danger + '44' },
  txNotes: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptyText: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: Colors.surfaceElt,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.md,
    paddingBottom: 48,
    maxHeight: '92%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderMid,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.borderMid, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  editTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary, marginBottom: Spacing.sm },
  editForm: { gap: Spacing.md, paddingBottom: Spacing.md },
  eLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  eInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  eDrop: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  eDropTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  payDot: { width: 10, height: 10, borderRadius: 5 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  typeDot: { width: 7, height: 7, borderRadius: 3.5 },
  typeTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  editBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelTxt: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: Radius.md, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: '#fff' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 2,
  },
  pickerDot: { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  pickerTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
});
