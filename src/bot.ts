import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import type { EntityLike } from 'telegram/define';
import * as fs from 'fs';
import * as path from 'path';
import { Config, getConfigDirectory } from './config';
import { Logger } from './logger';

interface GroupInfo {
  id: string;
  title: string;
  entity: EntityLike;
  lastMessageId?: number;
}

export class TelegramAutoPoster {
  private client: TelegramClient;
  private config: Config;
  private groups: GroupInfo[] = [];
  private postingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  private sessionFile: string;
  private session: StringSession;

  constructor(config: Config) {
    this.config = config;

    // Ensure config directory exists
    const configDir = getConfigDirectory();

    // Load existing session if available, otherwise create new one
    this.sessionFile = path.join(configDir, `session.config`);
    let sessionString = '';

    if (fs.existsSync(this.sessionFile)) {
      try {
        sessionString = fs.readFileSync(this.sessionFile, 'utf-8');
        Logger.info('Loaded existing session from config directory');
      } catch (error) {
        Logger.warn('Failed to load session file, starting fresh');
      }
    }

    this.session = new StringSession(sessionString);

    this.client = new TelegramClient(this.session, config.apiId, config.apiHash, {
      connectionRetries: 5,
    });
  }

  private saveSession(): void {
    try {
      const sessionString = this.session.save() as unknown as string;
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
      Logger.info(
        `Starting sequential posting: will post to each group with ${this.config.postIntervalMs / 1000}s interval between posts`
      );
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

      try {
        const signInResult = await this.client.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode: code,
          })
        );

        if ('user' in signInResult && signInResult.user) {
          const user = signInResult.user;
          let userName = 'User';

          // Check if user has firstName property (not UserEmpty)
          if ('firstName' in user) {
            userName = user.firstName || 'User';
          } else if ('username' in user && user.username) {
            userName = `@${user.username}`;
          }

          Logger.success(`Authentication successful! Logged in as: ${userName}`);
        } else {
          Logger.success('Authentication successful');
        }

        // Save session after successful authentication
        this.saveSession();
      } catch (signInError: any) {
        // Check if 2FA password is required
        if (
          signInError.errorMessage === 'SESSION_PASSWORD_NEEDED' ||
          (signInError instanceof Error && signInError.message.includes('SESSION_PASSWORD_NEEDED'))
        ) {
          Logger.info('Two-factor authentication is enabled. Please enter your password:');
          const password = await this.promptInput('Password: ');

          // Get password info for SRP
          const passwordResult = await this.client.invoke(new Api.account.GetPassword());

          // Compute password hash using SRP
          const Password = await import('telegram/Password');
          const passwordCheck = await Password.computeCheck(passwordResult, password);

          // Check password
          const checkPasswordResult = await this.client.invoke(
            new Api.auth.CheckPassword({
              password: passwordCheck,
            })
          );

          if ('user' in checkPasswordResult && checkPasswordResult.user) {
            const user = checkPasswordResult.user;
            let userName = 'User';

            if ('firstName' in user) {
              userName = user.firstName || 'User';
            } else if ('username' in user && user.username) {
              userName = `@${user.username}`;
            }

            Logger.success(`Authentication successful! Logged in as: ${userName}`);
          } else {
            Logger.success('Authentication successful');
          }

          // Save session after successful authentication
          this.saveSession();
        } else {
          // Re-throw if it's a different error
          throw signInError;
        }
      }
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

    return new Promise(resolve => {
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
          const dialogId = dialog.id;

          if (entity && dialogId !== undefined && dialogId !== null) {
            let title = 'Unknown';
            if ('title' in entity && entity.title) {
              title = entity.title;
            } else if ('username' in entity && entity.username) {
              title = `@${entity.username}`;
            } else if ('firstName' in entity && entity.firstName) {
              title = entity.firstName;
            }

            // Store dialog ID as string (Telegram IDs can be negative for groups)
            const groupId = dialogId.toString();
            this.groups.push({
              id: groupId,
              title,
              entity, // Store entity for API calls
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
    // Start sequential posting: post to one group, wait interval, then next group
    this.postSequentially();
  }

  private async postSequentially(): Promise<void> {
    let currentIndex = 0;
    let isFirstPost = true;

    while (this.isRunning) {
      if (this.groups.length === 0) {
        break;
      }

      const group = this.groups[currentIndex];
      
      try {
        await this.postToGroup(group);
      } catch (error) {
        Logger.error(`Error posting to group "${group.title}"`, error);
      }

      // Move to next group (wrap around to first group after last)
      currentIndex = (currentIndex + 1) % this.groups.length;

      // Wait for the configured interval before posting to next group
      // Skip wait for the very first post
      if (this.isRunning && !isFirstPost) {
        await this.sleep(this.config.postIntervalMs);
      } else if (this.isRunning) {
        // First post completed, mark as not first anymore
        isFirstPost = false;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async postToGroup(group: GroupInfo): Promise<void> {
    try {
      Logger.info(`Posting to group: ${group.title} (ID: ${group.id})`);

      // Delete previous message if exists
      if (group.lastMessageId) {
        try {
          await this.client.deleteMessages(group.entity, [group.lastMessageId], {
            revoke: false,
          });
          Logger.info(`Deleted previous message in "${group.title}"`);
        } catch (error) {
          Logger.warn(
            `Failed to delete previous message in "${group.title}":`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Send new message
      const sentMessage = await this.client.sendMessage(group.entity, {
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
          Logger.success(`Posted message to "${group.title}" (Message ID: ${messageId})`);
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

    // Clear all intervals (if any remain from old implementation)
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
