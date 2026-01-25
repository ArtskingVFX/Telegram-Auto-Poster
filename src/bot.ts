import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from './config';
import { Logger } from './logger';

interface GroupInfo {
  id: string;
  title: string;
  lastMessageId?: number;
}

export class TelegramAutoPoster {
  private client: TelegramClient;
  private config: Config;
  private groups: GroupInfo[] = [];
  private postingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  private sessionFile: string;

  constructor(config: Config) {
    this.config = config;
    
    // Load existing session if available, otherwise create new one
    this.sessionFile = path.join(process.cwd(), `${config.sessionName}.session`);
    let sessionString = '';
    
    if (fs.existsSync(this.sessionFile)) {
      try {
        sessionString = fs.readFileSync(this.sessionFile, 'utf-8');
        Logger.info('Loaded existing session');
      } catch (error) {
        Logger.warn('Failed to load session file, starting fresh');
      }
    }
    
    const session = new StringSession(sessionString);
    
    this.client = new TelegramClient(session, config.apiId, config.apiHash, {
      connectionRetries: 5,
    });
  }

  private saveSession(): void {
    try {
      const sessionString = this.client.session.save() as string;
      if (sessionString) {
        fs.writeFileSync(this.sessionFile, sessionString, 'utf-8');
      }
    } catch (error) {
      Logger.warn('Failed to save session', error);
    }
  }

  async start(): Promise<void> {
    try {
      Logger.info('Starting Telegram Auto Poster...');
      Logger.info('Connecting to Telegram...');

      await this.client.connect();
      Logger.success('Connected to Telegram');

      if (!(await this.client.checkAuthorization())) {
        Logger.info('Not authorized. Starting authentication...');
        await this.authenticate();
      } else {
        Logger.success('Already authorized');
        // Save session in case it was updated
        this.saveSession();
      }

      Logger.info('Fetching groups...');
      await this.fetchGroups();
      Logger.success(`Found ${this.groups.length} groups`);

      if (this.groups.length === 0) {
        Logger.warn('No groups found. Make sure you are a member of at least one group.');
        return;
      }

      this.isRunning = true;
      this.startPosting();
      Logger.success('Auto posting started');
    } catch (error) {
      Logger.error('Failed to start bot', error);
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    try {
      Logger.info('Please enter your phone number (with country code, e.g., +1234567890):');
      const phoneNumber = await this.promptInput('Phone number: ');

      const result = await this.client.invoke(
        new Api.auth.SendCode({
          phoneNumber,
          apiId: this.config.apiId,
          apiHash: this.config.apiHash,
          settings: new Api.CodeSettings({}),
        })
      );

      if (!('phoneCodeHash' in result)) {
        throw new Error('Failed to get phone code hash');
      }

      const phoneCodeHash = result.phoneCodeHash;

      Logger.info('Please enter the code you received:');
      const code = await this.promptInput('Code: ');

      const signInResult = await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );

      if ('user' in signInResult) {
        Logger.success(`Authentication successful! Logged in as: ${signInResult.user.firstName || 'User'}`);
      } else {
        Logger.success('Authentication successful');
      }
      
      // Save session after successful authentication
      this.saveSession();
    } catch (error) {
      Logger.error('Authentication failed', error);
      throw error;
    }
  }

  private async promptInput(prompt: string): Promise<string> {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      readline.question(prompt, (answer: string) => {
        readline.close();
        resolve(answer.trim());
      });
    });
  }

  private async fetchGroups(): Promise<void> {
    try {
      const dialogs = await this.client.getDialogs();
      this.groups = [];

      for (const dialog of dialogs) {
        if (dialog.isGroup || dialog.isChannel) {
          const entity = dialog.entity;
          if (entity) {
            let title = 'Unknown';
            if ('title' in entity && entity.title) {
              title = entity.title;
            } else if ('username' in entity && entity.username) {
              title = `@${entity.username}`;
            } else if ('firstName' in entity && entity.firstName) {
              title = entity.firstName;
            }

            // Store dialog ID as string (Telegram IDs can be negative for groups)
            // We'll convert to BigInt when needed for API calls
            const groupId = dialog.id.toString();
            this.groups.push({
              id: groupId,
              title,
            });
            Logger.info(`Found group: ${title} (ID: ${groupId})`);
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to fetch groups', error);
      throw error;
    }
  }

  private startPosting(): void {
    for (const group of this.groups) {
      this.schedulePosting(group);
    }
  }

  private schedulePosting(group: GroupInfo): void {
    // Post immediately for the first time
    this.postToGroup(group);

    // Then schedule periodic posts
    const interval = setInterval(() => {
      if (this.isRunning) {
        this.postToGroup(group);
      } else {
        clearInterval(interval);
      }
    }, this.config.postIntervalMs);

    this.postingIntervals.set(group.id, interval);
    Logger.info(
      `Scheduled posting for "${group.title}" every ${this.config.postIntervalMs / 1000} seconds`
    );
  }

  private async postToGroup(group: GroupInfo): Promise<void> {
    try {
      Logger.info(`Posting to group: ${group.title} (ID: ${group.id})`);

      const groupId = BigInt(group.id);

      // Delete previous message if exists
      if (group.lastMessageId) {
        try {
          await this.client.deleteMessages(groupId, [group.lastMessageId]);
          Logger.info(`Deleted previous message in "${group.title}"`);
        } catch (error) {
          Logger.warn(
            `Failed to delete previous message in "${group.title}":`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Send new message
      const sentMessage = await this.client.sendMessage(groupId, {
        message: this.config.message,
      });

      if (sentMessage) {
        // Handle different message response types
        let messageId: number | undefined;
        if (Array.isArray(sentMessage)) {
          messageId = sentMessage[0]?.id;
        } else if (typeof sentMessage === 'object' && 'id' in sentMessage) {
          messageId = sentMessage.id as number;
        }

        if (messageId) {
          group.lastMessageId = messageId;
          Logger.success(
            `Posted message to "${group.title}" (Message ID: ${messageId})`
          );
        } else {
          Logger.warn(`Posted to "${group.title}" but couldn't get message ID`);
        }
      }
    } catch (error) {
      Logger.error(
        `Failed to post to group "${group.title}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  async stop(): Promise<void> {
    Logger.info('Stopping auto poster...');
    this.isRunning = false;

    // Clear all intervals
    for (const interval of this.postingIntervals.values()) {
      clearInterval(interval);
    }
    this.postingIntervals.clear();

    // Disconnect client
    if (this.client.connected) {
      await this.client.disconnect();
      Logger.success('Disconnected from Telegram');
    }
  }
}
