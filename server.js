/**
 * server.js
 * Servidor ligero de producción (Node.js nativo) para vecindario.madkusin.com:
 * 1. Sirve el bundle compilado de Vite (/dist)
 * 2. Endpoint seguro /api/voice-config (Gemini Multimodal Live API / ElevenLabs)
 * 3. Endpoint del Agente IA Técnico con RAG y Zero-Trust (/api/agent/chat)
 * 4. Puente directo con PocketBase (/api/citas)
 * 5. Webhook público de Telegram para vecinos (/api/telegram-webhook -> @madkusin_citas_bot)
 * 6. Webhook PRIVADO y OPACO de Telegram exclusivo para Emil (/api/telegram-admin-webhook)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ragEngine } from './server/ragEngine.js';
import {
  runKusinUserAgent,
  runKusinAdminAgent,
  linkAppointmentToTelegramChat,
  getUserOwnAppointmentsByTelegramId,
  formatAppointmentDetailsForTelegram,
  createAppointmentInPocketBase,
  checkAvailabilityZeroTrust,
  synthesizeKusinNeuralSpeech
} from './server/kusinAgent.js';
import { buildKusinSystemPrompt } from './src/services/voice/voicePromptsAndTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || '';
// Lista blanca del Chat ID privado de Emil (puede configurarse por variable de entorno o activarse con código)
let lockedAdminChatId = (process.env.ADMIN_TELEGRAM_CHAT_ID || '').trim();

// Inicializar motor RAG al arrancar el servidor
ragEngine.init();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  });
  res.end(JSON.stringify(data));
}

async function sendTelegramMessage(botToken, chatId, text, useMarkdown = true) {
  if (!botToken || !chatId || !text) return;
  const payload = {
    chat_id: chatId,
    text
  };
  if (useMarkdown) payload.parse_mode = 'Markdown';

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Si falla el parseo Markdown por caracteres especiales del LLM, reenviar en texto plano
  if (!res.ok && useMarkdown) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  }
}

async function handleVoiceConfig(req, res, urlObj) {
  const requestedProvider = (
    urlObj.searchParams.get('provider') ||
    process.env.VOICE_PROVIDER ||
    'gemini'
  ).toLowerCase();

  try {
    if (requestedProvider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      if (!apiKey || !agentId) {
        return sendJson(res, 200, {
          ok: true,
          provider: 'hybrid',
          mode: 'hybrid_fallback',
          reason: 'ELEVENLABS_CREDENTIALS_MISSING'
        });
      }

      const r = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { 'xi-api-key': apiKey } }
      );
      if (!r.ok) throw new Error(`ElevenLabs error: ${r.status}`);
      const data = await r.json();
      return sendJson(res, 200, {
        ok: true,
        provider: 'elevenlabs',
        mode: 'live',
        agentId,
        signedUrl: data.signed_url
      });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel =
      process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-latest';
    const geminiVoiceName = process.env.GEMINI_VOICE_NAME || 'Aoede';

    if (!geminiApiKey || geminiApiKey === 'tu_clave_privada_gemini_aqui') {
      return sendJson(res, 200, {
        ok: true,
        provider: 'hybrid',
        mode: 'hybrid_fallback',
        reason: 'GEMINI_API_KEY_MISSING'
      });
    }

    const wsEndpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
      geminiApiKey
    )}`;

    return sendJson(res, 200, {
      ok: true,
      provider: 'gemini',
      mode: 'live',
      wsEndpoint,
      model: geminiModel,
      voiceName: geminiVoiceName,
      systemPrompt: buildKusinSystemPrompt()
    });
  } catch (err) {
    return sendJson(res, 200, {
      ok: true,
      provider: 'hybrid',
      mode: 'hybrid_fallback',
      reason: 'SERVER_ERROR',
      message: err.message
    });
  }
}

/**
 * Endpoint /api/agent/chat (POST)
 * Conecta el interfaz Web (tanto modo Chat por Texto como modo Voz Híbrida Coste Cero)
 * con el Agente IA Kusin + RAG Técnico (738+ fragmentos) + Zero-Trust.
 */
async function handleAgentChat(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = await runKusinUserAgent({
      message: body.message || '',
      history: Array.isArray(body.history) ? body.history : [],
      channel: 'web',
      verifiedTelegramChatId: null
    });
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: err.message
    });
  }
}

/**
 * Endpoint /api/agent/tts (POST)
 * Genera voz neuronal humana en español (WAV) con Gemini Neural TTS para el Modo Voz de la web.
 */
async function handleAgentTts(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = await synthesizeKusinNeuralSpeech(body.text || '');
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}

