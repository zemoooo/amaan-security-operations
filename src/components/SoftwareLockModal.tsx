import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  Copy, 
  Check, 
  MessageSquare, 
  Mail, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Laptop,
  UserCheck,
  Zap,
  LogIn,
  RefreshCw
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';
import { useLanguageTheme } from '../context/LanguageThemeContext';

interface SoftwareLockModalProps {
  onOpenAuthModal?: () => void;
}

export const SoftwareLockModal: React.FC<SoftwareLockModalProps> = ({ onOpenAuthModal }) => {
  const { 
    machineId, 
    isLocked, 
    status, 
    activateWithKey, 
    masterAdminUnlock,
    startFreeTrial,
    copyMachineId, 
    getWhatsAppRequestUrl,
    supportPhone,
    supportEmail
  } = useLicense();
  const { currentUser, switchUser, availableUsers } = useAuth();
  const { t } = useLanguageTheme();

  const [inputKey, setInputKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [activating, setActivating] = useState(false);
  const [bypassingAdmin, setBypassingAdmin] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [generatingQuickKey, setGeneratingQuickKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('شهر واحد');

  // If not locked, do not render lock modal
  if (!isLocked) {
    return null;
  }

  const handleCopy = async () => {
    const ok = await copyMachineId();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 1. One-click Super Admin Master Unlock for 
  const handleMasterAdminUnlock = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBypassingAdmin(true);

    try {
      const res = await masterAdminUnlock();
      if (res.success) {
        // Switch user session in AuthContext
        const adminUser = availableUsers.find(u => u.role === 'SUPER_ADMIN' || u.email === '');
        if (adminUser) {
          switchUser(adminUser.id);
        }
        setSuccessMsg(res.message || 'تم تأكيد صلاحيات مدير النظام وفك القفل بنجاح!');
      } else {
        setErrorMsg(res.error || 'فشل فك قفل النظام الإداري');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ في فك القفل');
    } finally {
      setBypassingAdmin(false);
    }
  };

  // 2. One-click 2-Day Free Trial Instant Activation
  const handleStartTrial = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setStartingTrial(true);

    try {
      const res = await startFreeTrial();
      if (res.success) {
        setSuccessMsg(res.message || 'تم بدء الفترة التجريبية المجانية (يومان) وفك القفل!');
      } else {
        setErrorMsg(res.error || 'فشل بدء الفترة التجريبية');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تفعيل التجربة');
    } finally {
      setStartingTrial(false);
    }
  };

  // 3. One-click Quick Key Generator & Auto-Fill for Testing
  const handleGenerateAndFillQuickKey = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGeneratingQuickKey(true);

    try {
      const res = await fetch('/api/admin/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId,
          period: '1_MONTH',
          customerName: 'مستخدم تجريبي سريع',
        }),
      });
      const data = await res.json();
      if (data.success && data.activationKey) {
        setInputKey(data.activationKey);
        setSuccessMsg(`تم توليد مفتاح معتمد لهذا الجهاز: [${data.activationKey}] وتم تعبئته تلقائياً! اضغط على زر التفعيل أدناه.`);
      } else {
        setErrorMsg(data.error || 'تعذر توليد المفتاح السريع');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setGeneratingQuickKey(false);
    }
  };

  // 4. Activate with Key manually entered
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg('يرجى إدخال مفتاح التفعيل أولاً أو استخدام الدخول السريع أعلاه');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setActivating(true);

    const result = await activateWithKey(inputKey);
    setActivating(false);

    if (result.success) {
      setSuccessMsg(result.message || 'تم فك قفل البرنامج وتفعيله بنجاح!');
      setInputKey('');
    } else {
      setErrorMsg(result.error || 'مفتاح التفعيل غير صالح لهذا الجهاز.');
    }
  };

  // Super admin profile
  const superAdminUser = availableUsers.find(u => u.role === 'SUPER_ADMIN' || u.email === '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-rose-600/40 rounded-3xl shadow-2xl overflow-hidden my-auto animate-fade-in">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 p-5 md:p-6 border-b border-rose-900/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-rose-600/20 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shadow-inner">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {status === 'UNACTIVATED' ? 'نسخة بانتظار الترخيص' : 'البرنامج مقفل / انتهاء الترخيص'}
                </span>
                <span className="text-xs text-slate-400 font-mono">منظومة أمان الذكية للمراقبة</span>
              </div>
              <h2 className="text-lg md:text-xl font-extrabold text-white mt-1">
                نافذة ترخيص ودخول النظام
              </h2>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 md:p-8 space-y-6">

          {/* Prompt / Notification Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5 shadow-lg">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Instant Entry Option For Admin & Evaluators */}
          <div className="bg-gradient-to-r from-cyan-950/70 via-slate-950 to-blue-950/70 p-4 md:p-5 rounded-2xl border-2 border-cyan-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                <h3 className="text-sm font-extrabold text-cyan-200">
                  خيارات الدخول الفوري السريع للنظام:
                </h3>
              </div>
              <span className="text-[11px] text-cyan-400 font-semibold">ضغطة واحدة وفك القفل</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              إذا كنت مدير النظام (<span className="text-amber-300 font-mono font-bold"></span>) أو ترغب في تجربة البرنامج فوراً، اضغط على أحد الخيارات أدناه للدخول للوحة التحكم:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Button 1: Master Admin Instant Entry */}
              <button
                type="button"
                onClick={handleMasterAdminUnlock}
                disabled={bypassingAdmin}
                className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer disabled:opacity-50"
              >
                {bypassingAdmin ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-100" />
                )}
                <span>دخول فوري كمدير النظام (Smart Tech)</span>
              </button>

              {/* Button 2: Free 2-Day Trial Instant Entry */}
              <button
                type="button"
                onClick={handleStartTrial}
                disabled={startingTrial}
                className="p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-extrabold text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 transition cursor-pointer disabled:opacity-50"
              >
                {startingTrial ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-slate-950" />
                )}
                <span>بدء التجربة المجانية (يومان) والدخول الآن</span>
              </button>
            </div>

            {onOpenAuthModal && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">لديك حساب مسجل بالبريد؟</span>
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول بالبريد الإلكتروني</span>
                </button>
              </div>
            )}
          </div>

          {/* Machine Hardware ID Box */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-cyan-400" />
                كود هذا الجهاز (Machine Hardware ID)
              </span>
              <span className="text-[11px] text-slate-400">مربوط بحصانة عتاد جهازك</span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <code className="text-base md:text-lg font-mono font-extrabold text-cyan-300 tracking-wider select-all">
                {machineId}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </button>
            </div>
          </div>

          {/* Direct Communication Buttons with System Admin */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400">
                طلب مفتاح تفعيل جديد من الإدارة:
              </label>
              <span className="text-[10px] text-amber-400">يومان، شهر، 3 أشهر، 6 أشهر، أو سنة</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={getWhatsAppRequestUrl(selectedPeriodLabel)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <MessageSquare className="w-4 h-4" />
                طلب المفتاح عبر واتساب ({supportPhone})
              </a>

              <a
                href={`mailto:${supportEmail}?subject=طلب مفتاح تفعيل لجهاز ${machineId}&body=كود جهازي: ${machineId}`}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                مراسلة بريدية ({supportEmail})
              </a>
            </div>
          </div>

          {/* Activation Key Input Form */}
          <form onSubmit={handleActivate} className="bg-slate-950/90 p-4 md:p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>إدخال مفتاح التفعيل لفك القفل:</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateAndFillQuickKey}
                disabled={generatingQuickKey}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="توليد مفتاح تجريبي متوافق مع كود هذا الجهاز وتعبئته تلقائياً"
              >
                <RefreshCw className={`w-3 h-3 ${generatingQuickKey ? 'animate-spin' : ''}`} />
                <span>تعبئة مفتاح تجريبي تلقائي</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                placeholder="AMAN-1M-F41C-XXXX-XXXX"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs md:text-sm tracking-wider uppercase focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={activating}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs md:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {activating ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {activating ? 'جاري التحقق...' : 'تفعيل وإلغاء القفل'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
