import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export type Connectivity = 'checking' | 'online' | 'offline';

function toConnectivity(state: Network.NetworkState): Connectivity {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }
  if (state.isConnected === true) return 'online';
  return 'checking';
}

export function useConnectivity(): Connectivity {
  const [connectivity, setConnectivity] = useState<Connectivity>('checking');

  useEffect(() => {
    let active = true;
    void Network.getNetworkStateAsync().then((state) => {
      if (active) setConnectivity(toConnectivity(state));
    });
    const subscription = Network.addNetworkStateListener((state) => {
      setConnectivity(toConnectivity(state));
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return connectivity;
}

