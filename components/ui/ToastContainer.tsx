import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontSize, Radius, FontWeight, Shadow, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss?: (id: string) => void;
}

const TOAST_CONFIG: Record<string, { color: string; icon: any; bg: string; border: string }> = {
  success: { color: '#34D399', icon: 'check-circle', bg: '#031A0F', border: '#10B98166' },
  error: { color: '#F87171', icon: 'error-outline', bg: '#1A0808', border: '#EF444466' },
  info: { color: '#60A5FA', icon: 'info-outline', bg: '#050F1F', border: '#3B82F666' },
  warning: { color: '#FCD34D', icon: 'warning-amber', bg: '#1A1000', border: '#F59E0B66' },
};

export const ToastContainer = React.memo(({ toasts, onDismiss }: ToastContainerProps) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(toast => {
        const config = TOAST_CONFIG[toast.type] ?? TOAST_CONFIG.info;
        return (
          <Pressable
            key={toast.id}
            style={[styles.toast, { backgroundColor: config.bg, borderColor: config.border }, Shadow.md]}
            onPress={() => onDismiss?.(toast.id)}
          >
            <View style={[styles.iconWrap, { backgroundColor: config.color + '22' }]}>
              <MaterialIcons name={config.icon} size={17} color={config.color} />
            </View>
            <Text style={[styles.message, { color: config.color }]} numberOfLines={2}>
              {toast.message}
            </Text>
            <MaterialIcons name="close" size={14} color={config.color + '88'} />
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    gap: 8,
    pointerEvents: 'box-none',
  },
  toast: {
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
    lineHeight: 18,
  },
});
