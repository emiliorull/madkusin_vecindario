/**
 * server.js
 * Servidor ligero de producción (Node.js nativo sin dependencias extra) para servir:
 * 1. El bundle estático compilado de Vite (/dist)
 * 2. El endpoint seguro /api/voice-config (equivalente a Cloudflare Pages Function)
 * Ideal para desplegar directamente tras Caddy en el Droplet de DigitalOcean (vecindario.madkusin.com).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);

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

async function handleVoiceConfig(req, res, urlObj) {
  const requestedProvider = (
    urlObj.searchParams.get('provider') ||
    process.env.VOICE_PROVIDER ||
    'gemini'
  ).toLowerCase();

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  });

  try {
    if (requestedProvider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      if (!apiKey || !agentId) {
        return res.end(
          JSON.stringify({
            ok: true,
            provider: 'hybrid',
            mode: 'hybrid_fallback',
            reason: 'ELEVENLABS_CREDENTIALS_MISSING'
          })
        );
      }

      const r = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { 'xi-api-key': apiKey } }
      );
      if (!r.ok) throw new Error(`ElevenLabs error: ${r.status}`);
      const data = await r.json();
      return res.end(
        JSON.stringify({
          ok: true,
          provider: 'elevenlabs',
          mode: 'live',
          agentId,
          signedUrl: data.signed_url
        })
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.0-flash-exp';
    const geminiVoiceName = process.env.GEMINI_VOICE_NAME || 'Aoede';

    if (!geminiApiKey || geminiApiKey === 'tu_clave_privada_gemini_aqui') {
      return res.end(
        JSON.stringify({
          ok: true,
          provider: 'hybrid',
          mode: 'hybrid_fallback',
          reason: 'GEMINI_API_KEY_MISSING'
        })
      );
    }

    const wsEndpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
      geminiApiKey
    )}`;

    return res.end(
      JSON.stringify({
        ok: true,
        provider: 'gemini',
        mode: 'live',
        wsEndpoint,
        model: geminiModel,
        voiceName: geminiVoiceName
      })
    );
  } catch (err) {
    return res.end(
      JSON.stringify({
        ok: true,
        provider: 'hybrid',
        mode: 'hybrid_fallback',
        reason: 'SERVER_ERROR',
        message: err.message
      })
    );
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (urlObj.pathname === '/api/voice-config') {
    return handleVoiceConfig(req, res, urlObj);
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
