/**
 * src/services/voice/VoiceAgentService.js
 * Servicio desacoplado de Agente de Voz ("Asistente de cita") con interfaz común IVoiceProvider:
 *
 * 1. GeminiLiveVoiceProvider: Conexión WebSockets en tiempo real a Gemini Multimodal Live API
 *    (BidiGenerateContent) con audio PCM 16kHz/24kHz y ejecución nativa de Function Calling.
 * 2. ElevenLabsVoiceProvider: Adaptador listo para alternar a ElevenLabs Conversational AI
 *    (con voz clonada de Kusin) usando URLs firmadas efímeras desde /api/voice-config.
 * 3. HybridLocalVoiceProvider: Motor conversacional interactivo con Web Speech API (reconocimiento
 *    y síntesis de voz en español) que se activa automáticamente cuando aún no se han configurado
 *    las claves privadas en Cloudflare, ejecutando igualmente las herramientas `check_availability`
 *    y `book_appointment` y actualizando la interfaz web en tiempo real.
 */

import { checkAvailability, bookAppointment } from '../appointmentApi';
import { getUpcomingBusinessDays, validatePostalCode } from '../../utils/scheduling';
import {
  INITIAL_GREETING,
  VOICE_AGENT_TOOLS,
  buildKusinSystemPrompt
} from './voicePromptsAndTools';

/**
 * Interfaz base (IVoiceProvider) que deben implementar todos los proveedores de voz.
 */
export class IVoiceProvider {
  constructor(callbacks) {
    this.callbacks = callbacks; // { onStateChange, onTranscript, onAudioLevel, onAppointmentBooked, onError }
  }
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }
  async disconnect() {}
  setMuted(_muted) {}
  async sendUserText(_text) {}
}

/**
 * ============================================================================
 * 1. PROVEEDOR GEMINI MULTIMODAL LIVE API (WebSockets BidiGenerateContent)
 * ============================================================================
 */
export class GeminiLiveVoiceProvider extends IVoiceProvider {
  constructor(config, callbacks) {
    super(callbacks);
    this.config = config; // { wsEndpoint, model, voiceName }
    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.isMuted = false;
    this.playbackTime = 0;
  }

