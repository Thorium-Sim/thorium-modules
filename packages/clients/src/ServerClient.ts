import { createSynchronizer } from '@thorium-sim/json-patch-synchronizer';
import WebSocket from 'ws';
import { ClientPatchData } from './types';

export interface Client {
  id: string;
  connected: boolean;
  socket?: WebSocket;
}

export function createClient(clientId: string, socket: WebSocket) {
  const client = createSynchronizer<Client>(
    { id: clientId, connected: true, socket },
    {
      maxOperations: 5,
      throttleTimeMs: 300,
      onSendPatches: ({ patch, state }) => {
        const filteredPatches = patch.filter(
          operation => operation.path !== '/socket'
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
