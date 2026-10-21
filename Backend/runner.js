// Multi-Process Distributed System Dev Runner
// Runs API Gateway and all 4 Microservices in isolated Node.js child processes
require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');




const services = [
  { name: 'AUTH (5001)', dir: path.join(__dirname, 'auth-service'), file: 'server.js', port: 5001, color: '\x1b[35m' },
  { name: 'PROJ (5002)', dir: path.join(__dirname, 'project-service'), file: 'server.js', port: 5002, color: '\x1b[34m' },
  { name: 'MSGS (5003)', dir: path.join(__dirname, 'messaging-service'), file: 'server.js', port: 5003, color: '\x1b[36m' },
  { name: 'NOTF (5004)', dir: path.join(__dirname, 'notification-service'), file: 'server.js', port: 5004, color: '\x1b[33m' },
  { name: 'GATE (5000)', dir: path.join(__dirname, 'gateway'), file: 'server.js', port: 5000, color: '\x1b[32m' },
];

const RESET = '\x1b[0m';
const processes = [];

console.log('===============================================================');
console.log('🚀 Launching DevCollab Distributed Microservices Cluster');
console.log('===============================================================');

services.forEach((svc) => {
  const env = {
    ...process.env,
    PORT: svc.port.toString(),
    MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/devcollab',
    JWT_SECRET: process.env.JWT_SECRET || 'devcollab_super_secret_jwt_key_2026',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    AUTH_SERVICE_URL: 'http://localhost:5001',
    PROJECT_SERVICE_URL: 'http://localhost:5002',
    MESSAGING_SERVICE_URL: 'http://localhost:5003',
    NOTIFICATION_SERVICE_URL: 'http://localhost:5004',
  };

  const proc = spawn('node', [svc.file], {
    cwd: svc.dir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.log(`${svc.color}[${svc.name}]${RESET} ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.error(`${svc.color}[${svc.name} ERR]${RESET} ${line}`);
    });
  });

  proc.on('close', (code) => {
    console.log(`${svc.color}[${svc.name}]${RESET} Exited with code ${code}`);
  });

  processes.push(proc);
});

// Graceful shutdown
const cleanup = () => {
  console.log('\n🛑 Shutting down all distributed services...');
  processes.forEach((p) => {
    try {
      p.kill();
    } catch {}
  });
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
