import { MemoryEntry } from '@shared/types';
import { DatabaseManager } from '@main/services/database.js';

export class MemoryManager {
  private database: DatabaseManager;

  constructor() {
    this.database = DatabaseManager.getInstance();
  }

  async create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessed'>): Promise<MemoryEntry> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const memoryEntry: MemoryEntry = {
      id,
      ...entry,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessed: now,
    };
    this.database.createMemory(memoryEntry);
    return memoryEntry;
  }

  list(query?: string, limit = 50): MemoryEntry[] {
    return this.database.listMemory(query, limit);
  }

  search(query: string, limit = 20): MemoryEntry[] {
    return this.database.searchMemory(query, limit);
  }

  get(id: string): MemoryEntry | undefined {
    return this.database.getMemory(id);
  }

  update(id: string, updates: Partial<MemoryEntry>): void {
    this.database.updateMemory(id, updates);
  }

  delete(id: string): void {
    this.database.deleteMemory(id);
  }

  incrementAccess(id: string): void {
    this.database.incrementMemoryAccess(id);
  }
}