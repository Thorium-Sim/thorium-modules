import { createSynchronizer } from '@thorium-sim/json-patch-synchronizer';
import { ClientPatchData } from './types';
import type { NetConnectorBase} from '@thorium-sim/types'
export type Client<T extends object> = T & {
  id: string;
  connected: boolean;
  socket?: NetConnectorBase
};

export function createClient<T extends object = any>(
  clientId: string,
  socket: NetConnectorBase
) {
  const client = createSynchronizer<Client<T>>(
    { id: clientId, connected: true, socket } as any,
    {
      maxOperations: 5,
      throttleTimeMs: 300,
      onSendPatches: ({ patch, state }) => {

        const filteredPatches = patch.filter(
          operation => !operation.path.includes('/socket')
        );
        const socket = state.socket;
        if (!socket) return;
        const message: ClientPatchData = {
          type: 'clientPatch',
          patches: filteredPatches,
        };
        socket.send(JSON.stringify(message));
      },
    }
  );
  return client;
}
