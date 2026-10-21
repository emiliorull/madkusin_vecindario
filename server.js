/**
 * server.js
 * Servidor ligero de producción (Node.js nativo) para vecindario.madkusin.com:
 * 1. Sirve el bundle compilado de Vite (/dist)
 * 2. Endpoint seguro /api/voice-config (Gemini Multimodal Live API / ElevenLabs)
 * 3. Puente directo con PocketBase (/api/citas) cuando el webhook de n8n aún no está activo
 * 4. Webhook en vivo de Telegram (/api/telegram-webhook) para @madkusin_citas_bot
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);
const POCKETBASE_INTERNAL_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

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
      if (raw.length > 1e6) req.destroy();
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
      voiceName: geminiVoiceName
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
 * Guarda la cita directamente en PocketBase (colección `citas`) cuando n8n aún no está activo,
 * garantizando que ninguna reserva se pierda.
 */
async function handleDirectPocketBaseBooking(req, res) {
  try {
    const body = await readJsonBody(req);
    const pbPayload = {
      nombre: body.nombre,
      email: body.email,
      direccion: body.direccion,
      codigo_postal: '28224',
      modalidad: body.modalidad === 'recogida' ? 'recogida' : 'in_situ',
      num_cuchillos: Number(body.num_cuchillos || 1),
      duracion_minutos: Number(body.duracion_minutos || 35),
      tiene_enchufe_15m: Boolean(body.tiene_enchufe_15m),
      confirma_filo_liso: true,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin || '',
      notas: body.notas || '',
      estado: 'confirmada',
      origen: body.origen || 'web_form'
    };

    const pbRes = await fetch(`${POCKETBASE_INTERNAL_URL}/api/collections/citas/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pbPayload)
    });

    if (!pbRes.ok) {
      const errText = await pbRes.text();
      return sendJson(res, 400, { ok: false, error: errText });
    }

    const record = await pbRes.json();
    const botUsername = process.env.VITE_TELEGRAM_BOT_USERNAME || 'madkusin_citas_bot';
    return sendJson(res, 200, {
      ok: true,
      source: 'pocketbase_direct',
      cita_id: record.id,
      telegram_deeplink: `https://t.me/${botUsername}?start=cita_${record.id}`
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}

/**
 * Webhook receptor de @madkusin_citas_bot en Telegram.
 * Responde automáticamente al comando /start cita_ID sin pedir nunca teléfono.
 */
async function handleTelegramWebhook(req, res) {
  try {
    const update = await readJsonBody(req);
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();
    const firstName = message?.from?.first_name || 'vecino/a';

    if (chatId && TELEGRAM_BOT_TOKEN) {
      let replyText =
        `🔪 ¡Hola ${firstName}! Soy el bot oficial del taller de afilado de *Emil* en el *CP 28224 (Pozuelo)*.\n\n` +
        `Puedes reservar tu cita (*AFILO GRATIS TU PEOR CUCHILLO*) en:\n👉 https://vecindario.madkusin.com`;

      if (text.startsWith('/start cita_')) {
        const citaId = text.replace('/start cita_', '').trim();
        replyText =
          `✅ *¡Aviso de cita activado, ${firstName}!*\n\n` +
          `Hemos vinculado tu reserva *#${citaId}* con este chat de Telegram sin necesidad de pedirte tu número de móvil.\n\n` +
          `📍 *Zona:* Exclusiva CP 28224 (Pozuelo)\n` +
          `⚙️ *Método de Emil:* Afilado profesional de alta precisión con afilador de banda y strop, respetuoso con el temple del acero y sin sobrecalentar nunca la hoja.\n` +
          `🎁 *Recuerda:* Ten preparado tu peor cuchillo de acero de filo liso (lo afilamos 100 % gratis y sin compromiso).\n\n` +
          `Te escribiremos por aquí para recordarte la visita de Emil.`;
      }

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: 'Markdown'
        })
      });
    }

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 200, { ok: true });
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname === '/api/voice-config') {
    return handleVoiceConfig(req, res, urlObj);
  }

  if (urlObj.pathname === '/api/citas' && req.method === 'POST') {
    return handleDirectPocketBaseBooking(req, res);
  }

  if (urlObj.pathname === '/api/telegram-webhook' && req.method === 'POST') {
    return handleTelegramWebhook(req, res);
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
  console.log(`[vecindario.madkusin.com] Servidor activo en http://0.0.0.0:${PORT}`);
});
