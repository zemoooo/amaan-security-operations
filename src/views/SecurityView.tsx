import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Play, 
  ArrowUpRight, 
  Lock, 
  FileText, 
  Video, 
  User, 
  Package, 
  Layers,
  Sparkles,
  Smartphone,
  PhoneCall,
  MessageSquare,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { SecurityIncident, BehaviorEvent } from '../types';

interface SecurityViewProps {
  onOpenWhatsApp?: () => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({ onOpenWhatsApp }) => {
  const { t } = useLanguageTheme();
  const { 
    securityIncidents, 
    behaviorEvents, 
    setActiveEvidenceIncident, 
    customerWhatsAppSettings,
    triggerWhatsAppCall
  } = useLiveCCTV();

  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'BEHAVIORS'>('INCIDENTS');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredIncidents = securityIncidents.filter(inc => {
    if (filterSeverity !== 'ALL' && inc.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && inc.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.cameraName.toLowerCase().includes(q) ||
        inc.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredBehaviors = behaviorEvents.filter(evt => {
    if (filterSeverity !== 'ALL' && evt.severity !== filterSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.cameraName.toLowerCase().includes(q) ||
        evt.reason.toLowerCase().includes(q) ||
        (evt.personName && evt.personName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('الحوادث الأمنية وتحليل السلوكيات الجنائية', 'Security Incidents & Theft Pipeline')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'رصد اشتباه السرقات والتسلل والتسكع عبر خوارزميات الذكاء الاصطناعي مع حفظ مقطع دليل مرئي موثق 70 ثانية.',
              'Multi-signal theft and behavioral anomaly detection with 70s protected forensic video evidence.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {onOpenWhatsApp && (
            <button
              type="button"
              onClick={onOpenWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('إعدادات واتساب العميل', 'Customer WhatsApp')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer WhatsApp Live Dispatch Strip */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-800/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-2xl bg-emerald-900/60 border border-emerald-700 text-emerald-300 flex-shrink-0">
            {customerWhatsAppSettings.alertMode === 'CALL_ONLY' ? (
              <PhoneCall className="w-5 h-5 text-cyan-400" />
            ) : customerWhatsAppSettings.alertMode === 'MESSAGE_AND_CALL' ? (
              <div className="flex items-center gap-0.5">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <PhoneCall className="w-4 h-4 text-cyan-400" />
              </div>
            ) : (
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100">
                {t('نظام تنبيهات ومكالمات واتساب العميل (Agent WhatsApp Dispatch):', 'Customer WhatsApp Alert System:')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                customerWhatsAppSettings.enabled 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {customerWhatsAppSettings.enabled ? t('مفعّل للتنبيه الفوري', 'Armed & Active') : t('معطّل', 'Disabled')}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
              <span>{t('رقم العميل المعتمد:', 'Customer Phone:')} <strong className="font-mono text-emerald-400 font-semibold">{customerWhatsAppSettings.phoneNumber}</strong></span>
              <span className="text-slate-600">|</span>
              <span>
                {t('إجراء الوكيل عند أمر مريب:', 'Action on Incident:')} {' '}
                <strong className="text-cyan-300 font-semibold">
                  {customerWhatsAppSettings.alertMode === 'CALL_ONLY'
                    ? t('📞 مكالمة صوتية واتساب فقط', 'Voice Call Only')
                    : customerWhatsAppSettings.alertMode === 'MESSAGE_AND_CALL'
                      ? t('🔔 رسالة + مكالمة صوتية معاً (اختياري)', 'Message + Urgent Voice Call')
                      : t('💬 رسالة نصية تفاعلية فقط', 'Message Only')}
                </strong>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => triggerWhatsAppCall({
              title: 'مكالمة واتساب تجريبية من شاشة الأمن',
              reason: 'اختبار فوري لاستجابة ورنين نداء الوكيل بالذكاء الاصطناعي',
              cameraName: 'المستودع الرئيسي - الرف 04',
              severity: 'CRITICAL',
            })}
            className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('تجربة اتصال واتساب الآن', 'Test Call Now')}</span>
          </button>

          {onOpenWhatsApp && (
            <button
              type="button"
              onClick={onOpenWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('تعديل الرقم والخيارات', 'Edit Settings')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Signal Theft Pipeline Explainer Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-300">
        <div className="space-y-1">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            {t('منطق كشف السرقات المتعدد (Theft Multi-Signal Pipeline):', 'Theft Multi-Signal Pipeline Engine:')}
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {t(
              'النظام لا يتهم قطعياً بل يصنف الحالة "اشتباه سرقة / Suspicious Activity" عند تزامن 3 إشارات: (1) رصد إزالة كرتون من الرف + (2) تواجد شخص خارج الدوام + (3) عدم وجود إذن صرف رسمي مسجل.',
              'Zero-false-allegation rule: Flags "Theft Suspicion" only when 3 signals converge: object removal + unauthorized presence + lack of work permit.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-center">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="font-mono text-cyan-400 font-bold block">30s</span>
            <span className="text-[10px] text-slate-500">{t('قبل الحدث', 'Pre-Event')}</span>
          </div>
          <span className="text-slate-600 font-bold">+</span>
          <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800">
            <span className="font-mono text-rose-400 font-bold block">10s</span>
            <span className="text-[10px] text-rose-400/80">{t('ذروة الحدث', 'Event Peak')}</span>
          </div>
          <span className="text-slate-600 font-bold">+</span>
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="font-mono text-cyan-400 font-bold block">30s</span>
            <span className="text-[10px] text-slate-500">{t('بعد الحدث', 'Post-Event')}</span>
          </div>
          <span className="text-slate-600 font-bold">=</span>
          <div className="p-2 rounded-xl bg-blue-950 border border-blue-700">
            <span className="font-mono text-blue-300 font-bold block">70s</span>
            <span className="text-[10px] text-blue-400">{t('المقطع الجنائي', 'Total Clip')}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Main Tab */}
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('INCIDENTS')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'INCIDENTS' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('الحوادث الأمنية والسرقات', 'Security Incidents')} ({securityIncidents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('BEHAVIORS')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'BEHAVIORS' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t('الأحداث السلوكية (تسكع / تسلل)', 'Behavioral Events')} ({behaviorEvents.length})</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('بحث عن كاميرا أو حدث...', 'Search incidents...')}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 sm:w-56"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">{t('كل مستويات الخطورة', 'All Severities')}</option>
            <option value="CRITICAL">CRITICAL (حرج)</option>
            <option value="HIGH">HIGH (عالي)</option>
            <option value="MEDIUM">MEDIUM (متوسط)</option>
            <option value="LOW">LOW (منخفض)</option>
          </select>

          {activeTab === 'INCIDENTS' && (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">{t('كل الحالات', 'All Review States')}</option>
              <option value="NEW">جديد (NEW)</option>
              <option value="UNDER_REVIEW">قيد المراجعة (UNDER_REVIEW)</option>
              <option value="CONFIRMED">مؤكد (CONFIRMED)</option>
              <option value="DISMISSED">مستبعد (DISMISSED)</option>
            </select>
          )}
        </div>
      </div>

      {/* List Content */}
      {activeTab === 'INCIDENTS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIncidents.map(inc => (
            <div
              key={inc.id}
              className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4 shadow-xl group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : inc.severity === 'HIGH'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-blue-950 text-blue-300 border-blue-800'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        inc.status === 'NEW'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
                          : inc.status === 'CONFIRMED'
                          ? 'bg-rose-950 text-rose-300 border-rose-700'
                          : inc.status === 'UNDER_REVIEW'
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{inc.timestamp}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-400 transition">
                    {inc.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {inc.reason}
                  </p>
                </div>

                {/* Evidence Thumbnail with 70s badge */}
                <div
                  onClick={() => setActiveEvidenceIncident(inc)}
                  className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 cursor-pointer group/img"
                >
                  <img
                    src={inc.videoEvidence.snapshots[0] || ''}
                    alt="Evidence Preview"
                    className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover/img:bg-black/20 flex items-center justify-center transition">
                    <div className="p-3 rounded-full bg-cyan-600/90 text-white shadow-xl flex items-center justify-center">
                      <Play className="w-5 h-5 fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-white font-mono text-[11px] border border-slate-700">
                    ⏱ 70 ثانية أدلة جنائية
                  </div>
                </div>

                {/* Metadata details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <div>
                    <span className="block text-[10px] text-slate-500">{t('الكاميرا:', 'Camera:')}</span>
                    <span className="font-semibold text-slate-200">{inc.cameraName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">{t('نسبة ثقة الذكاء الاصطناعي:', 'Confidence:')}</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {(inc.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button to launch 70s Modal */}
              <button
                onClick={() => setActiveEvidenceIncident(inc)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/40 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{t('فتح مشغل الأدلة الجنائية وتوثيق القرار', 'Review Forensic Clip & Commit Decision')}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Behavioral Events Feed */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBehaviors.map(evt => (
            <div
              key={evt.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3 text-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                    {evt.eventType}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{evt.timestamp.substring(11, 19)}</span>
                </div>

                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                  <img src={evt.snapshotUrl} alt="Behavior Snap" className="w-full h-full object-cover" />
                </div>

                <div>
                  <h4 className="font-bold text-slate-200">{evt.cameraName}</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{evt.reason}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{evt.personName || t('شخص مجهول', 'Unknown')}</span>
                <span className="font-mono text-emerald-400 font-bold">{(evt.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
