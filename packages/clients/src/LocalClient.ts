import jsonPatch, { Operation } from 'fast-json-patch';
import create, { UseStore } from 'zustand';
import { ClientPatchData } from './types';

type ClientState = Record<string, unknown> & {
  applyPatches: (patches: Operation[]) => void;
};
export const useClient = create<ClientState>((setState, getState) => ({
  applyPatches: patches => {
    const newResult = jsonPatch.applyPatch(getState(), patches);
    setState(newResult.newDocument as ClientState);
  },
}));

export function getClient<T extends object>() {
  return (useClient as unknown) as UseStore<T>;
}

export function setUpClientSynchronization(socket: WebSocket) {
  useClient.subscribe((state, previousState) => {
    const patches = jsonPatch.compare(state, previousState);
    const message: ClientPatchData = { type: 'clientPatch', patches };
    socket.send(JSON.stringify(message));
  });

  socket.addEventListener('message', message => {
    const parsed = JSON.parse(message.data) as ClientPatchData;
    if (parsed.type === 'clientPatch') {
      useClient.getState().applyPatches(parsed.patches);
    }
  });
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'clientConnect' }));
  });
}
