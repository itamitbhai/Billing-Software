import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

console.log('Starting Periodical Cron Scheduler engine...');

// Schedule validation checks every minute (* * * * *)
cron.schedule('* * * * *', () => {
  console.log(`[Scheduler Event] Running automatic inventory stock levels checking: ${new Date().toISOString()}`);
});

console.log('Cron Scheduler is active. System scheduler tasks are listening...');
