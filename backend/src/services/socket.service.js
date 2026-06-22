const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const orgId = socket.handshake.query.orgId;
    if (!orgId) return socket.disconnect(true);
    socket.join(`org:${orgId}`);

    socket.on('disconnect', () => {});
  });

  return io;
}

function emitToOrg(orgId, event, data) {
  if (!io) return;
  io.to(`org:${orgId}`).emit(event, data);
}

module.exports = { initSocket, emitToOrg };