/**
 * Endpoint /api/disponibilidad (GET) - Huecos libres anónimos (Zero-Trust)
 */
async function handleDirectAvailability(req, res, urlObj) {
  try {
    const fecha = urlObj.searchParams.get('fecha') || new Date().toISOString().split('T')[0];
    const modalidad = urlObj.searchParams.get('modalidad') || 'in_situ';
    const num_cuchillos = Number(urlObj.searchParams.get('num_cuchillos') || 1);
    const result = await checkAvailabilityZeroTrust({ fecha, modalidad, num_cuchillos });
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}

/**
 * Guarda la cita directamente en PocketBase (colección `citas`)
 */
async function handleDirectPocketBaseBooking(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = await createAppointmentInPocketBase({
      ...body,
      origen: body.origen || 'web_form'
    });
    if (!result.ok) {
      return sendJson(res, 400, result);
    }
    return sendJson(res, 200, {
      ok: true,
      source: 'pocketbase_direct',
      cita_id: result.cita_id,
      telegram_deeplink: result.telegram_deeplink,
      appointment: result.appointment
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}

/**
 * ============================================================================
 * CANAL 1: WEBHOOK PÚBLICO DE TELEGRAM PARA VECINOS (@madkusin_citas_bot)
 * - Vincula exclusivamente la cita propia con /start cita_ID (anti-secuestro).
 * - Responde preguntas técnicas de cuchillos/afilado con RAG y dudas sobre SU propia cita.
 * - NUNCA tiene acceso a citas de otros usuarios ni sabe que existe el canal admin.
 * ============================================================================
 */
async function handleTelegramUserWebhook(req, res) {
  try {
    const update = await readJsonBody(req);
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();
    const firstName = message?.from?.first_name || 'vecino/a';

    if (!chatId || !TELEGRAM_BOT_TOKEN) {
      return sendJson(res, 200, { ok: true });
    }

    // 1. Vinculación de cita mediante deeplink /start cita_ID
    if (text.startsWith('/start cita_')) {
      const citaId = text.replace('/start cita_', '').trim();
      const linkRes = await linkAppointmentToTelegramChat(citaId, chatId);

      let replyText = '';
      if (linkRes.ok && linkRes.cita) {
        const c = linkRes.cita;
        replyText =
          `✅ *¡Hola ${c.nombre || firstName}! Tu aviso de cita ha quedado activado.*\n\n` +
          `📋 *Datos de tu cita:*\n` +
          `${formatAppointmentDetailsForTelegram(c)}\n\n` +
          `Puedes consultarme tu cita en cualquier momento, pedirme modificar lo que necesites (fecha, hora, dirección completa, correo electrónico, número de cuchillos o modalidad) o hacerme cualquier pregunta sobre tus cuchillos o el afilado.\n\n` +
          `💬 _Si en algún momento necesitas atención humana directa, solo dímelo por aquí para avisar a Emil o escríbele a emil@madkusin.com._`;
      } else if (linkRes.reason === 'ALREADY_LINKED_TO_ANOTHER_USER') {
        replyText = `🔒 Por seguridad y privacidad, esa cita ya está vinculada a otro usuario. Solo puedes consultar o modificar tu propia cita o hacerme preguntas técnicas sobre cuchillos y afilado. Si necesitas atención humana directa, puedes pedírmelo por aquí o escribir a emil@madkusin.com.`;
      } else {
        const ownCitas = await getUserOwnAppointmentsByTelegramId(chatId);
        if (ownCitas.length > 0) {
          const c = ownCitas[0];
          replyText =
            `✅ *¡Hola ${c.nombre || firstName}! Aquí tienes los datos de tu cita:*\n\n` +
            `${formatAppointmentDetailsForTelegram(c)}\n\n` +
            `Dime si necesitas modificar algún dato, si tienes cualquier pregunta sobre tus cuchillos o si deseas atención humana directa de Emil.`;
        } else {
          replyText =
            `✅ *¡Hola ${firstName}!* Para mostrarte todos los datos de tu cita (fecha, hora, dirección completa, correo electrónico y número de cuchillos) y poder modificar lo que necesites, escríbeme por favor el correo electrónico con el que realizaste la reserva (o pídeme atención humana directa si prefieres que te atienda Emil personalmente).`;
        }
      }

      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, replyText);
      return sendJson(res, 200, { ok: true });
    }

    // 2. Comando /start genérico
    if (text === '/start') {
      const ownCitas = await getUserOwnAppointmentsByTelegramId(chatId);
      if (ownCitas.length > 0) {
        const c = ownCitas[0];
        const welcomeWithCita =
          `🔪 ¡Hola ${c.nombre || firstName}! Soy *Kusin*, el asistente técnico del taller de afilado de *Emil*.\n\n` +
          `📋 *Datos actuales de tu cita:*\n` +
          `${formatAppointmentDetailsForTelegram(c)}\n\n` +
          `Puedes pedirme modificar cualquier dato de tu cita que necesites, hacerme cualquier pregunta sobre tus cuchillos y su afilado, o solicitar atención humana directa de Emil en cualquier momento.`;
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, welcomeWithCita);
        return sendJson(res, 200, { ok: true });
      }

      const welcomeText =
        `🔪 ¡Hola ${firstName}! Soy *Kusin*, el asistente técnico del taller de afilado de *Emil*.\n\n` +
        `• Puedes hacerme cualquier pregunta sobre servicios de afilado, cuidado y tipos de cuchillos, tarifas, zonas de recogida o citas.\n` +
        `• Si quieres consultar todos los datos de tu cita o modificar lo que necesites, indícame el correo electrónico con el que hiciste la reserva.\n` +
        `• Si necesitas atención humana directa, pídemelo por aquí mismo o escribe a *emil@madkusin.com*.\n` +
        `• Para reservar una cita nueva: https://vecindario.madkusin.com`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, welcomeText);
      return sendJson(res, 200, { ok: true });
    }

    // 3. Cualquier pregunta técnica o consulta de su propia cita -> Agente IA Zero-Trust
    if (text) {
      const telegramUser = {
        id: String(chatId),
        username: message?.from?.username || '',
        firstName: message?.from?.first_name || '',
        lastName: message?.from?.last_name || ''
      };
      const agentRes = await runKusinUserAgent({
        message: text,
        channel: 'telegram_user',
        verifiedTelegramChatId: String(chatId),
        telegramUser
      });
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, agentRes.reply);
    }

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('[TelegramUserWebhook] Error:', err.message);
    return sendJson(res, 200, { ok: true });
  }
}

