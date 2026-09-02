# DevCollab — Containerized Distributed Microservices & Real-Time Collaboration Platform

DevCollab is a full-stack distributed system designed for developer collaboration. The platform features an independent microservices architecture, network-based inter-process communication (IPC), WebRTC distributed multimedia streaming, Socket.IO real-time stream synchronization, and multi-container Docker Compose orchestration.

---

## 📑 Distributed Systems Formative Assessment (FA) Mapping

This project is built and aligned with core **Distributed Systems (DS)** evaluation criteria and learning outcomes:

| # | Task / Requirement | Distributed Systems Concept | Implemented Component / Evidence |
|---|---|---|---|
| **1** | Split backend into independent services | **Distributed Architecture** | Decomposed monolithic backend into 4 microservices + API Gateway |
| **2** | Dedicated Authentication Service | **Service-Based Architecture** | `Backend/auth-service` (Port: `5001`) — User accounts, JWT, profiles |
| **3** | Dedicated Project & Collaboration Service | **Distributed Components** | `Backend/project-service` (Port: `5002`) — Projects CRUD, team members |
| **4** | Dedicated Messaging Service | **Distributed Components** | `Backend/messaging-service` (Port: `5003`) — Private chat & history |
| **5** | Dedicated Notification Service | **Distributed Components** | `Backend/notification-service` (Port: `5004`) — In-app alerts & push storage |
| **6** | Run each service on independent ports | **Distributed Processes & Isolation** | Ports `5000` (Gateway), `5001` (Auth), `5002` (Project), `5003` (Msg), `5004` (Notif) |
| **7** | Inter-service network communication | **Inter-Process Communication (IPC)** | HTTP REST IPC (`project-service` ➔ `notification-service:5004/api/notifications/dispatch`) |
| **8** | API Gateway to route client traffic | **Middleware / Gateway Pattern** | `Backend/gateway` (Port: `5000`) using `http-proxy-middleware` & WebSocket upgrade |
| **9** | Service health-check endpoints | **Distributed System Monitoring** | `/health` on all services, aggregated `/api/health` & `/api/system/status` on Gateway |
| **10** | Multi-node communication demonstration | **Distributed Computation & Tracing** | `X-Trace-Id` distributed correlation headers + Live Cluster UI visualizer |
| **31** | Real-time chat streaming | **Stream Communication** | Socket.IO event streams (`send_message`, `receive_message`, `message_sent`) |
| **32** | Real-time typing indicators | **Real-Time Stream Synchronization** | Live `typing` and `stop_typing` event streaming |
| **33** | Online / offline user status | **Real-Time Presence Tracking** | Centralized `online_users` live presence broadcasting |
| **49** | Screen sharing | **WebRTC Media Streams** | `navigator.mediaDevices.getDisplayMedia` dynamic track replacement |
| **50** | Direct peer-to-peer file transfer | **P2P Data Channel (No Server Storage)** | WebRTC `RTCDataChannel` binary chunk streaming directly between browsers |
| **83** | Video meeting for project teams | **Distributed Multimedia** | Multi-peer WebRTC video mesh rooms (`/meeting/:roomId`) |
| **84** | Voice communication & audio visualizer | **Multimedia Streaming** | Real-time WebRTC audio streams with mute/unmute state broadcast |
| **—** | Containerized distributed system | **Container Orchestration** | `docker-compose.yml` (7 containers, bridge network, health dependencies) |

---

## 🏛️ System Architecture Diagram

```text
                      ┌─────────────────────────────────┐
                      │    Frontend (React 19 + Vite)   │
                      │           Port: 5173            │
                      └────────────────┬────────────────┘
                                       │ HTTP / WebSockets / WebRTC
                                       ▼
                      ┌─────────────────────────────────┐
                      │      API Gateway (Express)      │
                      │           Port: 5000            │
                      └────┬───────┬────────┬───────┬───┘
                           │       │        │       │
            ┌──────────────┘       │        │       └──────────────┐
            ▼                      ▼        ▼                      ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  Auth Service        │ │  Project Service     │ │  Messaging Service   │ │ Notification Service │
│  Port: 5001          │ │  Port: 5002          │ │  Port: 5003          │ │ Port: 5004           │
│  - User Auth & JWT   │ │  - Projects CRUD     │ │  - Socket.IO Chat    │ │ - In-App Alerts      │
│  - User Profiles     │ │  - Collab Requests   │ │  - WebRTC Signaling │ │ - IPC Notification   │
│  - /health           │ │  - IPC to Notifs     │ │  - P2P Data Channel  │ │   Dispatch           │
│                      │ │  - /health           │ │  - /health           │ │ - /health            │
└──────────┬───────────┘ └─────────┬────────────┘ └──────────┬───────────┘ └──────────┬───────────┘
           │                       │                         │                        │
           └───────────────────────┼─────────────────────────┴────────────────────────┘
                                   │ (Shared Database Storage)
                                   ▼
                      ┌─────────────────────────┐
                      │   MongoDB Database      │
                      │   Port: 27017           │
                      └─────────────────────────┘
```

---

## ⚡ Project Sync-Up & Demonstration Guide (Viva / Assessment)

