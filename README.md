# Telegram Auto Poster Userbot

A TypeScript-based Telegram userbot that automatically posts messages to all groups you're a member of at configured intervals. The bot deletes the previous message before posting a new one in each group.

## Features

- ✅ Automatically fetches all groups you're a member of
- ✅ Posts messages at configurable intervals
- ✅ Deletes previous message before posting new one
- ✅ Real-time console logging
- ✅ Proper account authentication
- ✅ TypeScript with full type safety
- ✅ ESLint and Prettier configured
- ✅ Hot reload with Nodemon

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Telegram API credentials (API ID and API Hash)

## Getting Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Create a new application
4. Copy your `api_id` and `api_hash`

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

4. Edit `.env` and add your credentials:

```env
API_ID=your_api_id
API_HASH=your_api_hash
SESSION_NAME=session
POST_INTERVAL_MS=60000
MESSAGE=Your message here
```

## Configuration

- `API_ID`: Your Telegram API ID (from https://my.telegram.org/apps)
- `API_HASH`: Your Telegram API Hash
- `SESSION_NAME`: Name for the session file (default: "session")
- `POST_INTERVAL_MS`: Interval between posts in milliseconds (default: 60000 = 1 minute)
- `MESSAGE`: The message to post in groups

## Usage

### Development Mode (with hot reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Other Commands

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## First Run

On the first run, the bot will:
1. Connect to Telegram
2. Ask for your phone number
3. Send you a verification code
4. Ask you to enter the code
5. Once authenticated, it will fetch all your groups
6. Start posting messages at the configured interval

After the first authentication, the session will be saved and you won't need to authenticate again.

## How It Works

1. **Startup**: The bot connects to Telegram and authenticates if needed
2. **Group Fetching**: Retrieves all groups and channels you're a member of
3. **Posting**: For each group:
   - Deletes the previous message (if exists)
   - Posts the configured message
   - Schedules the next post based on `POST_INTERVAL_MS`
4. **Logging**: All actions are logged to the console in real-time

## Stopping the Bot

Press `Ctrl+C` to gracefully stop the bot. It will:
- Stop all posting intervals
- Disconnect from Telegram
- Exit cleanly

## Project Structure

```
.
├── src/
│   ├── index.ts      # Main entry point
│   ├── bot.ts        # Bot logic and posting
│   ├── config.ts     # Configuration loader
│   └── logger.ts     # Logging utility
├── dist/             # Compiled JavaScript (generated)
├── .env              # Environment variables (create this)
├── .env.example      # Example environment file
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── .eslintrc.json    # ESLint configuration
├── .prettierrc.json  # Prettier configuration
└── nodemon.json      # Nodemon configuration
```

## Notes

- The bot requires you to be a member of the groups you want to post to
- Make sure you have permission to send messages in the groups
- The bot deletes its own previous messages before posting new ones
- Session files are stored locally and should be kept secure

## License

MIT
