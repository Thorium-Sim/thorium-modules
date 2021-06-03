import { Operation } from 'fast-json-patch';

export interface ClientPatchData {
  type: 'clientPatch';
  patches: Operation[];
}