Follow this step-by-step walkthrough to demonstrate all distributed systems features to evaluators:

### Step 1: Start the Distributed System
```bash
# Start all 7 containers with Docker Compose
docker compose up --build -d

# Verify all containers are healthy and running
docker ps
```

### Step 2: Demonstrate Distributed System Monitoring (Tasks 9 & 10)
1. Open the frontend in your browser: `http://localhost:5173`.
2. Click the **Cluster** button (with live green pulse) in the top navbar.
3. Observe the **Distributed System Monitor** modal showing:
   - Live status (`ONLINE`) for Gateway, Auth, Project, Messaging, and Notification services.
   - Real-time round-trip latency measurements (ms) for each backend node.
   - Network topology and IPC protocol flow diagrams.

### Step 3: Demonstrate Inter-Process Communication (IPC) (Tasks 7 & 10)
1. Register/Login as User A in one browser window, and User B in an Incognito window.
2. User A creates a project under **New Post**.
3. User B browses **Explore** and clicks **Apply to Join**.
4. **IPC Demonstration**: `project-service` (Port 5002) executes an asynchronous HTTP network call to `notification-service:5004/api/notifications/dispatch`.
5. User A immediately receives a real-time notification in the Navbar bell dropdown without page refresh.

### Step 4: Demonstrate Real-Time Stream Communication (Tasks 31, 32, 33)
1. Navigate to **Chat** on both windows.
2. Observe the **🟢 Online** presence indicator next to active contacts.
3. Start typing in User A's input box — User B instantly sees the real-time **typing indicator** stream.
4. Send a message — it appears instantaneously via Socket.IO bidirectional stream.

### Step 5: Demonstrate WebRTC Distributed Multimedia & P2P (Tasks 49, 50, 83, 84)
1. From any Project card or Navbar, click **Video Room** (`/meeting/:roomId`).
2. Join the room on both windows:
   - **Video Mesh (Task 83):** Both peer video feeds render simultaneously.
   - **Voice Stream (Task 84):** Toggle mic on/off to see audio track status updates.
   - **Screen Sharing (Task 49):** Click **Share Screen** to broadcast a display stream.
   - **P2P Direct File Transfer (Task 50):** Switch to the **P2P Files** tab, select a file, and watch binary chunks stream directly over `RTCDataChannel` to the peer with an instant download button.

---

## 🌐 Network Ports & Service Topology

| Service Name | Port | Directory Path | Protocol / Technology | Health Endpoint |
|---|---|---|---|---|
| **API Gateway** | `5000` | `Backend/gateway` | Express, `http-proxy-middleware` | `http://localhost:5000/api/health` |
| **Auth Service** | `5001` | `Backend/auth-service` | Express, Mongoose, JWT, bcryptjs | `http://localhost:5001/health` |
| **Project Service** | `5002` | `Backend/project-service` | Express, Mongoose, HTTP REST IPC | `http://localhost:5002/health` |
| **Messaging Service** | `5003` | `Backend/messaging-service` | Express, Socket.IO, WebRTC Signaling | `http://localhost:5003/health` |
| **Notification Service** | `5004` | `Backend/notification-service` | Express, Mongoose, IPC Dispatch | `http://localhost:5004/health` |
| **Frontend Client** | `5173` | `Frontend` | React 19, Vite, Lucide, Framer Motion | `http://localhost:5173` |
| **MongoDB** | `27017` | Containerized | MongoDB 7 / MongoDB Atlas | `mongosh ping` |

---

## 🛠️ Local Development (Non-Docker Mode)

If you prefer running services without Docker during local development:

1. **Install dependencies:**
   ```bash
   cd Backend && npm install
   cd ../Frontend && npm install
   ```

2. **Start the multi-process distributed backend runner (starts all 5 services concurrently):**
   ```bash
   cd Backend
   npm run dev
   ```

3. **Start the frontend:**
   ```bash
   cd Frontend
   npm run dev
   ```

---

## 📁 Repository Structure

```text
DevCollab/
├── Backend/
│   ├── auth-service/           # Microservice 1: Port 5001 (Auth & Users)
│   ├── project-service/        # Microservice 2: Port 5002 (Projects, Requests & IPC)
│   ├── messaging-service/      # Microservice 3: Port 5003 (Socket.IO Chat & WebRTC Signaling)
│   ├── notification-service/   # Microservice 4: Port 5004 (In-App Notifications & IPC Dispatch)
│   ├── gateway/                # API Gateway: Port 5000 (Reverse Proxy & Health Aggregation)
│   ├── runner.js               # Concurrent multi-process local runner
│   ├── package.json
│   └── .env
├── Frontend/
│   ├── src/
│   │   ├── components/         # Navbar, SystemHealthModal, NotificationsDropdown
│   │   ├── context/            # AuthContext (Socket.IO & JWT state)
│   │   ├── pages/              # Explore, Projects, Chat, Meeting (WebRTC), Profile
│   │   └── utils/api.js        # Multi-service direct & gateway API clients
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env
├── docker-compose.yml          # Multi-container orchestration (7 containers)
└── README.md
```
