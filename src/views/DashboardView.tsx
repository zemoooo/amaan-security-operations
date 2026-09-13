import React from 'react';
import { 
  Video, 
  ShieldAlert, 
  UserCheck, 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  Activity, 
  Clock, 
  CheckCircle2, 
  Scan, 
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { useAuth } from '../context/AuthContext';
import { LiveCameraPlayer } from '../components/LiveCameraPlayer';
import { AppView } from '../components/Sidebar';

interface DashboardViewProps {
  onNavigate: (view: AppView) => void;
  onOpenZoneDrawer: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenZoneDrawer }) => {
  const { t } = useLanguageTheme();
  const { currentTenant } = useAuth();
  const { 
    cameras, 
    selectedCamera, 
    setSelectedCamera, 
    securityIncidents, 
    behaviorEvents, 
    attendanceRecords, 
    inventoryProducts, 
    agentHealth,
    setActiveEvidenceIncident
  } = useLiveCCTV();

  const onlineCameras = cameras.filter(c => c.status === 'ONLINE').length;
  const criticalIncidents = securityIncidents.filter(i => i.severity === 'CRITICAL' && i.status === 'NEW').length;
  const presentEmployees = attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
  const inventoryDiscrepancies = inventoryProducts.filter(p => p.difference !== 0).length;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Top Banner: Tenant Welcome & Quick Overview */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-100">
              {t('مركز القيادة والعمليات الأمنية الذكية', 'Security & Operations Command Center')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {t(
              'نظام AI Agent متصل ويراقب 5 كاميرات فيديو حية، يحلل السلوكيات، ويكتشف اشتباه السرقات وحضور الموظفين لحظياً.',
              'AI Agent active, continuously monitoring 5 live streams with behavioral analysis and theft detection.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('cameras')}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>{t('عرض جدار الكاميرات (Video Wall)', 'Open Video Wall')}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid (Low noise, sophisticated) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Cameras */}
        <div 
          onClick={() => onNavigate('cameras')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{t('الكاميرات النشطة', 'Active Cameras')}</span>
            <Video className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-100">{onlineCameras}</span>
              <span className="text-xs font-mono text-slate-400">/ {cameras.length} متصلة</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1">
              98.2% {t('جاهزية البث واستقرار الشبكة', 'stream uptime')}
            </p>
          </div>
        </div>

        {/* Card 2: Security Incidents */}
        <div 
          onClick={() => onNavigate('security')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{t('الحوادث الأمنية غير المراجعة', 'Pending Incidents')}</span>
            <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-rose-400">{criticalIncidents}</span>
              <span className="text-xs text-slate-400">{t('حالة حرجة جديدة', 'Critical')}</span>
            </div>
            <p className="text-[11px] text-rose-400/80 mt-1">
              {t('تتطلب مراجعة بشرية لفيديو الـ 70 ثانية', 'Requires human evidence review')}
            </p>
          </div>
        </div>

        {/* Card 3: Face Attendance */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{t('الحضور الذكي بالوجه', 'AI Face Attendance')}</span>
            <UserCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-100">{presentEmployees}</span>
              <span className="text-xs text-slate-400">/ {attendanceRecords.length} مسجلين</span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1">
              {t('بوابات الدخول الآلية متطابقة 96.8%', '96.8% facial match accuracy')}
            </p>
          </div>
        </div>

        {/* Card 4: Inventory Discrepancies */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between gap-3 group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{t('فروقات المخزون المرئي', 'Inventory CV Variance')}</span>
            <Boxes className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-400">{inventoryDiscrepancies}</span>
              <span className="text-xs text-slate-400">{t('فارق رصد تلقائي', 'SKU Discrepancy')}</span>
            </div>
            <p className="text-[11px] text-amber-400/80 mt-1">
              {t('مقارنة الرؤية الحاسوبية بسجلات ERP', 'Computer vision vs expected ERP')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Row: Live Featured Camera & Incident Priority List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live CCTV Canvas Feed */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-400" />
              <span>{t('البث المباشر النشط مع تحليل الذكاء الاصطناعي', 'Featured Camera Stream with Real-Time AI')}</span>
            </h3>

            {/* Camera Quick Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {cameras.map(cam => (
                <button
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedCamera?.id === cam.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cam.name.split('-')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {selectedCamera && (
            <LiveCameraPlayer
              camera={selectedCamera}
              onOpenZoneDrawer={onOpenZoneDrawer}
            />
          )}
        </div>

        {/* Right 1 Col: Urgent Security Incidents & Theft Pipeline Feed */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>{t('الحوادث الأمنية الأخيرة', 'Security Incidents')}</span>
            </h3>
            <button
              onClick={() => onNavigate('security')}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{t('عرض الكل', 'View All')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {securityIncidents.slice(0, 3).map(inc => (
              <div
                key={inc.id}
                onClick={() => setActiveEvidenceIncident(inc)}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col gap-2.5 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="overflow-hidden">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      {inc.severity}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100 mt-1 truncate group-hover:text-cyan-400 transition">
                      {inc.title}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                    {inc.timestamp.substring(11, 16)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {inc.reason}
                </p>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">{inc.cameraName}</span>
                  <span className="text-cyan-400 font-semibold flex items-center gap-1 group-hover:translate-x-[-2px] transition">
                    <span>{t('مراجعة فيديو 70ث', '70s Video')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Behavior Events Snippet */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('أحدث الأحداث السلوكية المرصودة', 'Recent Behavioral Triggers')}</span>
            </h4>
            <div className="space-y-2">
              {behaviorEvents.slice(0, 2).map(evt => (
                <div key={evt.id} className="text-xs p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{evt.eventType}</span>
                    <span className="text-[10px] font-mono text-slate-500">{evt.timestamp.substring(11, 16)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{evt.personName || evt.cameraName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
