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
  constructor(callbacks) {
    super(callbacks);
    this.recognition = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isMuted = false;
    this.isConnected = false;
    this.waveTimer = null;

    // Estado conversacional paso a paso según la Regla 5 del System Prompt
    const nextBusinessDays = getUpcomingBusinessDays(5);
    this.defaultDate = nextBusinessDays[0]?.isoDate || '2026-10-20';

    this.draft = {
      step: 'awaiting_intent', // awaiting_intent -> cp -> modalidad -> enchufe -> cuchillos -> fecha_hora -> datos -> completed
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

    // Saludo inicial estricto según Regla 1
    await this.speakAndTranscribe(INITIAL_GREETING);
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
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && !this.isMuted) {
          await this.sendUserText(transcript);
        }
      };

      this.recognition.onend = () => {
        if (this.isConnected && !this.isMuted && !this.synth?.speaking) {
          try {
            this.recognition.start();
          } catch {}
        }
      };
    } catch {
      // Si el navegador bloquea SpeechRecognition, el usuario puede usar los botones rápidos o el campo de texto
    }
  }

  async speakAndTranscribe(text) {
    if (!this.isConnected) return;

    this.callbacks.onStateChange?.('speaking');
    this.callbacks.onTranscript?.({
      role: 'assistant',
      text,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });

    if (this.synth) {
      try {
        this.synth.cancel();
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'es-ES';
          utterance.rate = 1.03;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          this.synth.speak(utterance);
        });
      } catch {}
    } else {
      await new Promise((r) => setTimeout(r, 900));
    }

    if (this.isConnected) {
      this.callbacks.onStateChange?.('listening');
      if (this.recognition && !this.isMuted) {
        try {
          this.recognition.start();
        } catch {}
      }
    }
  }

  async sendUserText(userText) {
    if (!userText?.trim() || !this.isConnected) return;
    const cleanText = userText.trim();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    this.callbacks.onTranscript?.({
      role: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });

    this.callbacks.onStateChange?.('thinking');
    await new Promise((r) => setTimeout(r, 450));

    const lower = cleanText.toLowerCase();

    // Consultas transversales: precios / tarifas (Regla 4)
    if (
      lower.includes('precio') ||
      lower.includes('tarifa') ||
      lower.includes('cuánto cuesta') ||
      lower.includes('cuanto cuesta') ||
      lower.includes('cobráis')
    ) {
      await this.speakAndTranscribe(
        'Primero Kusin afila totalmente gratis tu peor cuchillo de acero de filo liso, sin ningún compromiso. Si eliges el afilado in situ en tu domicilio, al ver en el acto cómo corta, Kusin te indicará en persona la tarifa para el resto de cuchillos que decidas afilar. Y si prefieres recogida y entrega en 24 o 48 horas, al devolvértelos pruebas primero ese peor cuchillo gratis: si no te convence, no pagas absolutamente nada por el resto. ¿Vivís en el código postal 28224?'
      );
      if (this.draft.step === 'awaiting_intent') {
        this.draft.step = 'cp';
      }
      return;
    }

    // Consultas transversales: sierra, cerámica, tijeras (Regla 3)
    if (
      lower.includes('sierra') ||
      lower.includes('panero') ||
      lower.includes('cerámica') ||
      lower.includes('ceramica') ||
      lower.includes('tijera') ||
      lower.includes('hacha')
    ) {
      await this.speakAndTranscribe(
        'Te aclaro un detalle importante: en el taller de Kusin solo afilamos cuchillos de cocina de acero de filo liso, usando afiladora de banda con refrigeración por agua y pulido en cuero strop. No afilamos cuchillos de sierra, ni de cerámica, ni tijeras, ni hachas. ¿Tienes cuchillos de acero de filo liso y vives en el 28224?'
      );
      if (this.draft.step === 'awaiting_intent') {
        this.draft.step = 'cp';
      }
      return;
    }

    // Flujo guiado de reserva paso a paso (Regla 5)
    switch (this.draft.step) {
      case 'awaiting_intent': {
        if (lower.includes('28224')) {
          this.draft.codigo_postal = '28224';
          this.draft.step = 'modalidad';
          await this.speakAndTranscribe(
            '¡Estupendo, vecino del 28224! Recuerda que solo afilamos cuchillos de acero de filo liso con refrigeración por agua y pulido en cuero strop. ¿Qué modalidad prefieres: afilado in situ en tu domicilio o recogida y entrega en 24 a 48 horas?'
          );
          return;
        }
        this.draft.step = 'cp';
        await this.speakAndTranscribe(
          '¡Genial! Kusin afila con sistema de banda refrigerado por agua y acabado en cuero strop, exclusivamente para cuchillos de acero de filo liso. Para empezar, ¿me confirmas que tu domicilio está en el código postal 28224 de Pozuelo?'
        );
        return;
      }

      case 'cp': {
        const cpMatch = cleanText.match(/\b\d{5}\b/);
        if (cpMatch && cpMatch[0] !== '28224') {
          const check = validatePostalCode(cpMatch[0]);
          await this.speakAndTranscribe(check.message);
          return;
        }

        if (
          lower.includes('28224') ||
          lower.includes('sí') ||
          lower.includes('si') ||
          lower.includes('pozuelo') ||
          lower.includes('claro')
        ) {
          this.draft.codigo_postal = '28224';
          this.draft.step = 'modalidad';
          await this.speakAndTranscribe(
            'Perfecto, código postal 28224 confirmado. ¿Qué modalidad prefieres: 1) Afilado in situ en tu casa, o 2) Recogida y entrega en 24/48 horas?'
          );
          return;
        }

        await this.speakAndTranscribe(
          'Disculpa, para continuar necesito confirmar que vives en el código postal 28224. ¿Es ese tu código postal?'
        );
        return;
      }

      case 'modalidad': {
        if (
          lower.includes('recogida') ||
          lower.includes('24') ||
          lower.includes('48') ||
          lower.includes('taller') ||
          lower.includes('opción 2') ||
          lower.includes('opcion 2')
        ) {
          this.draft.modalidad = 'recogida';
          this.draft.tiene_enchufe_15m = false;
          this.draft.step = 'cuchillos';
          await this.speakAndTranscribe(
            'Anotado: recogida y entrega en 24/48 horas (recuerda que al recibirlos pruebas primero tu peor cuchillo gratis y si no te convence no pagas nada por el resto). ¿Cuántos cuchillos de acero de filo liso quieres afilar aproximadamente?'
          );
          return;
        }

        if (
          lower.includes('situ') ||
          lower.includes('casa') ||
          lower.includes('domicilio') ||
          lower.includes('allí') ||
          lower.includes('opción 1') ||
          lower.includes('opcion 1')
        ) {
          this.draft.modalidad = 'in_situ';
          this.draft.step = 'enchufe';
          await this.speakAndTranscribe(
            'Perfecto, afilado in situ en tu domicilio. Para trabajar con la afiladora refrigerada por agua, ¿confirmas que dispones de un enchufe accesible a menos de 15 metros? Kusin lleva su propia alargadera profesional de 15 metros.'
          );
          return;
        }

        await this.speakAndTranscribe(
          'Por favor, dime si prefieres "afilado in situ en tu domicilio" o "recogida y entrega en 24/48 horas".'
        );
        return;
      }

      case 'enchufe': {
        if (
          lower.includes('sí') ||
          lower.includes('si') ||
          lower.includes('tengo') ||
          lower.includes('claro') ||
          lower.includes('enchufe')
        ) {
          this.draft.tiene_enchufe_15m = true;
          this.draft.step = 'cuchillos';
          await this.speakAndTranscribe(
            'Estupendo, contamos con enchufe a menos de 15 metros. ¿Cuántos cuchillos de acero de filo liso tienes pensado afilar aproximadamente? Recuerda que el peor cuchillo es totalmente gratis.'
          );
          return;
        }

        if (lower.includes('no')) {
          this.draft.modalidad = 'recogida';
          this.draft.tiene_enchufe_15m = false;
          this.draft.step = 'cuchillos';
          await this.speakAndTranscribe(
            'Sin problema: como no hay enchufe a menos de 15 metros, pasamos a la modalidad de Recogida y Entrega en 24/48 horas. ¿Cuántos cuchillos de acero de filo liso quieres incluir aproximadamente?'
          );
          return;
        }

        await this.speakAndTranscribe(
          '¿Me confirmas si tienes un enchufe a menos de 15 metros, o prefieres que cambiemos a recogida y entrega en 24/48h?'
        );
        return;
      }

      case 'cuchillos': {
        const numMatch = cleanText.match(/\d+/);
        let count = numMatch ? Number.parseInt(numMatch[0], 10) : 0;
        if (!count) {
          const wordMap = {
            un: 1,
            uno: 1,
            dos: 2,
            tres: 3,
            cuatro: 4,
            cinco: 5,
            seis: 6,
            siete: 7,
            ocho: 8,
            diez: 10
          };
          for (const [word, val] of Object.entries(wordMap)) {
            if (lower.includes(word)) {
              count = val;
              break;
            }
          }
        }
        this.draft.num_cuchillos = Math.max(1, count || 4);

        // Ejecutar la herramienta real check_availability (Regla 6)
        const availResult = await checkAvailability({
          fecha: this.draft.fecha,
          modalidad: this.draft.modalidad,
          num_cuchillos: this.draft.num_cuchillos
        });

        this.draft.availableSlots = availResult.slots || [];
        this.callbacks.onToolEvent?.({
          tool: 'check_availability',
          summary: `check_availability(${this.draft.fecha}, ${this.draft.modalidad}, ${this.draft.num_cuchillos}) → ${availResult.duracion_minutos} min`
        });

        const slotTimes = this.draft.availableSlots.map((s) => s.time).join(', ');
        this.draft.step = 'fecha_hora';

        await this.speakAndTranscribe(
          `Perfecto, ${this.draft.num_cuchillos} cuchillos de filo liso (la visita durará unos ${availResult.duracion_minutos} minutos). He consultado la agenda de Kusin para el próximo día laborable (${this.draft.fecha}) y tengo libres las: ${slotTimes}. ¿Qué hora entre las 10:00 y las 13:00 te viene mejor?`
        );
        return;
      }

      case 'fecha_hora': {
        // Detectar hora como "10:00", "10:30", "11", "11 y media", "12"
        let chosenHour = '';
        const explicitTime = cleanText.match(/\b(10|11|12):(00|30)\b/);
        if (explicitTime) {
          chosenHour = explicitTime[0];
        } else if (lower.includes('diez y media') || lower.includes('10 y media')) {
          chosenHour = '10:30';
        } else if (lower.includes('once y media') || lower.includes('11 y media')) {
          chosenHour = '11:30';
        } else if (lower.includes('doce y media') || lower.includes('12 y media')) {
          chosenHour = '12:30';
        } else if (lower.includes('10') || lower.includes('diez')) {
          chosenHour = '10:00';
        } else if (lower.includes('11') || lower.includes('once')) {
          chosenHour = '11:00';
        } else if (lower.includes('12') || lower.includes('doce')) {
          chosenHour = '12:00';
        } else if (this.draft.availableSlots.length > 0) {
          chosenHour = this.draft.availableSlots[0].time;
        } else {
          chosenHour = '10:30';
        }

        this.draft.hora = chosenHour;
        this.draft.step = 'datos';
        await this.speakAndTranscribe(
          `¡Reservamos el hueco de las ${chosenHour} para el ${this.draft.fecha}! Por último, dime tu nombre, tu dirección completa en el 28224 y tu correo electrónico (recuerda que nunca pedimos número de teléfono).`
        );
        return;
      }

      case 'datos': {
        const emailMatch = cleanText.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
        const extractedEmail = emailMatch ? emailMatch[0] : 'vecino@madkusin.com';

        // Extraer nombre y dirección de forma flexible
        this.draft.email = extractedEmail;
        this.draft.nombre = cleanText.split(',')[0]?.replace(extractedEmail, '').trim() || 'Vecino del 28224';
        this.draft.direccion = cleanText;

        // Ejecutar la herramienta book_appointment (Regla 6)
        const bookingRes = await bookAppointment({
          nombre: this.draft.nombre,
          email: this.draft.email,
          direccion: this.draft.direccion,
          codigo_postal: '28224',
          modalidad: this.draft.modalidad || 'in_situ',
          num_cuchillos: this.draft.num_cuchillos || 1,
          tiene_enchufe_15m: this.draft.modalidad === 'in_situ' ? true : false,
          confirma_filo_liso: true,
          fecha: this.draft.fecha,
          hora: this.draft.hora || '10:30',
          notas: 'Reserva realizada desde el Asistente de Voz de Kusin',
          origen: 'voice_assistant_hybrid'
        });

        this.callbacks.onToolEvent?.({
          tool: 'book_appointment',
          summary: `book_appointment completado → Cita #${bookingRes.cita_id}`
        });

        if (bookingRes.ok && bookingRes.appointment) {
          this.draft.step = 'completed';
          this.callbacks.onAppointmentBooked?.(bookingRes.appointment);
          await this.speakAndTranscribe(
            `¡Listo! Tu cita con Kusin para el ${this.draft.fecha} a las ${this.draft.hora} ha quedado registrada y hemos enviado la confirmación a ${this.draft.email}. En la pantalla de tu navegador acaba de aparecer el resumen de tu cita junto con un botón azul por si deseas recibir un recordatorio en nuestro Bot de Telegram sin compartir tu teléfono.`
          );
          return;
        }

        await this.speakAndTranscribe(
          bookingRes.error ||
            'Necesito que me confirmes tu nombre, dirección en el 28224 y un correo electrónico válido.'
        );
        return;
      }

      default: {
        await this.speakAndTranscribe(
          'Tu cita ya está confirmada en pantalla. Si necesitas cualquier otra aclaración sobre el afilado en agua y cuero de Kusin, aquí estoy.'
        );
      }
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.isMuted && this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    } else if (!this.isMuted && this.recognition && this.isConnected) {
      try {
        this.recognition.start();
      } catch {}
    }
  }

  async disconnect() {
    this.isConnected = false;
    if (this.waveTimer) {
      clearInterval(this.waveTimer);
      this.waveTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
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
    this.activeProviderName = 'hybrid';
  }

  async startSession(preferredProvider = null) {
    await this.stopSession();

    const targetProvider =
      preferredProvider || import.meta.env.VITE_VOICE_PROVIDER || 'gemini';

    try {
      const response = await fetch(
        `/api/voice-config?provider=${encodeURIComponent(targetProvider)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' }
        }
      );

      if (response.ok) {
        const config = await response.json();

        if (config.provider === 'gemini' && config.mode === 'live' && config.wsEndpoint) {
          this.activeProviderName = 'gemini';
          const fallbackToHybrid = async () => {
            if (this.activeProviderName === 'hybrid') return;
            this.activeProviderName = 'hybrid';
            if (this.providerInstance) {
              await this.providerInstance.disconnect();
            }
            this.providerInstance = new HybridLocalVoiceProvider(this.callbacks);
            await this.providerInstance.connect();
          };
          this.providerInstance = new GeminiLiveVoiceProvider(config, {
            ...this.callbacks,
            onError: () => {
              fallbackToHybrid();
            }
          });
          await this.providerInstance.connect();
          return { provider: 'gemini', mode: 'live' };
        }

        if (config.provider === 'elevenlabs' && config.mode === 'live' && config.signedUrl) {
          this.activeProviderName = 'elevenlabs';
          this.providerInstance = new ElevenLabsVoiceProvider(config, this.callbacks);
          await this.providerInstance.connect();
          return { provider: 'elevenlabs', mode: 'live' };
        }
      }
    } catch {
      // En local con `npm run dev` (sin wrangler) o si aún no hay API key, activamos el proveedor híbrido
    }

    this.activeProviderName = 'hybrid';
    this.providerInstance = new HybridLocalVoiceProvider(this.callbacks);
    await this.providerInstance.connect();
    return { provider: 'hybrid', mode: 'hybrid_fallback' };
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
