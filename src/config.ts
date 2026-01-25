import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export interface Config {
  apiId: number;
  apiHash: string;
  postIntervalMs: number;
  message: string;
}

function ensureConfigDirectory(): string {
  const configDir = path.join(process.cwd(), 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

function loadMessageFromFile(): string | null {
  try {
    const configDir = ensureConfigDirectory();
    const messageFile = path.join(configDir, 'message.txt');
    if (fs.existsSync(messageFile)) {
      return fs.readFileSync(messageFile, 'utf-8').trim();
    }
  } catch (error) {
    // Ignore errors, fall back to env var
  }
  return null;
}

export function loadConfig(): Config {
  const apiId = process.env.API_ID;
  const apiHash = process.env.API_HASH;
  const postIntervalMs = parseInt(process.env.POST_INTERVAL_MS || '60000', 10);

  // Try to load message from file first, then fall back to env var
  const messageFromFile = loadMessageFromFile();
  const message = messageFromFile || process.env.MESSAGE || 'Default message';

  if (!apiId || !apiHash) {
    throw new Error(
      'API_ID and API_HASH are required. Please set them in .env file or environment variables.'
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    postIntervalMs,
    message,
  };
}

export function getConfigDirectory(): string {
  return ensureConfigDirectory();
}
