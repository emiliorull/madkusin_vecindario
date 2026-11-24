import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  MessageSquareText,
  Send,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Terminal,
  X
} from 'lucide-react';
import { VoiceAgentService } from '../services/voice/VoiceAgentService';
import { formatDateDDMMYYYY } from '../utils/scheduling';

const STATUS_LABELS = {
  idle: { label: 'Desconectado', color: 'bg-stone-500', badge: 'bg-stone-800 text-stone-300' },
  connecting: {
    label: 'Conectando con Kusin...',
    color: 'bg-amber-400 animate-pulse',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  listening: {
    label: 'Listo',
    color: 'bg-emerald-400 animate-ping',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  thinking: {
    label: 'Consultando base científica...',
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
  // Modo de interacción elegible por el usuario: 'text' (Chat por Texto) o 'voice' (Hablar por Voz)
  const [interactionMode, setInteractionMode] = useState('text');
  const [status, setStatus] = useState('connecting');
  const [isMuted, setIsMuted] = useState(true);
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
    setInteractionMode('text');
    setIsMuted(true);

    const voiceService = new VoiceAgentService({
      onStateChange: (newState) => setStatus(newState),
      onMuteChange: (mutedState) => setIsMuted(mutedState),
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
    voiceService.startSession('text');

    return () => {
      voiceService.stopSession();
      serviceRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, toolEvents]);

  if (!isOpen) return null;

  const handleSelectMode = (newMode) => {
    setInteractionMode(newMode);
    const shouldMute = newMode === 'text';
    setIsMuted(shouldMute);
    serviceRef.current?.setInteractionMode(newMode);
  };

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

  // Generador de alturas de barras para el visualizador de ondas en modo Voz
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
              {interactionMode === 'voice' ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <MessageSquareText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 id="voice-modal-title" className="font-serif font-bold text-lg text-white">
                Kusin · Agente Técnico IA del Taller de Emil
              </h2>
              <p className="text-xs text-stone-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Base Científica de Metalurgia y Afilado (Banda + Strop) · Privacidad Zero-Trust</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${currentStatus.badge}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
              {interactionMode === 'voice' && status === 'listening' && !isMuted
                ? 'Escuchando voz'
                : currentStatus.label}
            </span>

            <button
              type="button"
              onClick={handleHangUp}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              aria-label="Cerrar asistente"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selector cómodo de Modo: Chat por Texto vs. Hablar por Voz */}
        <div className="px-6 py-3 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-stone-400 font-medium">
            Elige cómo prefieres comunicarte con Kusin:
          </span>
          <div className="inline-flex rounded-xl bg-stone-900 p-1 border border-stone-700">
            <button
              type="button"
              onClick={() => handleSelectMode('text')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                interactionMode === 'text'
                  ? 'bg-amber-500 text-stone-950 shadow'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Chat por Texto</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('voice')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                interactionMode === 'voice'
                  ? 'bg-amber-500 text-stone-950 shadow'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Hablar por Voz</span>
            </button>
          </div>
        </div>

        {/* Visualizador de Ondas de Audio (visible únicamente cuando el usuario elige Modo Voz) */}
        {interactionMode === 'voice' && (
          <div className="px-6 py-4 bg-gradient-to-b from-stone-900 to-stone-950 border-b border-stone-800 flex flex-col items-center justify-center space-y-2">
            <div
              className="h-14 w-full max-w-md flex items-center justify-center gap-1.5"
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
                ? 'Micrófono en pausa. Pulsa "Activar micro" o escribe abajo.'
                : status === 'speaking'
                ? 'Kusin está explicando por voz...'
                : status === 'thinking'
                ? 'Analizando documentación técnica y agenda de Emil...'
                : 'Habla por tu micrófono para preguntar sobre cuchillos, afilado o reservar cita'}
            </p>
          </div>
        )}

        {/* Área de Conversación y Respuestas Científicas */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-stone-900/90 min-h-[250px] max-h-[380px]">
          {transcripts.map((item, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                item.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  item.role === 'user'
                    ? 'bg-kusin-terra text-white rounded-br-none'
                    : 'bg-stone-800 text-stone-100 border border-stone-700 rounded-bl-none'
                }`}
              >
                <p>{item.text}</p>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 px-1">
                {item.role === 'user' ? 'Tú' : 'Kusin · Agente Técnico de Emil'} · {item.timestamp}
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
              <span>Agenda verificada: {evt.summary}</span>
            </div>
          ))}

          {bookedInSession && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-100 text-xs sm:text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">
                  ¡Cita confirmada para el {formatDateDDMMYYYY(bookedInSession.fecha)} a las{' '}
                  {bookedInSession.hora_inicio || bookedInSession.hora} h sincronizada en tu
                  pantalla!
                </strong>
                <span>
                  Al cerrar esta ventana verás tu resumen y el botón de Telegram para recibir el
                  aviso, consultar todos los datos de tu cita o modificar lo que necesites sin dar
                  tu móvil.
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

        {/* Entrada por teclado + Controles */}
        <div className="p-4 sm:p-5 bg-stone-950 border-t border-stone-800 space-y-3">
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escribe cualquier pregunta técnica sobre cuchillos, afilado o tu reserva..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-sm text-white placeholder-stone-500 focus:border-amber-500 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Preguntar</span>
            </button>
          </form>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-stone-500">
              {interactionMode === 'text'
                ? 'Modo Chat por Texto activo (respuestas breves con base científica).'
                : 'Modo Voz activo (síntesis y reconocimiento de voz en español).'}
            </span>

            <div className="flex items-center gap-3">
              {interactionMode === 'voice' && (
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isMuted
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? 'Activar micro' : 'Silenciar micro'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleHangUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-rose-600 text-stone-200 hover:text-white border border-stone-700 transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
