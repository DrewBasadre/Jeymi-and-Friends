import { registerWebModule, NativeModule } from 'expo';

import { WaisNearbyModuleEvents } from './WaisNearby.types';

// WaisNearbyModule is not available on the web platform.
class WaisNearbyModule extends NativeModule<WaisNearbyModuleEvents> {}

export default registerWebModule(WaisNearbyModule, 'WaisNearbyModule');
