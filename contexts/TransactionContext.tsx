import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Transaction } from '@/constants/config';
import { loadTransactions, saveTransactions, createTransaction } from '@/services/storageService';

interface TransactionContextType {
  transactions: Transaction[];
  isLoading: boolean;
  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, data: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const addTransaction = useCallback(async (data: Omit<Transaction, 'id'>) => {
    const newTx = createTransaction(data);
    const updated = [newTx, ...transactions];
    setTransactions(updated);
    await saveTransactions(updated);
  }, [transactions]);

  const updateTransaction = useCallback(async (id: string, data: Omit<Transaction, 'id'>) => {
    const updated = transactions.map(tx => tx.id === id ? { ...data, id } : tx);
    setTransactions(updated);
    await saveTransactions(updated);
  }, [transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    const updated = transactions.filter(tx => tx.id !== id);
    setTransactions(updated);
    await saveTransactions(updated);
  }, [transactions]);

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
