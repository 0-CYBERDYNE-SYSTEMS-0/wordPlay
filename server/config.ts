import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  database: {
    url: process.env.DATABASE_URL || `postgres://${process.env.USER}@localhost:5432/wordplay`,
    options: {
      host: '/tmp',  // Use the Unix socket directory
      connectionTimeoutMillis: 5000,
    }
  },
  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || 'localhost'
  }
}; 