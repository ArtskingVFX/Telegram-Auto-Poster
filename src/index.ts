import { TelegramAutoPoster } from './bot';
import { loadConfig } from './config';
import { Logger } from './logger';

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const bot = new TelegramAutoPoster(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      Logger.info('Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      Logger.info('Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    await bot.start();
  } catch (error) {
    Logger.error('Fatal error', error);
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error('Unhandled error', error);
  process.exit(1);
});
