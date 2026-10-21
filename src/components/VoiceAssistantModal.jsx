import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Send,
  Sparkles,
  Subtitles,
  CheckCircle2,
  Terminal,
  X
} from 'lucide-react';
import { VoiceAgentService } from '../services/voice/VoiceAgentService';

const STATUS_LABELS = {
  idle: { label: 'Desconectado', color: 'bg-stone-500', badge: 'bg-stone-800 text-stone-300' },
  connecting: {
    label: 'Conectando con el taller...',
    color: 'bg-amber-400 animate-pulse',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  listening: {
    label: 'Escuchando',
    color: 'bg-emerald-400 animate-ping',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  thinking: {
    label: 'Pensando',
    color: 'bg-sky-400 animate-pulse',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  },
  speaking: {
    label: 'Hablando',
    color: 'bg-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  }
};

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  onAppointmentBooked
}) {
  const [status, setStatus] = useState('connecting');
  const [providerInfo, setProviderInfo] = useState({ provider: 'gemini', mode: 'connecting' });
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcripts, setTranscripts] = useState([]);
  const [toolEvents, setToolEvents] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0.15);
  const [textInput, setTextInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [bookedInSession, setBookedInSession] = useState(null);

  const serviceRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setTranscripts([]);
    setToolEvents([]);
    setErrorMessage('');
    setBookedInSession(null);
    setIsMuted(false);

    const voiceService = new VoiceAgentService({
      onStateChange: (newState) => setStatus(newState),
      onTranscript: (entry) => {
        setTranscripts((prev) => [...prev, entry]);
      },
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onToolEvent: (evt) => {
        setToolEvents((prev) => [...prev, evt]);
      },
      onAppointmentBooked: (appointment) => {
        setBookedInSession(appointment);
        onAppointmentBooked?.(appointment);
      },
      onError: (msg) => setErrorMessage(msg)
    });

    serviceRef.current = voiceService;

    voiceService.startSession().then((info) => {
      if (info) setProviderInfo(info);
    });

    return () => {
      voiceService.stopSession();
      serviceRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, toolEvents]);

  if (!isOpen) return null;

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    serviceRef.current?.setMuted(nextMuted);
  };

  const handleHangUp = async () => {
    await serviceRef.current?.stopSession();
    onClose?.();
  };

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');
    await serviceRef.current?.sendText(msg);
  };

  const handleQuickReply = async (quickText) => {
    await serviceRef.current?.sendText(quickText);
  };

  const currentStatus = STATUS_LABELS[status] || STATUS_LABELS.listening;

  // Generador de alturas de barras para el visualizador de ondas en tiempo real
  const waveBars = Array.from({ length: 24 }, (_, idx) => {
    const centerFactor = 1 - Math.abs(idx - 11.5) / 13;
    const activeMultiplier =
      status === 'speaking' || status === 'listening' ? Math.max(0.2, audioLevel) : 0.12;
    const waveOffset = Math.sin(idx * 0.8 + audioLevel * 12) * 0.25 + 0.75;
    const heightPercent = Math.min(100, Math.max(14, centerFactor * activeMultiplier * waveOffset * 115));
    return heightPercent;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-stone-900 text-stone-100 border border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-stone-950/70 border-b border-stone-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kusin-terra text-white flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="voice-modal-title" className="font-serif font-bold text-lg text-white">
                Kusin · Asistente IA del Taller de Emil (28224)
              </h2>
              <p className="text-xs text-stone-400">
                {providerInfo.provider === 'gemini'
                  ? 'Conectado a Gemini Multimodal Live API'
                  : providerInfo.provider === 'elevenlabs'
                  ? 'Conectado a ElevenLabs Conversational AI'
                  : 'Modo Voz Híbrido Activo (Web Speech es-ES + Function Calling)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicador de Estado: Escuchando, Pensando, Hablando */}
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${currentStatus.badge}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
              {currentStatus.label}
            </span>

            <button
              type="button"
              onClick={handleHangUp}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              aria-label="Cerrar asistente de voz"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visualizador de Ondas de Audio en Tiempo Real */}
        <div className="px-6 py-6 bg-gradient-to-b from-stone-900 to-stone-950 border-b border-stone-800 flex flex-col items-center justify-center space-y-3">
          <div
            className="h-20 w-full max-w-md flex items-center justify-center gap-1.5"
            aria-label={`Estado del asistente: ${currentStatus.label}`}
          >
            {waveBars.map((height, idx) => (
              <span
                key={idx}
                style={{ height: `${isMuted ? 12 : height}%` }}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isMuted
                    ? 'bg-stone-700'
                    : status === 'speaking'
                    ? 'bg-amber-400'
                    : status === 'thinking'
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-stone-400 text-center">
            {isMuted
              ? 'Micrófono silenciado. Pulsa "Activar micro" o escribe abajo.'
              : status === 'speaking'
              ? 'Kusin (asistente del taller de Emil) está hablando...'
              : status === 'thinking'
              ? 'Consultando disponibilidad y reglas del taller de Emil...'
              : 'Habla con naturalidad con Kusin o usa las respuestas rápidas de abajo'}
          </p>
        </div>

        {/* Área de Transcripción en Pantalla para Accesibilidad */}
        {showTranscript && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-stone-900/90 min-h-[210px] max-h-[320px]">
            {transcripts.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col ${
                  item.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-kusin-terra text-white rounded-br-none'
                      : 'bg-stone-800 text-stone-100 border border-stone-700 rounded-bl-none'
                  }`}
                >
                  <p>{item.text}</p>
                </div>
                <span className="text-[11px] text-stone-500 mt-1 px-1">
                  {item.role === 'user' ? 'Tú' : 'Kusin (Asistente de Emil)'} · {item.timestamp}
                </span>
              </div>
            ))}

            {/* Eventos de Tool Calling ejecutados */}
            {toolEvents.map((evt, idx) => (
              <div
                key={`tool-${idx}`}
                className="flex items-center gap-2 text-xs bg-stone-950 border border-stone-800 text-amber-300 px-3 py-2 rounded-xl"
              >
                <Terminal className="w-3.5 h-3.5 shrink-0" />
                <span>Herramienta ejecutada: {evt.summary}</span>
              </div>
            ))}

            {bookedInSession && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-100 text-xs sm:text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white">
                    ¡Cita #{bookedInSession.cita_id} sincronizada en tu pantalla!
                  </strong>
                  <span>
                    Al cerrar esta ventana verás tu resumen y el botón de Telegram para recibir
                    recordatorios sin dar tu móvil.
                  </span>
                </div>
              </div>
            )}

            {errorMessage && (
              <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded-xl p-3">
                {errorMessage}
              </p>
            )}

            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Sugerencias rápidas de prueba / accesibilidad */}
        <div className="px-6 py-2.5 bg-stone-950/60 border-t border-stone-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-stone-400 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Respuestas rápidas:
          </span>
          <button
            type="button"
            onClick={() => handleQuickReply('Sí, vivo en el código postal 28224')}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 shrink-0 border border-stone-700"
          >
            "Sí, vivo en el 28224"
          </button>
          <button
            type="button"
            onClick={() => handleQuickReply('Prefiero afilado in situ y tengo enchufe a menos de 15m')}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 shrink-0 border border-stone-700"
          >
            "In situ con enchufe &lt;15m"
          </button>
          <button
            type="button"
            onClick={() => handleQuickReply('Son 4 cuchillos de filo liso')}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 shrink-0 border border-stone-700"
          >
            "4 cuchillos de filo liso"
          </button>
          <button
            type="button"
            onClick={() => handleQuickReply('¿Qué precio tiene afilar el resto de cuchillos?')}
            className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 shrink-0 border border-stone-700"
          >
            "¿Qué tarifas tenéis?"
          </button>
        </div>

        {/* Entrada por teclado accesible + Controles de Voz (Silenciar / Colgar) */}
        <div className="p-4 sm:p-5 bg-stone-950 border-t border-stone-800 space-y-4">
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Habla por el micrófono o escribe aquí tu respuesta..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-amber-500 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </form>

          <div className="flex items-center justify-between gap-3">
            {/* Botón Mostrar/Ocultar Transcripción */}
            <button
              type="button"
              onClick={() => setShowTranscript((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                showTranscript
                  ? 'bg-stone-800 text-stone-200 border-stone-700'
                  : 'bg-stone-900 text-stone-400 border-stone-800'
              }`}
            >
              <Subtitles className="w-4 h-4" />
              <span>{showTranscript ? 'Ocultar transcripción' : 'Mostrar transcripción'}</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Botón de Silenciar */}
              <button
                type="button"
                onClick={handleToggleMute}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                  isMuted
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Activar micro' : 'Silenciar'}</span>
              </button>

              {/* Botón de Colgar */}
              <button
                type="button"
                onClick={handleHangUp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Colgar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
