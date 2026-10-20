/**
 * Cloudflare Pages Function: /functions/api/voice-config.js
 * Endpoint: GET / POST /api/voice-config
 *
 * Gestiona de forma segura la configuración de sesión del Agente de Voz ("Asistente de cita")
 * sin incluir claves privadas (GEMINI_API_KEY o ELEVENLABS_API_KEY) en el código estático del cliente.
 *
 * Soporta arquitectura multi-proveedor:
 *  - "gemini": Gemini Multimodal Live API (WebSockets BidiGenerateContent)
 *  - "elevenlabs": ElevenLabs Conversational AI (Signed WebRTC/WS URL efímera)
 *  - "hybrid": Modo demo interactivo con Web Speech API cuando aún no se han configurado claves en Cloudflare
 */

const ALLOWED_ORIGINS = [
  'https://vecindario.madkusin.com',
  'https://madkusin.com',
  'http://localhost:5173',
  'http://localhost:8788',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8788'
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.pages.dev') ||
    origin.startsWith('http://localhost:');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request)
  });
}

export async function onRequestGet(context) {
  return handleVoiceConfigRequest(context);
}

export async function onRequestPost(context) {
  return handleVoiceConfigRequest(context);
}

async function handleVoiceConfigRequest({ request, env }) {
  const headers = getCorsHeaders(request);
  const url = new URL(request.url);

  // Permite seleccionar el proveedor por query param o por variable de entorno en Cloudflare
  const requestedProvider = (
    url.searchParams.get('provider') ||
    env.VOICE_PROVIDER ||
    'gemini'
  ).toLowerCase();

  try {
    // ========================================================================
    // OPCIÓN A: ELEVENLABS CONVERSATIONAL AI (Preparado para voz clonada de Kusin)
    // ========================================================================
    if (requestedProvider === 'elevenlabs') {
      const apiKey = env.ELEVENLABS_API_KEY;
      const agentId = env.ELEVENLABS_AGENT_ID;

      if (!apiKey || !agentId) {
        return new Response(
          JSON.stringify({
            ok: true,
            provider: 'hybrid',
            mode: 'hybrid_fallback',
            reason: 'ELEVENLABS_CREDENTIALS_MISSING',
            message:
              'Credenciales de ElevenLabs aún no configuradas en Cloudflare Pages. Usando modo híbrido local.'
          }),
          { status: 200, headers }
        );
      }

      // Solicita una URL firmada efímera (Signed URL) a ElevenLabs sin exponer la API Key
      const elevenResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey
          }
        }
      );

      if (!elevenResponse.ok) {
        throw new Error(`ElevenLabs Signed URL error: ${elevenResponse.status}`);
      }

      const elevenData = await elevenResponse.json();
      return new Response(
        JSON.stringify({
          ok: true,
          provider: 'elevenlabs',
          mode: 'live',
          agentId,
          signedUrl: elevenData.signed_url,
          expiresInSeconds: 900
        }),
        { status: 200, headers }
      );
    }

    // ========================================================================
    // OPCIÓN B: GEMINI MULTIMODAL LIVE API (Por defecto)
    // ========================================================================
    const geminiApiKey = env.GEMINI_API_KEY;
    const geminiModel = env.GEMINI_LIVE_MODEL || 'models/gemini-2.0-flash-exp';
    const geminiVoiceName = env.GEMINI_VOICE_NAME || 'Aoede';

    if (!geminiApiKey || geminiApiKey === 'tu_clave_privada_gemini_aqui') {
      return new Response(
        JSON.stringify({
          ok: true,
          provider: 'hybrid',
          mode: 'hybrid_fallback',
          reason: 'GEMINI_API_KEY_MISSING',
          message:
            'GEMINI_API_KEY no detectada en Cloudflare Functions. Activando Asistente de Voz Híbrido (Web Speech API) listo para pruebas.'
        }),
        { status: 200, headers }
      );
    }

    const wsEndpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
      geminiApiKey
    )}`;

    return new Response(
      JSON.stringify({
        ok: true,
        provider: 'gemini',
        mode: 'live',
        wsEndpoint,
        model: geminiModel,
        voiceName: geminiVoiceName
      }),
      { status: 200, headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: true,
        provider: 'hybrid',
        mode: 'hybrid_fallback',
        reason: 'SERVERLESS_ERROR',
        message: error.message || 'Error al obtener configuración de voz; usando modo híbrido.'
      }),
      { status: 200, headers }
    );
  }
}
