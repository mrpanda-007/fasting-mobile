import { ArchitectsDaughter_400Regular, useFonts } from '@expo-google-fonts/architects-daughter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TodayScreen } from '../features/today/screens/TodayScreen';

export default function App() {
  // Functional UI always has a system-font fallback; this optional face is for rare display accents.
  useFonts({ ArchitectsDaughter_400Regular });

  return (
    <SafeAreaProvider>
      <TodayScreen />
    </SafeAreaProvider>
  );
}
