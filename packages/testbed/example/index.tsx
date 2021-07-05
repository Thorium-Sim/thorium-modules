import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Thing } from '../.';
import { createClient } from '@thorium-sim/net-connector';

const client = createClient({
  connect: () => {
    const websocket = new WebSocket('ws://localhost:3000');
    return websocket;
  },
  connectionParams: () => ({ clientId: Math.random() }),
});

client.on('error', err => console.log('error', err));
client.on('closed', (...params) => console.log('closed', params));
client.on('connected', (...params) => console.log('connected', params));
client.on('connecting', (...params) => console.log('connecting', params));
client.on('reconnecting', (...params) => console.log('reconnecting', params));
client.start();

//@ts-ignore
window.wsClient = client;

const App = () => {
  return (
    <div>
      <Thing />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
