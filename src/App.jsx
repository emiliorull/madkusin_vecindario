import React, { useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import HowItWorksSection from './components/HowItWorksSection';
import BookingSection from './components/BookingSection';
import VoiceAssistantModal from './components/VoiceAssistantModal';
import Footer from './components/Footer';

export default function App() {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedModalidad, setSelectedModalidad] = useState('in_situ');
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  const handleAppointmentBookedFromVoice = (appointment) => {
    setConfirmedAppointment(appointment);
    // Hacemos scroll suave hacia la tarjeta de confirmación y botón de Telegram
    setTimeout(() => {
      const el = document.getElementById('reservar');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <Header
        onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
        confirmedAppointment={confirmedAppointment}
      />

      <main className="flex-1">
        <HeroSection onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)} />

        <HowItWorksSection
          onSelectModalidad={(mod) => setSelectedModalidad(mod)}
        />

        <BookingSection
          selectedModalidad={selectedModalidad}
          onModalidadChange={setSelectedModalidad}
          confirmedAppointment={confirmedAppointment}
          onAppointmentConfirmed={(appt) => setConfirmedAppointment(appt)}
          onResetConfirmedAppointment={() => setConfirmedAppointment(null)}
          onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
        />
      </main>

      <Footer onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)} />

      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onAppointmentBooked={handleAppointmentBookedFromVoice}
      />
    </div>
  );
}
