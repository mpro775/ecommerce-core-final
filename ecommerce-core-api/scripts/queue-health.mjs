import net from 'node:net';

const host = process.env.RABBITMQ_HOST ?? '127.0.0.1';
const port = Number(process.env.RABBITMQ_PORT ?? 5672);
const timeoutMs = 5000;

const managementUrl = process.env.RABBITMQ_MANAGEMENT_URL ?? '';
const managementUser = process.env.RABBITMQ_MANAGEMENT_USER ?? 'guest';
const managementPassword = process.env.RABBITMQ_MANAGEMENT_PASSWORD ?? 'guest';

const notificationMainQueue = process.env.NOTIFICATIONS_MAIN_QUEUE ?? 'notifications.order-events';
const notificationDlqQueue =
  process.env.NOTIFICATIONS_DLQ_QUEUE ?? 'notifications.order-events.dlq';

const mainQueueMaxMessages = Number(process.env.NOTIFICATIONS_MAIN_QUEUE_MAX_MESSAGES ?? 200);
const dlqQueueMaxMessages = Number(process.env.NOTIFICATIONS_DLQ_QUEUE_MAX_MESSAGES ?? 0);

function checkPort() {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });

    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout checking ${host}:${port}`));
    });

    socket.connect(port, host);
  });
}

function resolveManagementPath(queueName) {
  return `${managementUrl.replace(/\/$/, '')}/api/queues/%2F/${encodeURIComponent(queueName)}`;
}

async function fetchQueueDepth(queueName) {
  const response = await fetch(resolveManagementPath(queueName), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${managementUser}:${managementPassword}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed queue depth lookup for ${queueName}. Status ${response.status}`);
  }

  const body = await response.json();
  const messages = typeof body.messages === 'number' ? body.messages : 0;
  return { queueName, messages };
}

function assertQueueThreshold(queueName, messages, threshold) {
  if (messages > threshold) {
    throw new Error(`Queue ${queueName} depth ${messages} exceeds threshold ${threshold}`);
  }
}

async function checkQueueDepthThresholds() {
  if (!managementUrl) {
    console.log('Skipping queue depth checks (RABBITMQ_MANAGEMENT_URL not set)');
    return;
  }

  const [mainQueue, dlqQueue] = await Promise.all([
    fetchQueueDepth(notificationMainQueue),
    fetchQueueDepth(notificationDlqQueue),
  ]);

  assertQueueThreshold(mainQueue.queueName, mainQueue.messages, mainQueueMaxMessages);
  assertQueueThreshold(dlqQueue.queueName, dlqQueue.messages, dlqQueueMaxMessages);

  console.log(`Queue depth ${mainQueue.queueName}: ${mainQueue.messages}`);
  console.log(`Queue depth ${dlqQueue.queueName}: ${dlqQueue.messages}`);
}

try {
  await checkPort();
  console.log(`RabbitMQ is reachable at ${host}:${port}`);
  await checkQueueDepthThresholds();
} catch (error) {
  const message = error instanceof Error ? error.message : 'RabbitMQ health check failed';
  throw new Error(message);
}
