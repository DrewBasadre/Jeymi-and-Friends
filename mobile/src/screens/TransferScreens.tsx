import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bluetooth,
  CheckCircle2,
  Download,
  Radio,
} from 'lucide-react-native';
import {
  Card,
  Chip,
  PrimaryButton,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { saveReceivedModulePackage } from '@/data/repository';
import type { RootStackParamList } from '@/navigation/types';
import {
  nearby,
  type NearbyConnectionUpdate,
  type NearbyReceivedFile,
  type NearbyVerificationRequest,
} from '@/services/nearby';
import { useSessionStore } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiveTransfer'>;

export function ReceiveTransferScreen({ navigation }: Props) {
  const student = useSessionStore((state) => state.student);
  const [advertising, setAdvertising] = useState(false);
  const [connection, setConnection] = useState<NearbyConnectionUpdate | null>(
    null,
  );
  const [received, setReceived] = useState<NearbyReceivedFile | null>(null);
  const available = nearby.isAvailable();

  useEffect(() => {
    const verificationSubscription = nearby.addVerificationListener(
      showVerification,
    );
    const connectionSubscription = nearby.addConnectionListener(setConnection);
    const receivedSubscription = nearby.addReceivedFileListener((file) => {
      void saveReceivedModulePackage(file)
        .then(() => setReceived(file))
        .catch((error: unknown) => {
          Alert.alert(
            'Module could not be saved',
            error instanceof Error ? error.message : 'Try receiving it again.',
          );
        });
    });
    return () => {
      verificationSubscription?.remove();
      connectionSubscription?.remove();
      receivedSubscription?.remove();
      void nearby.stop();
    };
  }, []);

  function showVerification(request: NearbyVerificationRequest) {
    Alert.alert(
      `Connect to ${request.peerName}?`,
      `Confirm this code appears on both devices: ${request.code}`,
      [
        {
          text: 'Reject',
          style: 'cancel',
          onPress: () => void nearby.answerVerification(request.peerId, false),
        },
        {
          text: 'Codes match',
          onPress: () => void nearby.answerVerification(request.peerId, true),
        },
      ],
      { cancelable: false },
    );
  }

  async function startReceiving() {
    try {
      await nearby.advertise(`Student ${student?.firstName ?? 'WAIS'}`);
      setAdvertising(true);
    } catch (error) {
      Alert.alert(
        'Nearby unavailable',
        error instanceof Error
          ? error.message
          : 'Use a physical development build.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Receive a module"
        subtitle="Keep this screen open while the Markdown package arrives."
        onBack={navigation.goBack}
      />
      <Card accent={available ? colors.emerald : colors.amber}>
        <View style={styles.headingRow}>
          <Bluetooth
            size={25}
            color={available ? colors.emerald : colors.amber}
          />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>
              {available ? 'Offline nearby transfer' : 'Development build required'}
            </Text>
            <Text style={styles.body}>
              Transfer uses encrypted Nearby Connections over Bluetooth and
              local Wi-Fi. It does not need internet.
            </Text>
          </View>
        </View>
      </Card>
      <PrimaryButton
        label={advertising ? 'Waiting for teacher...' : 'Make this device visible'}
        icon={advertising ? Radio : Download}
        disabled={!available || advertising}
        onPress={() => void startReceiving()}
      />
      {connection ? (
        <Card>
          <View style={styles.statusRow}>
            <Text style={styles.rowTitle}>Connection</Text>
            <Chip
              label={capitalize(connection.state)}
              color={
                connection.state === 'connected'
                  ? colors.emerald
                  : colors.indigo
              }
              selected
            />
          </View>
          {connection.errorMessage ? (
            <Text style={styles.error}>{connection.errorMessage}</Text>
          ) : null}
        </Card>
      ) : null}
      {received ? (
        <Card accent={colors.emerald}>
          <CheckCircle2 size={28} color={colors.emerald} />
          <Text style={styles.cardTitle}>Module saved</Text>
          <Text style={styles.rowTitle}>{received.displayName}</Text>
          <Text style={styles.body}>
            {formatBytes(received.sizeBytes)} verified with SHA-256 and added
            to this device.
          </Text>
          <PrimaryButton
            label="Open modules"
            onPress={() => navigation.replace('StudentTabs')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toLocaleUpperCase()}${value.slice(1)}` : value;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
