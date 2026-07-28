import { registerWebModule, NativeModule } from 'expo';

import { PavoNearbyModuleEvents } from './PavoNearby.types';

// PavoNearbyModule is not available on the web platform.
class PavoNearbyModule extends NativeModule<PavoNearbyModuleEvents> {}

export default registerWebModule(PavoNearbyModule, 'PavoNearby');
