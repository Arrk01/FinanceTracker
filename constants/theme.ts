// Design tokens for FinanceTracker — Enhanced v2
export const Colors = {
  // Base
  background: '#080E1C',
  surface: '#111827',
  surfaceElt: '#162032',
  surfaceElevated: '#1C2D42',
  surfaceHighlight: '#1F3A56',
  border: '#1E3048',
  borderLight: '#1A2A3F',
  borderMid: '#263B55',

  // Text
  textPrimary: '#F0F6FF',
  textSecondary: '#8BA5C4',
  textMuted: '#4A6480',
  textDim: '#2E4560',

  // Brand
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDim: '#1D4ED8',
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  accentDim: '#92400E',

  // Semantic
  success: '#10B981',
  successLight: '#34D399',
  successDim: '#065F46',
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerDim: '#7F1D1D',

  // Gradient stops (used in LinearGradient)
  gradientDash: ['#0D1B2E', '#0F1F38', '#091428'],
  gradientCard: ['#162032', '#111827'],
  gradientGold: ['#F59E0B', '#D97706'],
  gradientGreen: ['#10B981', '#059669'],
  gradientBlue: ['#3B82F6', '#2563EB'],
  gradientRed: ['#EF4444', '#DC2626'],
  gradientPurple: ['#8B5CF6', '#7C3AED'],

  // Category Colors
  categories: {
    'Life Infrastructure': {
      bg: '#1C1A06',
      text: '#FCD34D',
      dot: '#F59E0B',
      glow: '#F59E0B33',
      border: '#3D2E00',
    },
    'Future Me': {
      bg: '#0A1628',
      text: '#93C5FD',
      dot: '#3B82F6',
      glow: '#3B82F633',
      border: '#1E3A6E',
    },
    'Performance & Growth': {
      bg: '#061A12',
      text: '#6EE7B7',
      dot: '#10B981',
      glow: '#10B98133',
      border: '#064E3B',
    },
    'Relationships & Generosity': {
      bg: '#150B28',
      text: '#C4B5FD',
      dot: '#8B5CF6',
      glow: '#8B5CF633',
      border: '#2E1065',
    },
    'Lifestyle Enjoyment': {
      bg: '#1E0B16',
      text: '#F9A8D4',
      dot: '#EC4899',
      glow: '#EC489933',
      border: '#4A0E2B',
    },
  },

  // Type colors
  types: {
    Need: { bg: '#061A12', text: '#6EE7B7', dot: '#10B981', border: '#064E3B' },
    Want: { bg: '#1E0B16', text: '#F9A8D4', dot: '#EC4899', border: '#4A0E2B' },
    Saving: { bg: '#0A1628', text: '#93C5FD', dot: '#3B82F6', border: '#1E3A6E' },
  },

  // Payment mode colors
  paymentModes: {
    UPI: '#8B5CF6',
    'Credit Card': '#EF4444',
    'Debit Card': '#F59E0B',
    Cash: '#10B981',
    'Bank Transfer': '#3B82F6',
  },

  // Chart palette — vivid, distinct
  chart: ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'],
  chartDim: ['#F59E0B66', '#3B82F666', '#10B98166', '#8B5CF666', '#EC489966'],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 12,
  body: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
  hero: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  }),
};
