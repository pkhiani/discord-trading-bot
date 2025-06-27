# Discord Trading Bot

A Discord bot that records voice in Discord voice channels, transcribes the audio using AssemblyAI's real-time streaming API, and detects trading commands using OpenAI to send formatted alerts in text channels.

## Features

- **Real-time Voice Recording**: Captures audio from Discord voice channels using discord.js
- **AssemblyAI Transcription**: Real-time streaming transcription using AssemblyAI's WebSocket API
- **OpenAI Command Formatting**: Uses OpenAI to format trading commands into clear, structured alerts
- **Trading Command Detection**: Monitors for specific trading-related phrases and formats them
- **Discord Alerts**: Sends formatted notifications when trading commands are detected

## Prerequisites

1. **Node.js 18+**: Required for running the bot
2. **Discord Bot Token**: Create a Discord application and bot at [https://discord.com/developers/applications](https://discord.com/developers/applications)
3. **AssemblyAI API Key**: Sign up at [https://www.assemblyai.com/](https://www.assemblyai.com/) and get your API key
4. **OpenAI API Key**: Get your API key from [https://platform.openai.com/](https://platform.openai.com/)

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd discord-trading-bot
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Create a `.env` file with your API keys:
```env
DISCORD_TOKEN=your_discord_bot_token_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the bot:
```bash
npm start
```

## Usage

1. **Join a voice channel** in your Discord server
2. **Type `!join`** in a text channel to have the bot join and start recording
3. **Speak trading commands** clearly in the voice channel
4. **Use `!leave`** to stop recording and disconnect the bot

## Trading Commands

The bot recognizes and formats these types of trading commands:

### **Trading Calls/Puts** (New positions)
- **Format**: `**Symbol**: [TICKER] | **Type**: [CALLS/PUTS] | **Strike**: $[STRIKE]`
- **Examples**:
  - "five ninety spy puts" → `**Symbol**: SPY | **Type**: PUTS | **Strike**: $590`
  - "QQ calls five two six" → `**Symbol**: QQQ | **Type**: CALLS | **Strike**: $526`

### **Trim Commands** (Partial profit taking)
- **Format**: `**Action**: TRIM | **Price**: $[PRICE]`
- **Examples**:
  - "trim QQQ at one point five" → `**Action**: TRIM | **Price**: $1.50`

### **Sell All Commands** (Complete exit)
- **Format**: `**Action**: SELL ALL`
- **Examples**:
  - "sell all positions" → `**Action**: SELL ALL`

## Bot Commands

- `!join` - Join your current voice channel and start recording
- `!leave` - Leave the voice channel and stop recording
- `!status` - Check bot status and connection
- `!process` - Check current sentence buffer content (for debugging)

## How It Works

### Audio Processing Pipeline

1. **Discord Voice Capture**: The bot connects to Discord voice channels and receives Opus-encoded audio packets
2. **AssemblyAI Streaming**: Audio is streamed to AssemblyAI's WebSocket API for real-time transcription
3. **Sentence Buffering**: Transcripts are buffered for 4 seconds to capture complete sentences
4. **OpenAI Formatting**: Complete sentences are sent to OpenAI for trading command formatting
5. **Discord Alerts**: Formatted trading commands are sent to the text channel

### Technical Details

- **Audio Format**: Discord sends Opus audio at 48kHz, which is decoded to PCM for AssemblyAI
- **Real-time Processing**: Audio is processed in chunks with 4-second sentence buffering
- **Smart Detection**: Only sends alerts when OpenAI successfully formats trading content
- **Error Handling**: Comprehensive error handling and connection state management

## Configuration

### Trigger Words
The bot detects these keywords to identify trading content:
```javascript
TRIGGER_WORDS = ['qqq calls', 'trim here', 'sell all', 'qqq', 'spy', 'tsla', 'calls', 'puts', 'qq', 'qq calls', 'qq puts', 'trim', 'sell', 'exit', 'close', 'profit', 'loss']
```

### Audio Settings
- **Sentence Buffer**: 4 seconds to capture complete thoughts
- **Discord Silence**: 3 seconds before ending audio stream
- **Resubscription Delay**: 100ms for continuous listening

## Troubleshooting

### Common Issues

1. **Bot doesn't join voice channel**:
   - Check bot permissions (Connect, Speak, Use Voice Activity)
   - Ensure you're in a voice channel when using `!join`

2. **No transcription**:
   - Verify AssemblyAI API key is correct
   - Check AssemblyAI account status and credits
   - Speak clearly and wait for the 4-second buffer

3. **No trading command alerts**:
   - Verify OpenAI API key is correct
   - Check OpenAI account status and credits
   - Use clear trading terminology

4. **Multiple join/leave messages**:
   - The bot now prevents multiple connections
   - Use `!leave` before `!join` if already connected

### Debugging

- **Console logs**: Check for "Partial:", "Final:", and "Processing complete sentence:" messages
- **Buffer check**: Use `!process` to see current sentence buffer content
- **Status check**: Use `!status` to verify connection state

## Logging

The bot provides detailed logging for debugging:
- Audio processing status
- AssemblyAI WebSocket events
- OpenAI formatting responses
- Transcription results
- Error conditions

## Security Notes

- Keep your API keys secure and never commit them to version control
- The bot only processes audio when actively recording
- All audio processing happens in real-time and is not stored permanently

## License

This project is for educational purposes. Please ensure compliance with Discord's Terms of Service, AssemblyAI's usage policies, and OpenAI's usage policies.