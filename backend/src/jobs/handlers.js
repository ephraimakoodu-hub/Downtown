import { sendMail } from '../utils/mailer.js';

// Each handler is a pure function of a payload. Adding a job type means adding a case here.
export const handlers = {
  async send_email(payload) {
    await sendMail(payload);
  },
};

export async function runJob(job) {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
  await handler(job.payload);
}
