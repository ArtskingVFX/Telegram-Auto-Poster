# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Get Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Create a new application
4. Copy your `api_id` and `api_hash`

## 3. Configure Environment

Create a `.env` file:

```env
API_ID=your_api_id_here
API_HASH=your_api_hash_here
SESSION_NAME=session
POST_INTERVAL_MS=60000
MESSAGE=Hello! This is an automated message.
```

## 4. Run the Bot

### Development Mode (with hot reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm run build
npm start
```

## 5. First Time Authentication

On first run, the bot will:
1. Ask for your phone number (with country code, e.g., +1234567890)
2. Send you a verification code via Telegram
3. Ask you to enter the code
4. Save your session for future runs

After authentication, the session is saved and you won't need to authenticate again.

## 6. How It Works

- The bot fetches all groups you're a member of
- For each group, it posts your message immediately
- Then it schedules periodic posts based on `POST_INTERVAL_MS`
- Before each new post, it deletes the previous message
- All actions are logged to the console in real-time

## 7. Stop the Bot

Press `Ctrl+C` to gracefully stop the bot.

## Troubleshooting

- **"No groups found"**: Make sure you're a member of at least one group
- **"Failed to post"**: Check that you have permission to send messages in the groups
- **Authentication errors**: Make sure your API_ID and API_HASH are correct
- **Session issues**: Delete the `.session` file and re-authenticate
