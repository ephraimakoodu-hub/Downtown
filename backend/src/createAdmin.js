// Usage: ADMIN_PASSWORD='...' node src/createAdmin.js admin@example.com "Full Name"
import bcrypt from 'bcryptjs';
import { loadEnv } from './config/env.js';
import { createPool } from './config/db.js';

const [email, fullName] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
if (!email || !fullName || !password || password.length < 12) {
  process.stderr.write('Provide email, full name, and ADMIN_PASSWORD (12+ characters).\n');
  process.exit(1);
}
const pool = createPool(loadEnv());
const hash = await bcrypt.hash(password, 12);
await pool.execute(
  "INSERT INTO users (email, full_name, password_hash, role_id, email_verified_at) SELECT ?, ?, ?, id, NOW() FROM roles WHERE name = 'administrator'",
  [email.toLowerCase(), fullName, hash],
);
process.stdout.write('Administrator created\n');
await pool.end();
