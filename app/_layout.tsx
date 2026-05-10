import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { TransactionProvider } from '@/contexts/TransactionContext';
import { WalletProvider } from '@/contexts/WalletContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <TransactionProvider>
          <WalletProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </WalletProvider>
        </TransactionProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
