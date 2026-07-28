import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { AppMode } from '@/domain/types';

const MODE_OVERRIDE_KEY = 'pavo.modeOverride';
const LIGHTWEIGHT_MEMORY_THRESHOLD = 384 * 1024 * 1024;

export interface DeviceCapability {
  mode: AppMode;
  reason: string;
  canUseOnlineEnhancements: boolean;
}

export async function detectDeviceCapability(): Promise<DeviceCapability> {
  const override = await AsyncStorage.getItem(MODE_OVERRIDE_KEY);
  if (override === 'lightweight' || override === 'full') {
    return {
      mode: override,
      reason: 'Selected in settings',
      canUseOnlineEnhancements: override === 'full',
    };
  }

  if (Platform.OS === 'android') {
    const maxMemory = await Device.getMaxMemoryAsync().catch(() => Number.MAX_SAFE_INTEGER);
    if (maxMemory < LIGHTWEIGHT_MEMORY_THRESHOLD) {
      return {
        mode: 'lightweight',
        reason: 'Optimized for this device memory',
        canUseOnlineEnhancements: false,
      };
    }
  }

  return {
    mode: 'full',
    reason: 'This device supports online enhancements',
    canUseOnlineEnhancements: true,
  };
}

export async function setModeOverride(mode: AppMode | null): Promise<DeviceCapability> {
  if (mode) await AsyncStorage.setItem(MODE_OVERRIDE_KEY, mode);
  else await AsyncStorage.removeItem(MODE_OVERRIDE_KEY);
  return detectDeviceCapability();
}

