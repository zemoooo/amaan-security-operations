import React, { useState } from 'react';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { X, UserCheck, UserX, Scan, Sparkles, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface FacePunchModalProps {
  onClose: () => void;
}

export const FacePunchModal: React.FC<FacePunchModalProps> = ({ onClose }) => {
  const { t } = useLanguageTheme();
  const { employees, punchFaceAttendance } = useLiveCCTV();

  const [selectedTarget, setSelectedTarget] = useState<string>(employees[0]?.id || 'unknown');
  const [isEntry, setIsEntry] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSimulatePunch = () => {
    setIsProcessing(true);
    setResult(null);

    // Realistic face inference delay simulation (600ms)
    setTimeout(() => {
      const res = punchFaceAttendance(selectedTarget, isEntry);
      setResult(res);
      setIsProcessing(false);
    }, 600);
  };

  const selectedEmployee = employees.find(e => e.id === selectedTarget);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        id="face-punch-modal-dialog"
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-950 border border-blue-700 text-blue-400">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('محاكي التعرف على الوجوه وبوابة الدخول الذكية', 'AI Face Recognition & Gate Punch Simulator')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('اختبار خوارزمية مطابقة التضمين الحيوي لبصمة الوجه وتسجيل الحضور والانصراف', 'Test face embeddings matching & automated attendance punching')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          {/* Target Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              {t('اختر الشخص العابر أمام كاميرا البوابة (Gate 01):', 'Select Person Crossing Gate 01:')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedTarget(emp.id);
                    setResult(null);
                  }}
                  className={`p-2.5 rounded-2xl border text-right transition flex items-center gap-2.5 cursor-pointer ${
                    selectedTarget === emp.id
                      ? 'bg-cyan-950/80 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={emp.photoUrl}
                    alt={emp.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-100 truncate">{emp.name}</p>
                    <span className="text-[10px] text-slate-400 block truncate">{emp.employeeCode}</span>
                  </div>
                </button>
              ))}

              {/* Unknown Person Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTarget('unknown');
                  setResult(null);
                }}
                className={`p-2.5 rounded-2xl border text-right transition flex items-center gap-2.5 cursor-pointer ${
                  selectedTarget === 'unknown'
                    ? 'bg-rose-950/80 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-rose-900/60 border border-rose-700 flex items-center justify-center flex-shrink-0 text-rose-400">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-300">{t('شخص مجهول', 'Unknown Person')}</p>
                  <span className="text-[10px] text-rose-400/80 block">{t('غير مسجل', 'Unregistered')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Action Direction (Entry vs Exit) */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400">{t('نوع الحركة:', 'Punch Direction:')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEntry(true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isEntry
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('تسجيل دخول (Check-in)', 'Check-in (Entry)')}
              </button>
              <button
                type="button"
                onClick={() => setIsEntry(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  !isEntry
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('تسجيل خروج (Check-out)', 'Check-out (Exit)')}
              </button>
            </div>
          </div>

          {/* Live Scanner Visual Simulation Box */}
          <div className="relative p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4 overflow-hidden">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border border-cyan-500/50 flex-shrink-0 flex items-center justify-center">
              {selectedTarget !== 'unknown' && selectedEmployee ? (
                <img src={selectedEmployee.photoUrl} alt="Target" className="w-full h-full object-cover" />
              ) : (
                <UserX className="w-8 h-8 text-rose-500" />
              )}
              {isProcessing && (
                <div className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_12px_#38bdf8] animate-bounce" />
              )}
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('معالجة ArcFace 512-dim Embedding Vector', 'ArcFace 512-dim Vector Extraction')}</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                {t(
                  'عتبة القبول: Cosine Similarity ≥ 0.75 | الكاميرا: Gate 01 | معدل التحليل: 25ms',
                  'Match Threshold: Cosine Similarity ≥ 0.75 | Camera: Gate 01'
                )}
              </p>
              {selectedTarget !== 'unknown' && selectedEmployee && (
                <p className="font-mono text-cyan-400 text-[11px]">
                  Allowed Zones: {selectedEmployee.allowedZones.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Result Alert Box */}
          {result && (
            <div
              className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                result.success
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-200'
                  : 'bg-rose-950/70 border-rose-700/80 text-rose-200'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold mb-1">
                  {result.success ? t('تم التحقق بنجاح!', 'Verified Successfully!') : t('تنبيه أمني - هوية غير معروفة!', 'Security Alert - Unknown Identity!')}
                </p>
                <p>{result.message}</p>
              </div>
            </div>
          )}

          {/* Punch Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSimulatePunch}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <span>{t('جاري استخراج وتحليل بصمة الوجه...', 'Extracting face vector & matching...')}</span>
            ) : (
              <>
                <Scan className="w-4 h-4" />
                <span>{t('محاكاة عبور البوابة الآن', 'Simulate Gate Passage Now')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
