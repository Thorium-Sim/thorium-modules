import { EventEmitter } from 'events';

import {
  ActionConstraint,
  Connector,
  OutputQueueItem,
  StateConstraint,
  SynchronizerConfig,
} from '@thorium-sim/types';
import LocalConnectorServer from './localConnectorServer';
import LockstepClient from '../src/LockstepClient';
export default class LocalConnectorClient<
  S extends StateConstraint,
  A extends ActionConstraint
> extends EventEmitter implements Connector<S, A> {
  server: LocalConnectorServer<S, A>;
  delay: number;
  clientId: number;
  synchronizer!: LockstepClient<S, A>;
  constructor(server: LocalConnectorServer<S, A>, delay: number) {
    super();
    this.server = server;
    this.delay = delay;
    this.clientId = server.clients++;
    server.on('push', (data, target) => {
      if (this.clientId !== target) return;
      setTimeout(
        () =>
          this.synchronizer.handleAction(
            { id: this.synchronizer.tickId + 1, rtt: 0, actions: data },
            false,
            target
          ),
        this.delay
      );
    });
    server.on('ack', (data, target) => {
      if (this.clientId !== target) return;
      setTimeout(() => this.server.handleAck(data, target), this.delay);
    });
    server.on('connect', (data, target) => {
      if (this.clientId !== target) return;
      setTimeout(
        () => this.synchronizer.handleConnect(data, target),
        this.delay
      );
    });
    server.on('disconnect', target => {
      if (this.clientId !== target) return;
      setTimeout(() => this.synchronizer.handleDisconnect(target), this.delay);
    });
  }
  setSynchronizer(synchronizer: LockstepClient<S, A>) {
    this.synchronizer = synchronizer;
  }
  getHostId() {
    return 0;
  }
  getClientId() {
    return this.clientId;
  }
  push(data: OutputQueueItem<A>[]) {
    setTimeout(
      () =>
        this.server.handleAction(
          { id: this.clientId, rtt: this.synchronizer.rtt, actions: data },
          this.clientId
        ),
      this.delay
    );
  }
  ack(data: { id: number; actions: OutputQueueItem<A>[] }) {
    setTimeout(() => this.server.handleAck(data, this.clientId), this.delay);
  }
  connect(data: {
    state: S;
    tickId: number;
    config: SynchronizerConfig;
    id: number;
    meta: Record<string, unknown>;
  }) {
    setTimeout(
      () => this.server.handleConnect(data, this.clientId),
      this.delay
    );
  }
  error(data: any) {
    console.log('Client Error: ' + data);
  }
  disconnect() {
    setTimeout(() => this.server.handleDisconnect(this.clientId), this.delay);
  }
}
