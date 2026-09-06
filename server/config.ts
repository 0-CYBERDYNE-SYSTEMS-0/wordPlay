import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  database: {
    url: process.env.DATABASE_URL || `postgres://${process.env.USER}@localhost:5432/wordplay`,
    options: {
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10, // Maximum number of connections in the pool
      // SSL is OPT-IN (DATABASE_SSL=true) — managed cloud Postgres (Neon etc.)
      // needs it, but local/LAN Postgres (the normal team deployment) does not
      // support it. Tying this to NODE_ENV=production broke every self-hosted
      // production start.
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  },
  server: {
    port: parseInt(process.env.PORT || '5001', 10),
    host: process.env.HOST || 'localhost'
  }
}; 