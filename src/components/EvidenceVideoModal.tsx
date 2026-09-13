import React, { useState, useEffect, useRef } from 'react';
import { SecurityIncident } from '../types';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldAlert, 
  Clock, 
  Camera, 
  User, 
  Package, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Lock, 
  Download, 
  FileText, 
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';

interface EvidenceVideoModalProps {
  incident: SecurityIncident;
  onClose: () => void;
}

export const EvidenceVideoModal: React.FC<EvidenceVideoModalProps> = ({ incident, onClose }) => {
  const { t } = useLanguageTheme();
  const { updateIncidentStatus } = useLiveCCTV();

  const [currentTimeSec, setCurrentTimeSec] = useState(30); // Starts at the beginning of the incident event!
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedSnapshotIdx, setSelectedSnapshotIdx] = useState(0);
  const [reviewStatus, setReviewStatus] = useState<SecurityIncident['status']>(incident.status);
  const [reviewNotes, setReviewNotes] = useState(incident.reviewNotes || '');
  const [isSaved, setIsSaved] = useState(false);

  // Gemini AI Forensic Deep Investigation State
  const [isInvestigatingAi, setIsInvestigatingAi] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<any>(null);

  const handleInvestigateWithAi = async () => {
    setIsInvestigatingAi(true);
    try {
      const res = await fetch('/api/ai/investigate-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysisData(data);
        if (data.analysis.recommendedActions && data.analysis.recommendedActions.length > 0) {
          const autoNotes = `[Gemini AI Forensic Investigation]:\n${data.analysis.forensicAnalysis}\n\nالإجراءات الموصى بها:\n- ${data.analysis.recommendedActions.join('\n- ')}`;
          setReviewNotes(prev => prev ? `${prev}\n\n${autoNotes}` : autoNotes);
        }
      }
    } catch (err) {
      console.error('AI investigation error:', err);
    } finally {
      setIsInvestigatingAi(false);
    }
  };

  const totalDuration = incident.videoEvidence.durationSec || 70;
  const preDuration = incident.videoEvidence.preEventSec || 30;
  const eventDuration = incident.videoEvidence.eventSec || 10;
  const eventEnd = preDuration + eventDuration; // 40s

  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTimeSec(prev => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return Number((prev + 0.5 * playbackSpeed).toFixed(1));
        });
      }, 500);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, playbackSpeed, totalDuration]);

  const handleSaveReview = () => {
    updateIncidentStatus(incident.id, reviewStatus, reviewNotes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const getPhaseName = () => {
    if (currentTimeSec < preDuration) {
      return {
        label: t('فترة ما قبل الحدث (Pre-Event 30s)', 'Pre-Event Phase (30s)'),
        color: 'text-amber-400 bg-amber-950/60 border-amber-800',
      };
    } else if (currentTimeSec <= eventEnd) {
      return {
        label: t('لحظة وقوع الحدث الحرج (Critical Event 10s)', 'Critical Incident Peak (10s)'),
        color: 'text-rose-400 bg-rose-950/80 border-rose-700 animate-pulse',
      };
    } else {
      return {
        label: t('فترة ما بعد الحدث (Post-Event 30s)', 'Post-Event Phase (30s)'),
        color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
      };
    }
  };

  const phase = getPhaseName();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="evidence-video-modal-dialog"
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  {t('مشغل الأدلة الجنائية المرئية (70 ثانية)', 'Video Evidence Player (70-Second Clip)')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-rose-950 text-rose-300 border border-rose-800">
                  {incident.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  {incident.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {incident.title} • {incident.cameraName} • {incident.timestamp}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs border border-slate-700">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('تسجيل غير قابل للحذف (Protected)', 'Immutable Evidence')}</span>
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Video Player & Controls on Top, Side Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Main Video Screen (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl flex items-center justify-center">
              {/* Snapshot / Video Simulator */}
              <img
                src={
                  incident.videoEvidence.snapshots[selectedSnapshotIdx] ||
                  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80'
                }
                alt="Video Evidence Frame"
                className="w-full h-full object-cover"
              />

              {/* Simulated Bounding Box for the incident peak */}
              {currentTimeSec >= 28 && currentTimeSec <= 45 && (
                <div className="absolute top-[28%] left-[34%] w-[32%] h-[55%] border-2 border-rose-500 rounded-lg shadow-lg pointer-events-none animate-pulse">
                  <div className="absolute -top-7 right-0 px-2 py-0.5 bg-rose-600 text-white font-mono text-xs rounded">
                    [SUSPECT] Object Removal: 93.4%
                  </div>
                </div>
              )}

              {/* Current Phase Pill OSD */}
              <div className="absolute top-4 left-4">
                <span className={`px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-lg ${phase.color}`}>
                  {phase.label}
                </span>
              </div>

              {/* Timecode OSD */}
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-black/75 border border-slate-700 text-white font-mono text-xs backdrop-blur-md">
                {String(Math.floor(currentTimeSec / 60)).padStart(2, '0')}:
                {String(Math.floor(currentTimeSec % 60)).padStart(2, '0')} / 01:10
              </div>
            </div>

            {/* 70s Segmented Timeline Scrub Bar */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>00:00 (Pre-Event)</span>
                <span className="text-rose-400 font-semibold">00:30 (Incident Moment)</span>
                <span className="text-cyan-400">00:40 (Post-Event)</span>
                <span>01:10 (End)</span>
              </div>

              {/* Three-segment visual progress bar */}
              <div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden flex cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = clickX / rect.width;
                  setCurrentTimeSec(Math.min(70, Math.max(0, Math.round(ratio * 70))));
                }}
              >
                {/* Pre-event slice: 0 - 30s (30/70 = 42.8%) */}
                <div 
                  className="h-full bg-amber-600/60 hover:bg-amber-500/80 transition" 
                  style={{ width: `${(30 / 70) * 100}%` }} 
                  title="30s Pre-event buffer"
                />
                {/* Event slice: 30 - 40s (10/70 = 14.3%) */}
                <div 
                  className="h-full bg-rose-600 hover:bg-rose-500 transition relative" 
                  style={{ width: `${(10 / 70) * 100}%` }} 
                  title="10s Critical Event"
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
                {/* Post-event slice: 40 - 70s (30/70 = 42.8%) */}
                <div 
                  className="h-full bg-cyan-600/60 hover:bg-cyan-500/80 transition" 
                  style={{ width: `${(30 / 70) * 100}%` }} 
                  title="30s Post-event buffer"
                />

                {/* Scrubber pin cursor */}
                <div 
                  className="absolute top-0 bottom-0 w-1.5 bg-white shadow-xl pointer-events-none"
                  style={{ left: `${(currentTimeSec / 70) * 100}%` }}
                />
              </div>

              {/* Playback Transport Controls */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setCurrentTimeSec(30)}
                    title={t('القفز إلى لحظة الحدث (30 ث)', 'Jump to Event Peak (30s)')}
                    className="px-3 py-1.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{t('لحظة الحدث (00:30)', 'Event Peak')}</span>
                  </button>

                  <button
                    onClick={() => setCurrentTimeSec(0)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Playback speed selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">{t('السرعة:', 'Speed:')}</span>
                  {[0.5, 1, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                        playbackSpeed === speed
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Snapshot Thumbnails Strip */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300">
                {t('لقطات الأدلة الجنائية المتزامنة:', 'Synchronized Evidence Snapshots:')}
              </span>
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {incident.videoEvidence.snapshots.map((snapUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSnapshotIdx(idx)}
                    className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition cursor-pointer ${
                      selectedSnapshotIdx === idx ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={snapUrl} alt={`Snap ${idx}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-center font-mono text-white">
                      +{idx * 8}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: AI Signals, Suspect Info, Human Review Decision */}
          <div className="flex flex-col gap-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
            {/* AI Reasoning Multi-Signal Card */}
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                {t('تحليل إشارات الذكاء الاصطناعي (Multi-Signal)', 'AI Multi-Signal Reasoning')}
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
                <p className="text-slate-200 font-medium">
                  {incident.reason}
                </p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{t('نسبة الثقة:', 'Confidence:')}</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {(incident.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Objects & Suspect Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">{t('هوية المشتبه به:', 'Suspect:')}</span>
                <span className="font-semibold text-rose-400">
                  {incident.suspectDetails.type === 'UNKNOWN_PERSON' ? t('شخص مجهول الهوية', 'Unknown Person') : incident.suspectDetails.name}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block mb-1">{t('الأجسام المرصودة في الحدث:', 'Detected Objects:')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {incident.involvedObjects.map((obj, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[11px]">
                      {obj}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Forensic Deep Investigation Module */}
            <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>{t('التحقيق الجنائي الرقمي عبر Gemini AI', 'Gemini AI Forensic Investigation')}</span>
                </div>
                {aiAnalysisData?.analysis?.suspicionScore && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-900 text-purple-200 border border-purple-700">
                    {t('درجة الخطورة:', 'Risk Score:')} {aiAnalysisData.analysis.suspicionScore}/100
                  </span>
                )}
              </div>

              {!aiAnalysisData ? (
                <button
                  type="button"
                  onClick={handleInvestigateWithAi}
                  disabled={isInvestigatingAi}
                  className="w-full py-2 px-3 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700 text-purple-200 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {isInvestigatingAi 
                      ? t('جاري تحليل الأدلة الجنائية مع Gemini 3.8 Flash...', 'Analyzing evidence with Gemini 3.8 Flash...') 
                      : t('بدء التحقيق الجنائي الذكي واستخراج التوصيات', 'Start AI Forensic Investigation')}
                  </span>
                </button>
              ) : (
                <div className="space-y-2.5 text-[11px] text-slate-300">
                  <p className="leading-relaxed bg-slate-950/80 p-2.5 rounded-xl border border-purple-900/50">
                    {aiAnalysisData.analysis.forensicAnalysis}
                  </p>

                  {aiAnalysisData.analysis.policyViolations?.length > 0 && (
                    <div>
                      <span className="text-rose-300 font-semibold block mb-1">
                        {t('المخالفات الإجرائية المرصودة:', 'Policy Violations:')}
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                        {aiAnalysisData.analysis.policyViolations.map((v: string, idx: number) => (
                          <li key={idx} className="text-[10px]">{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiAnalysisData.tamperProofHash && (
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>{t('ختم الأدلة الرقمي:', 'SHA-256 Seal:')}</span>
                      </span>
                      <span className="text-slate-300 truncate max-w-[140px]">{aiAnalysisData.tamperProofHash}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Human Review Section */}
            <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                {t('قرار المراجعة البشرية (Human Review)', 'Supervisor Human Review')}
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewStatus('CONFIRMED')}
                  className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                    reviewStatus === 'CONFIRMED'
                      ? 'bg-rose-950 border-rose-600 text-rose-300 ring-2 ring-rose-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-rose-500" />
                  <span>{t('تأكيد الحادثة', 'Confirm')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewStatus('UNDER_REVIEW')}
                  className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                    reviewStatus === 'UNDER_REVIEW'
                      ? 'bg-amber-950 border-amber-600 text-amber-300 ring-2 ring-amber-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{t('قيد التحقيق', 'Investigate')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewStatus('DISMISSED')}
                  className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                    reviewStatus === 'DISMISSED'
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300 ring-2 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-emerald-500" />
                  <span>{t('استبعاد / تبرير', 'Dismiss')}</span>
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  {t('ملاحظات المشرف المسجلة في سجل التدقيق:', 'Supervisor Audit Log Notes:')}
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={t('أدخل نتيجة التحقيق وإجراءات التدخل...', 'Enter review findings and response actions...')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveReview}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('حفظ القرار وتوثيق سجل التدقيق', 'Commit Decision & Record Audit')}</span>
              </button>

              {isSaved && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs text-center font-medium">
                  {t('تم حفظ القرار وتوثيق سجل التدقيق الدائم بنجاح!', 'Decision successfully saved & logged in tamper-proof audit trail!')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
