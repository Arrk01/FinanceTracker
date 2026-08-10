import React, { useState, useCallback, useMemo } from 'react';
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
  AccountType,
  dateToString,
  formatINR,
  autoCategorise,
  isLikelySubscription,
} from '@/constants/config';
import { useTransactions } from '@/hooks/useTransactions';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { useAlert } from '@/template';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { AccountSource } from '@/services/reconciliationService';
import { BankAccount, CreditCard } from '@/contexts/WalletContext';

const TYPES: TransactionType[] = ['Need', 'Want', 'Saving'];
const TYPE_ICONS: Record<string, string> = {
  Need: 'flash-on', Want: 'star', Saving: 'savings',
};
const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

type AddMode = 'expense' | 'transfer' | 'cardpayment';

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { addTransaction } = useTransactions();
  const { accounts, cards } = useWallet();
  const { toasts, showToast, removeToast } = useToast();
  const { showAlert } = useAlert();

  const today = dateToString(new Date());

  // ── Mode ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AddMode>('expense');

  // ── Common expense fields ─────────────────────────────────────────────
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Life Infrastructure');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [type, setType] = useState<TransactionType>('Need');
  const [notes, setNotes] = useState('');
  const [typeManuallySet, setTypeManuallySet] = useState(false);

  // ── Account source selector ───────────────────────────────────────────
  const [selectedAccountSource, setSelectedAccountSource] = useState<AccountSource>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // ── Transfer fields ───────────────────────────────────────────────────
  const [transferFromId, setTransferFromId] = useState<string>('');
  const [transferToId, setTransferToId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState('');
  const [showTransferFromPicker, setShowTransferFromPicker] = useState(false);
  const [showTransferToPicker, setShowTransferToPicker] = useState(false);

  // ── Card payment fields ───────────────────────────────────────────────
  const [cpBankId, setCpBankId] = useState<string>('');
  const [cpCardId, setCpCardId] = useState<string>('');
  const [cpAmount, setCpAmount] = useState('');
  const [showCpBankPicker, setShowCpBankPicker] = useState(false);
  const [showCpCardPicker, setShowCpCardPicker] = useState(false);

  // ── Pickers ───────────────────────────────────────────────────────────
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Auto-categorise ───────────────────────────────────────────────────
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

  // ── Account source label ──────────────────────────────────────────────
  const accountSourceLabel = useMemo(() => {
    if (!selectedAccountSource) return 'Select account / card';
    if (selectedAccountSource.type === 'cash') return 'Cash (no balance tracking)';
    if (selectedAccountSource.type === 'bank') {
      const acc = accounts.find(a => a.id === selectedAccountSource.id);
      return acc ? `${acc.accountName} · ${formatINR(acc.balance)}` : 'Bank Account';
    }
    if (selectedAccountSource.type === 'card') {
      const card = cards.find(c => c.id === selectedAccountSource.id);
      return card
        ? `${card.cardName} · ${formatINR(card.creditLimit - card.outstanding)} avail`
        : 'Credit Card';
    }
    return 'Select account';
  }, [selectedAccountSource, accounts, cards]);

  const accountSourceColor = useMemo(() => {
    if (!selectedAccountSource) return Colors.textMuted;
    if (selectedAccountSource.type === 'bank') {
      return accounts.find(a => a.id === selectedAccountSource.id)?.color ?? Colors.primaryLight;
    }
    if (selectedAccountSource.type === 'card') {
      return cards.find(c => c.id === selectedAccountSource.id)?.color ?? Colors.dangerLight;
    }
    return Colors.textSecondary;
  }, [selectedAccountSource, accounts, cards]);

  // ── Balance preview for expense ───────────────────────────────────────
  const balancePreview = useMemo(() => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !selectedAccountSource) return null;
    if (selectedAccountSource.type === 'bank') {
      const acc = accounts.find(a => a.id === selectedAccountSource.id);
      if (!acc) return null;
      return {
        label: acc.accountName,
        before: acc.balance,
        after: acc.balance - amt,
        color: acc.color,
        isLow: acc.balance - amt < 0,
      };
    }
    if (selectedAccountSource.type === 'card') {
      const card = cards.find(c => c.id === selectedAccountSource.id);
      if (!card) return null;
      const available = card.creditLimit - card.outstanding;
      return {
        label: `${card.cardName} Outstanding`,
        before: card.outstanding,
        after: card.outstanding + amt,
        color: card.color,
        isLow: card.outstanding + amt > card.creditLimit,
      };
    }
    return null;
  }, [amount, selectedAccountSource, accounts, cards]);

  // ── Transfer preview ──────────────────────────────────────────────────
  const transferFrom = useMemo(() => accounts.find(a => a.id === transferFromId), [accounts, transferFromId]);
  const transferTo = useMemo(() => accounts.find(a => a.id === transferToId), [accounts, transferToId]);

  // ── Card payment preview ──────────────────────────────────────────────
  const cpBank = useMemo(() => accounts.find(a => a.id === cpBankId), [accounts, cpBankId]);
  const cpCard = useMemo(() => cards.find(c => c.id === cpCardId), [cards, cpCardId]);

  // ── Submit expense ────────────────────────────────────────────────────
  const handleSubmitExpense = useCallback(async () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc) { showToast('Please enter a description', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    if (amt > 10000000) { showToast('Amount seems unusually large — please verify', 'warning'); return; }

    // Warn on insufficient balance but don't block (allow overdraft)
    if (balancePreview?.isLow && selectedAccountSource?.type === 'bank') {
      await new Promise<void>(resolve =>
        showAlert(
          'Low Balance Warning',
          `${balancePreview.label} will go below zero.\n\nBalance: ${formatINR(balancePreview.before)}\nExpense: ${formatINR(amt)}\n\nProceed anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
            { text: 'Proceed', onPress: () => resolve() },
          ],
        ),
      );
    }

    setIsSubmitting(true);
    try {
      const accountId = selectedAccountSource && selectedAccountSource.type !== 'cash'
        ? selectedAccountSource.id : undefined;
      const accountType: AccountType | undefined = selectedAccountSource?.type !== 'cash'
        ? selectedAccountSource?.type : undefined;

      await addTransaction({
        date,
        description: trimmedDesc,
        category,
        amount: Math.round(amt * 100) / 100,
        paymentMode,
        type,
        notes: notes.trim(),
        accountId,
        accountType,
        accountSource: selectedAccountSource ?? undefined,
      });

      showToast(isLikelySubscription(trimmedDesc) ? 'Subscription logged!' : 'Expense added!', 'success');
      // Reset
      setDescription('');
      setAmount('');
      setNotes('');
      setDate(today);
      setCategory('Life Infrastructure');
      setType('Need');
      setPaymentMode('UPI');
      setTypeManuallySet(false);
      setSelectedAccountSource(null);
    } catch {
      showToast('Failed to save expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [description, amount, date, category, paymentMode, type, notes, selectedAccountSource,
    balancePreview, addTransaction, showToast, showAlert, today]);

  // ── Submit transfer ───────────────────────────────────────────────────
  const handleSubmitTransfer = useCallback(async () => {
    const amt = parseFloat(transferAmount);
    if (!transferFromId) { showToast('Select source account', 'error'); return; }
    if (!transferToId) { showToast('Select destination account', 'error'); return; }
    if (transferFromId === transferToId) { showToast('Source and destination cannot be the same', 'error'); return; }
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid transfer amount', 'error'); return; }

    setIsSubmitting(true);
    try {
      await addTransaction({
        date: today,
        description: `Transfer: ${transferFrom?.accountName ?? ''} → ${transferTo?.accountName ?? ''}`,
        category: 'Future Me',
        amount: Math.round(amt * 100) / 100,
        paymentMode: 'Bank Transfer',
        type: 'Transfer',
        notes: '',
        accountId: transferFromId,
        accountType: 'bank',
        toAccountId: transferToId,
        toAccountType: 'bank',
      });

      showToast(`Transferred ${formatINR(amt)}`, 'success');
      setTransferAmount('');
      setTransferFromId('');
      setTransferToId('');
    } catch {
      showToast('Transfer failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [transferFromId, transferToId, transferAmount, transferFrom, transferTo, addTransaction, showToast, today]);

  // ── Submit card payment ───────────────────────────────────────────────
  const handleSubmitCardPayment = useCallback(async () => {
    const amt = parseFloat(cpAmount);
    if (!cpBankId) { showToast('Select bank account', 'error'); return; }
    if (!cpCardId) { showToast('Select credit card', 'error'); return; }
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid payment amount', 'error'); return; }

    setIsSubmitting(true);
    try {
      await addTransaction({
        date: today,
        description: `Card Payment: ${cpCard?.cardName ?? ''} from ${cpBank?.accountName ?? ''}`,
        category: 'Life Infrastructure',
        amount: Math.round(amt * 100) / 100,
        paymentMode: 'Bank Transfer',
        type: 'CardPayment',
        notes: '',
        accountId: cpBankId,
        accountType: 'bank',
        toAccountId: cpCardId,
        toAccountType: 'card',
      });

      showToast(`Card payment of ${formatINR(amt)} recorded`, 'success');
      setCpAmount('');
      setCpBankId('');
      setCpCardId('');
    } catch {
      showToast('Card payment failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [cpBankId, cpCardId, cpAmount, cpBank, cpCard, addTransaction, showToast, today]);

  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Add Entry</Text>
          <Text style={styles.pageSub}>Track every rupee</Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.modeTabs}>
          {([
            { key: 'expense', label: 'Expense', icon: 'shopping-cart' },
            { key: 'transfer', label: 'Transfer', icon: 'swap-horiz' },
            { key: 'cardpayment', label: 'Card Pay', icon: 'credit-card' },
          ] as { key: AddMode; label: string; icon: string }[]).map(m => (
            <Pressable
              key={m.key}
              style={[styles.modeTab, mode === m.key && styles.modeTabActive]}
              onPress={() => setMode(m.key)}
            >
              <MaterialIcons name={m.icon as any} size={14} color={mode === m.key ? '#000' : Colors.textMuted} />
              <Text style={[styles.modeTabTxt, mode === m.key && styles.modeTabTxtActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─── EXPENSE MODE ─── */}
        {mode === 'expense' && (
          <>
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
              {amtValid && <Text style={styles.amountFormatted}>{formatINR(amtNum)}</Text>}
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

            {/* Balance preview */}
            {balancePreview && (
              <View style={[styles.balancePreview, {
                borderColor: balancePreview.isLow ? Colors.danger + '66' : Colors.success + '44',
                backgroundColor: balancePreview.isLow ? Colors.dangerDim + '33' : Colors.successDim + '22',
              }]}>
                <MaterialIcons
                  name={balancePreview.isLow ? 'warning' : 'account-balance'}
                  size={13}
                  color={balancePreview.isLow ? Colors.dangerLight : Colors.successLight}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewLabel, { color: balancePreview.color }]}>
                    {balancePreview.label}
                  </Text>
                  <Text style={styles.previewRow}>
                    <Text style={styles.previewBefore}>{formatINR(balancePreview.before)}</Text>
                    <Text style={styles.previewArrow}> → </Text>
                    <Text style={[styles.previewAfter, { color: balancePreview.isLow ? Colors.dangerLight : Colors.successLight }]}>
                      {formatINR(balancePreview.after)}
                    </Text>
                  </Text>
                </View>
                {balancePreview.isLow && (
                  <View style={styles.insuffBadge}>
                    <Text style={styles.insuffTxt}>LOW</Text>
                  </View>
                )}
              </View>
            )}

            {/* Form */}
            <View style={styles.formSection}>
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

              <FormField label="Date" icon="calendar-today">
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="DD Mon YYYY"
                  placeholderTextColor={Colors.textMuted}
                />
              </FormField>

              <FormField label="Category" icon="label">
                <Pressable
                  style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.8 }]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <CategoryBadge category={category} />
                  <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
                </Pressable>
              </FormField>

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

              {/* PAID FROM — account/card selector */}
              <FormField label="Paid From" icon="account-balance-wallet">
                <Pressable
                  style={({ pressed }) => [
                    styles.dropdown,
                    { borderColor: selectedAccountSource ? accountSourceColor + '66' : Colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setShowAccountPicker(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.accountDot, { backgroundColor: selectedAccountSource ? accountSourceColor : Colors.textDim }]} />
                    <Text style={[styles.dropTxt, { color: selectedAccountSource ? Colors.textPrimary : Colors.textMuted }]}>
                      {accountSourceLabel}
                    </Text>
                  </View>
                  <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
                </Pressable>
              </FormField>

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

            <Pressable
              style={({ pressed }) => [
                styles.submitWrap,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                isSubmitting && { opacity: 0.6 },
              ]}
              onPress={handleSubmitExpense}
              disabled={isSubmitting}
            >
              <LinearGradient colors={[Colors.accent, Colors.accentDim + 'FF']} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="add-circle-outline" size={22} color="#000" />
                <Text style={styles.submitTxt}>{isSubmitting ? 'Saving...' : 'Add Expense'}</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}

        {/* ─── TRANSFER MODE ─── */}
        {mode === 'transfer' && (
          <View style={styles.formSection}>
            <View style={styles.transferHero}>
              <MaterialIcons name="swap-horiz" size={28} color={Colors.accentLight} />
              <Text style={styles.transferTitle}>Move Money Between Accounts</Text>
              <Text style={styles.transferSub}>This will NOT count as an expense in analytics</Text>
            </View>

            <FormField label="From Account" icon="account-balance">
              <Pressable style={styles.dropdown} onPress={() => setShowTransferFromPicker(true)}>
                {transferFrom ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.accountDot, { backgroundColor: transferFrom.color }]} />
                    <View>
                      <Text style={styles.dropTxt}>{transferFrom.accountName}</Text>
                      <Text style={[styles.dropSub, { color: transferFrom.color }]}>{formatINR(transferFrom.balance)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.dropTxt, { color: Colors.textMuted }]}>Select source account</Text>
                )}
                <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
              </Pressable>
            </FormField>

            <FormField label="To Account" icon="account-balance">
              <Pressable style={styles.dropdown} onPress={() => setShowTransferToPicker(true)}>
                {transferTo ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.accountDot, { backgroundColor: transferTo.color }]} />
                    <View>
                      <Text style={styles.dropTxt}>{transferTo.accountName}</Text>
                      <Text style={[styles.dropSub, { color: transferTo.color }]}>{formatINR(transferTo.balance)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.dropTxt, { color: Colors.textMuted }]}>Select destination account</Text>
                )}
                <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
              </Pressable>
            </FormField>

            <FormField label="Amount (₹)" icon="attach-money">
              <TextInput
                style={styles.input}
                value={transferAmount}
                onChangeText={setTransferAmount}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </FormField>

            {/* Preview */}
            {transferFrom && transferTo && parseFloat(transferAmount) > 0 && (
              <View style={styles.transferPreview}>
                <View style={styles.transferPreviewRow}>
                  <View style={[styles.accountDot, { backgroundColor: transferFrom.color }]} />
                  <Text style={styles.transferPreviewName}>{transferFrom.accountName}</Text>
                  <Text style={[styles.transferPreviewAmt, { color: Colors.dangerLight }]}>
                    {formatINR(transferFrom.balance)} → {formatINR(Math.max(0, transferFrom.balance - parseFloat(transferAmount)))}
                  </Text>
                </View>
                <MaterialIcons name="arrow-downward" size={16} color={Colors.textMuted} style={{ alignSelf: 'center', marginVertical: 2 }} />
                <View style={styles.transferPreviewRow}>
                  <View style={[styles.accountDot, { backgroundColor: transferTo.color }]} />
                  <Text style={styles.transferPreviewName}>{transferTo.accountName}</Text>
                  <Text style={[styles.transferPreviewAmt, { color: Colors.successLight }]}>
                    {formatINR(transferTo.balance)} → {formatINR(transferTo.balance + parseFloat(transferAmount))}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitWrap, pressed && { opacity: 0.85 }, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmitTransfer}
              disabled={isSubmitting}
            >
              <LinearGradient colors={[Colors.accent, Colors.accentDim + 'FF']} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="swap-horiz" size={22} color="#000" />
                <Text style={styles.submitTxt}>{isSubmitting ? 'Processing...' : 'Transfer Money'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* ─── CARD PAYMENT MODE ─── */}
        {mode === 'cardpayment' && (
          <View style={styles.formSection}>
            <View style={styles.transferHero}>
              <MaterialIcons name="credit-card" size={28} color={Colors.primaryLight} />
              <Text style={styles.transferTitle}>Pay Credit Card Bill</Text>
              <Text style={styles.transferSub}>Deducts bank balance & reduces card outstanding — not counted as expense</Text>
            </View>

            <FormField label="Pay From (Bank)" icon="account-balance">
              <Pressable style={styles.dropdown} onPress={() => setShowCpBankPicker(true)}>
                {cpBank ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.accountDot, { backgroundColor: cpBank.color }]} />
                    <View>
                      <Text style={styles.dropTxt}>{cpBank.accountName}</Text>
                      <Text style={[styles.dropSub, { color: cpBank.color }]}>{formatINR(cpBank.balance)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.dropTxt, { color: Colors.textMuted }]}>Select bank account</Text>
                )}
                <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
              </Pressable>
            </FormField>

            <FormField label="Pay To (Credit Card)" icon="credit-card">
              <Pressable style={styles.dropdown} onPress={() => setShowCpCardPicker(true)}>
                {cpCard ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.accountDot, { backgroundColor: cpCard.color }]} />
                    <View>
                      <Text style={styles.dropTxt}>{cpCard.cardName} · {cpCard.bankName}</Text>
                      <Text style={[styles.dropSub, { color: Colors.dangerLight }]}>Outstanding: {formatINR(cpCard.outstanding)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.dropTxt, { color: Colors.textMuted }]}>Select credit card</Text>
                )}
                <MaterialIcons name="expand-more" size={20} color={Colors.textSecondary} />
              </Pressable>
            </FormField>

            <FormField label="Payment Amount (₹)" icon="attach-money">
              {cpCard && cpCard.outstanding > 0 && (
                <View style={styles.cpQuickRow}>
                  {[
                    { label: 'Min Due', val: Math.round(cpCard.outstanding * 0.05) },
                    { label: 'Full', val: cpCard.outstanding },
                  ].map(q => (
                    <Pressable
                      key={q.label}
                      style={styles.cpQuickChip}
                      onPress={() => setCpAmount(q.val.toString())}
                    >
                      <Text style={styles.cpQuickLbl}>{q.label}</Text>
                      <Text style={styles.cpQuickAmt}>{formatINR(q.val)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                style={styles.input}
                value={cpAmount}
                onChangeText={setCpAmount}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </FormField>

            {/* Preview */}
            {cpBank && cpCard && parseFloat(cpAmount) > 0 && (
              <View style={styles.transferPreview}>
                <View style={styles.transferPreviewRow}>
                  <View style={[styles.accountDot, { backgroundColor: cpBank.color }]} />
                  <Text style={styles.transferPreviewName}>{cpBank.accountName}</Text>
                  <Text style={[styles.transferPreviewAmt, { color: Colors.dangerLight }]}>
                    {formatINR(cpBank.balance)} → {formatINR(Math.max(0, cpBank.balance - parseFloat(cpAmount)))}
                  </Text>
                </View>
                <View style={styles.transferPreviewRow}>
                  <View style={[styles.accountDot, { backgroundColor: cpCard.color }]} />
                  <Text style={styles.transferPreviewName}>{cpCard.cardName} Outstanding</Text>
                  <Text style={[styles.transferPreviewAmt, { color: Colors.successLight }]}>
                    {formatINR(cpCard.outstanding)} → {formatINR(Math.max(0, cpCard.outstanding - parseFloat(cpAmount)))}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitWrap, pressed && { opacity: 0.85 }, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmitCardPayment}
              disabled={isSubmitting}
            >
              <LinearGradient colors={[Colors.primary, Colors.primaryDim]} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="credit-card" size={22} color="#fff" />
                <Text style={[styles.submitTxt, { color: '#fff' }]}>{isSubmitting ? 'Processing...' : 'Pay Card Bill'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ─── Account source picker ─── */}
      <Modal visible={showAccountPicker} transparent animationType="slide" onRequestClose={() => setShowAccountPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowAccountPicker(false)}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Paid From</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Cash option */}
              <Pressable
                style={[pickerStyles.item, selectedAccountSource?.type === 'cash' && pickerStyles.itemActive]}
                onPress={() => { setSelectedAccountSource({ type: 'cash' }); setShowAccountPicker(false); }}
              >
                <View style={[pickerStyles.dot, { backgroundColor: Colors.textMuted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={pickerStyles.itemName}>Cash</Text>
                  <Text style={pickerStyles.itemSub}>No balance tracking</Text>
                </View>
              </Pressable>

              {accounts.length > 0 && <Text style={pickerStyles.section}>Bank Accounts</Text>}
              {accounts.map(acc => {
                const isSelected = selectedAccountSource?.type === 'bank' && selectedAccountSource.id === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    style={[pickerStyles.item, isSelected && { backgroundColor: acc.color + '18', borderColor: acc.color + '44' }]}
                    onPress={() => { setSelectedAccountSource({ type: 'bank', id: acc.id }); setShowAccountPicker(false); }}
                  >
                    <View style={[pickerStyles.dot, { backgroundColor: acc.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[pickerStyles.itemName, isSelected && { color: acc.color }]}>{acc.accountName}</Text>
                      <Text style={pickerStyles.itemSub}>{acc.bankName} · {formatINR(acc.balance)}</Text>
                    </View>
                    {isSelected && <MaterialIcons name="check-circle" size={16} color={acc.color} />}
                  </Pressable>
                );
              })}

              {cards.length > 0 && <Text style={pickerStyles.section}>Credit Cards</Text>}
              {cards.map(card => {
                const available = card.creditLimit - card.outstanding;
                const isSelected = selectedAccountSource?.type === 'card' && selectedAccountSource.id === card.id;
                return (
                  <Pressable
                    key={card.id}
                    style={[pickerStyles.item, isSelected && { backgroundColor: card.color + '18', borderColor: card.color + '44' }]}
                    onPress={() => { setSelectedAccountSource({ type: 'card', id: card.id }); setShowAccountPicker(false); }}
                  >
                    <View style={[pickerStyles.dot, { backgroundColor: card.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[pickerStyles.itemName, isSelected && { color: card.color }]}>{card.cardName}</Text>
                      <Text style={pickerStyles.itemSub}>{card.bankName} · Avail: {formatINR(available)}</Text>
                    </View>
                    {isSelected && <MaterialIcons name="check-circle" size={16} color={card.color} />}
                  </Pressable>
                );
              })}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Picker */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Select Category</Text>
            {CATEGORIES.map(cat => {
              const c = Colors.categories[cat];
              return (
                <Pressable
                  key={cat}
                  style={({ pressed }) => [styles.pickerItem, category === cat && { backgroundColor: c.bg, borderColor: c.border }, pressed && { opacity: 0.8 }]}
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
            <View style={{ height: 16 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Mode Picker */}
      <Modal visible={showPaymentPicker} transparent animationType="slide" onRequestClose={() => setShowPaymentPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowPaymentPicker(false)}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Payment Mode</Text>
            {PAYMENT_MODES.map(mode => {
              const color = Colors.paymentModes[mode];
              return (
                <Pressable
                  key={mode}
                  style={[styles.pickerItem, paymentMode === mode && { backgroundColor: color + '22', borderColor: color + '55' }]}
                  onPress={() => { setPaymentMode(mode); setShowPaymentPicker(false); }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: color }]} />
                  <Text style={[styles.pickerItemTxt, { flex: 1 }]}>{mode}</Text>
                  {paymentMode === mode && <MaterialIcons name="check-circle" size={18} color={color} />}
                </Pressable>
              );
            })}
            <View style={{ height: 16 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transfer From Picker */}
      <AccountListModal
        visible={showTransferFromPicker}
        title="Transfer From"
        accounts={accounts}
        selectedId={transferFromId}
        onSelect={id => { setTransferFromId(id); setShowTransferFromPicker(false); }}
        onClose={() => setShowTransferFromPicker(false)}
      />

      {/* Transfer To Picker */}
      <AccountListModal
        visible={showTransferToPicker}
        title="Transfer To"
        accounts={accounts}
        selectedId={transferToId}
        onSelect={id => { setTransferToId(id); setShowTransferToPicker(false); }}
        onClose={() => setShowTransferToPicker(false)}
      />

      {/* Card Payment — Bank Picker */}
      <AccountListModal
        visible={showCpBankPicker}
        title="Pay From (Bank)"
        accounts={accounts}
        selectedId={cpBankId}
        onSelect={id => { setCpBankId(id); setShowCpBankPicker(false); }}
        onClose={() => setShowCpBankPicker(false)}
      />

      {/* Card Payment — Card Picker */}
      <Modal visible={showCpCardPicker} transparent animationType="slide" onRequestClose={() => setShowCpCardPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowCpCardPicker(false)}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Pay To (Credit Card)</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {cards.map(card => {
                const isSelected = card.id === cpCardId;
                return (
                  <Pressable
                    key={card.id}
                    style={[pickerStyles.item, isSelected && { backgroundColor: card.color + '18', borderColor: card.color + '44' }]}
                    onPress={() => { setCpCardId(card.id); setShowCpCardPicker(false); }}
                  >
                    <View style={[pickerStyles.dot, { backgroundColor: card.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[pickerStyles.itemName, isSelected && { color: card.color }]}>{card.cardName}</Text>
                      <Text style={pickerStyles.itemSub}>{card.bankName} · Outstanding: {formatINR(card.outstanding)}</Text>
                    </View>
                    {isSelected && <MaterialIcons name="check-circle" size={16} color={card.color} />}
                  </Pressable>
                );
              })}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </KeyboardAvoidingView>
  );
}

// ─── Account List Modal (reusable for transfer pickers) ─────────────────────
function AccountListModal({
  visible, title, accounts, selectedId, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  accounts: BankAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {accounts.map(acc => {
              const isSelected = acc.id === selectedId;
              return (
                <Pressable
                  key={acc.id}
                  style={[pickerStyles.item, isSelected && { backgroundColor: acc.color + '18', borderColor: acc.color + '44' }]}
                  onPress={() => onSelect(acc.id)}
                >
                  <View style={[pickerStyles.dot, { backgroundColor: acc.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[pickerStyles.itemName, isSelected && { color: acc.color }]}>{acc.accountName}</Text>
                    <Text style={pickerStyles.itemSub}>{acc.bankName} · {formatINR(acc.balance)}</Text>
                  </View>
                  {isSelected && <MaterialIcons name="check-circle" size={16} color={acc.color} />}
                </Pressable>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
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

const fieldStyles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceElt,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.md,
    paddingBottom: 48,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.borderMid,
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.borderMid, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary, marginBottom: 8 },
  section: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  item: {
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
  itemActive: {
    backgroundColor: Colors.primaryDim + '33',
    borderColor: Colors.primaryLight + '44',
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  itemName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: {},
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  pageSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  modeTabActive: { backgroundColor: Colors.accentLight },
  modeTabTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted },
  modeTabTxtActive: { color: '#000' },

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

  // Balance preview
  balancePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  previewLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  previewBefore: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  previewArrow: { fontSize: FontSize.sm, color: Colors.textMuted },
  previewAfter: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  insuffBadge: {
    backgroundColor: Colors.dangerDim,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  insuffTxt: { fontSize: FontSize.xs, color: Colors.dangerLight, fontWeight: FontWeight.heavy },

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
  dropSub: { fontSize: FontSize.xs, marginTop: 1 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payDot: { width: 10, height: 10, borderRadius: 5 },
  accountDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

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
  submitBtn: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: '#000' },

  // Transfer mode
  transferHero: { alignItems: 'center', paddingVertical: Spacing.sm, gap: 6 },
  transferTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  transferSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  transferPreview: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transferPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferPreviewName: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  transferPreviewAmt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Card payment
  cpQuickRow: { flexDirection: 'row', gap: 8 },
  cpQuickChip: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cpQuickLbl: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  cpQuickAmt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.heavy, marginTop: 2 },

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
