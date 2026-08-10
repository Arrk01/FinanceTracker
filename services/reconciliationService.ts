/**
 * reconciliationService.ts
 *
 * Central ledger engine — every account/card mutation flows through here.
 * This ensures a single source of truth and atomic state updates.
 */

import { BankAccount, CreditCard } from '@/contexts/WalletContext';
import { Transaction } from '@/constants/config';

export type AccountSource =
  | { type: 'bank'; id: string }
  | { type: 'card'; id: string }
  | { type: 'cash' }
  | null;

/**
 * Apply a NEW expense transaction's financial effect to accounts/cards.
 * Returns updated accounts & cards arrays (immutable).
 */
export function applyExpense(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  source: AccountSource,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  if (!source || source.type === 'cash') return { accounts, cards };
  const amt = Math.max(0, amount);

  if (source.type === 'bank') {
    return {
      accounts: accounts.map(a =>
        a.id === source.id ? { ...a, balance: Math.max(0, a.balance - amt) } : a,
      ),
      cards,
    };
  }

  if (source.type === 'card') {
    return {
      accounts,
      cards: cards.map(c =>
        c.id === source.id ? { ...c, outstanding: c.outstanding + amt } : c,
      ),
    };
  }

  return { accounts, cards };
}

/**
 * Reverse an expense transaction's financial effect (for delete/edit).
 */
export function reverseExpense(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  source: AccountSource,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  if (!source || source.type === 'cash') return { accounts, cards };
  const amt = Math.max(0, amount);

  if (source.type === 'bank') {
    return {
      accounts: accounts.map(a =>
        a.id === source.id ? { ...a, balance: a.balance + amt } : a,
      ),
      cards,
    };
  }

  if (source.type === 'card') {
    return {
      accounts,
      cards: cards.map(c =>
        c.id === source.id ? { ...c, outstanding: Math.max(0, c.outstanding - amt) } : c,
      ),
    };
  }

  return { accounts, cards };
}

/**
 * Apply an INCOME transaction's financial effect.
 */
export function applyIncome(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  destination: AccountSource,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  if (!destination || destination.type === 'cash') return { accounts, cards };
  const amt = Math.max(0, amount);

  if (destination.type === 'bank') {
    return {
      accounts: accounts.map(a =>
        a.id === destination.id ? { ...a, balance: a.balance + amt } : a,
      ),
      cards,
    };
  }

  // Income doesn't go to credit cards
  return { accounts, cards };
}

/**
 * Reverse an income transaction.
 */
export function reverseIncome(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  destination: AccountSource,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  if (!destination || destination.type === 'cash') return { accounts, cards };
  const amt = Math.max(0, amount);

  if (destination.type === 'bank') {
    return {
      accounts: accounts.map(a =>
        a.id === destination.id ? { ...a, balance: Math.max(0, a.balance - amt) } : a,
      ),
      cards,
    };
  }

  return { accounts, cards };
}

/**
 * Process a bank-to-bank transfer.
 */
export function applyTransfer(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  fromId: string,
  toId: string,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  const amt = Math.max(0, amount);
  return {
    accounts: accounts.map(a => {
      if (a.id === fromId) return { ...a, balance: Math.max(0, a.balance - amt) };
      if (a.id === toId) return { ...a, balance: a.balance + amt };
      return a;
    }),
    cards,
  };
}

/**
 * Reverse a transfer.
 */
export function reverseTransfer(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  fromId: string,
  toId: string,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  const amt = Math.max(0, amount);
  return {
    accounts: accounts.map(a => {
      if (a.id === fromId) return { ...a, balance: a.balance + amt };
      if (a.id === toId) return { ...a, balance: Math.max(0, a.balance - amt) };
      return a;
    }),
    cards,
  };
}

/**
 * Process a credit card bill payment:
 *   - Deduct from bank account
 *   - Reduce credit card outstanding
 */
export function applyCardPayment(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  bankId: string,
  cardId: string,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  const amt = Math.max(0, amount);
  return {
    accounts: accounts.map(a =>
      a.id === bankId ? { ...a, balance: Math.max(0, a.balance - amt) } : a,
    ),
    cards: cards.map(c =>
      c.id === cardId ? { ...c, outstanding: Math.max(0, c.outstanding - amt) } : c,
    ),
  };
}

/**
 * Reverse a card payment.
 */
export function reverseCardPayment(
  accounts: BankAccount[],
  cards: CreditCard[],
  amount: number,
  bankId: string,
  cardId: string,
): { accounts: BankAccount[]; cards: CreditCard[] } {
  const amt = Math.max(0, amount);
  return {
    accounts: accounts.map(a =>
      a.id === bankId ? { ...a, balance: a.balance + amt } : a,
    ),
    cards: cards.map(c =>
      c.id === cardId ? { ...c, outstanding: c.outstanding + amt } : c,
    ),
  };
}

/**
 * Reconstruct source from a transaction (backward-compat with old records).
 */
export function sourceFromTransaction(tx: Transaction): AccountSource {
  if (!tx.accountId) return null;
  if (tx.accountType === 'bank') return { type: 'bank', id: tx.accountId };
  if (tx.accountType === 'card') return { type: 'card', id: tx.accountId };
  if (tx.accountType === 'cash') return { type: 'cash' };
  return null;
}

/**
 * Check whether a bank account has sufficient balance.
 */
export function checkSufficientBalance(
  accounts: BankAccount[],
  accountId: string,
  amount: number,
): { sufficient: boolean; balance: number } {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return { sufficient: false, balance: 0 };
  return { sufficient: acc.balance >= amount, balance: acc.balance };
}

/**
 * Check whether a credit card has sufficient available credit.
 */
export function checkCreditAvailable(
  cards: CreditCard[],
  cardId: string,
  amount: number,
): { sufficient: boolean; available: number } {
  const card = cards.find(c => c.id === cardId);
  if (!card) return { sufficient: false, available: 0 };
  const available = card.creditLimit - card.outstanding;
  return { sufficient: available >= amount, available };
}