  async connect() {
    this.callbacks.onStateChange?.('connecting');

    this.ws = new WebSocket(this.config.wsEndpoint);

    this.ws.onopen = async () => {
      // Enviar paquete setup con el System Prompt estricto y las herramientas
      const setupFrame = {
        setup: {
          model: this.config.model || 'models/gemini-2.0-flash-exp',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.config.voiceName || 'Aoede'
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: buildKusinSystemPrompt() }]
          },
          tools: [
            {
              functionDeclarations: VOICE_AGENT_TOOLS
            }
          ]
        }
      };

      this.ws.send(JSON.stringify(setupFrame));
      await this.startMicrophoneCapture();

      // Solicitar que el asistente inicie saludando según la Regla 1
      this.sendClientPrompt(
        'Inicia la conversación saludando exactamente con la frase obligatoria de la regla 1.'
      );
    };

    this.ws.onmessage = async (event) => {
      try {
        let rawText = event.data;
        if (rawText instanceof Blob) {
          rawText = await rawText.text();
        }
        const message = JSON.parse(rawText);
        await this.handleServerMessage(message);
      } catch (err) {
        console.error('[GeminiLiveVoiceProvider] Error procesando mensaje:', err);
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.(
        'No se pudo establecer el stream con Gemini Live. Puedes continuar por voz o texto en el modo asistente.'
      );
    };

    this.ws.onclose = () => {
      this.cleanupAudio();
    };
  }

  sendClientPrompt(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      })
    );
  }

  async sendUserText(text) {
    if (!text?.trim()) return;
    this.callbacks.onTranscript?.({
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });
    this.callbacks.onStateChange?.('thinking');
    this.sendClientPrompt(text.trim());
  }

  async handleServerMessage(message) {
    // 1. Procesar Audio o Texto del modelo
    const parts = message?.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.text) {
        this.callbacks.onTranscript?.({
          role: 'assistant',
          text: part.text,
          timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });
      }
      if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
        this.callbacks.onStateChange?.('speaking');
        this.playPcm24kAudio(part.inlineData.data);
      }
    }

    if (message?.serverContent?.turnComplete) {
      this.callbacks.onStateChange?.('listening');
    }

    // 2. Procesar Tool Calls (check_availability / book_appointment)
    const functionCalls = message?.toolCall?.functionCalls || [];
    if (functionCalls.length > 0) {
      this.callbacks.onStateChange?.('thinking');
      const functionResponses = [];

      for (const call of functionCalls) {
        const result = await this.executeToolCall(call.name, call.args || {});
        functionResponses.push({
          id: call.id,
          name: call.name,
          response: { output: result }
        });
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            toolResponse: {
              functionResponses
            }
          })
        );
      }
    }
  }

  async executeToolCall(toolName, args) {
    if (toolName === 'check_availability') {
      const res = await checkAvailability({
        fecha: args.fecha,
        modalidad: args.modalidad || 'in_situ',
        num_cuchillos: args.num_cuchillos || 1
      });
      this.callbacks.onToolEvent?.({
        tool: 'check_availability',
        summary: `Consultada agenda para el ${args.fecha} (${res.duracion_minutos} min)`
      });
      return res;
    }

    if (toolName === 'book_appointment') {
      const res = await bookAppointment({
        ...args,
        origen: 'voice_assistant_gemini'
      });
      if (res.ok && res.appointment) {
        this.callbacks.onAppointmentBooked?.(res.appointment);
      }
      return res;
    }

    return { ok: false, error: `Herramienta desconocida: ${toolName}` };
  }

  async startMicrophoneCapture() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        // Calcular nivel RMS para el visualizador de ondas
        let sum = 0;
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          sum += sample * sample;
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        const rms = Math.min(1, Math.sqrt(sum / inputData.length) * 4.5);
        this.callbacks.onAudioLevel?.(rms);

        // Convertir a Base64 y enviar por WebSocket
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Audio
                }
              ]
            }
          })
        );
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.callbacks.onStateChange?.('listening');
    } catch (err) {
      this.callbacks.onError?.(
        'No se pudo acceder al micrófono. Revisa los permisos del navegador o escribe tu respuesta abajo.'
      );
    }
  }

  playPcm24kAudio(base64Data) {
    if (!this.audioContext) return;
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
      sum += float32[i] * float32[i];
    }
    const rms = Math.min(1, Math.sqrt(sum / Math.max(1, float32.length)) * 3.5);
    this.callbacks.onAudioLevel?.(rms);

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    if (this.playbackTime < now) {
      this.playbackTime = now;
    }
    source.start(this.playbackTime);
    this.playbackTime += buffer.duration;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.isMuted) {
      this.callbacks.onAudioLevel?.(0.05);
    }
  }

  cleanupAudio() {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }

  async disconnect() {
    this.cleanupAudio();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.callbacks.onStateChange?.('idle');
  }
}

/**
 * ============================================================================
 * 2. PROVEEDOR ELEVENLABS CONVERSATIONAL AI (Adaptador para voz clonada de Kusin)
 * ============================================================================
 */
export class ElevenLabsVoiceProvider extends IVoiceProvider {
  constructor(config, callbacks) {
    super(callbacks);
    this.config = config; // { signedUrl, agentId }
    this.ws = null;
    this.isMuted = false;
  }

  async connect() {
    this.callbacks.onStateChange?.('connecting');
    this.ws = new WebSocket(this.config.signedUrl);

    this.ws.onopen = () => {
      this.callbacks.onStateChange?.('listening');
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'agent_response' && msg.agent_response_event?.agent_response) {
          this.callbacks.onStateChange?.('speaking');
          this.callbacks.onTranscript?.({
            role: 'assistant',
            text: msg.agent_response_event.agent_response,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          });
        }

        if (msg.type === 'user_transcript' && msg.user_transcription_event?.user_transcript) {
          this.callbacks.onTranscript?.({
            role: 'user',
            text: msg.user_transcription_event.user_transcript,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          });
        }

        // Soporte para Client Tools en ElevenLabs Conversational AI
        if (msg.type === 'client_tool_call' && msg.client_tool_call) {
          const { tool_name, tool_call_id, parameters } = msg.client_tool_call;
          this.callbacks.onStateChange?.('thinking');
          let result = { ok: false };

          if (tool_name === 'check_availability') {
            result = await checkAvailability(parameters);
          } else if (tool_name === 'book_appointment') {
            result = await bookAppointment({
              ...parameters,
              origen: 'voice_assistant_elevenlabs'
            });
            if (result.ok && result.appointment) {
              this.callbacks.onAppointmentBooked?.(result.appointment);
            }
          }

          this.ws.send(
            JSON.stringify({
              type: 'client_tool_result',
              tool_call_id,
              result: JSON.stringify(result),
              is_error: !result.ok
            })
          );
        }
      } catch (err) {
        console.error('[ElevenLabsVoiceProvider] Error:', err);
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.('Error en la conexión con ElevenLabs Conversational AI.');
    };
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
  }

  async disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.callbacks.onStateChange?.('idle');
  }
}

