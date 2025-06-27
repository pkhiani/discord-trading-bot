require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const { AssemblyAI } = require('assemblyai');
const { OpenAI } = require('openai');
const prism = require('prism-media');

// CONFIG
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRIGGER_WORDS = ['qqq calls', 'trim here', 'sell all', 'qqq', 'spy', 'tsla', 'calls', 'puts', 'qq', 'qq calls', 'qq puts', 'trim', 'sell', 'exit', 'close', 'profit', 'loss'];

if (!DISCORD_TOKEN || !ASSEMBLYAI_API_KEY || !OPENAI_API_KEY) {
  console.error('Missing DISCORD_TOKEN, ASSEMBLYAI_API_KEY, or OPENAI_API_KEY in .env');
  process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let currentVoiceConnection = null;
let currentTextChannel = null;
let receiver = null;
let isListening = false;
let transcriber = null;
let transcription = "";
let userIdListening = null;
let sentenceBuffer = "";
let sentenceTimeout = null;

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (msg.content === '!join') {
    if (!msg.member.voice.channel) {
      msg.reply('You must be in a voice channel!');
      return;
    }
    
    // Check if already connected to this guild
    if (currentVoiceConnection) {
      msg.reply('I\'m already connected to a voice channel. Use !leave first.');
      return;
    }
    
    currentTextChannel = msg.channel;
    const channel = msg.member.voice.channel;
    currentVoiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false
    });
    receiver = currentVoiceConnection.receiver;
    msg.reply(`Joined ${channel.name} and started recording!`);

    // Listen to the first non-bot user
    channel.members.forEach((member) => {
      if (!member.user.bot && !isListening) {
        userIdListening = member.id;
        startContinuousTranscription(member.id);
        isListening = true;
        return;
      }
    });
  }
  if (msg.content === '!leave') {
    if (currentVoiceConnection) {
      stopContinuousTranscription();
      currentVoiceConnection.destroy();
      currentVoiceConnection = null;
      receiver = null;
      msg.reply('Left the voice channel and stopped recording.');
    } else {
      msg.reply('Not in a voice channel.');
    }
  }
  if (msg.content === '!status') {
    msg.reply('Bot is running. Voice: ' + (currentVoiceConnection ? 'Connected' : 'Not connected'));
  }
  if (msg.content === '!process') {
    if (sentenceBuffer.trim()) {
      msg.reply(`Current buffer: "${sentenceBuffer.trim()}"`);
    } else {
      msg.reply('No current buffer content.');
    }
  }
});

async function startContinuousTranscription(userId) {
  // Only create one transcriber per session
  if (!transcriber) {
    const assemblyAI = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
    transcriber = assemblyAI.realtime.transcriber({
      sampleRate: 48000,
      // Improve accuracy settings for trading terminology
      language_code: "en",
      enable_partials: true,
      punctuate: true,
      format_text: true,
      // Reduce latency and improve sentence capture
      interim_results: true,
      // Add custom vocabulary for better accuracy on trading terms
      custom_spelling: [
        { from: ["qqq"], to: "QQQ" },
        { from: ["qq"], to: "QQQ" },
        { from: ["spy"], to: "SPY" },
        { from: ["tsla"], to: "TSLA" },
        { from: ["trim"], to: "trim" },
        { from: ["sell"], to: "sell" },
        { from: ["calls"], to: "calls" },
        { from: ["puts"], to: "puts" },
        { from: ["average"], to: "average" },
        { from: ["strike"], to: "strike" },
        { from: ["price"], to: "price" },
        { from: ["five twenty six"], to: "526" },
        { from: ["five two six"], to: "526" },
        { from: ["five thirty"], to: "530" },
        { from: ["five forty"], to: "540" },
        { from: ["five fifty"], to: "550" },
        { from: ["five sixty"], to: "560" },
        { from: ["five seventy"], to: "570" },
        { from: ["five eighty"], to: "580" },
        { from: ["five ninety"], to: "590" },
        { from: ["five hundred ninety"], to: "590" },
        { from: ["five hundred eighty"], to: "580" },
        { from: ["five hundred seventy"], to: "570" }
      ]
    });
    transcription = "";

    transcriber.on("open", ({ sessionId }) => {
      console.log(`Real-time session opened with ID: ${sessionId}`);
    });
    transcriber.on("error", (error) => {
      console.error("Real-time transcription error:", error);
    });
    transcriber.on("close", (code, reason) => {
      console.log("Real-time session closed:", code, reason);
      console.log("Final text:", transcription);
    });
    transcriber.on("transcript", async (transcriptObj) => {
      if (transcriptObj.message_type === "PartialTranscript") {
        // Show partial transcripts for real-time feedback (optional)
        console.log("Partial:", transcriptObj.text);
      } else if (transcriptObj.message_type === "FinalTranscript") {
        console.log("Final:", transcriptObj.text);
        
        // Add to sentence buffer
        sentenceBuffer += transcriptObj.text + " ";
        
        // Clear any existing timeout
        if (sentenceTimeout) {
          clearTimeout(sentenceTimeout);
        }
        
        // Wait 4 seconds for more content before processing
        sentenceTimeout = setTimeout(async () => {
          if (sentenceBuffer.trim()) {
            console.log("Processing complete sentence:", sentenceBuffer.trim());
            
            // Check for trigger words in the complete sentence
            if (checkForTriggers(sentenceBuffer)) {
              console.log("🔍 Attempting to format trading command...");
              // Format the trading command using OpenAI
              const formattedCommand = await formatTradingCommand(sentenceBuffer);
              console.log("📝 OpenAI response:", formattedCommand);
              
              if (formattedCommand) {
                currentTextChannel.send(`🚨 **TRADING COMMAND DETECTED!** @everyone\n${formattedCommand}`);
              } else {
                // Don't send a ping if OpenAI returns null (no trading content)
                console.log("⚠️ No trading content detected, skipping ping");
              }
            } else {
              // Send regular transcript
              currentTextChannel.send(`📝 **Transcript:** ${sentenceBuffer.trim()}`);
            }
            
            // Add to full transcription and clear buffer
            transcription += sentenceBuffer;
            sentenceBuffer = "";
          }
        }, 4000); // Increased from 2500ms to 4000ms for complete sentence capture
      }
    });
    await transcriber.connect();
  }
  subscribeAndPipeAudio(userId);
}

