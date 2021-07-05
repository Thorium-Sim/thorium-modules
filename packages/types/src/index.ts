import { EventEmitter } from 'events';
export * from './thorium';
export * from './netConnector';

export type StateConstraint = unknown[] | Record<number | string, unknown>;
export type ActionConstraint = { [key: string]: any; type: string };
export interface SimulationMachine<S extends StateConstraint, A> {
  getState(): S;
  loadState(state: S): void;
  run(action: A): S;
}

/**
 * @param dynamic If true, the tick only triggers when there is an action. This is useful if tick shouldn't happen often.
 * @param dynamicPushWait How long it should wait to push triggered action? Too low value can take too much network bandwidth, too high value increases the response time. (Dynamic mode)
 * @param dynamicTickWait How long the server should wait to trigger new tick? Too low value can take too much network bandwidth, too high value increases the response time. (Dynamic mode)
 * @param fixedTick How often does the tick occur? Too low value can take too much network bandwidth, too high value increases the response time. (Fixed mode)
 * @param fixedBuffer How much should it store the tick/push event in the buffer? This is used to mitigate network jittering. (Client, Fixed mode)
 * @param disconnectWait How long should it wait before disconnecting not responding client? High value can freeze the system for too long time, low value can disconnect the client even if it doesn't have any problem.
 * @param freezeWait How long should it wait before start freezing and waiting for acknowledge? Too low value can slow down the system, too high value can explode the network buffer.
 */
export interface SynchronizerConfig {
  dynamic: boolean;
  dynamicPushWait: number;
  dynamicTickWait: number;
  fixedTick: number;
  fixedBuffer: number;
  disconnectWait: number;
  freezeWait: number;
}

export type OutputQueueItem<A> = {
  promiseId: number;
} & A;

export type InputQueueItem<A> = {
  id: number;
  rtt: number;
  actions: OutputQueueItem<A>[];
};

export interface ConnectionData<S extends StateConstraint> {
  tickId: number;
  config: SynchronizerConfig;
  meta: Record<string, unknown>;
  state: S;
}
// This is just a dummy class marking the methods required by synchronizer.
export abstract class Connector<
  S extends StateConstraint,
  A extends ActionConstraint
> extends EventEmitter {
  abstract getHostId(): number;
  abstract getClientId(): number;
  abstract push(
    data: OutputQueueItem<A>[],
    target?: number,
    rtt?: number
  ): void;
  abstract ack(
    data: { id: number; actions: OutputQueueItem<A>[] },
    target?: number
  ): void;
  abstract connect(
    data: {
      state: S;
      tickId: number;
      config: SynchronizerConfig;
      id: number;
      meta: Record<string, unknown>;
    },
    target?: number
  ): void;
  abstract disconnect(target?: number): void;
  abstract error(data: unknown, target?: number): void;
}
