import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

// Render (and most PaaS hosts) inject PORT and require the app to bind to it —
// WEBSOCKET_PORT stays as the local-dev override.
const port = process.env.PORT || process.env.WEBSOCKET_PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket real-time channel gateway is active.\n');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
});

io.on('connection', (socket) => {
  console.log(`[WebSocket Client] Client connected. Socket ID: ${socket.id}`);

  // Join company channel for real-time data sync (e.g. POS updates)
  socket.on('subscribe-tenant', (companyId) => {
    socket.join(companyId);
    console.log(`[WebSocket Channel] Socket ${socket.id} subscribed to tenant room: "${companyId}"`);
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket Client] Client disconnected. Socket ID: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`📡 WebSocket Gateway Server running on port: ${port}`);
});
