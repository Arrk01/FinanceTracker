import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import {
  CATEGORIES,
  PAYMENT_MODES,
  CATEGORY_TYPE_MAP,
  Category,
  PaymentMode,
  TransactionType,
  dateToString,
  formatINR,
  autoCategorise,
  isLikelySubscription,
} from '@/constants/config';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CategoryBadge } from '@/components/ui/CategoryBadge';

const TYPES: TransactionType[] = ['Need', 'Want', 'Saving'];

const TYPE_ICONS: Record<TransactionType, string> = {
  Need: 'flash-on',
  Want: 'star',
  Saving: 'savings',
};

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { addTransaction } = useTransactions();
  const { toasts, showToast, removeToast } = useToast();

  const today = dateToString(new Date());

  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Life Infrastructure');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [type, setType] = useState<TransactionType>('Need');
  const [notes, setNotes] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typeManuallySet, setTypeManuallySet] = useState(false);

  // ── Auto-categorise on description blur ───────────────────────────────
  const handleDescriptionBlur = useCallback(() => {
    if (!description.trim()) return;
    const suggested = autoCategorise(description);
    if (suggested && suggested !== category) {
      setCategory(suggested);
      if (!typeManuallySet) setType(CATEGORY_TYPE_MAP[suggested]);
    }
  }, [description, category, typeManuallySet]);

  const handleCategorySelect = useCallback((cat: Category) => {
    setCategory(cat);
    if (!typeManuallySet) setType(CATEGORY_TYPE_MAP[cat]);
    setShowCategoryPicker(false);
  }, [typeManuallySet]);

  const handleTypeSelect = useCallback((t: TransactionType) => {
    setType(t);
    setTypeManuallySet(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      showToast('Please enter a description', 'error');
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (amt > 10000000) {
      showToast('Amount seems unusually large — please verify', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction({
        date,
        description: trimmedDesc,
        category,
        amount: Math.round(amt * 100) / 100, // 2dp precision
        paymentMode,
        type,
        notes: notes.trim(),
      });

      const isSubscription = isLikelySubscription(trimmedDesc);
      showToast(
        isSubscription ? 'Subscription logged!' : 'Expense added!',
        'success',
      );

      // Reset form
      setDescription('');
      setAmount('');
      setNotes('');
      setDate(today);
      setCategory('Life Infrastructure');
      setType('Need');
      setPaymentMode('UPI');
      setTypeManuallySet(false);
    } catch {
      showToast('Failed to save expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [description, amount, date, category, paymentMode, type, notes, addTransaction, showToast, today]);

  const catColors = Colors.categories[category];
  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Add Expense</Text>
          <Text style={styles.pageSub}>Every rupee tracked</Text>
        </View>

        {/* Amount spotlight */}
        <LinearGradient colors={['#0D1F38', '#111827']} style={styles.amountCard}>
          <Text style={styles.amountLabel}>AMOUNT (₹)</Text>
          <View style={styles.amountInputRow}>
            <Text style={[styles.rupeeSign, amtValid && { color: Colors.accentLight }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, amtValid && { color: Colors.accentLight }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={Colors.textDim}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          {amtValid && (
            <Text style={styles.amountFormatted}>{formatINR(amtNum)}</Text>
          )}

          {/* Quick amount chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map(q => (
                <Pressable
                  key={q}
                  style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                  onPress={() => setAmount(q.toString())}
                >
                  <Text style={styles.quickTxt}>₹{q >= 1000 ? `${q / 1000}k` : q}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </LinearGradient>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Description */}
          <FormField label="Description" icon="edit">
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              onBlur={handleDescriptionBlur}
              placeholder="What did you spend on?"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
            />
          </FormField>

          {/* Date */}
          <FormField label="Date" icon="calendar-today">
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="DD Mon YYYY"
              placeholderTextColor={Colors.textMuted}
            />
          </FormField>

          {/* Category */}
          <FormField label="Category" icon="label">
            <Pressable
              style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.8 }]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <CategoryBadge category={category} />
              <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
            </Pressable>
          </FormField>

          {/* Payment Mode */}
          <FormField label="Payment Mode" icon="payment">
            <Pressable
              style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.8 }]}
              onPress={() => setShowPaymentPicker(true)}
            >
              <View style={styles.payRow}>
                <View style={[styles.payDot, { backgroundColor: Colors.paymentModes[paymentMode] }]} />
                <Text style={styles.dropTxt}>{paymentMode}</Text>
              </View>
              <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
            </Pressable>
          </FormField>

          {/* Type selector */}
          <FormField label="Type" icon="tune">
            <View style={styles.typeRow}>
              {TYPES.map(t => {
                const isActive = type === t;
                const tc = Colors.types[t];
                return (
                  <Pressable
                    key={t}
                    style={({ pressed }) => [
                      styles.typeBtn,
                      isActive && { backgroundColor: tc.bg, borderColor: tc.border },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => handleTypeSelect(t)}
                  >
                    <MaterialIcons name={TYPE_ICONS[t] as any} size={13} color={isActive ? tc.text : Colors.textMuted} />
                    <Text style={[styles.typeTxt, isActive && { color: tc.text }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.typeHint}>
              {typeManuallySet ? 'Manually set' : 'Auto-set by category · tap to override'}
            </Text>
          </FormField>

          {/* Notes */}
          <FormField label="Notes (Optional)" icon="notes">
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any extra context..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </FormField>
        </View>

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.submitWrap,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            isSubmitting && { opacity: 0.6 },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={[Colors.accent, Colors.accentDim + 'FF']}
            style={styles.submitBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialIcons name="add-circle-outline" size={22} color="#000" />
            <Text style={styles.submitTxt}>
              {isSubmitting ? 'Saving...' : 'Add Expense'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>

      {/* Category Picker */}
      <PickerModal
        visible={showCategoryPicker}
        title="Select Category"
        onClose={() => setShowCategoryPicker(false)}
      >
        {CATEGORIES.map(cat => {
          const c = Colors.categories[cat];
          return (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                styles.pickerItem,
                category === cat && { backgroundColor: c.bg, borderColor: c.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => handleCategorySelect(cat)}
            >
              <View style={[styles.pickerDot, { backgroundColor: c.dot }]} />
              <View style={styles.pickerInfo}>
                <Text style={[styles.pickerItemTxt, category === cat && { color: c.text }]}>{cat}</Text>
                <Text style={styles.pickerItemSub}>→ {CATEGORY_TYPE_MAP[cat]}</Text>
              </View>
              {category === cat && <MaterialIcons name="check-circle" size={18} color={c.dot} />}
            </Pressable>
          );
        })}
      </PickerModal>

      {/* Payment Picker */}
      <PickerModal
        visible={showPaymentPicker}
        title="Payment Mode"
        onClose={() => setShowPaymentPicker(false)}
      >
        {PAYMENT_MODES.map(mode => {
          const color = Colors.paymentModes[mode];
          return (
            <Pressable
              key={mode}
              style={({ pressed }) => [
                styles.pickerItem,
                paymentMode === mode && { backgroundColor: color + '22', borderColor: color + '55' },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => { setPaymentMode(mode); setShowPaymentPicker(false); }}
            >
              <View style={[styles.pickerDot, { backgroundColor: color }]} />
              <Text style={[styles.pickerItemTxt, { flex: 1 }]}>{mode}</Text>
              {paymentMode === mode && <MaterialIcons name="check-circle" size={18} color={color} />}
            </Pressable>
          );
        })}
      </PickerModal>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </KeyboardAvoidingView>
  );
}

function FormField({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        <MaterialIcons name={icon as any} size={12} color={Colors.textMuted} />
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function PickerModal({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>{title}</Text>
          {children}
          <View style={{ height: 16 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceElt,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderMid,
    maxHeight: '80%',
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.borderMid, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: {},
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  pageSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  amountCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  amountLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, letterSpacing: 2 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rupeeSign: { fontSize: FontSize.display, fontWeight: FontWeight.heavy, color: Colors.textSecondary },
  amountInput: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -1,
  },
  amountFormatted: { fontSize: FontSize.sm, color: Colors.accentLight, fontWeight: FontWeight.semibold },
  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  quickChip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },

  formSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  notesInput: { height: 72, paddingTop: 12 },
  dropdown: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dropTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payDot: { width: 10, height: 10, borderRadius: 5 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  typeTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  typeHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  submitWrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  submitBtn: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: '#000' },

  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerDot: { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  pickerInfo: { flex: 1 },
  pickerItemTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  pickerItemSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
