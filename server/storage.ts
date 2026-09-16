import {
  users, type User, type InsertUser,
  projects, type Project, type InsertProject,
  documents, type Document, type InsertDocument,
  sources, type Source, type InsertSource,
  customCommands, type CustomCommand, type InsertCustomCommand
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations — id-addressed reads/writes are scoped to the owning user
  getProjects(userId: number): Promise<Project[]>;
  getProject(id: number, userId: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>, userId: number): Promise<Project | undefined>;
  deleteProject(id: number, userId: number): Promise<boolean>;
  
  // Document operations — ownership flows through the parent project
  getDocuments(projectId: number, userId: number): Promise<Document[]>;
  getDocument(id: number, userId: number): Promise<Document | undefined>;
  // Returns undefined when the payload's projectId is not owned by userId
  createDocument(document: InsertDocument, userId: number): Promise<Document | undefined>;
  updateDocument(id: number, document: Partial<Document>, userId: number): Promise<Document | undefined>;
  deleteDocument(id: number, userId: number): Promise<boolean>;
  
  // Source operations — ownership flows through the parent project
  getSources(projectId: number, userId: number): Promise<Source[]>;
  getSource(id: number, userId: number): Promise<Source | undefined>;
  // Returns undefined when the payload's projectId is not owned by userId
  createSource(source: InsertSource, userId: number): Promise<Source | undefined>;
  deleteSource(id: number, userId: number): Promise<boolean>;
  
  // Custom Command operations
  getCustomCommands(userId: number): Promise<CustomCommand[]>;
  getCustomCommand(id: number): Promise<CustomCommand | undefined>;
  createCustomCommand(command: InsertCustomCommand): Promise<CustomCommand>;
  updateCustomCommand(id: number, command: Partial<CustomCommand>): Promise<CustomCommand | undefined>;
  deleteCustomCommand(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private documents: Map<number, Document>;
  private sources: Map<number, Source>;
  private customCommands: Map<number, CustomCommand>;
  
  private userId: number;
  private projectId: number;
  private documentId: number;
  private sourceId: number;
  private customCommandId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.documents = new Map();
    this.sources = new Map();
    this.customCommands = new Map();
    
    this.userId = 1;
    this.projectId = 1;
    this.documentId = 1;
    this.sourceId = 1;
    this.customCommandId = 1;
    
    // Create a default user and project
    const defaultUser: User = {
      id: this.userId,
      username: "demo",
      password: "password"
    };
    this.users.set(defaultUser.id, defaultUser);
    
    const defaultProject: Project = {
      id: this.projectId,
      userId: defaultUser.id,
      name: "Novel Draft",
      type: "Novel",
      style: "Creative",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.set(defaultProject.id, defaultProject);
    
    const defaultDocument: Document = {
      id: this.documentId,
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
    };
    this.documents.set(defaultDocument.id, defaultDocument);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Project operations
  async getProjects(userId: number): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      (project) => project.userId === userId
    );
  }

  async getProject(id: number, userId: number): Promise<Project | undefined> {
    const project = this.projects.get(id);
    return project && project.userId === userId ? project : undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const project: Project = {
      ...insertProject,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, projectUpdate: Partial<Project>, userId: number): Promise<Project | undefined> {
    const project = await this.getProject(id, userId);
    if (!project) return undefined;
    
    const updatedProject = {
      ...project,
      ...projectUpdate,
      updatedAt: new Date()
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number, userId: number): Promise<boolean> {
    if (!(await this.getProject(id, userId))) return false;
    return this.projects.delete(id);
  }

  // Document operations
  async getDocuments(projectId: number, userId: number): Promise<Document[]> {
    if (!(await this.getProject(projectId, userId))) return [];
    return Array.from(this.documents.values()).filter(
      (document) => document.projectId === projectId
    );
  }

  async getDocument(id: number, userId: number): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    return (await this.getProject(document.projectId, userId)) ? document : undefined;
  }

  async createDocument(insertDocument: InsertDocument, userId: number): Promise<Document | undefined> {
    if (!(await this.getProject(insertDocument.projectId, userId))) return undefined;
    const id = this.documentId++;
    const document: Document = {
      ...insertDocument,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      styleMetrics: insertDocument.styleMetrics || { 
        formality: 0.5, 
        complexity: 0.5, 
        engagement: 0.5, 
        tone: "Neutral",
        averageSentenceLength: 15
      },
      wordCount: insertDocument.wordCount || 0
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: number, documentUpdate: Partial<Document>, userId: number): Promise<Document | undefined> {
    const document = await this.getDocument(id, userId);
    if (!document) return undefined;
    
    const updatedDocument = {
      ...document,
      ...documentUpdate,
      updatedAt: new Date()
    };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number, userId: number): Promise<boolean> {
    if (!(await this.getDocument(id, userId))) return false;
    return this.documents.delete(id);
  }

  // Source operations
  async getSources(projectId: number, userId: number): Promise<Source[]> {
    if (!(await this.getProject(projectId, userId))) return [];
    return Array.from(this.sources.values()).filter(
      (source) => source.projectId === projectId
    );
  }

  async getSource(id: number, userId: number): Promise<Source | undefined> {
    const source = this.sources.get(id);
    if (!source) return undefined;
    return (await this.getProject(source.projectId, userId)) ? source : undefined;
  }

  async createSource(insertSource: InsertSource, userId: number): Promise<Source | undefined> {
    if (!(await this.getProject(insertSource.projectId, userId))) return undefined;
    const id = this.sourceId++;
    const source: Source = {
      ...insertSource,
      id,
      createdAt: new Date(),
      content: insertSource.content || null,
      url: insertSource.url || null
    };
    this.sources.set(id, source);
    return source;
  }

  async deleteSource(id: number, userId: number): Promise<boolean> {
    if (!(await this.getSource(id, userId))) return false;
    return this.sources.delete(id);
  }

  // Custom Command operations
  async getCustomCommands(userId: number): Promise<CustomCommand[]> {
    return Array.from(this.customCommands.values()).filter(
      (command) => command.userId === userId && command.isActive
    );
  }

  async getCustomCommand(id: number): Promise<CustomCommand | undefined> {
    return this.customCommands.get(id);
  }

  async createCustomCommand(insertCommand: InsertCustomCommand): Promise<CustomCommand> {
    const id = this.customCommandId++;
    const command: CustomCommand = {
      ...insertCommand,
      id,
      description: insertCommand.description || null,
      isActive: insertCommand.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customCommands.set(id, command);
    return command;
  }

  async updateCustomCommand(id: number, updates: Partial<CustomCommand>): Promise<CustomCommand | undefined> {
    const existing = this.customCommands.get(id);
    if (!existing) return undefined;

    const updated: CustomCommand = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.customCommands.set(id, updated);
    return updated;
  }

  async deleteCustomCommand(id: number): Promise<boolean> {
    return this.customCommands.delete(id);
  }
}

import { PostgresStorage } from "./db-storage";

// Use PostgreSQL storage - data confirmed to exist in database
export const storage = new PostgresStorage();
