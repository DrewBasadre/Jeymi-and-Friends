import { NativeModule, requireNativeModule } from 'expo';

import { PavoNearbyModuleEvents } from './PavoNearby.types';

declare class PavoNearbyModule extends NativeModule<PavoNearbyModuleEvents> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<PavoNearbyModule>('PavoNearby');
