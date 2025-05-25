import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { config } from './config';
import { users, projects, documents } from "@shared/schema";

// Function to run migrations
export async function runMigrations() {
  const pool = new Pool({
    connectionString: config.database.url,
    ...config.database.options
  });

  const db = drizzle(pool, { logger: false });

  try {
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Database migrations completed successfully');
  } catch (error: any) {
    // Check if the error is because tables already exist
    if (error.code === '42P07' || error.message.includes('already exists')) {
      console.log('Database tables already exist, skipping migration');
    } else {
      console.error('Error running database migrations:', error);
      // Don't throw the error - continue with server startup
    }
  } finally {
    await pool.end();
  }
}

// Add a function to create a default user and project if none exist
export async function seedInitialData() {
  console.log("Checking for existing data...");
  
  const pool = new Pool({
    connectionString: config.database.url,
    ...config.database.options
  });

  const db = drizzle(pool, { logger: false });
  
  try {
    // Check if any users exist
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length === 0) {
      console.log("No users found, creating default user and sample project...");
      
      // Create a default user
      const [defaultUser] = await db.insert(users)
        .values({
          username: "demo",
          password: "password"
        })
        .returning();
      
      // Create a default project
      const [defaultProject] = await db.insert(projects)
        .values({
          userId: defaultUser.id,
          name: "Novel Draft",
          type: "Novel",
          style: "Creative",
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Create a default document
      await db.insert(documents)
        .values({
          projectId: defaultProject.id,
          title: "AI-Powered Writing: The Future of Content Creation",
          content: "The integration of artificial intelligence into writing tools has revolutionized the way we create content. These sophisticated AI companions assist writers by providing context-aware suggestions, automating routine tasks, and enhancing the creative process.\n\nModern writing assistants can analyze the existing content to understand the author's intent and style. They maintain awareness of the entire document context, allowing them to provide relevant suggestions that maintain consistency throughout longer works.\n\nOne of the most impressive capabilities of these tools is how they adapt to individual writing styles.",
          styleMetrics: {
            formality: 0.75,
            complexity: 0.5,
            engagement: 0.65,
            tone: "Informative",
            averageSentenceLength: 18
          },
          wordCount: 87,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      console.log("Default data created successfully");
    } else {
      console.log("Existing data found, skipping seed creation");
    }
    
    return true;
  } catch (error) {
    console.error("Error seeding initial data:", error);
    return false;
  } finally {
    await pool.end();
  }
}

export async function checkDatabase() {
  const pool = new Pool({
    connectionString: config.database.url,
    ...config.database.options
  });

  try {
    const client = await pool.connect();
    
    // Test basic connectivity
    const result = await client.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'projects', 'documents', 'sources')
    `);
    
    console.log(`Found ${tableCheck.rows.length} tables in database`);
    
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  } finally {
    await pool.end();
  }
}

export async function initializeDatabase() {
  console.log('Checking database connection...');
  const isConnected = await checkDatabase();
  
  if (isConnected) {
    await runMigrations();
    await seedInitialData();
    return true;
  } else {
    console.error('Cannot initialize database - connection failed');
    return false;
  }
}