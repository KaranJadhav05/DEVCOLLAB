require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Connect Database
connectDB();

const app = express();

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
  res.setHeader('X-Service-Name', 'project-service');
  res.setHeader('X-Service-Port', process.env.PORT || '5002');
  next();
});

// Routes
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));

// Service Health-Check Endpoint (Task 9)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  res.json({
    service: 'project-service',
    status: dbState === 1 ? 'healthy' : 'degraded',
    port: Number(process.env.PORT) || 5002,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'unknown',
    },
    ipcTarget: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004',
    memoryUsage: process.memoryUsage(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Project Service Route Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[Project Service Error]:', err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`📁 [Project Service] running on port ${PORT}`);
});
