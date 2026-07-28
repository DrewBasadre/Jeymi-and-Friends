import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/ui';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useSessionStore } from '@/store/session';

export default function App() {
  const ready = useSessionStore((state) => state.ready);
  const bootstrap = useSessionStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? <RootNavigator /> : <LoadingScreen />}
    </SafeAreaProvider>
  );
}
