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
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(camera.detectionSettings.confidenceThreshold || 0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpsCurrent, setFpsCurrent] = useState(camera.fps);
  const [simulatedSnapshotNotice, setSimulatedSnapshotNotice] = useState(false);
  const [realVideoStream, setRealVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Request real webcam access
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startRealCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setRealVideoStream(stream);
        
        if (!videoRef.current) {
          const video = document.createElement('video');
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          videoRef.current = video;
        }
        
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (err) {
        console.warn('Real camera access denied or unavailable. Falling back to simulation.', err);
      }
    };

    startRealCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camera.id]); // Re-init if camera id changes

  // Dynamic simulation loop for realistic CCTV footage
  useEffect(() => {
    let animationFrameId: number;
    let tick = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Draw CCTV Background scene based on camera type
      if (videoRef.current && videoRef.current.readyState >= 2 && realVideoStream) {
        // Draw real webcam feed
        ctx.drawImage(videoRef.current, 0, 0, w, h);
      } else {
        // Fallback simulation if no real camera
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, w, h);

        if (camera.status === 'OFFLINE') {
          // Offline TV noise static
          const imgData = ctx.createImageData(w, h);
          for (let i = 0; i < imgData.data.length; i += 4) {
            const noise = Math.random() * 80 + 20;
            imgData.data[i] = noise;
            imgData.data[i + 1] = noise;
            imgData.data[i + 2] = noise;
            imgData.data[i + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(w * 0.2, h * 0.35, w * 0.6, h * 0.3);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(w * 0.2, h * 0.35, w * 0.6, h * 0.3);

          ctx.fillStyle = '#f87171';
          ctx.font = 'bold 20px "IBM Plex Sans Arabic", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️ انقطع اتصال الكاميرا (RTSP STREAM OFFLINE)', w / 2, h / 2 - 10);
          ctx.font = '14px "JetBrains Mono", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(camera.streamUrl, w / 2, h / 2 + 18);
          ctx.fillText('جاري محاولة إعادة الاتصال التلقائي من خادم Windows Agent...', w / 2, h / 2 + 42);
          return;
        }

        // Draw perspective room lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;

        // Perspective floor & ceiling
        ctx.beginPath();
        ctx.moveTo(0, h * 0.35);
        ctx.lineTo(w * 0.25, h * 0.45);
        ctx.lineTo(w * 0.75, h * 0.45);
        ctx.lineTo(w, h * 0.35);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.25, h * 0.75);
        ctx.lineTo(w * 0.75, h * 0.75);
        ctx.lineTo(w, h);
        ctx.stroke();

        // Warehouse Racks or Walls depending on camera
        if (camera.id.includes('rack') || camera.id.includes('wh')) {
          // Warehouse Racks with Shelved Boxes
          ctx.fillStyle = '#111c30';
          ctx.fillRect(w * 0.1, h * 0.25, w * 0.25, h * 0.5);
          ctx.fillRect(w * 0.65, h * 0.25, w * 0.25, h * 0.5);

          ctx.strokeStyle = '#334155';
          for (let y = h * 0.25; y <= h * 0.75; y += h * 0.12) {
            ctx.beginPath();
            ctx.moveTo(w * 0.1, y);
            ctx.lineTo(w * 0.35, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(w * 0.65, y);
            ctx.lineTo(w * 0.9, y);
            ctx.stroke();

            // Draw stacked cartons
            for (let bx = w * 0.12; bx < w * 0.32; bx += 32) {
              ctx.fillStyle = '#854d0e';
              ctx.fillRect(bx, y - 24, 26, 22);
              ctx.strokeStyle = '#ca8a04';
              ctx.lineWidth = 1;
              ctx.strokeRect(bx, y - 24, 26, 22);
            }
            for (let bx = w * 0.67; bx < w * 0.87; bx += 32) {
              ctx.fillStyle = '#854d0e';
              ctx.fillRect(bx, y - 24, 26, 22);
              ctx.strokeStyle = '#ca8a04';
              ctx.lineWidth = 1;
              ctx.strokeRect(bx, y - 24, 26, 22);
            }
          }
        } else if (camera.id.includes('gate')) {
          // Gate Turnstile doors
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(w * 0.3, h * 0.4, w * 0.4, h * 0.6);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.strokeRect(w * 0.35, h * 0.45, w * 0.3, h * 0.55);

          // Turnstile glass
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(w * 0.36, h * 0.46, w * 0.28, h * 0.53);
        } else {
          // General yard / perimeter
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, h * 0.55, w, h * 0.45);
          // Fence posts
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          for (let fx = 20; fx < w; fx += 50) {
            ctx.beginPath();
            ctx.moveTo(fx, h * 0.4);
            ctx.lineTo(fx, h * 0.7);
            ctx.stroke();
          }
        }

        // Draw moving dynamic actors
        const actorSpeed = isPlaying ? 1 : 0;
        const personX = (w * 0.35 + Math.sin((tick * 0.015) * actorSpeed) * (w * 0.2));
        const personY = h * 0.52 + Math.cos((tick * 0.015) * actorSpeed) * (h * 0.04);
        const personW = 55;
        const personH = 120;

        // Draw silhouette
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(personX + personW / 2, personY - 14, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(personX, personY, personW, personH);
      }

      // 2. Overlay Polygon Zones if enabled
      if (showZones && camera.zones && camera.zones.length > 0) {
        camera.zones.forEach((zone: CameraZone) => {
          if (zone.polygon && zone.polygon.length >= 3) {
            ctx.beginPath();
            const firstPt = zone.polygon[0];
            ctx.moveTo((firstPt.x / 100) * w, (firstPt.y / 100) * h);

            for (let i = 1; i < zone.polygon.length; i++) {
              const pt = zone.polygon[i];
              ctx.lineTo((pt.x / 100) * w, (pt.y / 100) * h);
            }
            ctx.closePath();

            ctx.fillStyle = `${zone.color}26`; // 15% opacity
            ctx.fill();
            ctx.strokeStyle = zone.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            const labelX = (zone.polygon[0].x / 100) * w + 8;
            const labelY = (zone.polygon[0].y / 100) * h + 18;
            ctx.fillStyle = zone.color;
            ctx.font = 'bold 12px "IBM Plex Sans Arabic", sans-serif';
            ctx.fillText(`⚑ ${zone.name}`, labelX, labelY);
          }
        });
      }

      // 3. Overlay AI Bounding Boxes if enabled
      if (showBoundingBoxes && camera.aiEnabled) {
        // Person Detection Box
        const conf = 0.97;
        if (conf >= confidenceThreshold) {
          ctx.strokeStyle = '#10b981'; // Green for detected person
          ctx.lineWidth = 2;
          ctx.strokeRect(personX - 8, personY - 36, personW + 16, personH + 42);

          // Header tag
          ctx.fillStyle = '#10b981';
          ctx.fillRect(personX - 8, personY - 60, 160, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px "JetBrains Mono", sans-serif';
          ctx.fillText(`[#1042] Person: ${(conf * 100).toFixed(1)}%`, personX - 4, personY - 44);

          // Face recognition sub-box
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(personX + 10, personY - 32, 35, 35);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(personX + 10, personY - 48, 80, 16);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 10px "JetBrains Mono", sans-serif';
          ctx.fillText(`Face: 94.2%`, personX + 14, personY - 36);

          // Loitering timer HUD if in sensitive zone
          const loiterSec = Math.floor((tick / 30) % 60);
          ctx.fillStyle = loiterSec > 25 ? '#ef4444' : '#f59e0b';
          ctx.fillRect(personX - 8, personY + personH + 8, 120, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px "JetBrains Mono", sans-serif';
          ctx.fillText(`⏱ Loiter: ${loiterSec}s`, personX - 2, personY + personH + 22);
        }

        // Warehouse Carton Bounding Box
        if (camera.id.includes('rack')) {
          const boxX = w * 0.15;
          const boxY = h * 0.42;
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(boxX, boxY, 80, 50);

          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(boxX, boxY - 20, 110, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.fillText(`Box SKU: 98.4%`, boxX + 4, boxY - 6);
        }
      }

      // 4. CCTV OSD HUD (Timecode, Camera Name, REC badge)
      if (showTelemetry) {
        // Top Left: Camera name & Resolution
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(12, 12, 280, 32);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`📹 ${camera.name}`, 20, 33);

        // Top Right: Live Rec + Timecode
        const now = new Date();
        const timecode = now.toTimeString().substring(0, 8);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(w - 220, 12, 208, 32);

        // Blinking red dot
        if (Math.floor(tick / 20) % 2 === 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(w - 200, 28, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`LIVE REC | ${timecode}`, w - 186, 32);

        // Bottom Left: Stream specs (FPS, Protocol, AI Engine)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(12, h - 38, 360, 26);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(
          `${camera.type} | ${camera.resolution} | ${fpsCurrent} FPS | AI: ${camera.aiEnabled ? 'YOLOv8-DeepSORT' : 'OFF'}`,
          18,
          h - 21
        );
      }

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [camera, isPlaying, showBoundingBoxes, showZones, showTelemetry, confidenceThreshold, fpsCurrent]);

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSimulatedSnapshotNotice(true);
    setTimeout(() => setSimulatedSnapshotNotice(false), 2500);

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
        {simulatedSnapshotNotice && (
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
