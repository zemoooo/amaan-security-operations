import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneOff, 
  PhoneCall, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  ExternalLink, 
  Sparkles,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { WhatsAppCallState } from '../types';

interface WhatsAppIncomingCallModalProps {
  callState: WhatsAppCallState;
  onAccept: () => void;
  onDecline: () => void;
  onOpenEvidence?: (incidentId?: string) => void;
}

export const WhatsAppIncomingCallModal: React.FC<WhatsAppIncomingCallModalProps> = ({
  callState,
  onAccept,
  onDecline,
  onOpenEvidence,
}) => {
  const { t } = useLanguageTheme();
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);

  // Synthesize realistic phone ringtone using Web Audio API
  useEffect(() => {
    if (callState.status === 'RINGING' && !isMuted) {
      const playRingBurst = () => {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
          osc2.frequency.setValueAtTime(480, ctx.currentTime); // Standard ringback tone

          gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 1.2);
          osc2.stop(ctx.currentTime + 1.2);
        } catch {
          // Audio autoplay might be blocked until user gesture, graceful fallback
        }
      };

      playRingBurst();
      ringIntervalRef.current = setInterval(playRingBurst, 3000);

      return () => {
        if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch {}
        }
      };
    }
  }, [callState.status, isMuted]);

  // Handle call timer when CONNECTED
  useEffect(() => {
    let timer: any;
    if (callState.status === 'CONNECTED') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Play Speech Synthesis briefing
      if (!audioPlayed && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const textToSpeak = `تنبيه أمني عاجل من وكيل أمان للذكاء الاصطناعي. تم رصد ${callState.incidentTitle} في موقع ${callState.cameraName}. مستوى الخطورة عالي. يرجى التحقق فوراً.`;
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.lang = 'ar-SA';
          utterance.rate = 0.95;
          window.speechSynthesis.speak(utterance);
          setAudioPlayed(true);
        } catch {
          // Ignore speech synthesis errors
        }
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState.status, callState.incidentTitle, callState.cameraName, audioPlayed]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeclineCall = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="whatsapp-call-modal-dialog"
        className="relative w-full max-w-sm bg-[#0b141a] border border-[#1f2c34] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-[580px]"
      >
        {/* Top bar with WhatsApp security branding */}
        <div className="p-4 flex items-center justify-between text-slate-400 text-xs border-b border-emerald-900/30 bg-[#111b21]">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>{t('مكالمة واتساب أمنية مشفرة', 'End-to-End Encrypted')}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title={isMuted ? 'إلغاء كتم النغمة' : 'كتم النغمة'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>

        {/* Call Body */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Avatar with pulsing rings */}
          <div className="relative mb-6">
            {callState.status === 'RINGING' && (
              <>
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
                <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
              </>
            )}
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 p-1 shadow-2xl shadow-emerald-500/30">
              <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-white border-2 border-emerald-400/50">
                <ShieldAlert className="w-10 h-10 text-emerald-400 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">AI AGENT</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-white shadow">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Caller Details */}
          <h3 className="text-xl font-bold text-slate-100 tracking-tight mb-1">
            {t('وكيل أمان للمراقبة والذكاء الاصطناعي', 'Aman AI Security Agent')}
          </h3>
          <p className="text-xs text-emerald-400 font-medium mb-3 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('حساب واتساب رسمي موثق للأعمال (Verified)', 'Verified Official WhatsApp Bot')}</span>
          </p>

          {/* Phone recipient */}
          <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 mb-4 font-mono">
            {t('المتصل به (العميل):', 'Recipient:')} {callState.recipient}
          </div>

          {/* Status / Duration */}
          {callState.status === 'RINGING' ? (
            <div className="space-y-1.5 animate-pulse">
              <span className="text-sm font-semibold text-emerald-300 block">
                {t('مكالمة صوتية واتساب واردة...', 'Incoming WhatsApp Voice Call...')}
              </span>
              <p className="text-xs text-rose-400 font-bold px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-800/80">
                🚨 {callState.incidentTitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              <div className="text-lg font-mono font-bold text-emerald-400">
                {formatTimer(callDuration)}
              </div>

              {/* Animated Speech Waveform */}
              <div className="flex items-center justify-center gap-1 h-8">
                {[14, 24, 32, 18, 28, 36, 22, 16, 30, 25, 15].map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full animate-pulse"
                    style={{
                      height: `${height}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.8s',
                    }}
                  />
                ))}
              </div>

              {/* Spoken Alert Transcript Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 text-right text-xs text-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                  <span>{t('الرسالة الصوتية المباشرة من الإيجنت:', 'Live Voice Briefing:')}</span>
                  <span className="font-mono">{callState.cameraName}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  "{callState.incidentReason || t('رصد إزالة منتج بدون إذن وتواجد خارج أوقات العمل الرسمية.')}"
                </p>
              </div>

              {/* Direct Evidence Action */}
              {onOpenEvidence && (
                <button
                  type="button"
                  onClick={() => {
                    handleDeclineCall();
                    onOpenEvidence(callState.incidentId);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  <span>{t('فتح فيديو الأدلة الجنائية (70 ثانية)', 'Open 70s Forensic Video Evidence')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Call Actions Footer */}
        <div className="p-6 bg-[#111b21] border-t border-[#1f2c34] flex items-center justify-around">
          {callState.status === 'RINGING' ? (
            <>
              {/* Decline Call Button */}
              <button
                type="button"
                onClick={handleDeclineCall}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform group-hover:scale-105">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <span className="text-[11px] text-slate-300 font-medium">
                  {t('رفض', 'Decline')}
                </span>
              </button>

              {/* Accept Call Button */}
              <button
                type="button"
                onClick={onAccept}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 group-hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 transition transform group-hover:scale-110 animate-bounce">
                  <PhoneCall className="w-7 h-7" />
                </div>
                <span className="text-[11px] text-emerald-400 font-bold">
                  {t('رد واستماع', 'Answer')}
                </span>
              </button>
            </>
          ) : (
            /* End Active Call Button */
            <button
              type="button"
              onClick={handleDeclineCall}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition transform group-hover:scale-105">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-300 font-medium">
                {t('إنهاء المكالمة', 'End Call')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
