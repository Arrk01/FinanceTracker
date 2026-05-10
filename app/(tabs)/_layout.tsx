import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({
            ios: insets.bottom + 58,
            android: insets.bottom + 60,
            default: 68,
          }),
          paddingTop: 8,
          paddingBottom: Platform.select({
            ios: insets.bottom + 6,
            android: insets.bottom + 8,
            default: 8,
          }),
          paddingHorizontal: 8,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        },
        tabBarActiveTintColor: Colors.accentLight,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[tabIconStyles.wrap, focused && tabIconStyles.wrapActive]}>
              <MaterialIcons name="dashboard" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[tabIconStyles.addWrap, focused && tabIconStyles.addWrapActive]}>
              <MaterialIcons name="add" size={size} color={focused ? '#000' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[tabIconStyles.wrap, focused && tabIconStyles.wrapActive]}>
              <MaterialIcons name="receipt-long" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[tabIconStyles.wrap, focused && tabIconStyles.wrapActive]}>
              <MaterialIcons name="bar-chart" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[tabIconStyles.wrap, focused && tabIconStyles.wrapActive]}>
              <MaterialIcons name="account-balance-wallet" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: {
    backgroundColor: Colors.accentDim + '44',
  },
  addWrap: {
    width: 40,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addWrapActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
});
