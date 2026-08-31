/**
 * Per-month salary hook
 * Stores a map of "YYYY-M" → salary in AsyncStorage
 * Falls back to 50,000 if no salary is set for a month
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SALARY_KEY = 'finance_monthly_salaries';
const DEFAULT_SALARY = 50000;

type SalaryMap = Record<string, number>; // key = "YYYY-M"

function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function useSalary() {
  const [salaryMap, setSalaryMap] = useState<SalaryMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(SALARY_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null) {
              setSalaryMap(parsed);
            }
          } catch { /* ignore */ }
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  /** Get salary for a specific month (returns DEFAULT if not set) */
  const getSalary = useCallback((year: number, month: number): number => {
    const key = monthKey(year, month);
    const val = salaryMap[key];
    return (typeof val === 'number' && val > 0) ? val : DEFAULT_SALARY;
  }, [salaryMap]);

  /** Set salary for a specific month and persist */
  const setSalary = useCallback(async (year: number, month: number, amount: number) => {
    if (!isFinite(amount) || amount < 0) return;
    const key = monthKey(year, month);
    const updated = { ...salaryMap, [key]: Math.round(amount) };
    setSalaryMap(updated);
    await AsyncStorage.setItem(SALARY_KEY, JSON.stringify(updated));
  }, [salaryMap]);

  /** Check if a salary has been explicitly set for a month */
  const hasSalary = useCallback((year: number, month: number): boolean => {
    const key = monthKey(year, month);
    return typeof salaryMap[key] === 'number' && salaryMap[key] > 0;
  }, [salaryMap]);

  return { getSalary, setSalary, hasSalary, isLoaded };
}
