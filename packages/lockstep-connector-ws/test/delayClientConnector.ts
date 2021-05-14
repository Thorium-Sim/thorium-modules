import { ActionConstraint, StateConstraint } from '@thorium-sim/types';
import WebSocketClientConnector, {
  AllowedData,
} from '../src/webSocketClientConnector';
import ws from 'ws';
export default class DelayClientConnector<
  S extends StateConstraint,
  A extends ActionConstraint
> extends WebSocketClientConnector<S, A> {
  delay: number;
  constructor(address: string) {
    const socket = new ws(address);
    super(socket);
    this.delay = 0;
  }
  sendData(data: AllowedData<A>) {
    setTimeout(() => super.sendData(data), this.delay);
  }
  handleMessage(string: string) {
    setTimeout(() => super.handleMessage(string), this.delay);
  }
  handleError(event: any) {
    setTimeout(() => super.handleError(event), this.delay);
  }
  handleDisconnect() {
    setTimeout(() => super.handleDisconnect(), this.delay);
  }
}