/**
 * ============================================================================
 * 3. PROVEEDOR HÍBRIDO / DEMO INTERACTIVO (Web Speech API + Flujo Guiado Kusin)
 * Funciona de inmediato en el navegador antes de configurar GEMINI_API_KEY
 * ============================================================================
 */
export class HybridLocalVoiceProvider extends IVoiceProvider {
  constructor(callbacks, initialMode = 'text') {
    super(callbacks);
    this.recognition = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.interactionMode = initialMode; // 'text' | 'voice'
    this.isMuted = initialMode === 'text';
    this.isConnected = false;
    this.isBusySpeakingOrThinking = false;
    this.currentAudio = null;
    this.waveTimer = null;
    this.history = [];

    // Estado conversacional de respaldo por si se ejecuta sin backend
    const nextBusinessDays = getUpcomingBusinessDays(5);
    this.defaultDate = nextBusinessDays[0]?.isoDate || '2026-10-20';

    this.draft = {
      step: 'awaiting_intent',
      codigo_postal: '',
      modalidad: '',
      tiene_enchufe_15m: false,
      num_cuchillos: 1,
      fecha: this.defaultDate,
      hora: '',
      availableSlots: [],
      nombre: '',
      direccion: '',
      email: ''
    };
  }

  async connect() {
    this.isConnected = true;
    this.callbacks.onStateChange?.('connecting');

    this.startWaveformSimulation();
    this.setupSpeechRecognition();

    await this.speakAndTranscribe(INITIAL_GREETING);
  }

