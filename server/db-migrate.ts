import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

// Function to run migrations
export async function runMigrations() {
  console.log("Running database migrations...");
  
  try {
    // This will automatically create tables based on your schema
    // if they don't exist yet
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Database migrations completed successfully");
    
    return true;
  } catch (error) {
    console.error("Error running database migrations:", error);
    return false;
  }
}

// Add a function to create a default user and project if none exist
export async function seedInitialData() {
  console.log("Checking for existing data...");
  
  try {
    // Check if any users exist
    const existingUsers = await db.query.users.findMany({ limit: 1 });
    
    if (existingUsers.length === 0) {
      console.log("No users found, creating default user and sample project...");
      
      // Create a default user
      const [defaultUser] = await db.insert(db.schema.users)
        .values({
          username: "demo",
          password: "password"
        })
        .returning();
      
      // Create a default project
      const [defaultProject] = await db.insert(db.schema.projects)
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
      await db.insert(db.schema.documents)
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
  }
}