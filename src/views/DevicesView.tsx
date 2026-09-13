import React, { useState } from 'react';
import { 
  Laptop, 
  Key, 
  Cpu, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Plus, 
  CheckCircle2, 
  Terminal, 
  RefreshCw,
  ShieldCheck,
  Server
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';

interface DevicesViewProps {
  onOpenWindowsAgentModal: () => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({ onOpenWindowsAgentModal }) => {
  const { t } = useLanguageTheme();
  const { devices } = useLiveCCTV();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Laptop className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('أسطول أجهزة Windows Edge Agent الميدانية', 'Windows Edge Agent Fleet')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'معالجة كاميرات RTSP وفك التشفير محلياً على أجهزة المنشأة مع ميزة التخزين المؤقت في حال انقطاع الإنترنت.',
              'On-premise edge RTSP inference, hardware acceleration, and offline local event buffering.'
            )}
          </p>
        </div>

        <button
          onClick={onOpenWindowsAgentModal}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('ربط جهاز Windows Agent جديد', 'Pair New Windows Node')}</span>
        </button>
      </div>

      {/* Edge Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map(dev => (
          <div
            key={dev.id}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between gap-5"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{dev.name}</h3>
                    <span className="text-xs font-mono text-slate-400">{dev.os} • v{dev.agentVersion}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    dev.status === 'ONLINE'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dev.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  {dev.status}
                </span>
              </div>

              {/* Hardware & Network telemetry grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">{t('عنوان IP المحلي', 'Local IP')}</span>
                  <span className="font-mono text-cyan-400 font-bold">{dev.ipAddress}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">{t('الكاميرات المرتبطة', 'Cameras')}</span>
                  <span className="font-mono text-slate-200 font-bold">{dev.connectedCamerasCount} RTSP</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">{t('استهلاك المعالج', 'CPU Load')}</span>
                  <span className="font-mono text-emerald-400 font-bold">{dev.cpuUsage}%</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">{t('الذاكرة RAM', 'RAM Load')}</span>
                  <span className="font-mono text-emerald-400 font-bold">{dev.ramUsage}%</span>
                </div>
              </div>

              {/* Features & Offline Queue Status */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{t('طابور التخزين المحلي (Offline Buffer):', 'Local Offline Buffer:')}</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {dev.offlineQueueEvents} {t('أحداث معلقة', 'events queued')} (0 MB)
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{t('حالة الترخيص والمصادقة:', 'License & Auth Token:')}</span>
                  <span className="font-mono text-cyan-300 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {dev.licenseStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>{t('آخر إشارة نبض (Heartbeat):', 'Last Heartbeat:')} {dev.lastSeen}</span>
              <button
                onClick={onOpenWindowsAgentModal}
                className="text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                {t('إدارة الرمز والمفاتيح ➜', 'Manage Pairing Token ➜')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
