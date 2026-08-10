import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, FontWeight } from '@/constants/theme';
import { Category, TransactionType } from '@/constants/config';

interface CategoryBadgeProps {
  category: Category;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
}

interface TypeBadgeProps {
  type: TransactionType;
  size?: 'xs' | 'sm' | 'md';
}

const CATEGORY_SHORT: Record<Category, string> = {
  'Life Infrastructure': 'Life',
  'Future Me': 'Future',
  'Performance & Growth': 'Growth',
  'Relationships & Generosity': 'Social',
  'Lifestyle Enjoyment': 'Fun',
};

const TYPE_ICONS: Record<string, string> = {
  Need: '⚡',
  Want: '✦',
  Saving: '◈',
  Transfer: '⇄',
  CardPayment: '💳',
};

export const CategoryBadge = React.memo(({ category, size = 'md', showDot = true }: CategoryBadgeProps) => {
  const colors = Colors.categories[category];
  const isXS = size === 'xs';
  const isSM = size === 'sm';

  const px = isXS ? 5 : isSM ? 7 : 10;
  const py = isXS ? 2 : isSM ? 3 : 5;
  const dotSz = isXS ? 4 : isSM ? 5 : 7;
  const fs = isXS ? FontSize.xs - 1 : isSM ? FontSize.xs : FontSize.sm;
  const label = (isXS || isSM) ? CATEGORY_SHORT[category] : category;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: px,
          paddingVertical: py,
        },
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.dot, width: dotSz, height: dotSz, borderRadius: dotSz / 2 },
          ]}
        />
      )}
      <Text
        style={[styles.text, { color: colors.text, fontSize: fs }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});

export const TypeBadge = React.memo(({ type, size = 'md' }: TypeBadgeProps) => {
  // Graceful fallback for Transfer / CardPayment types
  const knownTypes = ['Need', 'Want', 'Saving'] as const;
  const isKnown = knownTypes.includes(type as typeof knownTypes[number]);
  const colors = isKnown ? Colors.types[type as 'Need' | 'Want' | 'Saving'] : {
    bg: Colors.surfaceElevated,
    border: Colors.border,
    text: Colors.textMuted,
    dot: Colors.textMuted,
  };
  const isSM = size === 'sm' || size === 'xs';
  const icon = TYPE_ICONS[type] ?? '○';
  const label = type === 'CardPayment' ? 'Card Pay' : type;

  return (
    <View
      style={[
        styles.typeBadge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: isSM ? 6 : 9,
          paddingVertical: isSM ? 2 : 4,
        },
      ]}
    >
      <Text style={[styles.typeIcon, { fontSize: isSM ? 8 : 10 }]}>
        {icon}
      </Text>
      <Text
        style={[
          styles.text,
          { color: colors.text, fontSize: isSM ? FontSize.xs : FontSize.sm, letterSpacing: 0.2 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  dot: {},
  typeIcon: { color: '#ffffff99' },
  text: { fontWeight: FontWeight.semibold },
});