/**
 * ============================================================================
 * CANAL 2: WEBHOOK PRIVADO Y OPACO DE ADMINISTRACIÓN PARA EMIL (2.º BOT)
 * - 100 % separado del bot de vecinos.
 * - Protegido por lista blanca de ADMIN_TELEGRAM_CHAT_ID.
 * - Permite subir archivos PDF/TXT/MD (en inglés o español) desde Telegram al RAG,
 *   enseñar notas técnicas y consultar todas las citas de PocketBase.
 * ============================================================================
 */
async function handleTelegramAdminWebhook(req, res) {
  try {
    const update = await readJsonBody(req);
    const message = update?.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : '';
    const text = String(message?.text || message?.caption || '').trim();
    const firstName = message?.from?.first_name || 'Emil';

    if (!chatId || !TELEGRAM_ADMIN_BOT_TOKEN) {
      return sendJson(res, 200, { ok: true });
    }

    // Si ADMIN_TELEGRAM_CHAT_ID aún no se ha fijado en .env, permitir vinculación inicial al primer /start de Emil
    if (!lockedAdminChatId) {
      lockedAdminChatId = chatId;
      console.log(`[KusinAdmin] Canal privado vinculado automáticamente al Chat ID de Emil: ${chatId}`);
      await sendTelegramMessage(
        TELEGRAM_ADMIN_BOT_TOKEN,
        chatId,
        `🔐 *Canal Privado de Emil Vinculado y Blindado*\n\n` +
          `Tu \`ADMIN_TELEGRAM_CHAT_ID\` verificado es: \`${chatId}\`\n` +
          `Este bot ha quedado bloqueado exclusivamente para tu usuario. Cualquier otra persona que intente escribirle será ignorada en silencio (opacidad 100 %).\n\n` +
          `Escribe \`/estado\` para ver el panel del motor RAG y tus citas, o **envíame directamente un archivo PDF, TXT o MD** (en español o inglés) para incorporarlo al cerebro técnico de Kusin.`
      );
      if (text === '/start') {
        return sendJson(res, 200, { ok: true });
      }
    }

    // Verificación estricta de lista blanca: si no es el Chat ID de Emil, opacidad absoluta (silencio total)
    const allowedIds = lockedAdminChatId.split(',').map((id) => id.trim());
    if (!allowedIds.includes(chatId)) {
      console.warn(`[KusinAdmin] Intento no autorizado ignorado en silencio desde chat_id=${chatId}`);
      return sendJson(res, 200, { ok: true });
    }

    // 1. ¿Emil ha adjuntado un documento técnico (.pdf, .txt, .md) en el chat privado?
    if (message?.document?.file_id) {
      const doc = message.document;
      const fileName = doc.file_name || `documento_${Date.now()}.txt`;
      const lowerName = fileName.toLowerCase();

      await sendTelegramMessage(
        TELEGRAM_ADMIN_BOT_TOKEN,
        chatId,
        `⏳ *Procesando documento técnico:* \`${fileName}\`...\nExtrayendo texto e indexando fragmentos en el motor RAG de Kusin.`
      );

      const fileInfoRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_ADMIN_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(doc.file_id)}`
      );
      const fileInfo = await fileInfoRes.json();
      const filePath = fileInfo?.result?.file_path;

      if (!filePath) {
        await sendTelegramMessage(
          TELEGRAM_ADMIN_BOT_TOKEN,
          chatId,
          `⚠️ Telegram no pudo entregar el archivo (recuerda que la API de bots de Telegram admite archivos de hasta 20 MB directamente por chat; para libros mayores usa la carpeta local \`knowledge/raw/\`).`
        );
        return sendJson(res, 200, { ok: true });
      }

      const fileDownloadRes = await fetch(
        `https://api.telegram.org/file/bot${TELEGRAM_ADMIN_BOT_TOKEN}/${filePath}`
      );
      const arrayBuf = await fileDownloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      let extractedText = '';
      if (lowerName.endsWith('.pdf')) {
        extractedText = await ragEngine.extractPdfBufferToText(buffer);
      } else {
        extractedText = buffer.toString('utf-8');
      }

      const ingestRes = ragEngine.ingestTextDocument({
        title: fileName.replace(/\.(pdf|txt|md)$/i, ''),
        rawText: extractedText,
        source: `telegram_admin_doc:${fileName}`
      });

      if (!ingestRes.ok) {
        await sendTelegramMessage(
          TELEGRAM_ADMIN_BOT_TOKEN,
          chatId,
          `⚠️ No se pudo extraer texto seleccionable de \`${fileName}\` (${ingestRes.error}).`
        );
      } else {
        await sendTelegramMessage(
          TELEGRAM_ADMIN_BOT_TOKEN,
          chatId,
          `✅ *¡Documento \`${fileName}\` aprendido por Kusin!*\n\n` +
            `• Nuevos fragmentos técnicos indexados: *${ingestRes.addedChunks}*\n` +
            `• Total fragmentos activos en el cerebro RAG: *${ingestRes.totalChunks}*\n` +
            `• Búsqueda bilingüe (ES/EN) activa.\n\n` +
            `🧪 *Pruébalo ahora mismo:* Hazme cualquier pregunta técnica sobre el contenido de \`${fileName}\` aquí mismo o desde la web.`
        );
      }

      return sendJson(res, 200, { ok: true });
    }

    // 2. Mensaje de texto o comando de Emil en su canal privado
    if (text === '/start') {
      const reply = await runKusinAdminAgent({ message: '/estado', adminName: firstName });
      await sendTelegramMessage(TELEGRAM_ADMIN_BOT_TOKEN, chatId, reply);
      return sendJson(res, 200, { ok: true });
    }

    if (text) {
      const reply = await runKusinAdminAgent({ message: text, adminName: firstName });
      await sendTelegramMessage(TELEGRAM_ADMIN_BOT_TOKEN, chatId, reply);
    }

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('[TelegramAdminWebhook] Error:', err.message);
    return sendJson(res, 200, { ok: true });
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname === '/api/voice-config') {
    return handleVoiceConfig(req, res, urlObj);
  }

  if (urlObj.pathname === '/api/agent/chat' && req.method === 'POST') {
    return handleAgentChat(req, res);
  }

  if (urlObj.pathname === '/api/agent/tts' && req.method === 'POST') {
    return handleAgentTts(req, res);
  }

  if (urlObj.pathname === '/api/disponibilidad' && req.method === 'GET') {
    return handleDirectAvailability(req, res, urlObj);
  }

  if (urlObj.pathname === '/api/citas' && req.method === 'POST') {
    return handleDirectPocketBaseBooking(req, res);
  }

  if (urlObj.pathname === '/api/telegram-webhook' && req.method === 'POST') {
    return handleTelegramUserWebhook(req, res);
  }

  if (urlObj.pathname === '/api/telegram-admin-webhook' && req.method === 'POST') {
    return handleTelegramAdminWebhook(req, res);
  }

  let filePath = path.join(DIST_DIR, urlObj.pathname === '/' ? 'index.html' : urlObj.pathname);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[vecindario.madkusin.com] Servidor + Agente IA Kusin activo en http://0.0.0.0:${PORT}`);
});
