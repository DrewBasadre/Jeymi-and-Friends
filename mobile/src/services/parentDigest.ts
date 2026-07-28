import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { ParentDigest } from '@/domain/types';

export type DigestDelivery = 'notification' | 'in-app';

export async function deliverParentDigest(
  digest: ParentDigest,
): Promise<DigestDelivery> {
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return 'in-app';
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'in-app';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('parent-digests', {
      name: 'Parent weekly digests',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'WAIS weekly learning digest',
      body: digest.insightNote,
      data: {
        digestId: digest.digestId,
        studentId: digest.studentId,
      },
    },
    trigger: null,
  });
  return 'notification';
}
