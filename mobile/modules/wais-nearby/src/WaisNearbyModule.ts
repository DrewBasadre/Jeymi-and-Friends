import { NativeModule, requireNativeModule } from 'expo';

import { WaisNearbyModuleEvents } from './WaisNearby.types';

declare class WaisNearbyModule extends NativeModule<WaisNearbyModuleEvents> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<WaisNearbyModule>('WaisNearby');