function checkForTriggers(text) {
  const lowerText = text.toLowerCase();
  for (const trigger of TRIGGER_WORDS) {
    if (lowerText.includes(trigger.toLowerCase())) {
      console.log(`🚨 TRIGGER DETECTED: "${trigger}" in "${text}"`);
      return true;
    }
  }
  return false;
}

async function formatTradingCommand(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a trading assistant that formats voice transcripts into clear trading commands. 
          
          Extract and format any trading information from the transcript. Be flexible and creative in interpreting partial information.
          
          1. **TRADING CALLS/PUTS** - New positions
          Format: **Symbol**: [TICKER] | **Type**: [CALLS/PUTS] | **Strike**: $[STRIKE]
          Examples:
          - "QQQ calls average 1.0 526" → **Symbol**: QQQ | **Type**: CALLS | **Strike**: $526
          - "SPY puts at 2.5 strike 530" → **Symbol**: SPY | **Type**: PUTS | **Strike**: $530
          - "QQ calls five two six average one point" → **Symbol**: QQQ | **Type**: CALLS | **Strike**: $526
          
          If you can extract ANY trading information, format it. Only return null if there's no trading content at all.`
        },
        {
          role: "user",
          content: `Format this trading transcript: "${text}"`
        }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    // 2. **TRIM COMMANDS** - Partial profit taking
    // Format: **Action**: TRIM | **Price**: $[PRICE]
    // Examples:
    // - "trim QQQ at 1.5" → **Action**: TRIM | **Price**: $1.50 
    // - "trim here at 2.0" → **Action**: TRIM | **Price**: $2.00 
    // - "trim SPY calls" → **Action**: TRIM | **Price**: TBD
    
    // 3. **SELL ALL COMMANDS** - Complete exit
    // Format: **Action**: SELL ALL
    // Examples:
    // - "sell all QQQ" → **Action**: SELL ALL 
    // - "sell all positions" → **Action**: SELL ALL 
    // - "sell everything" → **Action**: SELL ALL 

    const formattedCommand = completion.choices[0].message.content.trim();
    
    // Check if OpenAI returned a valid formatted command (not null or error message)
    if (formattedCommand && !formattedCommand.toLowerCase().includes('null') && formattedCommand.length > 10) {
      return formattedCommand;
    }
    
    return null;
  } catch (error) {
    console.error('OpenAI formatting error:', error);
    return null;
  }
}

function subscribeAndPipeAudio(userId) {
  if (!receiver) return;
  const audioStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 3000,
    },
  });
  const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 1 });
  audioStream.pipe(opusDecoder).on("data", (chunk) => {
    if (transcriber) transcriber.sendAudio(chunk);
  });
  audioStream.on("end", async () => {
    // Wait a shorter time, then resubscribe if still listening
    if (isListening && userIdListening === userId) {
      setTimeout(() => {
        subscribeAndPipeAudio(userId);
      }, 100);
    }
  });
}

function stopContinuousTranscription() {
  isListening = false;
  userIdListening = null;
  if (sentenceTimeout) {
    clearTimeout(sentenceTimeout);
    sentenceTimeout = null;
  }
  sentenceBuffer = "";
  if (transcriber) {
    transcriber.close();
    transcriber = null;
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle voice state updates to clean up when bot is disconnected
client.on('voiceStateUpdate', (oldState, newState) => {
  // If the bot was disconnected from a voice channel
  if (oldState.member.id === client.user.id && oldState.channel && !newState.channel) {
    console.log('Bot was disconnected from voice channel');
    stopContinuousTranscription();
    currentVoiceConnection = null;
    receiver = null;
    isListening = false;
  }
});

client.login(DISCORD_TOKEN); 