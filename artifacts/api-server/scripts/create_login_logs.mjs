import { pool } from "@workspace/db";

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      email VARCHAR(255),
      ip_address VARCHAR(100),
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("login_logs table created/verified");
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
