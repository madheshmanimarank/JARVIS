import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { DATABASE_SCHEMA } from '@shared/constants';
import type { Conversation, Message, MemoryEntry, AppSettings } from '@shared/types';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database;
  private dbPath: string;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'jarvis.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
    this.migrateSettings();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initializeSchema(): void {
    this.db.exec(DATABASE_SCHEMA);
  }

  private migrateSettings(): void {
    const settings = this.getAllSettings();
    if (Object.keys(settings).length === 0) {
      this.initializeDefaultSettings();
    }
  }

  private initializeDefaultSettings(): void {
    const defaultSettings = {
      'ai.provider': 'auto',
      'ai.ollamaUrl': 'http://localhost:11434',
      'ai.ollamaModel': 'llama3.2:3b',
      'ai.groqApiKey': '',
      'ai.groqModel': 'llama-3.3-70b-versatile',
      'ai.temperature': '0.7',
      'ai.maxTokens': '4096',
      'ai.stream': 'true',
      'ai.toolCalling': 'true',
      'voice.enabled': 'true',
      'voice.ttsProvider': 'fish-audio',
      'voice.fishAudioApiKey': '',
      'voice.fishAudioVoiceId': '2d33b07cbe1943a7957cdd43907216c8',
      'voice.sttProvider': 'whisper',
      'voice.whisperModel': 'base',
      'voice.language': 'en',
      'voice.speed': '1.0',
      'voice.autoSpeak': 'true',
      'privacy.localFirst': 'true',
      'privacy.saveConversations': 'true',
      'privacy.saveMemory': 'true',
      'privacy.telemetry': 'false',
      'ui.theme': 'dark',
      'ui.animations': 'true',
      'ui.compactMode': 'false',
      'ui.alwaysOnTop': 'false',
      'hotkey.enabled': 'true',
      'hotkey.modifier': JSON.stringify(['CommandOrControl', 'Shift']),
      'hotkey.key': 'J',
      'tray.enabled': 'true',
      'tray.minimizeToTray': 'true',
    };

    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultSettings)) {
      stmt.run(key, value);
    }
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // Conversations
  createConversation(conversation: Conversation): void {
    this.db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, message_count, model, provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      conversation.id,
      conversation.title,
      conversation.createdAt,
      conversation.updatedAt,
      conversation.messageCount,
      conversation.model || null,
      conversation.provider || null
    );
  }

  getConversation(id: string): Conversation | undefined {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapConversation(row);
  }

  listConversations(): Conversation[] {
    const rows = this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as any[];
    return rows.map(this.mapConversation);
  }

  updateConversation(id: string, updates: Partial<Conversation>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.updatedAt !== undefined) { fields.push('updated_at = ?'); values.push(updates.updatedAt); }
    if (updates.messageCount !== undefined) { fields.push('message_count = ?'); values.push(updates.messageCount); }
    if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
    if (updates.provider !== undefined) { fields.push('provider = ?'); values.push(updates.provider); }
    if (fields.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteConversation(id: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  private mapConversation(row: any): Conversation {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count,
      model: row.model,
      provider: row.provider,
    };
  }

  // Messages
  createMessage(message: Omit<Message, 'id' | 'timestamp'> & { id: string; timestamp: number }): void {
    this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.conversationId,
      message.role,
      message.content,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolCallId || null,
      message.timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null
    );
  }

  getMessages(conversationId: string): Message[] {
    const rows = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(conversationId) as any[];
    return rows.map(this.mapMessage);
  }

  getMessage(id: string): Message | undefined {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapMessage(row);
  }

  deleteMessage(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolCallId: row.tool_call_id,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  // Memory
  createMemory(entry: MemoryEntry): void {
    this.db.prepare(`
      INSERT INTO memory (id, type, content, tags, importance, created_at, updated_at, access_count, last_accessed, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.type,
      entry.content,
      JSON.stringify(entry.tags),
      entry.importance,
      entry.createdAt,
      entry.updatedAt,
      0,
      entry.createdAt,
      entry.embedding ? JSON.stringify(entry.embedding) : null
    );
  }

  getMemory(id: string): MemoryEntry | undefined {
    const row = this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.mapMemory(row);
  }

  listMemory(query?: string, limit = 50): MemoryEntry[] {
    let sql = 'SELECT * FROM memory';
    const params: unknown[] = [];
    if (query) {
      sql += ' WHERE content LIKE ? OR tags LIKE ?';
      params.push(`%${query}%`, `%${query}%`);
    }
    sql += ' ORDER BY importance DESC, last_accessed DESC LIMIT ?';
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapMemory);
  }

  searchMemory(query: string, limit = 20): MemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memory
      WHERE content LIKE ? OR tags LIKE ?
      ORDER BY importance DESC, last_accessed DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit) as any[];
    return rows.map(this.mapMemory);
  }

  updateMemory(id: string, updates: Partial<MemoryEntry>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
    if (updates.importance !== undefined) { fields.push('importance = ?'); values.push(updates.importance); }
    if (updates.embedding !== undefined) { fields.push('embedding = ?'); values.push(updates.embedding ? JSON.stringify(updates.embedding) : null); }
    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);
    this.db.prepare(`UPDATE memory SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  incrementMemoryAccess(id: string): void {
    this.db.prepare(`
      UPDATE memory
      SET access_count = access_count + 1, last_accessed = ?
      WHERE id = ?
    `).run(Date.now(), id);
  }

  deleteMemory(id: string): void {
    this.db.prepare('DELETE FROM memory WHERE id = ?').run(id);
  }

  private mapMemory(row: any): MemoryEntry {
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      tags: JSON.parse(row.tags),
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    };
  }

  // Settings
  getSettings(): AppSettings {
    const raw = this.getAllSettings();
    return {
      ai: {
        provider: raw['ai.provider'] as any,
        ollamaUrl: raw['ai.ollamaUrl'],
        ollamaModel: raw['ai.ollamaModel'],
        groqApiKey: raw['ai.groqApiKey'],
        groqModel: raw['ai.groqModel'],
        temperature: parseFloat(raw['ai.temperature']),
        maxTokens: parseInt(raw['ai.maxTokens']),
        stream: raw['ai.stream'] === 'true',
        toolCalling: raw['ai.toolCalling'] === 'true',
      },
      voice: {
        enabled: raw['voice.enabled'] === 'true',
        ttsProvider: raw['voice.ttsProvider'] as any,
        fishAudioApiKey: raw['voice.fishAudioApiKey'],
        fishAudioVoiceId: raw['voice.fishAudioVoiceId'],
        sttProvider: raw['voice.sttProvider'] as any,
        whisperModel: raw['voice.whisperModel'],
        language: raw['voice.language'],
        speed: parseFloat(raw['voice.speed']),
        autoSpeak: raw['voice.autoSpeak'] === 'true',
      },
      privacy: {
        localFirst: raw['privacy.localFirst'] === 'true',
        saveConversations: raw['privacy.saveConversations'] === 'true',
        saveMemory: raw['privacy.saveMemory'] === 'true',
        telemetry: raw['privacy.telemetry'] === 'true',
      },
      ui: {
        theme: raw['ui.theme'] as any,
        animations: raw['ui.animations'] === 'true',
        compactMode: raw['ui.compactMode'] === 'true',
        alwaysOnTop: raw['ui.alwaysOnTop'] === 'true',
      },
      hotkey: {
        enabled: raw['hotkey.enabled'] === 'true',
        modifier: JSON.parse(raw['hotkey.modifier']),
        key: raw['hotkey.key'],
      },
      tray: {
        enabled: raw['tray.enabled'] === 'true',
        minimizeToTray: raw['tray.minimizeToTray'] === 'true',
      },
    };
  }

  saveSettings(settings: Partial<AppSettings>): void {
    const flat: Record<string, string> = {};
    if (settings.ai) {
      flat['ai.provider'] = settings.ai.provider;
      flat['ai.ollamaUrl'] = settings.ai.ollamaUrl;
      flat['ai.ollamaModel'] = settings.ai.ollamaModel;
      flat['ai.groqApiKey'] = settings.ai.groqApiKey;
      flat['ai.groqModel'] = settings.ai.groqModel;
      flat['ai.temperature'] = settings.ai.temperature.toString();
      flat['ai.maxTokens'] = settings.ai.maxTokens.toString();
      flat['ai.stream'] = settings.ai.stream.toString();
      flat['ai.toolCalling'] = settings.ai.toolCalling.toString();
    }
    if (settings.voice) {
      flat['voice.enabled'] = settings.voice.enabled.toString();
      flat['voice.ttsProvider'] = settings.voice.ttsProvider;
      flat['voice.fishAudioApiKey'] = settings.voice.fishAudioApiKey;
      flat['voice.fishAudioVoiceId'] = settings.voice.fishAudioVoiceId;
      flat['voice.sttProvider'] = settings.voice.sttProvider;
      flat['voice.whisperModel'] = settings.voice.whisperModel;
      flat['voice.language'] = settings.voice.language;
      flat['voice.speed'] = settings.voice.speed.toString();
      flat['voice.autoSpeak'] = settings.voice.autoSpeak.toString();
    }
    if (settings.privacy) {
      flat['privacy.localFirst'] = settings.privacy.localFirst.toString();
      flat['privacy.saveConversations'] = settings.privacy.saveConversations.toString();
      flat['privacy.saveMemory'] = settings.privacy.saveMemory.toString();
      flat['privacy.telemetry'] = settings.privacy.telemetry.toString();
    }
    if (settings.ui) {
      flat['ui.theme'] = settings.ui.theme;
      flat['ui.animations'] = settings.ui.animations.toString();
      flat['ui.compactMode'] = settings.ui.compactMode.toString();
      flat['ui.alwaysOnTop'] = settings.ui.alwaysOnTop.toString();
    }
    if (settings.hotkey) {
      flat['hotkey.enabled'] = settings.hotkey.enabled.toString();
      flat['hotkey.modifier'] = JSON.stringify(settings.hotkey.modifier);
      flat['hotkey.key'] = settings.hotkey.key;
    }
    if (settings.tray) {
      flat['tray.enabled'] = settings.tray.enabled.toString();
      flat['tray.minimizeToTray'] = settings.tray.minimizeToTray.toString();
    }
    for (const [key, value] of Object.entries(flat)) {
      this.setSetting(key, value);
    }
  }

  close(): void {
    this.db.close();
  }
}