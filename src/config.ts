import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  apiId: number;
  apiHash: string;
  sessionName: string;
  postIntervalMs: number;
  message: string;
}

export function loadConfig(): Config {
  const apiId = process.env.API_ID;
  const apiHash = process.env.API_HASH;
  const sessionName = process.env.SESSION_NAME || 'session';
  const postIntervalMs = parseInt(process.env.POST_INTERVAL_MS || '60000', 10);
  const message = process.env.MESSAGE || 'Default message';

  if (!apiId || !apiHash) {
    throw new Error(
      'API_ID and API_HASH are required. Please set them in .env file or environment variables.'
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    sessionName,
    postIntervalMs,
    message,
  };
}
