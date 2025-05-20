import {
  users, type User, type InsertUser,
  projects, type Project, type InsertProject,
  documents, type Document, type InsertDocument,
  sources, type Source, type InsertSource
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Document operations
  getDocuments(projectId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Source operations
  getSources(projectId: number): Promise<Source[]>;
  getSource(id: number): Promise<Source | undefined>;
  createSource(source: InsertSource): Promise<Source>;
  deleteSource(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private documents: Map<number, Document>;
  private sources: Map<number, Source>;
  
  private userId: number;
  private projectId: number;
  private documentId: number;
  private sourceId: number;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.documents = new Map();
    this.sources = new Map();
    
    this.userId = 1;
    this.projectId = 1;
    this.documentId = 1;
    this.sourceId = 1;
    
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

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
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

  async updateProject(id: number, projectUpdate: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = {
      ...project,
      ...projectUpdate,
      updatedAt: new Date()
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Document operations
  async getDocuments(projectId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => document.projectId === projectId
    );
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.documentId++;
    const document: Document = {
      ...insertDocument,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: number, documentUpdate: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = {
      ...document,
      ...documentUpdate,
      updatedAt: new Date()
    };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }

  // Source operations
  async getSources(projectId: number): Promise<Source[]> {
    return Array.from(this.sources.values()).filter(
      (source) => source.projectId === projectId
    );
  }

  async getSource(id: number): Promise<Source | undefined> {
    return this.sources.get(id);
  }

  async createSource(insertSource: InsertSource): Promise<Source> {
    const id = this.sourceId++;
    const source: Source = {
      ...insertSource,
      id,
      createdAt: new Date()
    };
    this.sources.set(id, source);
    return source;
  }

  async deleteSource(id: number): Promise<boolean> {
    return this.sources.delete(id);
  }
}

export const storage = new MemStorage();
