const { useServer } = require('@thorium-sim/net-connector-ws');
const ws = require('ws');
const http = require('http');

let httpServer = http.createServer();

const wsServer = new ws.Server({
  server: httpServer,
  path: '/',
});

const clients = {};
const port = 3000;
httpServer.listen(port, () => {
  console.log('Server running');
  useServer(
    {
      onConnect(ctx) {
        console.log('conencted');
        clients[ctx.connectionParams.clientId] = ctx.socket;
      },
      onDisconnect: (ctx, code, reason) => console.log(code, reason),
      onClose: (ctx, code, reason) => console.log(code, reason),
      context: async (ctx, message) => ({ ...ctx.connectionParams }),
      execute: async message => {
        setTimeout(() => {
          clients[message.context.clientId].send({ type: 'Testing!' });
        }, 1000);
        return { type: message.type, message: 'Hi there!' };
      },
    },
    wsServer
  );
});
