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
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }
  },
  server: {
    port: parseInt(process.env.PORT || '5001', 10),
    host: process.env.HOST || 'localhost'
  }
}; 