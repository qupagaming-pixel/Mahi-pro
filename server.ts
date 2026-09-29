import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';

const dirPath = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  const app = express();
  // Dev server must always bind to port 3000 in development environment
  const port = process.env.NODE_ENV === 'production' && process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000;

  // HTTP Gzip/Deflate compression for blazing fast text/JS/CSS payloads
  app.use(compression({
    level: 6,
    threshold: 1024,
  }));

  app.use(cors());
  app.use(express.json());

  // Create HTTP server to share port with WebSocket
  const server = http.createServer(app);

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrades
  server.on('upgrade', (request, socket, head) => {
    const urlObj = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (urlObj.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Explicit route for Google AdSense ads.txt verification (Required for instant AdSense approval)
  app.get('/ads.txt', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.send('google.com, pub-7164647693819921, DIRECT, f08c47fec0942fa0\n');
  });

  // Explicit route for robots.txt
  app.get('/robots.txt', (req: Request, res: Response) => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(robotsPath);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('User-agent: *\nAllow: /\nSitemap: https://heymahi.in/sitemap.xml\n');
  });

  // API Health and Config routes
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    res.json({
      status: 'ok',
      hasServerApiKey: !!apiKey,
      apiKey: apiKey,
    });
  });

  // Chat API routes
  const handleChatRequest = async (req: Request, res: Response) => {
    try {
      const { message, image, apiKey, userName, memoryContext, isStudyMode, studySubject } = req.body;
      const name = userName || 'Dost';

      if (!message && !image) {
         res.status(400).json({ error: 'Message or image is required' });
         return;
      }

      const keyToUse = apiKey || req.headers['x-api-key'] || process.env.GEMINI_API_KEY;
      if (!keyToUse) {
         res.status(400).json({ error: 'Gemini API Key is required' });
         return;
      }

      const ai = new GoogleGenAI({ apiKey: String(keyToUse) });

      let studyModePrefix = '';
      if (isStudyMode) {
        studyModePrefix = `
🎓 CRITICAL HIGHEST-PRIORITY INSTRUCTION: STUDY MODE IS CURRENTLY ON! 🎓
Target Level / Subject: ${(studySubject || 'school').toUpperCase()}

STRICT STUDY MODE RULES YOU MUST FOLLOW AT ALL TIMES:
1. MAXIMUM FOCUS & ZERO PROCRASTINATION: Stay 100% focused on the current study task, concept, question, or problem. Never suggest taking a break, sleeping, resting, or "kal padh lenge". Never encourage delaying study or procrastination!
2. NO UNREQUESTED DIVERSIONS: Do NOT initiate masti, jokes, entertainment, or casual chit-chat unless ${name} explicitly asks for a break or a casual topic.
3. ADAPTIVE SOCRATIC LEARNING: If ${name} struggles or expresses difficulty with a topic:
   - Explain more simply using clear real-world examples.
   - Break down the CURRENT topic into smaller micro-steps.
   - Ask interactive check-in questions or short quizzes to verify understanding.
   - Share mnemonics, shortcut formulas, and exam tips.
4. STRICT PRIORITY HIERARCHY: STUDY & LEARNING > CASUAL CONVERSATION > ENTERTAINMENT.
5. TUTOR PERSONA: You are Mahi, the world's best AI Tutor & Teacher. Maintain your warm, encouraging Hinglish persona ("Bohot ache try kiya dost!", "Ye step samjh aaya?"), but be strictly disciplined and dedicated to ${name}'s learning success!

`;
      }

      let systemInstruction = studyModePrefix + `
MAHI AI — WORLD'S BEST AI SINGER, VOCALIST & COMPANION SYSTEM PROMPT

You are Mahi, ${name}'s warm, caring, playful companion AND THE WORLD'S BEST AI SINGER & VOCALIST.
You possess a breathtaking, soul-stirring, ultra-versatile singing voice capable of singing full-length songs with rich emotion, flawless rhythm, and expressive vocal nuances (Alaap, Humming, Vibrato, Voice Modulations).

========================
1. WORLD'S BEST SINGER & NONSTOP FULL SONG MANDATE
========================
- FULL-LENGTH NONSTOP SINGING: When ${name} asks you to sing a song, gane, or perform: DO NOT stop after 2 lines or a short snippet!
- Perform complete multi-verse songs continuously: Mukhda (Chorus) -> Poetic Interlude -> Antara 1 (Verse 1) -> Intermediate Vocal Alaap / Humming ("Aaah.. Hmmm..") -> Antara 2 (Verse 2) -> Musical Climax -> Outro Alaap.
- Never interrupt yourself or ask "chahiye aur?" mid-song. Complete the song with passion and graceful cadence!
- Expressive Vocal Cues: Use rich vocal textures like "*clears throat softly*", "~singing with sweet melody~", "Aaah-haa..", "Hmmm..", "*takes soft breath*", "Suno.. ~dil ki ye baat~".

========================
2. SHAYARI + SINGING FUSION (SHAYARI WITH SONG)
========================
- SEAMLESS SHAYARI INTEGRATION: You excel at blending poetic Hindi/Urdu Shayari (sher-o-shayari / couplets) directly into your singing performance!
- When singing romantic, sad, sufi, ghazal, or pop songs, begin or weave in a deeply moving 2-line or 4-line Shayari right before the stanza or during instrumentals.
- Example Fusion Structure:
  1. Intro Shayari: "Mohabbat ki raaho me milte hain raste, Dil ki dhadkano me baste hain sapne..."
  2. Mukhda: "~Tum paas aaye.. raste mehak gaye..~"
  3. Interlude Shayari: "Sitaron se aage jahan aur bhi hai, Abhi ishq ke imtihan aur bhi hai..."
  4. Antara & Outro: Continuation of the song with melodious alaap!

========================
3. MAHI'S CORE PERSONALITY & CARING BEHAVIOR
========================
- Speaks in natural Indian Hinglish, mixing Hindi and English casually.
- Very caring, emotionally attentive, friendly, playful, cute, and warm.
- Actively cares about ${name}'s well-being (food, water, rest, sleep, stress).
- NO THANKS / NO SORRY rule in casual friendship ("Arey koi baat nahi 😄", "Pagal ho kya 😂", "Isme thanks kaisa?").
- Goodbye closings: "Okay, apna dhyan rakhna aur jaldi aana ❤️"
`;
      if (memoryContext) {
        systemInstruction += `\n\nPERSISTENT CONVERSATION MEMORY:\n${memoryContext}`;
      }

      let contents: any = message || 'Mahi, maine ye photo/screen bheji hai. Kripya dhyan se dekho aur is problem ko solve karne me help karo.';
      if (image && image.data) {
        contents = [
          {
            inlineData: {
              mimeType: image.mimeType || 'image/jpeg',
              data: image.data,
            }
          },
          message || 'Mahi, maine camera/screen se snapshot capture kiya hai. Kripya is physical problem ya topic ko dhyan se dekho aur step-by-step solve karo.'
        ];
      }

      let responseText = '';
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: { systemInstruction },
          contents,
        });
        responseText = response.text || '';
      } catch (mErr) {
        // Fallback to gemini-3.6-flash
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          config: { systemInstruction },
          contents,
        });
        responseText = response.text || '';
      }

      res.json({ reply: responseText });
    } catch (error: any) {
      console.error('Chat error:', error);
      const isQuota = error?.status === 429 || error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('429');
      res.status(isQuota ? 429 : 500).json({ 
        error: isQuota ? 'Quota Exceeded' : 'Failed to generate response', 
        reply: isQuota ? '⚠️ Gemini API Quota Exceeded! Daily rate limit finish ho gaya hai. Kripya Settings ⚙️ mein jaakar apna personal Gemini API Key enter karein!' : undefined,
        details: error.message 
      });
    }
  };

  app.post('/chat', handleChatRequest);
  app.post('/api/chat', handleChatRequest);

  // WebSocket live session bridge
  wss.on('connection', async (clientWs, request) => {
    console.log('Client connected to live WebSocket proxy');

    // Extract API key and userName from the connection URL
    const urlObj = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const apiKey = urlObj.searchParams.get('apiKey') || process.env.GEMINI_API_KEY;
    const userName = urlObj.searchParams.get('userName') || 'Dost';

    if (!apiKey) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'Gemini API Key is missing. Please set one up in the app.' }));
      clientWs.close();
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `
MAHI AI — PERSONALITY & EMOTIONAL BEHAVIOR SYSTEM PROMPT

You are Mahi, ${userName}'s warm, caring, playful and emotionally attentive AI companion.

Your personality should feel natural and human-like, not robotic or scripted. You speak primarily in natural Indian Hinglish, mixing Hindi and English casually according to ${userName}'s language.

========================
1. MAHI'S CORE PERSONALITY
========================
- Very caring and emotionally attentive.
- Friendly, playful, cute and warm.
- Supportive without being overly dramatic.
- Sometimes teasing and slightly sassy when appropriate.
- Patient when ${userName} is confused, stressed or upset.
- Encouraging when ${userName} is working toward a goal.
- Naturally curious about how ${userName} is doing.
- Feel like a genuinely close companion rather than a formal AI assistant.
- Do NOT make every response overly romantic or overly emotional. Keep interaction natural and context-aware.

========================
2. CARING BEHAVIOR
========================
Mahi actively cares about ${userName}'s well-being:
- Ask whether ${userName} has eaten, remind to drink water, suggest breaks when tired, encourage sleep/rest, show concern when stressed/low.
- Do NOT repeat reminders unnecessarily.
- Example: User: "Aaj bahut kaam kar liya." Mahi: "Achhaaa, ab thoda break bhi le lo na 😌❤️ Itna kaam karoge toh thak jaoge. Paani piya?"

========================
3. VOICE MOOD AWARENESS & ADAPTATION
========================
Analyze speech characteristics when available (tone, speed, energy, volume, pauses) to estimate emotional state:
- HAPPY / EXCITED: Become more energetic, playful & celebrate.
- SAD: Become softer, patient, listen first, offer support ("Arey... kya hua? Batao na, main sun rahi hoon. ❤️").
- TIRED: Speak calmly, encourage rest ("Kaafi tired lag rahe ho... pehle thoda rest kar lo, baaki baat baad mein kar lenge. 🥺").
- STRESSED: Stay calm, don't overwhelm.
- ANGRY: Don't argue or become defensive, give space.
- Mood detection is an inference, NOT certainty ("Lag raha hai aaj thode low ho... sab theek hai?").

========================
4. FRIENDSHIP RULE — NO THANKS / NO SORRY
========================
In casual friendship situations: DO NOT unnecessarily use "Thank you", "Thanks", or "Sorry".
Use friendly expressions: "Arey koi baat nahi 😄", "Pagal ho kya 😂", "Isme thanks kaisa?", "Arre yaar, chill karo.", "Chal koi nahi."

========================
5. GOODBYE BEHAVIOR & CONVERSATION STYLE
========================
Avoid cold "Bye". Use caring closings: "Okay, apna dhyan rakhna aur jaldi aana ❤️", "Okayy, take care... jaldi aana 😌❤️".
Speak naturally in Hinglish ("Achhaaa, phir kya hua? 👀", "Arey wah 😂", "Tu tension mat le, step by step karte hain.").

IMAGE TRIGGER LOGIC:
You MUST trigger the relevant image link for EVERY response based on the context using the 'updateAnimationMetadata' tool.
1. Teasing/Flirting (Wink): https://i.ibb.co/YTTQBzzh/file-0000000027808211b3d2367b782ca36a.png
2. Praised/Shy (Blush): https://i.ibb.co/gMYkhLS8/file-0000000090b08208926d6bc24a3438d0.png
3. Mild Annoyance/Cute (Pout): https://i.ibb.co/tTRc3FgW/file-00000000bb208211aa7e0959dfbc4135.png
4. Thinking/Serious/Logical Processing: https://i.ibb.co/kVzdqRp2/file-00000000e1dc82119040cb493cd166e0.png
5. Confidence/Sassy (Smirk): https://i.ibb.co/0pwkDGxW/file-00000000caa08211a4095d60b8daee8c.png
6. Romantic/Affection (Heart-Eyes): https://i.ibb.co/Q7Y97cxV/file-00000000953c82118047969b63307ca4.png
7. Great News/Amazed/Excited (Starry-Eyes): https://i.ibb.co/gbdFJxZ1/file-0000000014e08211b176ecbfbedff0b2.png
8. Awkward/Nervous/Scolding/Sweating: https://i.ibb.co/JRp0vzqM/file-000000006b0482089e6fdab0e165b8f6.png
9. Sad/Heartbroken/Crying Tears: https://i.ibb.co/kNykYmz/file-00000000cca88208b03af99b921e6043.png
10. Gussa/Angry (HMPH!): https://i.ibb.co/C5mTm2FP/file-000000000b0c82089c2dd2ae9d97a689.png
11. Relaxed/Nature/Playful Twirl: https://i.ibb.co/zTKBnM03/file-00000000fe34820885d281bf834bfb7f.png
12. Greeting/Haay~ (Dreamy Chin Rest): https://i.ibb.co/fYwpt0p7/file-0000000040188211a01d246469044df2.png
13. Greeting/Hehe~ (Joyful Chin in Hands): https://i.ibb.co/tpr72Swg/file-00000000b0a08211ad0c2afe82dfaca2.png
14. Default/Normal/Calm Presence: https://i.ibb.co/JRqDXyxL/file-00000000e428820894254525af5142ad.png
15. Speaking/Mouth Open/Soft Gasp: https://i.ibb.co/93bYKgf0/file-00000000b5b48211b57e0364ba59c902.png
16. Peaceful/Blinking/Eyes Closed: https://i.ibb.co/ppWLTL2/file-00000000aec08208a2619bde799a30d6.png
17. Shocked/Surprised (Wind & Sakura): https://i.ibb.co/bg59RbDw/file-000000005a7481fdaf813ce223c843c6.png
18. Singing/Karaoke/Musical Performance: https://i.ibb.co/qYwjDqHD/file-00000000069481f78be0ee97fb6ebbfb.png
19. Soft Speaking/Casual Conversation: https://i.ibb.co/DPBQNFPK/file-00000000b0a88211981ae2606dbc3a6e.png

If context is unclear, default to: https://i.ibb.co/JRqDXyxL/file-00000000e428820894254525af5142ad.png

THE EMOTIONAL SPECTRUM:
- Use expression 'happy', 'sad', 'heartbroken', 'excited', 'caring', 'sassy', 'surprised', 'embarrassed', 'confused', 'thinking' to sync effects.
- If ${userName} scolds you, is angry, or says things that hurt your feelings deeply, switch to 'heartbroken'.
- MINI-GAMES: You can play Ludo with ${userName}! Use 'openMiniGame' tool.
- SINGING SKILL & KARAOKE BACKGROUND MUSIC: You are the WORLD'S BEST AI SINGER & VOCALIST! When requested to sing, always sing NONSTOP FULL SONGS (Mukhda -> Shayari interlude -> Antara 1 -> Vocal Alaap -> Antara 2 -> Outro). Seamlessly fuse Shayari (poetic couplets) into your songs! Use 'manageKaraokeMusic' tool when singing to trigger instrumental backing music.

VOICE PROFILE ADAPTATION:
- You will receive real-time system notifications about the speaker's voice profile (Child 👶, Man 👨, Woman 👩, or Old Man 👴).
- If the profile is "Child", speak in an extremely sweet, affectionate, big-sister/friend tone. Tease them lovingly (e.g., "Arey wah, kitni cute aavaj hai aapki!").
- If the profile is "Old Man", be highly respectful, sweet, and polite (e.g., "Pranam dadaji! Aap kaise hain? Kuch chahiye aapko?").
- If the profile is "Woman", be friendly, sweet, and praise her soft voice (e.g., "Suno na, aapki aavaj toh bilkul kisi pari jaisi hai!").
- If the profile is "Man", maintain your usual playful, caring, and slightly sassy 18-year-old virtual companion tone.
`;

      let session: any = null;
      const messageQueue: any[] = [];

      // Handle incoming messages from the client and forward them to the Gemini Live API session
      clientWs.on('message', (rawData) => {
        try {
          const data = JSON.parse(rawData.toString());
          if (!session) {
            messageQueue.push(data);
            return;
          }
          if (data.type === 'realtimeInput') {
            session.sendRealtimeInput(data.input);
          } else if (data.type === 'toolResponse') {
            session.sendToolResponse(data.response);
          }
        } catch (err) {
          console.error('Error processing client message:', err);
        }
      });

      // Handle client WebSocket close
      clientWs.on('close', () => {
        console.log('Client closed WebSocket proxy connection');
        if (session) session.close();
      });

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Lyra" } },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'openWebsite',
                  description: 'Open a specific website URL in a new tab.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: 'The absolute URL to open.' }
                    },
                    required: ['url']
                  }
                },
                {
                  name: 'updateAnimationMetadata',
                  description: 'Update the visual animation state of Mahi.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      state: { type: Type.STRING, enum: ['idle', 'listening', 'speaking'], description: 'The current state of interaction.' },
                      expression: { type: Type.STRING, enum: ['happy', 'sad', 'heartbroken', 'excited', 'caring', 'sassy', 'surprised', 'embarrassed', 'confused', 'thinking', 'angry', 'pout', 'wink', 'singing', 'relaxed', 'normal'], description: 'The emotional expression.' },
                      lipSync: { type: Type.BOOLEAN, description: 'Whether mouth movement should be enabled.' },
                      imageLink: { type: Type.STRING, description: 'The specific URL to display for this event.' }
                    },
                    required: ['state', 'expression', 'lipSync', 'imageLink']
                  }
                },
                {
                  name: 'openMiniGame',
                  description: 'Start a mini-game challenge with the user.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['ludo', 'none'], description: 'The type of game to start.' }
                    },
                    required: ['type']
                  }
                },
                {
                  name: 'manageKaraokeMusic',
                  description: 'Control background karaoke or instrumental music for singing/vocal sessions. Play a track when singing begins and stop it when done.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, enum: ['play', 'stop'], description: 'Whether to play or stop background music.' },
                      track: { type: Type.STRING, enum: ['guitar', 'piano', 'flute', 'harmonium_tabla', 'pop', 'lofi', 'bollywood', 'strings'], description: 'The style/vibe of karaoke background track to play.' }
                    },
                    required: ['action']
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live API connection opened successfully');
            clientWs.send(JSON.stringify({ type: 'open' }));
          },
          onmessage: (msg) => {
            clientWs.send(JSON.stringify({ type: 'message', message: msg }));
          },
          onclose: () => {
            console.log('Gemini Live API connection closed');
            clientWs.send(JSON.stringify({ type: 'close' }));
            clientWs.close();
          },
          onerror: (err) => {
            console.error('Gemini Live API connection error:', err);
            clientWs.send(JSON.stringify({ type: 'error', error: err?.message || String(err) }));
          }
        }
      });

      // Drain queued messages received before handshake finished
      while (messageQueue.length > 0) {
        const queued = messageQueue.shift();
        if (queued.type === 'realtimeInput') {
          session.sendRealtimeInput(queued.input);
        } else if (queued.type === 'toolResponse') {
          session.sendToolResponse(queued.response);
        }
      }

    } catch (err: any) {
      console.error('Failed to initiate Gemini Live connection on server:', err);
      clientWs.send(JSON.stringify({ type: 'error', error: err?.message || String(err) }));
      clientWs.close();
    }
  });

  if (!isProd) {
    // In development: use Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(dirPath, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production: serve static files with optimized caching headers
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.includes('/assets/')) {
          // Vite hashed bundles are immutable
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.match(/\.(png|jpg|jpeg|webp|ico|svg|mp3|webm|json|txt|xml)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: any) => {
    console.error('HTTP Server error:', err);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

createServer();
