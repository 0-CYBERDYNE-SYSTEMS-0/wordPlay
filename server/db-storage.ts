import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { IStorage } from "./storage";
import {
  users, type User, type InsertUser,
  projects, type Project, type InsertProject,
  documents, type Document, type InsertDocument,
  sources, type Source, type InsertSource
} from "@shared/schema";

export class PostgresStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Project operations
  async getProjects(userId: number): Promise<Project[]> {
    return await db.select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: number, projectUpdate: Partial<Project>): Promise<Project | undefined> {
    // Include updated timestamp
    const updateData = {
      ...projectUpdate,
      updatedAt: new Date()
    };
    
    const result = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    
    return result[0];
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      // First, delete all documents associated with this project
      await db.delete(documents).where(eq(documents.projectId, id));
      
      // Then, delete all sources associated with this project
      await db.delete(sources).where(eq(sources.projectId, id));
      
      // Finally, delete the project itself
      const result = await db.delete(projects).where(eq(projects.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  }

  // Document operations
  async getDocuments(projectId: number): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.updatedAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values({
      ...document,
      styleMetrics: document.styleMetrics || { 
        formality: 0.5, 
        complexity: 0.5, 
        engagement: 0.5, 
        tone: "Neutral",
        averageSentenceLength: 15
      },
      wordCount: document.wordCount || 0
    }).returning();
    
    return result[0];
  }

  async updateDocument(id: number, documentUpdate: Partial<Document>): Promise<Document | undefined> {
    // Include updated timestamp
    const updateData = {
      ...documentUpdate,
      updatedAt: new Date()
    };
    
    const result = await db.update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();
    
    return result[0];
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  // Source operations
  async getSources(projectId: number): Promise<Source[]> {
    return await db.select()
      .from(sources)
      .where(eq(sources.projectId, projectId))
      .orderBy(desc(sources.createdAt));
  }

  async getSource(id: number): Promise<Source | undefined> {
    const result = await db.select().from(sources).where(eq(sources.id, id));
    return result[0];
  }

  async createSource(source: InsertSource): Promise<Source> {
    const result = await db.insert(sources).values({
      ...source,
      content: source.content || null,
      url: source.url || null
    }).returning();
    
    return result[0];
  }

  async deleteSource(id: number): Promise<boolean> {
    const result = await db.delete(sources).where(eq(sources.id, id)).returning();
    return result.length > 0;
  }
}