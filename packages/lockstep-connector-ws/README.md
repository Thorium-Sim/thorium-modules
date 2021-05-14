# locksmith-connector-ws

WebSocket connector for @thorium-sim/lockstep

## Usage

`npm install @thorium-sim/lockstep-connector-ws --save`

### Server

```js
import { WebSocketServerConnector } from '@thorium-sim/lockstep-connector-ws';
let connector = new WebSocketServerConnector({
  port: 23482,
});
connector.start({});
```

### Client

```js
import { WebSocketClientConnector } from '@thorium-sim/lockstep-connector-ws';
let connector = new WebSocketClientConnector(
  new WebSocket('ws://localhost:23482')
);
connector.start({}); // Metadata can be any JSON object
```
