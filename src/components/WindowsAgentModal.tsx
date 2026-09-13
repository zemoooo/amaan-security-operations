import React, { useState } from 'react';
import { X, Laptop, ShieldCheck, Key, Download, CheckCircle2, Copy, RefreshCw, Terminal, Cpu } from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';

interface WindowsAgentModalProps {
  onClose: () => void;
}

export const WindowsAgentModal: React.FC<WindowsAgentModalProps> = ({ onClose }) => {
  const { t } = useLanguageTheme();
  const [tokenCopied, setTokenCopied] = useState(false);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const deviceToken = "cctv_agt_live_9f81a74e892c4b019da5631c_tok2026";

  const handleCopyToken = () => {
    navigator.clipboard.writeText(deviceToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2500);
  };

  const handleRunSync = () => {
    setIsSimulatingSync(true);
    setSyncStatus(null);
    setTimeout(() => {
      setIsSimulatingSync(false);
      setSyncStatus('تم التحقق من بصمة الجهاز المشفرة ومزامنة 5 كاميرات RTSP محلية بنجاح!');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        id="windows-agent-modal-dialog"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('وكيل أجهزة ويندوز الميداني (Windows Edge CCTV Agent)', 'Windows Edge CCTV Agent Setup & Fleet Node')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('معالجة كاميرات RTSP المحلية داخل الشبكة الداخلية للمنشأة دون استهلاك سعة السحابة', 'On-premise local RTSP capture & edge AI inference with cloud sync')}
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
        <div className="p-6 flex flex-col gap-5 text-xs text-slate-300">
          {/* Architecture Diagram Pill */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              {t('مخطط الاتصال الآمن (Encrypted Gateway Topology)', 'Encrypted Zero-Trust Topology')}
            </span>
            <div className="flex items-center justify-between text-center gap-2 py-2">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 flex-1">
                <span className="block font-bold text-slate-100">كاميرات RTSP / IP</span>
                <span className="text-[10px] text-slate-400">الشبكة المحلية LAN</span>
              </div>
              <span className="text-slate-500">➜</span>
              <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-700 flex-1">
                <span className="block font-bold text-cyan-300">Windows Edge Agent</span>
                <span className="text-[10px] text-cyan-400">YOLOv8 & Buffer</span>
              </div>
              <span className="text-slate-500">➜</span>
              <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-700 flex-1">
                <span className="block font-bold text-blue-300">Cloud SaaS Backend</span>
                <span className="text-[10px] text-blue-400">Metadata & Evidence</span>
              </div>
            </div>
          </div>

          {/* Secure Token Box */}
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('رمز الربط الموثق للجهاز (Secure Device Registration Token):', 'Device Pairing Token:')}</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-amber-300 select-all truncate">
                {deviceToken}
              </div>
              <button
                type="button"
                onClick={handleCopyToken}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-600 transition flex items-center gap-1.5 cursor-pointer"
              >
                {tokenCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{tokenCopied ? t('تم النسخ', 'Copied') : t('نسخ', 'Copy')}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('يستخدم الرمز لمصادقة خادم ويندوز وتشفير تدفق الأحداث دون تخزين كلمات مرور الكاميرات على السحابة.', 'Used to authenticate the local agent without exposing camera credentials to cloud.')}
            </p>
          </div>

          {/* Windows CLI Command box */}
          <div className="p-4 rounded-2xl bg-black border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2">
            <div className="flex items-center justify-between text-slate-500 border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Windows PowerShell (Run as Administrator)
              </span>
              <span>install_service.bat</span>
            </div>
            <p className="text-cyan-300">
              powershell -ExecutionPolicy Bypass -File .\windows-agent\install.ps1 -Token "{deviceToken}"
            </p>
          </div>

          {/* Test Pairing Button */}
          <button
            type="button"
            disabled={isSimulatingSync}
            onClick={handleRunSync}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSimulatingSync ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cpu className="w-4 h-4" />
            )}
            <span>
              {isSimulatingSync
                ? t('جاري اختبار نبضات الجهاز والمزامنة...', 'Testing Device Heartbeat & Sync...')
                : t('محاكاة فحص اتصال جهاز ويندوز الآن', 'Simulate Windows Edge Heartbeat Handshake')}
            </span>
          </button>

          {syncStatus && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs text-center font-medium">
              {syncStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
