import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { IStorage } from "./storage";
import {
  users, type User, type InsertUser,
  projects, type Project, type InsertProject,
  documents, type Document, type InsertDocument,
  sources, type Source, type InsertSource,
  customCommands, type CustomCommand, type InsertCustomCommand
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

  async getProject(id: number, userId: number): Promise<Project | undefined> {
    const result = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: number, projectUpdate: Partial<Project>, userId: number): Promise<Project | undefined> {
    // Include updated timestamp
    const updateData = {
      ...projectUpdate,
      updatedAt: new Date()
    };
    
    const result = await db.update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    
    return result[0];
  }

  async deleteProject(id: number, userId: number): Promise<boolean> {
    try {
      // Every delete is scoped through the ownership subquery, so a race on
      // the pre-check (or any future caller skipping it) still cannot touch
      // another user's rows.
      const ownedProjectIds = db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)));

      // First, delete all documents associated with this project
      await db.delete(documents).where(inArray(documents.projectId, ownedProjectIds));

      // Then, delete all sources associated with this project
      await db.delete(sources).where(inArray(sources.projectId, ownedProjectIds));

      // Finally, delete the project itself
      const result = await db.delete(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  }

  // Document operations
  async getDocuments(projectId: number, userId: number): Promise<Document[]> {
    const rows = await db.select({ document: documents })
      .from(documents)
      .innerJoin(projects, eq(documents.projectId, projects.id))
      .where(and(eq(documents.projectId, projectId), eq(projects.userId, userId)))
      .orderBy(desc(documents.updatedAt));
    return rows.map(row => row.document);
  }

  async getDocument(id: number, userId: number): Promise<Document | undefined> {
    const result = await db.select({ document: documents })
      .from(documents)
      .innerJoin(projects, eq(documents.projectId, projects.id))
      .where(and(eq(documents.id, id), eq(projects.userId, userId)));
    return result[0]?.document;
  }

  async createDocument(document: InsertDocument, userId: number): Promise<Document | undefined> {
    // The payload's projectId must belong to the user before writing.
    if (!(await this.getProject(document.projectId, userId))) return undefined;

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

  async updateDocument(id: number, documentUpdate: Partial<Document>, userId: number): Promise<Document | undefined> {
    // Include updated timestamp
    const updateData = {
      ...documentUpdate,
      updatedAt: new Date()
    };
    
    // Atomic ownership scoping: only rows whose parent project belongs to
    // the user are visible to the update.
    const result = await db.update(documents)
      .set(updateData)
      .where(and(
        eq(documents.id, id),
        inArray(documents.projectId, db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)))
      ))
      .returning();
    
    return result[0];
  }

  async deleteDocument(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(documents)
      .where(and(
        eq(documents.id, id),
        inArray(documents.projectId, db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)))
      ))
      .returning();
    return result.length > 0;
  }

  // Source operations
  async getSources(projectId: number, userId: number): Promise<Source[]> {
    const rows = await db.select({ source: sources })
      .from(sources)
      .innerJoin(projects, eq(sources.projectId, projects.id))
      .where(and(eq(sources.projectId, projectId), eq(projects.userId, userId)))
      .orderBy(desc(sources.createdAt));
    return rows.map(row => row.source);
  }

  async getSource(id: number, userId: number): Promise<Source | undefined> {
    const result = await db.select({ source: sources })
      .from(sources)
      .innerJoin(projects, eq(sources.projectId, projects.id))
      .where(and(eq(sources.id, id), eq(projects.userId, userId)));
    return result[0]?.source;
  }

  async createSource(source: InsertSource, userId: number): Promise<Source | undefined> {
    // The payload's projectId must belong to the user before writing.
    if (!(await this.getProject(source.projectId, userId))) return undefined;

    const result = await db.insert(sources).values({
      ...source,
      content: source.content || null,
      url: source.url || null
    }).returning();
    
    return result[0];
  }

  async deleteSource(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(sources)
      .where(and(
        eq(sources.id, id),
        inArray(sources.projectId, db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)))
      ))
      .returning();
    return result.length > 0;
  }

  // Custom Command operations
  async getCustomCommands(userId: number): Promise<CustomCommand[]> {
    return await db.select()
      .from(customCommands)
      .where(eq(customCommands.userId, userId))
      .orderBy(desc(customCommands.createdAt));
  }

  async getCustomCommand(id: number): Promise<CustomCommand | undefined> {
    const result = await db.select().from(customCommands).where(eq(customCommands.id, id));
    return result[0];
  }

  async createCustomCommand(command: InsertCustomCommand): Promise<CustomCommand> {
    const result = await db.insert(customCommands).values({
      ...command,
      isActive: command.isActive ?? true,
    }).returning();
    
    return result[0];
  }

  async updateCustomCommand(id: number, commandUpdate: Partial<CustomCommand>): Promise<CustomCommand | undefined> {
    const updateData = {
      ...commandUpdate,
      updatedAt: new Date()
    };
    
    const result = await db.update(customCommands)
      .set(updateData)
      .where(eq(customCommands.id, id))
      .returning();
    
    return result[0];
  }

  async deleteCustomCommand(id: number): Promise<boolean> {
    const result = await db.delete(customCommands).where(eq(customCommands.id, id)).returning();
    return result.length > 0;
  }
}