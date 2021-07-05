type TickNumber = number;
export type Event = {
  type: string;
  context: Record<string, unknown>;
  [param: string]: any;
};
export interface LockstepServerConfig {
  tickMs: number;
}
export interface LockstepClientConfig extends LockstepServerConfig {
  currentTick: TickNumber;
  rngSeed: string | number;
  rngSkip: number;
}
export type EventHandler = (event: Event) => Promise<object>;
export interface LockstepServer {
  connect: (socketSend: (data: string) => void | Promise<void>) => void;
  queueEvent: (event: Event) => Promise<object>;
  tick: (tickNumber: TickNumber) => void;
  onGetGameState: (handler: () => object & LockstepClientConfig) => void;
}
export interface LockstepClient {
  initialize: (gameState:LockstepClientConfig)=>void;
  
}
