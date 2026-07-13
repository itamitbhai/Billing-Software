import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import IORedis from 'ioredis';

dotenv.config();

console.log('Starting Background Job Processing Worker...');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT || 6379);

// Setup background connection client for queues
const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null, // Enforced by BullMQ
});

// Configure example background consumer
const notificationWorker = new Worker(
  'notification-tasks',
  async (job) => {
    console.log(`[Worker Process] Processing task ${job.id} (Action: ${job.name})`);
    // Simulated operation (e.g., sending SMS alerts/email billing updates)
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { dispatched: true, target: job.data.email };
  },
  { connection }
);

notificationWorker.on('completed', (job, result) => {
  console.log(`[Worker Success] Task "${job.name}" (ID: ${job.id}) completed. Result:`, result);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[Worker Failure] Task "${job?.name}" (ID: ${job?.id}) failed: ${err.message}`);
});

console.log('Background Worker registered and listening on queue "notification-tasks"');