  setInteractionMode(mode) {
    this.interactionMode = mode === 'voice' ? 'voice' : 'text';
    if (this.interactionMode === 'text') {
      this.setMuted(true);
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
        } catch {}
        this.currentAudio = null;
      }
      if (this.synth) {
        try {
          this.synth.cancel();
        } catch {}
      }
      this.callbacks.onStateChange?.('listening');
    } else {
      this.setMuted(false);
    }
  }

  startWaveformSimulation() {
    if (this.waveTimer) clearInterval(this.waveTimer);
    this.waveTimer = setInterval(() => {
      if (!this.isConnected || this.isMuted) {
        this.callbacks.onAudioLevel?.(0.06);
        return;
      }
      const level = 0.15 + Math.random() * 0.55;
      this.callbacks.onAudioLevel?.(level);
    }, 140);
  }

  stopRecognitionSafely() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
  }

  startRecognitionSafely() {
    if (
      !this.isConnected ||
      this.interactionMode !== 'voice' ||
      this.isMuted ||
      this.isBusySpeakingOrThinking ||
      !this.recognition
    ) {
      return;
    }
    try {
      this.recognition.start();
    } catch {}
  }

  setupSpeechRecognition() {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = async (event) => {
        if (this.isBusySpeakingOrThinking || this.isMuted || this.interactionMode !== 'voice') {
          return;
        }
        const transcript = (event.results?.[0]?.[0]?.transcript || '').trim();
        if (transcript.length >= 3) {
          await this.sendUserText(transcript);
        }
      };

      // Cuando no recibe respuesta del usuario tras unos segundos de silencio, NO entra en bucle:
      // detiene la escucha activa limpiamente hasta que el usuario pulse el micro o hable en el siguiente turno.
      this.recognition.onend = () => {
        if (!this.isBusySpeakingOrThinking && this.interactionMode === 'voice' && !this.isMuted) {
          this.isMuted = true;
          this.callbacks.onMuteChange?.(true);
          this.callbacks.onStateChange?.('listening');
        }
      };
    } catch {
      // Si el navegador bloquea SpeechRecognition, el usuario puede usar el campo de texto
    }
  }

  async speakAndTranscribe(text, ragSources = []) {
    if (!this.isConnected) return;

    this.isBusySpeakingOrThinking = true;
    this.stopRecognitionSafely();

    this.history.push({ role: 'assistant', text });
    this.callbacks.onTranscript?.({
      role: 'assistant',
      text,
      ragSources,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });

    if (this.interactionMode === 'voice') {
      this.callbacks.onStateChange?.('speaking');
      let playedNeural = false;

      // 1. Voz Neuronal Humana Real desde el servidor (/api/agent/tts -> Gemini TTS WAV)
      try {
        const ttsRes = await fetch('/api/agent/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.ok && ttsData.audioBase64) {
            playedNeural = true;
            await new Promise((resolve) => {
              const audio = new Audio(`data:${ttsData.mimeType || 'audio/wav'};base64,${ttsData.audioBase64}`);
              this.currentAudio = audio;
              audio.onended = () => {
                this.currentAudio = null;
                resolve();
              };
              audio.onerror = () => {
                this.currentAudio = null;
                resolve();
              };
              audio.play().catch(() => {
                this.currentAudio = null;
                playedNeural = false;
                resolve();
              });
            });
          }
        }
      } catch {
        playedNeural = false;
      }

      // 2. Fallback a voz del navegador si falla la red
      if (!playedNeural && this.synth) {
        try {
          this.synth.cancel();
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            const voices = this.synth.getVoices?.() || [];
            const naturalVoice =
              voices.find((v) => v.lang.startsWith('es') && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google'))) ||
              voices.find((v) => v.lang.startsWith('es-ES'));
            if (naturalVoice) utterance.voice = naturalVoice;
            utterance.rate = 1.02;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            this.synth.speak(utterance);
          });
        } catch {}
      }

      // Pausa de 450ms tras terminar el audio para evitar que el micro capte el eco de los altavoces
      await new Promise((r) => setTimeout(r, 450));
    }

    this.isBusySpeakingOrThinking = false;

    if (this.isConnected) {
      this.callbacks.onStateChange?.('listening');
      this.startRecognitionSafely();
    }
  }

  async sendUserText(userText) {
    if (!userText?.trim() || !this.isConnected) return;
    const cleanText = userText.trim();

    this.isBusySpeakingOrThinking = true;
    this.stopRecognitionSafely();
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {}
      this.currentAudio = null;
    }

    this.history.push({ role: 'user', text: cleanText });
    this.callbacks.onTranscript?.({
      role: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });

    this.callbacks.onStateChange?.('thinking');

    // Consultar el Cerebro RAG + Gemini Zero-Trust en el servidor (/api/agent/chat)
    try {
      const apiRes = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: this.history.slice(-10)
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.ok && data.reply) {
          if (Array.isArray(data.toolEvents)) {
            for (const evt of data.toolEvents) {
              this.callbacks.onToolEvent?.(evt);
            }
          }
          if (data.appointment) {
            this.callbacks.onAppointmentBooked?.(data.appointment);
          }
          await this.speakAndTranscribe(data.reply, data.ragSources || []);
          return;
        }
      }
    } catch (err) {
      this.callbacks.onError?.(
        `No se pudo conectar con el servidor de Kusin: ${err.message || 'error de red'}`
      );
    }

    this.isBusySpeakingOrThinking = false;
    if (this.isConnected) {
      this.callbacks.onStateChange?.('listening');
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    this.callbacks.onMuteChange?.(this.isMuted);
    if (this.isMuted) {
      this.stopRecognitionSafely();
    } else if (!this.isBusySpeakingOrThinking && this.isConnected) {
      this.startRecognitionSafely();
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.isBusySpeakingOrThinking = false;
    if (this.waveTimer) {
      clearInterval(this.waveTimer);
      this.waveTimer = null;
    }
    this.stopRecognitionSafely();
    this.recognition = null;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {}
      this.currentAudio = null;
    }
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.callbacks.onStateChange?.('idle');
  }
}

/**
 * ============================================================================
 * ORQUESTADOR PRINCIPAL: VoiceAgentService
 * Consulta `/api/voice-config` en Cloudflare Pages y selecciona automáticamente
 * GeminiLiveVoiceProvider, ElevenLabsVoiceProvider o HybridLocalVoiceProvider.
 * ============================================================================
 */
export class VoiceAgentService {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.providerInstance = null;
    this.activeProviderName = 'rag_agent';
  }

  async startSession(initialMode = 'text') {
    await this.stopSession();

    this.activeProviderName = 'rag_agent';
    this.providerInstance = new HybridLocalVoiceProvider(this.callbacks, initialMode);
    await this.providerInstance.connect();
    return { provider: 'rag_agent', mode: initialMode };
  }

  setInteractionMode(mode) {
    if (this.providerInstance && typeof this.providerInstance.setInteractionMode === 'function') {
      this.providerInstance.setInteractionMode(mode);
    }
  }

  async sendText(text) {
    if (this.providerInstance) {
      await this.providerInstance.sendUserText(text);
    }
  }

  setMuted(muted) {
    if (this.providerInstance) {
      this.providerInstance.setMuted(muted);
    }
  }

  async stopSession() {
    if (this.providerInstance) {
      await this.providerInstance.disconnect();
      this.providerInstance = null;
    }
  }
}
