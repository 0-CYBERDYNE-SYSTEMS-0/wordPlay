import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@shared/schema';
import { config } from './config';

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ...config.database.options
});

// Create a Drizzle client with the schema
export const db = drizzle(pool, { schema });