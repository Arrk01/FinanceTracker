import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import { formatINR, parseDate, formatDateDisplay } from '@/constants/config';
import { useWallet } from '@/hooks/useWallet';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/useToast';
import { useAlert } from '@/template';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { BankAccount, CreditCard, ACCOUNT_COLORS_LIST, CARD_COLORS_LIST } from '@/contexts/WalletContext';

type Tab = 'accounts' | 'cards';
type DetailView = { type: 'account'; id: string } | { type: 'card'; id: string } | null;

const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary'] as const;
const BANK_NAMES = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank', 'IDFC FIRST Bank', 'AU Bank', 'Yes Bank', 'IndusInd Bank', 'PNB', 'Other'];
const CARD_BANKS = ['HDFC Bank', 'ICICI Bank', 'SBI', 'SBI Card', 'Axis Bank', 'Kotak Bank', 'AU Bank', 'IDFC FIRST Bank', 'IndusInd Bank', 'American Express', 'Other'];

const BLANK_ACCOUNT = {
  accountName: '', bankName: 'HDFC Bank', accountType: 'Savings' as const,
  balance: '', color: ACCOUNT_COLORS_LIST[0], icon: 'account-balance',
};
const BLANK_CARD = {
  cardName: '', bankName: 'HDFC Bank', creditLimit: '', outstanding: '', dueDate: '', color: CARD_COLORS_LIST[0],
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, cards, isLoading, addAccount, updateAccount, deleteAccount, addCard, updateCard, deleteCard } = useWallet();
  const { transactions } = useTransactions();
  const { toasts, showToast, removeToast } = useToast();
  const { showAlert } = useAlert();

  const [tab, setTab] = useState<Tab>('accounts');
  const [detailView, setDetailView] = useState<DetailView>(null);

  // ── Account modal ─────────────────────────────────────────────────────
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accForm, setAccForm] = useState(BLANK_ACCOUNT);
  const [showAccBankPicker, setShowAccBankPicker] = useState(false);

  // ── Card modal ────────────────────────────────────────────────────────
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardForm, setCardForm] = useState(BLANK_CARD);
  const [showCardBankPicker, setShowCardBankPicker] = useState(false);

  // ── Totals ────────────────────────────────────────────────────────────
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);
  const totalOutstanding = useMemo(() => cards.reduce((s, c) => s + c.outstanding, 0), [cards]);
  const totalCreditLimit = useMemo(() => cards.reduce((s, c) => s + c.creditLimit, 0), [cards]);
  const netWorth = totalBalance - totalOutstanding;

  // ── Per-account spending (from linked transactions) ───────────────────
  const accountStats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const stats: Record<string, { spent: number; received: number; txList: typeof transactions }> = {};

    for (const tx of transactions) {
      const d = parseDate(tx.date);
      const isThisMonth = d.getMonth() === month && d.getFullYear() === year;

      if (tx.accountId) {
        if (!stats[tx.accountId]) stats[tx.accountId] = { spent: 0, received: 0, txList: [] };
        stats[tx.accountId].txList.push(tx);
        if (isThisMonth) {
          if (tx.isIncome || tx.type === 'Transfer') {
            stats[tx.accountId].received += tx.amount;
          } else {
            stats[tx.accountId].spent += tx.amount;
          }
        }
      }

      // Also count "to" account for transfers/card payments
      if (tx.toAccountId && tx.accountType === 'bank') {
        if (!stats[tx.toAccountId]) stats[tx.toAccountId] = { spent: 0, received: 0, txList: [] };
        if (!stats[tx.toAccountId].txList.find(t => t.id === tx.id)) {
          stats[tx.toAccountId].txList.push(tx);
        }
        if (isThisMonth) {
          stats[tx.toAccountId].received += tx.amount;
        }
      }
    }

    return stats;
  }, [transactions]);

  // ── Account transaction history ───────────────────────────────────────
  const accountHistory = useMemo(() => {
    if (!detailView) return [];
    const id = detailView.id;
    return transactions
      .filter(tx => tx.accountId === id || tx.toAccountId === id)
      .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
      .slice(0, 50);
  }, [detailView, transactions]);

  // ── Account handlers ──────────────────────────────────────────────────
  const openAddAccount = useCallback(() => {
    setEditingAccount(null);
    setAccForm(BLANK_ACCOUNT);
    setShowAccountModal(true);
  }, []);

  const openEditAccount = useCallback((acc: BankAccount) => {
    setEditingAccount(acc);
    setAccForm({ accountName: acc.accountName, bankName: acc.bankName, accountType: acc.accountType, balance: acc.balance.toString(), color: acc.color, icon: acc.icon });
    setShowAccountModal(true);
  }, []);

  const handleSaveAccount = useCallback(async () => {
    if (!accForm.accountName.trim()) { showToast('Enter account name', 'error'); return; }
    const bal = parseFloat(accForm.balance);
    if (isNaN(bal) || bal < 0) { showToast('Enter a valid balance', 'error'); return; }
    const data = { accountName: accForm.accountName.trim(), bankName: accForm.bankName, accountType: accForm.accountType, balance: bal, color: accForm.color, icon: 'account-balance' };
    if (editingAccount) { await updateAccount(editingAccount.id, data); showToast('Account updated', 'success'); }
    else { await addAccount(data); showToast('Account added', 'success'); }
    setShowAccountModal(false);
  }, [accForm, editingAccount, addAccount, updateAccount, showToast]);

  const handleDeleteAccount = useCallback((acc: BankAccount) => {
    showAlert('Delete Account?', `"${acc.accountName}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAccount(acc.id); showToast('Account removed', 'info'); } },
    ]);
  }, [deleteAccount, showAlert, showToast]);

  // ── Card handlers ─────────────────────────────────────────────────────
  const openAddCard = useCallback(() => {
    setEditingCard(null);
    setCardForm(BLANK_CARD);
    setShowCardModal(true);
  }, []);

  const openEditCard = useCallback((card: CreditCard) => {
    setEditingCard(card);
    setCardForm({ cardName: card.cardName, bankName: card.bankName, creditLimit: card.creditLimit.toString(), outstanding: card.outstanding.toString(), dueDate: card.dueDate, color: card.color });
    setShowCardModal(true);
  }, []);

  const handleSaveCard = useCallback(async () => {
    if (!cardForm.cardName.trim()) { showToast('Enter card name', 'error'); return; }
    const limit = parseFloat(cardForm.creditLimit);
    const outstanding = parseFloat(cardForm.outstanding || '0');
    if (isNaN(limit) || limit <= 0) { showToast('Enter a valid credit limit', 'error'); return; }
    const data = { cardName: cardForm.cardName.trim(), bankName: cardForm.bankName, creditLimit: limit, outstanding: isNaN(outstanding) ? 0 : outstanding, dueDate: cardForm.dueDate.trim(), color: cardForm.color };
    if (editingCard) { await updateCard(editingCard.id, data); showToast('Card updated', 'success'); }
    else { await addCard(data); showToast('Card added', 'success'); }
    setShowCardModal(false);
  }, [cardForm, editingCard, addCard, updateCard, showToast]);

  const handleDeleteCard = useCallback((card: CreditCard) => {
    showAlert('Delete Card?', `"${card.cardName}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCard(card.id); showToast('Card removed', 'info'); } },
    ]);
  }, [deleteCard, showAlert, showToast]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  // ── Account detail view ───────────────────────────────────────────────
  if (detailView) {
    const isAccountDetail = detailView.type === 'account';
    const acc = isAccountDetail ? accounts.find(a => a.id === detailView.id) : null;
    const card = !isAccountDetail ? cards.find(c => c.id === detailView.id) : null;
    const name = acc?.accountName ?? `${card?.cardName} · ${card?.bankName}` ?? 'Account';
    const color = acc?.color ?? card?.color ?? Colors.primaryLight;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <Pressable style={styles.backBtn} onPress={() => setDetailView(null)}>
            <MaterialIcons name="arrow-back" size={20} color={Colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailTitle, { color }]}>{name}</Text>
            <Text style={styles.detailSub}>Transaction History</Text>
          </View>
        </View>

        {/* Summary card */}
        {acc && (
          <LinearGradient colors={['#0D1F38', '#111827']} style={styles.detailSummaryCard}>
            <View style={styles.detailSummaryRow}>
              <View style={styles.detailSumItem}>
                <Text style={styles.detailSumLbl}>Balance</Text>
                <Text style={[styles.detailSumVal, { color: acc.color }]}>{formatINR(acc.balance)}</Text>
              </View>
              <View style={styles.netDiv} />
              <View style={styles.detailSumItem}>
                <Text style={styles.detailSumLbl}>Spent (Month)</Text>
                <Text style={[styles.detailSumVal, { color: Colors.dangerLight }]}>
                  {formatINR(accountStats[acc.id]?.spent ?? 0)}
                </Text>
              </View>
              <View style={styles.netDiv} />
              <View style={styles.detailSumItem}>
                <Text style={styles.detailSumLbl}>Received</Text>
                <Text style={[styles.detailSumVal, { color: Colors.successLight }]}>
                  {formatINR(accountStats[acc.id]?.received ?? 0)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {card && (
          <LinearGradient colors={[card.color + 'CC', card.color + '33']} style={styles.detailSummaryCard}>
            <View style={styles.detailSummaryRow}>
              <View style={styles.detailSumItem}>
                <Text style={[styles.detailSumLbl, { color: 'rgba(255,255,255,0.6)' }]}>Outstanding</Text>
                <Text style={[styles.detailSumVal, { color: '#fff' }]}>{formatINR(card.outstanding)}</Text>
              </View>
              <View style={[styles.netDiv, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={styles.detailSumItem}>
                <Text style={[styles.detailSumLbl, { color: 'rgba(255,255,255,0.6)' }]}>Available</Text>
                <Text style={[styles.detailSumVal, { color: '#fff' }]}>{formatINR(card.creditLimit - card.outstanding)}</Text>
              </View>
              <View style={[styles.netDiv, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={styles.detailSumItem}>
                <Text style={[styles.detailSumLbl, { color: 'rgba(255,255,255,0.6)' }]}>Due</Text>
                <Text style={[styles.detailSumVal, { color: '#fff', fontSize: FontSize.sm }]}>{card.dueDate || '—'}</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {accountHistory.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="history" size={48} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No linked transactions</Text>
            <Text style={styles.emptyText}>Add expenses and select this account to see history</Text>
          </View>
        ) : (
          <FlatList
            data={accountHistory}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: tx }) => {
              const isOutgoing = tx.accountId === detailView.id;
              const isIncoming = tx.toAccountId === detailView.id;
              const sign = isIncoming ? '+' : '-';
              const amtColor = isIncoming ? Colors.successLight : Colors.dangerLight;
              return (
                <View style={styles.histTxRow}>
                  <View style={[styles.histTxIcon, { backgroundColor: isIncoming ? Colors.successDim + '44' : Colors.dangerDim + '44' }]}>
                    <MaterialIcons
                      name={isIncoming ? 'arrow-downward' : 'arrow-upward'}
                      size={16}
                      color={amtColor}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.histTxDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.histTxDate}>{formatDateDisplay(tx.date)}</Text>
                  </View>
                  <Text style={[styles.histTxAmt, { color: amtColor }]}>
                    {sign}{formatINR(tx.amount)}
                  </Text>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Wallet</Text>
          <Text style={styles.pageSub}>Accounts & Cards</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          onPress={tab === 'accounts' ? openAddAccount : openAddCard}
        >
          <MaterialIcons name="add" size={18} color="#000" />
          <Text style={styles.addBtnTxt}>{tab === 'accounts' ? 'Account' : 'Card'}</Text>
        </Pressable>
      </View>

      {/* ── Net worth summary card ── */}
      <LinearGradient colors={['#0D1F38', '#111827']} style={styles.netCard}>
        <View style={styles.netRow}>
          <View style={styles.netItem}>
            <Text style={styles.netLbl}>Total Balance</Text>
            <Text style={[styles.netVal, { color: Colors.successLight }]}>{formatINR(totalBalance)}</Text>
          </View>
          <View style={styles.netDiv} />
          <View style={styles.netItem}>
            <Text style={styles.netLbl}>Total Debt</Text>
            <Text style={[styles.netVal, { color: Colors.dangerLight }]}>{formatINR(totalOutstanding)}</Text>
          </View>
          <View style={styles.netDiv} />
          <View style={styles.netItem}>
            <Text style={styles.netLbl}>Net Worth</Text>
            <Text style={[styles.netVal, { color: netWorth >= 0 ? Colors.accentLight : Colors.dangerLight }]}>
              {formatINR(netWorth)}
            </Text>
          </View>
        </View>
        {totalCreditLimit > 0 && (
          <>
            <View style={styles.utilRow}>
              <Text style={styles.utilLbl}>Credit Utilisation</Text>
              <Text style={[styles.utilPct, { color: (totalOutstanding / totalCreditLimit) > 0.3 ? Colors.dangerLight : Colors.successLight }]}>
                {Math.round((totalOutstanding / totalCreditLimit) * 100)}%
              </Text>
            </View>
            <View style={styles.utilTrack}>
              <View style={[styles.utilFill, { width: `${Math.min((totalOutstanding / totalCreditLimit) * 100, 100)}%` as any, backgroundColor: (totalOutstanding / totalCreditLimit) > 0.3 ? Colors.danger : Colors.success }]} />
            </View>
          </>
        )}
      </LinearGradient>

      {/* ── Tab toggle ── */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'accounts' && styles.tabBtnActive]} onPress={() => setTab('accounts')}>
          <MaterialIcons name="account-balance" size={14} color={tab === 'accounts' ? Colors.accentLight : Colors.textMuted} />
          <Text style={[styles.tabTxt, tab === 'accounts' && styles.tabTxtActive]}>Bank Accounts ({accounts.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'cards' && styles.tabBtnActive]} onPress={() => setTab('cards')}>
          <MaterialIcons name="credit-card" size={14} color={tab === 'cards' ? Colors.accentLight : Colors.textMuted} />
          <Text style={[styles.tabTxt, tab === 'cards' && styles.tabTxtActive]}>Credit Cards ({cards.length})</Text>
        </Pressable>
      </View>

      {/* ── List ── */}
      {tab === 'accounts' ? (
        <FlatList
          data={accounts}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => <EmptyState icon="account-balance" title="No accounts yet" sub="Tap + Account to add one" />}
          renderItem={({ item: acc }) => (
            <AccountCard
              account={acc}
              spentThisMonth={accountStats[acc.id]?.spent ?? 0}
              onEdit={() => openEditAccount(acc)}
              onDelete={() => handleDeleteAccount(acc)}
              onViewHistory={() => setDetailView({ type: 'account', id: acc.id })}
            />
          )}
        />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => <EmptyState icon="credit-card" title="No cards yet" sub="Tap + Card to add one" />}
          renderItem={({ item: card }) => (
            <CreditCardCard
              card={card}
              onEdit={() => openEditCard(card)}
              onDelete={() => handleDeleteCard(card)}
              onViewHistory={() => setDetailView({ type: 'card', id: card.id })}
            />
          )}
        />
      )}

      {/* ── Account Modal ── */}
      <FormModal visible={showAccountModal} title={editingAccount ? 'Edit Account' : 'Add Bank Account'} onClose={() => setShowAccountModal(false)} onSave={handleSaveAccount} saveLabel={editingAccount ? 'Save Changes' : 'Add Account'}>
        <EField label="Account Name">
          <TextInput style={styles.eInput} value={accForm.accountName} onChangeText={v => setAccForm(f => ({ ...f, accountName: v }))} placeholder="e.g. Primary Savings" placeholderTextColor={Colors.textMuted} />
        </EField>
        <EField label="Bank Name">
          <Pressable style={styles.eDrop} onPress={() => setShowAccBankPicker(true)}>
            <Text style={styles.eDropTxt}>{accForm.bankName}</Text>
            <MaterialIcons name="expand-more" size={18} color={Colors.textSecondary} />
          </Pressable>
        </EField>
        <EField label="Account Type">
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map(t => (
              <Pressable key={t} style={[styles.typeBtn, accForm.accountType === t && { backgroundColor: Colors.primaryDim + '55', borderColor: Colors.primaryLight + '66' }]} onPress={() => setAccForm(f => ({ ...f, accountType: t }))}>
                <Text style={[styles.typeTxt, accForm.accountType === t && { color: Colors.primaryLight }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </EField>
        <EField label="Current Balance (₹)">
          <TextInput style={styles.eInput} value={accForm.balance} onChangeText={v => setAccForm(f => ({ ...f, balance: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </EField>
        <EField label="Card Color">
          <View style={styles.colorRow}>
            {ACCOUNT_COLORS_LIST.map(c => (
              <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, accForm.color === c && styles.colorSwatchActive]} onPress={() => setAccForm(f => ({ ...f, color: c }))}>
                {accForm.color === c && <MaterialIcons name="check" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>
        </EField>
      </FormModal>

      <PickerModal visible={showAccBankPicker} title="Select Bank" onClose={() => setShowAccBankPicker(false)} items={BANK_NAMES} selected={accForm.bankName} onSelect={b => { setAccForm(f => ({ ...f, bankName: b })); setShowAccBankPicker(false); }} />

      {/* ── Card Modal ── */}
      <FormModal visible={showCardModal} title={editingCard ? 'Edit Card' : 'Add Credit Card'} onClose={() => setShowCardModal(false)} onSave={handleSaveCard} saveLabel={editingCard ? 'Save Changes' : 'Add Card'}>
        <EField label="Card Name">
          <TextInput style={styles.eInput} value={cardForm.cardName} onChangeText={v => setCardForm(f => ({ ...f, cardName: v }))} placeholder="e.g. Infinia, Sapphiro" placeholderTextColor={Colors.textMuted} />
        </EField>
        <EField label="Bank / Issuer">
          <Pressable style={styles.eDrop} onPress={() => setShowCardBankPicker(true)}>
            <Text style={styles.eDropTxt}>{cardForm.bankName}</Text>
            <MaterialIcons name="expand-more" size={18} color={Colors.textSecondary} />
          </Pressable>
        </EField>
        <EField label="Credit Limit (₹)">
          <TextInput style={styles.eInput} value={cardForm.creditLimit} onChangeText={v => setCardForm(f => ({ ...f, creditLimit: v }))} placeholder="e.g. 200000" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </EField>
        <EField label="Outstanding Balance (₹)">
          <TextInput style={styles.eInput} value={cardForm.outstanding} onChangeText={v => setCardForm(f => ({ ...f, outstanding: v }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </EField>
        <EField label="Payment Due Date">
          <TextInput style={styles.eInput} value={cardForm.dueDate} onChangeText={v => setCardForm(f => ({ ...f, dueDate: v }))} placeholder="e.g. 15 Aug 2026" placeholderTextColor={Colors.textMuted} />
        </EField>
        <EField label="Card Color">
          <View style={styles.colorRow}>
            {CARD_COLORS_LIST.map(c => (
              <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, cardForm.color === c && styles.colorSwatchActive]} onPress={() => setCardForm(f => ({ ...f, color: c }))}>
                {cardForm.color === c && <MaterialIcons name="check" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>
        </EField>
      </FormModal>

      <PickerModal visible={showCardBankPicker} title="Select Bank / Issuer" onClose={() => setShowCardBankPicker(false)} items={CARD_BANKS} selected={cardForm.bankName} onSelect={b => { setCardForm(f => ({ ...f, bankName: b })); setShowCardBankPicker(false); }} />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AccountCard({ account, spentThisMonth, onEdit, onDelete, onViewHistory }: {
  account: BankAccount; spentThisMonth: number;
  onEdit: () => void; onDelete: () => void; onViewHistory: () => void;
}) {
  const typeIcons: Record<string, string> = { Savings: 'savings', Current: 'business', Salary: 'work' };
  return (
    <Pressable style={cardStyles.wrap} onPress={onViewHistory}>
      <View style={[cardStyles.accentBar, { backgroundColor: account.color }]} />
      <View style={cardStyles.body}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.iconWrap, { backgroundColor: account.color + '22', borderColor: account.color + '44' }]}>
            <MaterialIcons name={(typeIcons[account.accountType] as any) || 'account-balance'} size={20} color={account.color} />
          </View>
          <View style={cardStyles.info}>
            <Text style={cardStyles.name}>{account.accountName}</Text>
            <Text style={cardStyles.sub}>{account.bankName} · {account.accountType}</Text>
          </View>
          <View style={cardStyles.actions}>
            <Pressable style={({ pressed }) => [cardStyles.actionBtn, pressed && { opacity: 0.7 }]} onPress={e => { e.stopPropagation(); onEdit(); }} hitSlop={8}>
              <MaterialIcons name="edit" size={14} color={Colors.primaryLight} />
            </Pressable>
            <Pressable style={({ pressed }) => [cardStyles.actionBtn, cardStyles.deleteBtn, pressed && { opacity: 0.7 }]} onPress={e => { e.stopPropagation(); onDelete(); }} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={14} color={Colors.dangerLight} />
            </Pressable>
          </View>
        </View>
        <Text style={[cardStyles.balance, { color: account.color }]}>{formatINR(account.balance)}</Text>
        <View style={cardStyles.statsRow}>
          <Text style={cardStyles.balanceLbl}>Available Balance</Text>
          {spentThisMonth > 0 && (
            <View style={cardStyles.spentBadge}>
              <MaterialIcons name="arrow-upward" size={9} color={Colors.dangerLight} />
              <Text style={cardStyles.spentTxt}>{formatINR(spentThisMonth)} this month</Text>
            </View>
          )}
        </View>
        <View style={cardStyles.historyHint}>
          <MaterialIcons name="history" size={11} color={Colors.textMuted} />
          <Text style={cardStyles.historyHintTxt}>Tap to view transaction history</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CreditCardCard({ card, onEdit, onDelete, onViewHistory }: {
  card: CreditCard; onEdit: () => void; onDelete: () => void; onViewHistory: () => void;
}) {
  const used = card.creditLimit > 0 ? (card.outstanding / card.creditLimit) * 100 : 0;
  const available = card.creditLimit - card.outstanding;
  const isHighUtil = used > 30;

  return (
    <Pressable style={ccStyles.wrap} onPress={onViewHistory}>
      <LinearGradient colors={[card.color + 'CC', card.color + '33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ccStyles.gradTop}>
        <View style={ccStyles.topRow}>
          <View>
            <Text style={ccStyles.cardName}>{card.cardName}</Text>
            <Text style={ccStyles.bankName}>{card.bankName}</Text>
          </View>
          <View style={ccStyles.actions}>
            <Pressable style={({ pressed }) => [ccStyles.actionBtn, pressed && { opacity: 0.7 }]} onPress={e => { e.stopPropagation(); onEdit(); }} hitSlop={8}>
              <MaterialIcons name="edit" size={13} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <Pressable style={({ pressed }) => [ccStyles.actionBtn, pressed && { opacity: 0.7 }]} onPress={e => { e.stopPropagation(); onDelete(); }} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={13} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>
        </View>
        <MaterialIcons name="credit-card" size={28} color="rgba(255,255,255,0.3)" style={{ alignSelf: 'flex-end', marginTop: -8 }} />
      </LinearGradient>
      <View style={ccStyles.body}>
        <View style={ccStyles.statsRow}>
          <View style={ccStyles.statItem}>
            <Text style={ccStyles.statLbl}>Outstanding</Text>
            <Text style={[ccStyles.statVal, { color: card.outstanding > 0 ? Colors.dangerLight : Colors.successLight }]}>{formatINR(card.outstanding)}</Text>
          </View>
          <View style={ccStyles.statDiv} />
          <View style={ccStyles.statItem}>
            <Text style={ccStyles.statLbl}>Available</Text>
            <Text style={[ccStyles.statVal, { color: Colors.successLight }]}>{formatINR(available)}</Text>
          </View>
          <View style={ccStyles.statDiv} />
          <View style={ccStyles.statItem}>
            <Text style={ccStyles.statLbl}>Limit</Text>
            <Text style={ccStyles.statVal}>{formatINR(card.creditLimit)}</Text>
          </View>
        </View>
        <View style={ccStyles.utilRow}>
          <Text style={ccStyles.utilLbl}>Used: {Math.round(used)}%</Text>
          {isHighUtil && (
            <View style={ccStyles.highUtilBadge}>
              <MaterialIcons name="warning" size={10} color={Colors.dangerLight} />
              <Text style={ccStyles.highUtilTxt}>High</Text>
            </View>
          )}
        </View>
        <View style={ccStyles.utilTrack}>
          <View style={[ccStyles.utilFill, { width: `${Math.min(used, 100)}%` as any, backgroundColor: isHighUtil ? Colors.danger : Colors.success }]} />
        </View>
        {card.dueDate ? (
          <View style={ccStyles.dueRow}>
            <MaterialIcons name="event" size={12} color={Colors.textMuted} />
            <Text style={ccStyles.dueTxt}>Due: {card.dueDate}</Text>
          </View>
        ) : null}
        <View style={cardStyles.historyHint}>
          <MaterialIcons name="history" size={11} color={Colors.textMuted} />
          <Text style={cardStyles.historyHintTxt}>Tap to view transaction history</Text>
        </View>
      </View>
    </Pressable>
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

function FormModal({ visible, title, onClose, onSave, saveLabel, children }: {
  visible: boolean; title: string; onClose: () => void; onSave: () => void; saveLabel: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>
                {children}
                <View style={styles.sheetBtns}>
                  <Pressable style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={onSave}>
                    <LinearGradient colors={[Colors.accent, Colors.accentDim + 'FF']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={styles.saveTxt}>{saveLabel}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PickerModal({ visible, title, onClose, items, selected, onSelect }: {
  visible: boolean; title: string; onClose: () => void; items: string[]; selected: string; onSelect: (item: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map(item => (
              <Pressable key={item} style={[styles.pickerItem, selected === item && { backgroundColor: Colors.primaryDim + '44', borderColor: Colors.primaryLight + '44' }]} onPress={() => onSelect(item)}>
                <Text style={[styles.pickerTxt, selected === item && { color: Colors.primaryLight }]}>{item}</Text>
                {selected === item && <MaterialIcons name="check-circle" size={16} color={Colors.primaryLight} />}
              </Pressable>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon as any} size={36} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  wrap: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', overflow: 'hidden', ...Shadow.sm },
  accentBar: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 28, height: 28, borderRadius: Radius.xs, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  deleteBtn: { borderColor: Colors.danger + '44' },
  balance: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy },
  balanceLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dangerDim + '44', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  spentTxt: { fontSize: FontSize.xs, color: Colors.dangerLight, fontWeight: FontWeight.semibold },
  historyHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  historyHintTxt: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
});

const ccStyles = StyleSheet.create({
  wrap: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.sm },
  gradTop: { padding: 14, paddingBottom: 12, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: '#fff' },
  bankName: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 26, height: 26, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  body: { padding: 14, gap: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  statVal: { fontSize: FontSize.md, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  statDiv: { width: 1, height: 28, backgroundColor: Colors.border },
  utilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  highUtilBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dangerDim + '55', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.danger + '44' },
  highUtilTxt: { fontSize: FontSize.xs, color: Colors.dangerLight, fontWeight: FontWeight.bold },
  utilTrack: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  utilFill: { height: '100%', borderRadius: Radius.full },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dueTxt: { fontSize: FontSize.xs, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: FontSize.body, color: Colors.textSecondary },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  pageSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accentLight, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full },
  addBtnTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: '#000' },

  // Detail view
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy },
  detailSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  detailSummaryCard: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, ...Shadow.sm },
  detailSummaryRow: { flexDirection: 'row', alignItems: 'center' },
  detailSumItem: { flex: 1, alignItems: 'center', gap: 4 },
  detailSumLbl: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  detailSumVal: { fontSize: FontSize.md, fontWeight: FontWeight.heavy, textAlign: 'center' },

  // History row
  histTxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histTxIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  histTxDesc: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  histTxDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  histTxAmt: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },

  netCard: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 10, ...Shadow.sm },
  netRow: { flexDirection: 'row', alignItems: 'center' },
  netItem: { flex: 1, alignItems: 'center', gap: 3 },
  netLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  netVal: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  netDiv: { width: 1, height: 28, backgroundColor: Colors.border },
  utilRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  utilLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  utilPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  utilTrack: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  utilFill: { height: '100%', borderRadius: Radius.full },

  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.md, marginVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: Radius.sm },
  tabBtnActive: { backgroundColor: Colors.accentDim + '55', borderWidth: 1, borderColor: Colors.accent + '55' },
  tabTxt: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  tabTxtActive: { color: Colors.accentLight },

  listContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingTop: 4 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  emptyText: { fontSize: FontSize.body, color: Colors.textMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceElt, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.md, paddingBottom: 48, maxHeight: '92%', borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.borderMid },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.borderMid, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary, marginBottom: Spacing.md },
  sheetBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: Radius.md, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: FontSize.body, fontWeight: FontWeight.heavy, color: '#000' },

  eLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  eInput: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.body, color: Colors.textPrimary },
  eDrop: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  eDropTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated },
  typeTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent', marginBottom: 2 },
  pickerTxt: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: FontWeight.medium },
});
