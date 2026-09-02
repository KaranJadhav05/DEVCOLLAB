require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const crypto = require('crypto');

const app = express();

// Service Discovery / Routing Configurations
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  project: process.env.PROJECT_SERVICE_URL || 'http://localhost:5002',
  messaging: process.env.MESSAGING_SERVICE_URL || 'http://localhost:5003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004',
};

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Distributed Trace ID & Request Logging Middleware
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || `trace_${crypto.randomUUID()}`;
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Gateway-Node', 'DevCollab-Gateway-v1');

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/api/health') && !req.url.startsWith('/api/system/status')) {
      console.log(`📡 [Gateway] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms) [Trace: ${traceId.slice(0, 12)}...]`);
    }
  });
  next();
});

// Proxy error helper
const handleProxyError = (err, req, res, serviceName) => {
  console.error(`❌ [Gateway Proxy Error] Failed to route ${req.method} ${req.url} to ${serviceName}:`, err.message);
  if (!res.headersSent) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: `The ${serviceName} is currently unreachable or offline.`,
      service: serviceName,
      traceId: req.traceId,
      timestamp: new Date().toISOString(),
    });
  }
};

// ─── 1. Health & Distributed System Monitoring Endpoints ───────────────────────
// Task 9: Service health-check endpoints & aggregated cluster health
app.get('/api/health', async (req, res) => {
  const healthResults = {};
  const serviceList = [
    { key: 'auth', name: 'Authentication Service', url: `${SERVICES.auth}/health`, port: 5001 },
    { key: 'project', name: 'Project & Collaboration Service', url: `${SERVICES.project}/health`, port: 5002 },
    { key: 'messaging', name: 'Messaging & Signaling Service', url: `${SERVICES.messaging}/health`, port: 5003 },
    { key: 'notification', name: 'Notification Service', url: `${SERVICES.notification}/health`, port: 5004 },
  ];

  await Promise.all(
    serviceList.map(async (svc) => {
      const start = Date.now();
      try {
        const resp = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
        const data = await resp.json();
        healthResults[svc.key] = {
          name: svc.name,
          port: svc.port,
          status: 'UP',
          latencyMs: Date.now() - start,
          details: data,
        };
      } catch (error) {
        healthResults[svc.key] = {
          name: svc.name,
          port: svc.port,
          status: 'DOWN',
          latencyMs: Date.now() - start,
          error: error.message,
        };
      }
    })
  );

  const allUp = Object.values(healthResults).every((s) => s.status === 'UP');

  res.status(allUp ? 200 : 207).json({
    status: allUp ? 'healthy' : 'degraded',
    gateway: {
      port: Number(process.env.PORT) || 5000,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    services: healthResults,
    timestamp: new Date().toISOString(),
  });
});

// Detailed Topology & Metrics for Frontend Distributed Dashboard (Task 10)
app.get('/api/system/status', async (req, res) => {
  const serviceList = [
    { key: 'auth', name: 'Auth & User Service', url: `${SERVICES.auth}/health`, port: 5001, routes: ['/api/auth', '/api/users'] },
    { key: 'project', name: 'Project & Collab Service', url: `${SERVICES.project}/health`, port: 5002, routes: ['/api/projects', '/api/requests'] },
    { key: 'messaging', name: 'Messaging & WebRTC Service', url: `${SERVICES.messaging}/health`, port: 5003, routes: ['/api/messages', '/socket.io'] },
    { key: 'notification', name: 'Notification Service', url: `${SERVICES.notification}/health`, port: 5004, routes: ['/api/notifications'] },
  ];

  const nodeMetrics = await Promise.all(
    serviceList.map(async (svc) => {
      const start = Date.now();
      try {
        const resp = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
        const data = await resp.json();
        return {
          id: svc.key,
          name: svc.name,
          port: svc.port,
          status: 'ONLINE',
          latencyMs: Date.now() - start,
          routes: svc.routes,
          data,
        };
      } catch (error) {
        return {
          id: svc.key,
          name: svc.name,
          port: svc.port,
          status: 'OFFLINE',
          latencyMs: Date.now() - start,
          routes: svc.routes,
          error: error.message,
        };
      }
    })
  );

  res.json({
    architecture: 'Distributed Microservices Architecture',
    gateway: {
      name: 'API Gateway',
      port: Number(process.env.PORT) || 5000,
      status: 'ONLINE',
      uptimeSeconds: Math.round(process.uptime()),
    },
    nodes: nodeMetrics,
    network: {
      type: 'Distributed Inter-Process Communication (REST + WebSockets + WebRTC)',
      ipcFlows: [
        { from: 'Project Service (5002)', to: 'Notification Service (5004)', protocol: 'HTTP REST IPC' },
        { from: 'Client (5173)', to: 'Gateway (5000)', protocol: 'HTTP / WebSocket' },
        { from: 'Gateway (5000)', to: 'Messaging Service (5003)', protocol: 'Socket.IO / WebRTC Signaling' },
      ],
    },
  });
});

// ─── 2. Service Proxy Middlewares ─────────────────────────────────────────────

// Proxy: Authentication & User Service (/api/auth & /api/users -> 5001)
const authProxy = createProxyMiddleware({
  target: SERVICES.auth,
  changeOrigin: true,
  on: {
    error: (err, req, res) => handleProxyError(err, req, res, 'Auth Service'),
  },
});
app.use('/api/auth', authProxy);
app.use('/api/users', authProxy);

// Proxy: Project & Collaboration Service (/api/projects & /api/requests -> 5002)
const projectProxy = createProxyMiddleware({
  target: SERVICES.project,
  changeOrigin: true,
  on: {
    error: (err, req, res) => handleProxyError(err, req, res, 'Project Service'),
  },
});
app.use('/api/projects', projectProxy);
app.use('/api/requests', projectProxy);

// Proxy: Messaging Service REST (/api/messages -> 5003)
const messageProxy = createProxyMiddleware({
  target: SERVICES.messaging,
  changeOrigin: true,
  on: {
    error: (err, req, res) => handleProxyError(err, req, res, 'Messaging Service'),
  },
});
app.use('/api/messages', messageProxy);

// Proxy: Notification Service (/api/notifications -> 5004)
const notificationProxy = createProxyMiddleware({
  target: SERVICES.notification,
  changeOrigin: true,
  on: {
    error: (err, req, res) => handleProxyError(err, req, res, 'Notification Service'),
  },
});
app.use('/api/notifications', notificationProxy);

// Proxy: Socket.IO & WebRTC Signaling WebSocket Upgrade (/socket.io -> 5003)
const wsProxy = createProxyMiddleware({
  target: SERVICES.messaging,
  changeOrigin: true,
  ws: true,
  on: {
    error: (err, req, res) => handleProxyError(err, req, res, 'Messaging WebSocket'),
  },
});
app.use('/socket.io', wsProxy);

// ─── 3. Fallbacks ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found on Gateway` });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🌐 [API Gateway] running on port ${PORT}`);
  console.log(`🔀 Routing map:`);
  console.log(`   - /api/auth, /api/users       -> Auth Service (${SERVICES.auth})`);
  console.log(`   - /api/projects, /api/requests -> Project Service (${SERVICES.project})`);
  console.log(`   - /api/messages, /socket.io   -> Messaging Service (${SERVICES.messaging})`);
  console.log(`   - /api/notifications          -> Notification Service (${SERVICES.notification})`);
  console.log(`   - /api/health, /api/system/status -> Central Gateway Monitor`);
});

// Upgrade WebSocket connections on the server instance
server.on('upgrade', wsProxy.upgrade);
