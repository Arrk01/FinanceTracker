export type Category =
  | 'Life Infrastructure'
  | 'Future Me'
  | 'Performance & Growth'
  | 'Relationships & Generosity'
  | 'Lifestyle Enjoyment';

export type PaymentMode =
  | 'UPI'
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash'
  | 'Bank Transfer';

export type TransactionType = 'Need' | 'Want' | 'Saving' | 'Transfer' | 'CardPayment';

export type AccountType = 'bank' | 'card' | 'cash';

export interface Transaction {
  id: string;
  date: string; // DD MMM YYYY
  description: string;
  category: Category;
  amount: number;
  paymentMode: PaymentMode;
  type: TransactionType;
  notes: string;
  // Account linking (optional — old records without these still work)
  accountId?: string;
  accountType?: AccountType;
  // Transfer-specific fields
  toAccountId?: string;
  toAccountType?: AccountType;
  // Income flag
  isIncome?: boolean;
}

export const CATEGORIES: Category[] = [
  'Life Infrastructure',
  'Future Me',
  'Performance & Growth',
  'Relationships & Generosity',
  'Lifestyle Enjoyment',
];

export const PAYMENT_MODES: PaymentMode[] = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
];

export const CATEGORY_TYPE_MAP: Record<Category, TransactionType> = {
  'Life Infrastructure': 'Need',
  'Future Me': 'Saving',
  'Performance & Growth': 'Need',
  'Relationships & Generosity': 'Want',
  'Lifestyle Enjoyment': 'Want',
};

export const BUDGET_CONFIG = {
  salary: 50000,
  needs: 25000,
  wants: 15000,
  savings: 10000,
  weeklyLimit: 10000,
};

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ── Indian rupee formatter (handles decimals, negatives, 0) ────────────────
export function formatINR(amount: number): string {
  if (!isFinite(amount)) return '₹0';
  const isNeg = amount < 0;
  const abs = Math.abs(Math.round(amount));
  if (abs === 0) return '₹0';
  const str = abs.toString();
  if (str.length <= 3) return (isNeg ? '-₹' : '₹') + str;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  let result = '';
  let count = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (count > 0 && count % 2 === 0) result = ',' + result;
    result = rest[i] + result;
    count++;
  }
  return (isNeg ? '-₹' : '₹') + result + ',' + last3;
}

// ── Safe date parser — never throws ───────────────────────────────────────
export function parseDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.trim().split(' ');
  if (parts.length !== 3) return new Date();
  const day = parseInt(parts[0], 10);
  const monthIndex = MONTH_NAMES.indexOf(parts[1]);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || monthIndex === -1 || isNaN(year)) return new Date();
  const d = new Date(year, monthIndex, day);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ── Display formatter: "01 Jan 2026" → "Thu, 01 Jan" ─────────────────────
