import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraZone } from '../types';
import { 
  Play, 
  Pause, 
  Maximize2, 
  Camera as CameraIcon, 
  Eye, 
  EyeOff, 
  Sliders, 
  Layers, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  Clock, 
  Cpu
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';

interface LiveCameraPlayerProps {
  camera: Camera;
  onOpenZoneDrawer?: () => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
}

export const LiveCameraPlayer: React.FC<LiveCameraPlayerProps> = ({
  camera,
  onOpenZoneDrawer,
  onCaptureSnapshot,
}) => {
  const { t } = useLanguageTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [snapshotNotice, setSnapshotNotice] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(camera.detectionSettings.confidenceThreshold || 0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpsCurrent, setFpsCurrent] = useState(camera.fps);

  // Request real webcam access
    useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(camera.status === 'ONLINE' ? 'البث الحقيقي عبر Edge Agent' : 'لا يوجد بث حقيقي متصل', canvas.width / 2, canvas.height / 2);
  }, [camera.id, camera.status]);

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSnapshotNotice(true);
    setTimeout(() => setSnapshotNotice(false), 2500);

    if (onCaptureSnapshot) {
      onCaptureSnapshot(dataUrl);
    } else {
      const link = document.createElement('a');
      link.download = `CCTV_SNAPSHOT_${camera.id}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      id={`camera-player-container-${camera.id}`}
      className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col group"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                camera.status === 'ONLINE'
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse'
                  : camera.status === 'DEGRADED'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide flex items-center gap-2">
              {camera.name}
            </h3>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700">
            {camera.location}
          </span>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2">
          {onOpenZoneDrawer && (
            <button
              onClick={onOpenZoneDrawer}
              title={t('رسم مناطق الكشف والعد', 'Draw Detection & Count Zones')}
              className="px-2.5 py-1 text-xs rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900/90 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('مناطق المراقبة', 'Zones')}</span>
            </button>
          )}

          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            title={showBoundingBoxes ? t('إخفاء مربعات الذكاء الاصطناعي', 'Hide AI Bounding Boxes') : t('إظهار مربعات الذكاء الاصطناعي', 'Show AI Boxes')}
            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
              showBoundingBoxes
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
          >
            {showBoundingBoxes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={handleCaptureSnapshot}
            title={t('التقاط صورة فورية', 'Capture Snapshot')}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
          >
            <CameraIcon className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            title={t('ملء الشاشة', 'Fullscreen')}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Video Surface */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain"
        />

        {/* Snapshot feedback badge */}
        {snapshotNotice && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-emerald-600/90 text-white font-medium text-xs shadow-xl backdrop-blur-md flex items-center gap-2 animate-bounce">
            <CameraIcon className="w-4 h-4" />
            <span>{t('تم حفظ لقطة الإطار بنجاح!', 'Snapshot captured & saved!')}</span>
          </div>
        )}
      </div>

      {/* Bottom Sub-control Toolbar */}
      <div className="px-4 py-2.5 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? t('إيقاف مؤقت', 'Pause') : t('تشغيل', 'Play')}</span>
          </button>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showZones}
              onChange={e => setShowZones(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span>{t('عرض المناطق (Zones)', 'Show Zones')}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showTelemetry}
              onChange={e => setShowTelemetry(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span>{t('بيانات OSD', 'Telemetry OSD')}</span>
          </label>
        </div>

        {/* Confidence Threshold Calibration Slider */}
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 text-xs">
            {t('عتبة الثقة (AI Confidence):', 'Confidence:')}
          </span>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.05"
            value={confidenceThreshold}
            onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="font-mono text-cyan-300 font-semibold w-8">
            {(confidenceThreshold * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
