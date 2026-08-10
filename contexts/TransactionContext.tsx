import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { Transaction } from '@/constants/config';
import { loadTransactions, saveTransactions, createTransaction } from '@/services/storageService';
import { WalletContext } from '@/contexts/WalletContext';
import {
  AccountSource,
  sourceFromTransaction,
  applyExpense,
  reverseExpense,
  applyIncome,
  reverseIncome,
  applyTransfer,
  reverseTransfer,
  applyCardPayment,
  reverseCardPayment,
} from '@/services/reconciliationService';

interface AddTransactionData extends Omit<Transaction, 'id'> {
  accountSource?: AccountSource;
}

interface TransactionContextType {
  transactions: Transaction[];
  isLoading: boolean;
  addTransaction: (data: AddTransactionData) => Promise<void>;
  updateTransaction: (id: string, data: AddTransactionData) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Access wallet context for balance reconciliation
  const wallet = useContext(WalletContext);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadTransactions();
      setTransactions(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Helper: reconcile wallet based on transaction type ────────────────
  const reconcileAdd = useCallback(async (tx: Transaction, source?: AccountSource) => {
    if (!wallet) return;
    const { accounts, cards, applyAccountsAndCards } = wallet;
    let newAccounts = accounts;
    let newCards = cards;

    const effectiveSource = source ?? sourceFromTransaction(tx);

    if (tx.type === 'Transfer' && tx.accountId && tx.toAccountId) {
      // Bank → Bank transfer
      const r = applyTransfer(accounts, cards, tx.amount, tx.accountId, tx.toAccountId);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (tx.type === 'CardPayment' && tx.accountId && tx.toAccountId) {
      // Bank → Card payment
      const r = applyCardPayment(accounts, cards, tx.amount, tx.accountId, tx.toAccountId);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (tx.isIncome) {
      const r = applyIncome(accounts, cards, tx.amount, effectiveSource);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (tx.type !== 'Saving' || effectiveSource) {
      // Regular expense or saving deduction
      const r = applyExpense(accounts, cards, tx.amount, effectiveSource);
      newAccounts = r.accounts;
      newCards = r.cards;
    }

    if (newAccounts !== accounts || newCards !== cards) {
      await applyAccountsAndCards(newAccounts, newCards);
    }
  }, [wallet]);

  const reconcileDelete = useCallback(async (tx: Transaction) => {
    if (!wallet) return;
    const { accounts, cards, applyAccountsAndCards } = wallet;
    let newAccounts = accounts;
    let newCards = cards;

    const source = sourceFromTransaction(tx);

    if (tx.type === 'Transfer' && tx.accountId && tx.toAccountId) {
      const r = reverseTransfer(accounts, cards, tx.amount, tx.accountId, tx.toAccountId);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (tx.type === 'CardPayment' && tx.accountId && tx.toAccountId) {
      const r = reverseCardPayment(accounts, cards, tx.amount, tx.accountId, tx.toAccountId);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (tx.isIncome) {
      const r = reverseIncome(accounts, cards, tx.amount, source);
      newAccounts = r.accounts;
      newCards = r.cards;
    } else if (source) {
      const r = reverseExpense(accounts, cards, tx.amount, source);
      newAccounts = r.accounts;
      newCards = r.cards;
    }

    if (newAccounts !== accounts || newCards !== cards) {
      await applyAccountsAndCards(newAccounts, newCards);
    }
  }, [wallet]);

  // ── Add ───────────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (data: AddTransactionData) => {
    const { accountSource, ...txData } = data;
    const newTx = createTransaction(txData);
    const updated = [newTx, ...transactions];
    setTransactions(updated);
    await saveTransactions(updated);
    await reconcileAdd(newTx, accountSource);
  }, [transactions, reconcileAdd]);

  // ── Update ────────────────────────────────────────────────────────────
  const updateTransaction = useCallback(async (id: string, data: AddTransactionData) => {
    const oldTx = transactions.find(tx => tx.id === id);
    const { accountSource, ...txData } = data;
    const newTx: Transaction = { ...txData, id };

    const updated = transactions.map(tx => tx.id === id ? newTx : tx);
    setTransactions(updated);
    await saveTransactions(updated);

    // Reverse old effect, apply new effect
    if (oldTx) {
      await reconcileDelete(oldTx);
    }
    await reconcileAdd(newTx, accountSource);
  }, [transactions, reconcileDelete, reconcileAdd]);

  // ── Delete ────────────────────────────────────────────────────────────
  const deleteTransaction = useCallback(async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    await saveTransactions(updated);
    if (tx) await reconcileDelete(tx);
  }, [transactions, reconcileDelete]);

  return (
    <TransactionContext.Provider value={{
      transactions,
      isLoading,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      refresh,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}