export function formatDateDisplay(dateStr: string): string {
  const d = parseDate(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  const parts = dateStr.trim().split(' ');
  if (parts.length !== 3) return dateStr;
  return `${day}, ${parts[0]} ${parts[1]}`;
}

// ── Date serialiser ────────────────────────────────────────────────────────
export function dateToString(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ── Budget health grade (A–D based on 50:30:20) ───────────────────────────
export function getBudgetGrade(
  needsRatio: number,
  wantsRatio: number,
  savingsRatio: number,
): { grade: string; color: string; label: string; score: number } {
  const needsDiff = Math.abs(needsRatio - 50);
  const wantsDiff = Math.abs(wantsRatio - 30);
  const savingsDiff = Math.abs(savingsRatio - 20);
  const totalDiff = needsDiff + wantsDiff + savingsDiff;
  // score out of 100 (lower diff = higher score)
  const score = Math.max(0, Math.round(100 - totalDiff * 1.5));

  if (totalDiff <= 10) return { grade: 'A', color: '#10B981', label: 'Excellent', score };
  if (totalDiff <= 20) return { grade: 'B', color: '#3B82F6', label: 'Good', score };
  if (totalDiff <= 35) return { grade: 'C', color: '#F59E0B', label: 'Fair', score };
  return { grade: 'D', color: '#EF4444', label: 'Needs Work', score };
}

// ── Week bounds (Mon–Sun) ──────────────────────────────────────────────────
export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const day = date.getDay(); // 0=Sun
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// ── Smart auto-categorise by keywords ─────────────────────────────────────
const KEYWORD_MAP: { keywords: string[]; category: Category }[] = [
  { keywords: ['rent', 'house', 'flat', 'pg', 'hostel'], category: 'Life Infrastructure' },
  { keywords: ['grocery', 'groceries', 'bigbasket', 'zepto', 'dmart', 'milk', 'bread', 'vegetables'], category: 'Life Infrastructure' },
  { keywords: ['electricity', 'bill', 'internet', 'broadband', 'mobile', 'recharge', 'water', 'gas', 'cooking gas', 'metro', 'petrol', 'fuel', 'uber', 'auto', 'cab', 'medicine', 'medical', 'laundry'], category: 'Life Infrastructure' },
  { keywords: ['sip', 'mutual fund', 'fd', 'ppf', 'investment', 'saving', 'deposit', 'lic', 'insurance'], category: 'Future Me' },
  { keywords: ['gym', 'course', 'udemy', 'book', 'books', 'course', 'training', 'coaching', 'workshop', 'class'], category: 'Performance & Growth' },
  { keywords: ['gift', 'donation', 'charity', 'birthday', 'anniversary', 'valentine', 'flowers', 'treats', 'team dinner', 'farewell', 'lunch treat'], category: 'Relationships & Generosity' },
  { keywords: ['swiggy', 'zomato', 'food', 'restaurant', 'cafe', 'coffee', 'movie', 'shopping', 'clothes', 'amazon', 'myntra', 'flipkart', 'netflix', 'spotify', 'concert', 'drinks', 'beer', 'bar', 'chai', 'ice cream', 'salon', 'grooming', 'haircut'], category: 'Lifestyle Enjoyment' },
];

export function autoCategorise(description: string): Category | null {
  const lower = description.toLowerCase();
  for (const { keywords, category } of KEYWORD_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return null;
}

// ── Subscription detection keywords ───────────────────────────────────────
export const SUBSCRIPTION_KEYWORDS = ['netflix', 'spotify', 'amazon prime', 'hotstar', 'youtube', 'sip', 'mutual fund', 'ppf', 'gym', 'internet', 'broadband', 'mobile recharge'];

export function isLikelySubscription(description: string): boolean {
  const lower = description.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Financial insight generator ────────────────────────────────────────────
export interface FinancialInsight {
  type: 'warning' | 'success' | 'info' | 'tip';
  title: string;
  message: string;
  icon: string;
}

export function generateInsights(params: {
  salary: number;
  totalSpent: number;
  needs: number;
  wants: number;
  savings: number;
  weeklySpend: number;
  weeklyLimit: number;
  topCategory: string;
  txCount: number;
  avgDaily: number;
}): FinancialInsight[] {
  const { salary, totalSpent, needs, wants, savings, weeklySpend, weeklyLimit, topCategory, txCount, avgDaily } = params;
  const insights: FinancialInsight[] = [];
  const needsLimit = Math.round(salary * 0.5);
  const wantsLimit = Math.round(salary * 0.3);
  const savingsGoal = Math.round(salary * 0.2);

  // Over budget warnings
  if (needs > needsLimit) {
    insights.push({
      type: 'warning',
      title: 'Needs Over Budget',
      message: `Needs spending (${formatINR(needs)}) exceeds 50% limit by ${formatINR(needs - needsLimit)}.`,
      icon: 'warning',
    });
  }
  if (wants > wantsLimit) {
    insights.push({
      type: 'warning',
      title: 'Wants Over Budget',
      message: `Discretionary spending is ${formatINR(wants - wantsLimit)} over the 30% limit.`,
      icon: 'trending-up',
    });
  }

  // Weekly over
  if (weeklySpend > weeklyLimit) {
    insights.push({
      type: 'warning',
      title: 'Weekly Limit Breached',
      message: `This week you spent ${formatINR(weeklySpend)} — ${formatINR(weeklySpend - weeklyLimit)} over the ${formatINR(weeklyLimit)} limit.`,
      icon: 'date-range',
    });
  }

  // Good savings
  if (savings >= savingsGoal) {
    insights.push({
      type: 'success',
      title: 'Savings Goal Met',
      message: `You have saved ${formatINR(savings)} — ${Math.round((savings / salary) * 100)}% of income. Great discipline!`,
      icon: 'savings',
    });
  } else if (savings > 0) {
    insights.push({
      type: 'tip',
      title: 'Boost Savings',
      message: `Save ${formatINR(savingsGoal - savings)} more to hit the 20% savings target (${formatINR(savingsGoal)}) this month.`,
      icon: 'lightbulb',
    });
  }

  // Top spending category
  if (topCategory) {
    insights.push({
      type: 'info',
      title: 'Top Spend Category',
      message: `Most money went to "${topCategory}" this month. Review if this aligns with your priorities.`,
      icon: 'category',
    });
  }

  // Transaction frequency
  if (txCount > 80) {
    insights.push({
      type: 'tip',
      title: 'High Transaction Volume',
      message: `${txCount} transactions this month. Many small spends can add up — watch for impulse buys.`,
      icon: 'receipt-long',
    });
  }

  // Daily average
  if (avgDaily > 1800) {
    insights.push({
      type: 'warning',
      title: 'High Daily Average',
      message: `Daily average spend of ${formatINR(avgDaily)} puts you on track to overshoot the monthly budget.`,
      icon: 'today',
    });
  }

  return insights.slice(0, 4); // max 4 insights
}
