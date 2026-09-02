// Inter-Process Communication (IPC) Network Client for Project Service
// Communicates with Notification Service (Task 7 & 10: Inter-process communication / Distributed computation)

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004';

const sendNotificationIPC = async (payload) => {
  const startTime = Date.now();
  try {
    const targetUrl = `${NOTIFICATION_SERVICE_URL}/api/notifications/dispatch`;
    console.log(`🌐 [IPC Outbound] project-service -> notification-service: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-Service': 'project-service',
        'X-IPC-Request-Time': new Date().toISOString(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000), // 4s timeout
    });

    const duration = Date.now() - startTime;
    if (!response.ok) {
      console.warn(`⚠️ [IPC Failed] Status: ${response.status} (${duration}ms)`);
      return null;
    }

    const result = await response.json();
    console.log(`✅ [IPC Success] Notification dispatched over network in ${duration}ms`);
    return result;
  } catch (error) {
    console.error(`❌ [IPC Error] Failed to reach notification-service: ${error.message}`);
    return null;
  }
};

module.exports = { sendNotificationIPC };
