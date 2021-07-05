import jsonPatch, { Operation } from 'fast-json-patch';
import create, { UseStore } from 'zustand';
import { ClientPatchData } from './types';
import { NetConnectorBase } from '@thorium-sim/types';
type ClientState = Record<string, unknown> & {
  applyPatches: (patches: Operation[]) => void;
};
export const useClient = create<ClientState>((setState, getState) => ({
  applyPatches: patches => {
    const { applyPatches, ...existingState } = getState();
    const newResult = jsonPatch.applyPatch(existingState, patches);
    setState(newResult.newDocument as ClientState);
  },
}));

export function getClient<T extends object>() {
  return (useClient as unknown) as UseStore<T>;
}

export function setUpClientSynchronization(socket: NetConnectorBase) {
  useClient.subscribe((state, previousState) => {
    const patches = jsonPatch.compare(previousState, state);
    const message: ClientPatchData = {
      type: 'clientPatch',
      patches,
    };
    socket.send(JSON.stringify(message));
  });

  socket.onMessage(message => {
    const parsed = JSON.parse(message) as ClientPatchData;
    if (parsed.type === 'clientPatch') {
      useClient.getState().applyPatches(parsed.patches);
    }
  });
}
