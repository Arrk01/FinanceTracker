import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'Savings' | 'Current' | 'Salary';
  balance: number;
  color: string;
  icon: string;
}

export interface CreditCard {
  id: string;
  cardName: string;
  bankName: string;
  creditLimit: number;
  outstanding: number;
  dueDate: string;
  color: string;
}

interface WalletContextType {
  accounts: BankAccount[];
  cards: CreditCard[];
  isLoading: boolean;

  // CRUD
  addAccount: (data: Omit<BankAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, data: Omit<BankAccount, 'id'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCard: (data: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCard: (id: string, data: Omit<CreditCard, 'id'>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;

  // Atomic batch update — called by reconciliation engine
  applyAccountsAndCards: (
    newAccounts: BankAccount[],
    newCards: CreditCard[],
  ) => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

const ACCOUNTS_KEY = 'finance_accounts';
const CARDS_KEY = 'finance_cards';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const ACCOUNT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
const CARD_COLORS = ['#EF4444', '#F97316', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981'];

const SAMPLE_ACCOUNTS: BankAccount[] = [
  { id: 'acc_hdfc', accountName: 'Primary Savings', bankName: 'HDFC Bank', accountType: 'Savings', balance: 45000, color: '#3B82F6', icon: 'account-balance' },
  { id: 'acc_icici', accountName: 'Salary Account', bankName: 'ICICI Bank', accountType: 'Salary', balance: 12500, color: '#10B981', icon: 'account-balance' },
  { id: 'acc_sbi', accountName: 'Emergency Fund', bankName: 'SBI', accountType: 'Savings', balance: 80000, color: '#8B5CF6', icon: 'account-balance' },
  { id: 'acc_axis', accountName: 'Business Current', bankName: 'Axis Bank', accountType: 'Current', balance: 28000, color: '#F59E0B', icon: 'account-balance' },
];

const SAMPLE_CARDS: CreditCard[] = [
  { id: 'card_hdfc_infinia', cardName: 'Infinia', bankName: 'HDFC Bank', creditLimit: 300000, outstanding: 18500, dueDate: '15 Aug 2026', color: '#EF4444' },
  { id: 'card_icici_sapphiro', cardName: 'Sapphiro', bankName: 'ICICI Bank', creditLimit: 200000, outstanding: 6200, dueDate: '10 Aug 2026', color: '#F97316' },
  { id: 'card_sbi_simply', cardName: 'Simply Click', bankName: 'SBI', creditLimit: 100000, outstanding: 3100, dueDate: '20 Aug 2026', color: '#8B5CF6' },
  { id: 'card_axis_magnus', cardName: 'Magnus', bankName: 'Axis Bank', creditLimit: 250000, outstanding: 22000, dueDate: '05 Aug 2026', color: '#3B82F6' },
  { id: 'card_sbi_vistara', cardName: 'Vistara Prime', bankName: 'SBI Card', creditLimit: 150000, outstanding: 0, dueDate: '25 Aug 2026', color: '#EC4899' },
  { id: 'card_au_ace', cardName: 'ACE', bankName: 'AU Bank', creditLimit: 80000, outstanding: 4800, dueDate: '18 Aug 2026', color: '#10B981' },
];

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [accData, cardData] = await Promise.all([
          AsyncStorage.getItem(ACCOUNTS_KEY),
          AsyncStorage.getItem(CARDS_KEY),
        ]);
        if (accData) {
          const parsed = JSON.parse(accData);
          setAccounts(Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_ACCOUNTS);
        } else {
          setAccounts(SAMPLE_ACCOUNTS);
          await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(SAMPLE_ACCOUNTS));
        }
        if (cardData) {
          const parsed = JSON.parse(cardData);
          setCards(Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_CARDS);
        } else {
          setCards(SAMPLE_CARDS);
          await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(SAMPLE_CARDS));
        }
      } catch {
        setAccounts(SAMPLE_ACCOUNTS);
        setCards(SAMPLE_CARDS);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveAccounts = useCallback(async (list: BankAccount[]) => {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }, []);

  const saveCards = useCallback(async (list: CreditCard[]) => {
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(list));
  }, []);

  /** Atomic update of both accounts and cards in one AsyncStorage write. */
  const applyAccountsAndCards = useCallback(async (
    newAccounts: BankAccount[],
    newCards: CreditCard[],
  ) => {
    setAccounts(newAccounts);
    setCards(newCards);
    await Promise.all([
      AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(newAccounts)),
      AsyncStorage.setItem(CARDS_KEY, JSON.stringify(newCards)),
    ]);
  }, []);

  const addAccount = useCallback(async (data: Omit<BankAccount, 'id'>) => {
    const updated = [...accounts, { ...data, id: genId() }];
    setAccounts(updated);
    await saveAccounts(updated);
  }, [accounts, saveAccounts]);

  const updateAccount = useCallback(async (id: string, data: Omit<BankAccount, 'id'>) => {
    const updated = accounts.map(a => a.id === id ? { ...data, id } : a);
    setAccounts(updated);
    await saveAccounts(updated);
  }, [accounts, saveAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    await saveAccounts(updated);
  }, [accounts, saveAccounts]);

  const addCard = useCallback(async (data: Omit<CreditCard, 'id'>) => {
    const updated = [...cards, { ...data, id: genId() }];
    setCards(updated);
    await saveCards(updated);
  }, [cards, saveCards]);

  const updateCard = useCallback(async (id: string, data: Omit<CreditCard, 'id'>) => {
    const updated = cards.map(c => c.id === id ? { ...data, id } : c);
    setCards(updated);
    await saveCards(updated);
  }, [cards, saveCards]);

  const deleteCard = useCallback(async (id: string) => {
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
    await saveCards(updated);
  }, [cards, saveCards]);

  return (
    <WalletContext.Provider value={{
      accounts, cards, isLoading,
      addAccount, updateAccount, deleteAccount,
      addCard, updateCard, deleteCard,
      applyAccountsAndCards,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const ACCOUNT_COLORS_LIST = ACCOUNT_COLORS;
export const CARD_COLORS_LIST = CARD_COLORS;
