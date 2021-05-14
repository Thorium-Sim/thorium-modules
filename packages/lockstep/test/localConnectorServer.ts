import {
  ActionConstraint,
  ConnectionData,
  Connector,
  InputQueueItem,
  OutputQueueItem,
  StateConstraint,
  SynchronizerConfig,
} from '../../types/dist';
import LockstepServer from '../src/LockstepServer';

export default class LocalConnectorServer<
  S extends StateConstraint,
  A extends ActionConstraint
> extends Connector<S, A> {
  clients: number;
  synchronizer!: LockstepServer<S, A>;
  constructor() {
    super();
    this.clients = 1;
  }
  setSynchronizer(synchronizer: LockstepServer<S, A>) {
    this.synchronizer = synchronizer;
  }
  getHostId() {
    return 0;
  }
  getClientId() {
    return 0;
  }
  push(data: OutputQueueItem<A>[], target: number) {
    this.emit('push', data, target);
  }
  ack(
    data: {
      id: number;
      actions: OutputQueueItem<A>[];
    },
    target: number
  ) {
    this.emit('ack', data, target);
  }
  connect(
    data: {
      state: S;
      tickId: number;
      config: SynchronizerConfig;
      id: number;
      meta: Record<string, unknown>;
    },
    target: number
  ) {
    this.emit('connect', data, target);
  }
  disconnect(target: number) {
    this.emit('disconnect', target);
  }
  error(data: unknown, target: number) {
    console.log('Error to ' + target + ': ' + data);
  }
  handleAction(data: InputQueueItem<A>, target: number) {
    this.synchronizer.handleAction(data, false, target);
  }
  handleConnect(data: ConnectionData<S>, target: number) {
    this.synchronizer.handleConnect(data, target);
  }
  handleDisconnect(target: number) {
    this.synchronizer.handleDisconnect(target);
  }
  handleAck(
    data: {
      id: number;
      actions: OutputQueueItem<A>[];
    },
    target: number
  ) {
    this.synchronizer.handleAck(data, target);
  }
}
