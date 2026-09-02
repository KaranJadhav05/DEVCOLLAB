require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const User = require('./models/User');
const { initSocketHandlers, onlineUsers, meetingRooms } = require('./signaling/webrtcHandler');

// Connect Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io Server (Task 31, 32, 33, 49, 50, 83, 84)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 25000,
});

// Socket.io Auth Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devcollab_super_secret_jwt_key_2026');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      // Fallback
      socket.user = { _id: decoded.id, name: 'Developer', avatar: '' };
    } else {
      socket.user = user;
    }
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Initialize real-time streams and WebRTC handlers
initSocketHandlers(io);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Distributed Tracing / Identification Middleware
app.use((req, res, next) => {
  res.setHeader('X-Service-Name', 'messaging-service');
  res.setHeader('X-Service-Port', process.env.PORT || '5003');
  next();
});

// Routes
app.use('/api/messages', require('./routes/messageRoutes'));

// Service Health-Check Endpoint (Task 9)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  res.json({
    service: 'messaging-service',
    status: dbState === 1 ? 'healthy' : 'degraded',
    port: Number(process.env.PORT) || 5003,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'unknown',
    },
    realtime: {
      onlineUsersCount: onlineUsers.size,
      activeMeetingRooms: meetingRooms.size,
      totalSocketConnections: io.engine.clientsCount,
    },
    memoryUsage: process.memoryUsage(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Messaging Service Route Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[Messaging Service Error]:', err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5003;
server.listen(PORT, () => {
  console.log(`💬 [Messaging Service] running on port ${PORT}`);
  console.log(`📡 Socket.IO & WebRTC Signaling server initialized`);
});
