import React, { useState } from 'react';
import { 
  Video, 
  Plus, 
  Grid2X2, 
  Square, 
  Layers, 
  Sliders, 
  Wifi, 
  WifiOff, 
  Trash2, 
  Check, 
  Activity, 
  Eye, 
  EyeOff,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { Camera } from '../types';
import { LiveCameraPlayer } from '../components/LiveCameraPlayer';

interface CamerasViewProps {
  onOpenZoneDrawer: (camera: Camera) => void;
}

export const CamerasView: React.FC<CamerasViewProps> = ({ onOpenZoneDrawer }) => {
  const { t } = useLanguageTheme();
  const { cameras, selectedCamera, setSelectedCamera, addCamera, addRecorder, updateCameraStatus } = useLiveCCTV();

  const [layoutMode, setLayoutMode] = useState<'SINGLE' | 'QUAD'>('SINGLE');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddRecorderModal, setShowAddRecorderModal] = useState(false);

  // New Camera Form State
  const [newCamName, setNewCamName] = useState('');
  const [newCamLocation, setNewCamLocation] = useState('');
  const [newCamType, setNewCamType] = useState<Camera['type']>('RTSP');
  const [newCamUrl, setNewCamUrl] = useState('rtsp://192.168.1.120:554/live/ch0');
  const [newCamUsername, setNewCamUsername] = useState('admin');
  const [newCamPassword, setNewCamPassword] = useState('');
  const [recUsername, setRecUsername] = useState('admin');
  const [recPassword, setRecPassword] = useState('');
  const [newCamResolution, setNewCamResolution] = useState('1920x1080');
  const [newCamFps, setNewCamFps] = useState(25);
  const [newCamAiEnabled, setNewCamAiEnabled] = useState(true);

  // New Recorder Form State
  const [recName, setRecName] = useState('');
  const [recType, setRecType] = useState<'NVR' | 'DVR'>('NVR');
  const [recChannels, setRecChannels] = useState<4 | 8 | 16 | 32 | 64>(16);
  const [recIp, setRecIp] = useState('192.168.1.100');
  const [recPort, setRecPort] = useState(8000);

  const handleCreateRecorder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recName.trim()) return;

    addRecorder({
      tenantId: 'tenant-aman-logistics',
      name: recName,
      type: recType,
      channels: recChannels,
      ipAddress: recIp,
      port: recPort,
      status: 'ONLINE',
      brand: 'Hikvision / Dahua / Generic',
      username: recUsername,
      password: recPassword,
    });

    // Auto-create dummy cameras based on channels? (Optional, let's keep it simple)
    setShowAddRecorderModal(false);
    setRecName('');
  };

  const handleCreateCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName.trim()) return;

    addCamera({
      tenantId: 'tenant-aman-logistics',
      name: newCamName,
      location: newCamLocation || 'موقع عام',
      type: newCamType,
      streamUrl: newCamUrl,
      username: newCamUsername,
      password: newCamPassword,
      status: 'ONLINE',
      resolution: newCamResolution,
      fps: newCamFps,
      aiEnabled: newCamAiEnabled,
      detectionSettings: {
        detectPersons: true,
        detectVehicles: false,
        detectObjects: true,
        faceRecognition: true,
        loiteringThresholdSeconds: 30,
        confidenceThreshold: 0.8,
      },
      zones: [],
    });

    setShowAddModal(false);
    setNewCamName('');
    setNewCamUsername('admin');
    setNewCamPassword('');
    setNewCamLocation('');
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Video className="w-5 h-5 text-cyan-400" />
            <span>{t('جدار البث المباشر وإدارة كاميرات المراقبة', 'Live Video Wall & CCTV Fleet')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'دعم بروتوكولات RTSP / ONVIF / HLS مع معالجة حافة وتصحيح انقطاع البث عبر Windows Agent.',
              'Multi-protocol RTSP/ONVIF streams with edge decoding and polygon zone overlays.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              onClick={() => setLayoutMode('SINGLE')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'SINGLE' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t('كاميرا مفردة', 'Focused View')}</span>
            </button>
            <button
              onClick={() => setLayoutMode('QUAD')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'QUAD' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span>{t('جدار رباعي (Quad)', 'Quad Grid')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddRecorderModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>{t('إضافة جهاز NVR/DVR', 'Add NVR/DVR')}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('إضافة كاميرا جديدة', 'Add Camera')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {layoutMode === 'SINGLE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Focused Player (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {selectedCamera ? (
              <LiveCameraPlayer
                camera={selectedCamera}
                onOpenZoneDrawer={() => onOpenZoneDrawer(selectedCamera)}
              />
            ) : (
              <div className="aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 text-sm">
                {t('حدد كاميرا من القائمة لعرضها', 'Select a camera to start live view')}
              </div>
            )}

            {/* Selected Camera Specs Banner */}
            {selectedCamera && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200">{selectedCamera.name}</h4>
                  <p className="font-mono text-cyan-400 text-[11px] select-all">{selectedCamera.streamUrl}</p>
                </div>

                {/* Status Toggle buttons for simulation */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">{t('محاكاة حالة الكاميرا:', 'Simulate State:')}</span>
                  {(['ONLINE', 'DEGRADED', 'OFFLINE'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => updateCameraStatus(selectedCamera.id, st)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border transition cursor-pointer ${
                        selectedCamera.status === st
                          ? st === 'ONLINE'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : st === 'DEGRADED'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-rose-950 text-rose-300 border-rose-700'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera Directory List (1 Col) */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t('قائمة الكاميرات المتاحة', 'Camera Directory')} ({cameras.length})
            </h3>

            <div className="flex flex-col gap-2 max-h-[620px] overflow-y-auto pr-1">
              {cameras.map(cam => {
                const isSelected = selectedCamera?.id === cam.id;
                return (
                  <div
                    key={cam.id}
                    onClick={() => setSelectedCamera(cam)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            cam.status === 'ONLINE'
                              ? 'bg-emerald-500'
                              : cam.status === 'DEGRADED'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <h4 className="text-xs font-bold text-slate-200 truncate">{cam.name}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{cam.fps} FPS</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{cam.location}</span>
                      <span className="font-mono text-cyan-400">{cam.type}</span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                      <span>AI: {cam.aiEnabled ? 'مفعّل' : 'معطّل'}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onOpenZoneDrawer(cam);
                        }}
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3" />
                        <span>{cam.zones.length} مناطق</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Quad Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cameras.slice(0, 4).map(cam => (
            <div key={cam.id} className="flex flex-col gap-1">
              <LiveCameraPlayer
                camera={cam}
                onOpenZoneDrawer={() => onOpenZoneDrawer(cam)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-400" />
              <span>{t('إضافة كاميرا مراقبة جديدة', 'Add New CCTV Camera')}</span>
            </h3>

            <form onSubmit={handleCreateCamera} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">{t('اسم الكاميرا:', 'Camera Name:')}</label>
                <input
                  type="text"
                  required
                  value={newCamName}
                  onChange={e => setNewCamName(e.target.value)}
                  placeholder="مثال: البوابة الغربية - ممر الشاحنات"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('الموقع / القسم:', 'Location:')}</label>
                  <input
                    type="text"
                    value={newCamLocation}
                    onChange={e => setNewCamLocation(e.target.value)}
                    placeholder="مثال: المستودع الخارجي"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('نوع البروتوكول:', 'Stream Protocol:')}</label>
                  <select
                    value={newCamType}
                    onChange={e => setNewCamType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="RTSP">RTSP (Real Time Streaming)</option>
                    <option value="ONVIF">ONVIF Profile S</option>
                    <option value="IP">IP / HTTP MJPEG</option>
                    <option value="HLS">HLS (m3u8)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('عنوان البث المباشر (RTSP URL):', 'Stream URL:')}</label>
                <input
                  type="text"
                  required
                  value={newCamUrl}
                  onChange={e => setNewCamUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-cyan-300 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('اسم المستخدم:', 'Username:')}</label>
                  <input type="text" value={newCamUsername} onChange={e => setNewCamUsername(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('كلمة مرور الكاميرا:', 'Camera Password:')}</label>
                  <input type="password" value={newCamPassword} onChange={e => setNewCamPassword(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100" />
                </div>
              </div>
              <p className="text-[10px] text-amber-300/80">{t('بيانات الدخول تُرسل للخادم وتُخزّن مشفّرة ولا تظهر في الواجهة.', 'Credentials are sent to the server and stored encrypted; they are not displayed back to the browser.')}</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('الدقة (Resolution):', 'Resolution:')}</label>
                  <select
                    value={newCamResolution}
                    onChange={e => setNewCamResolution(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1920x1080">1080p FHD (1920x1080)</option>
                    <option value="2560x1440">2K QHD (2560x1440)</option>
                    <option value="3840x2160">4K UHD (3840x2160)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('معدل الإطارات (FPS):', 'FPS:')}</label>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    value={newCamFps}
                    onChange={e => setNewCamFps(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCamAiEnabled}
                  onChange={e => setNewCamAiEnabled(e.target.checked)}
                  className="rounded text-cyan-500"
                />
                <span className="font-semibold text-slate-200">
                  {t('تفعيل خط أنابيب الذكاء الاصطناعي (AI Detection Engine)', 'Enable AI Detection Pipeline')}
                </span>
              </label>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                >
                  {t('حفظ الكاميرا وبدء البث', 'Save & Connect Stream')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Recorder Modal */}
      {showAddRecorderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>{t('إضافة جهاز NVR / DVR', 'Add NVR / DVR')}</span>
            </h3>

            <form onSubmit={handleCreateRecorder} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">{t('اسم الجهاز:', 'Device Name:')}</label>
                <input
                  type="text"
                  required
                  value={recName}
                  onChange={e => setRecName(e.target.value)}
                  placeholder="مثال: المستودع NVR 01"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('نوع الجهاز:', 'Device Type:')}</label>
                  <select
                    value={recType}
                    onChange={e => setRecType(e.target.value as 'NVR' | 'DVR')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="NVR">NVR (Network Video Recorder)</option>
                    <option value="DVR">DVR (Digital Video Recorder)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('السعة (قنوات):', 'Channels:')}</label>
                  <select
                    value={recChannels}
                    onChange={e => setRecChannels(parseInt(e.target.value) as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="4">4 {t('كاميرات', 'Cameras')}</option>
                    <option value="8">8 {t('كاميرات', 'Cameras')}</option>
                    <option value="16">16 {t('كاميرا', 'Cameras')}</option>
                    <option value="32">32 {t('كاميرا', 'Cameras')}</option>
                    <option value="64">64 {t('كاميرا', 'Cameras')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('عنوان IP:', 'IP Address:')}</label>
                  <input
                    type="text"
                    required
                    value={recIp}
                    onChange={e => setRecIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('منفذ الاتصال (Port):', 'Port:')}</label>
                  <input
                    type="number"
                    required
                    value={recPort}
                    onChange={e => setRecPort(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('اسم مستخدم NVR/DVR:', 'Recorder Username:')}</label>
                  <input type="text" value={recUsername} onChange={e => setRecUsername(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('كلمة المرور:', 'Recorder Password:')}</label>
                  <input type="password" value={recPassword} onChange={e => setRecPassword(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100" />
                </div>
              </div>
              <p className="text-[10px] text-amber-300/80">{t('لا تحفظ كلمة المرور داخل رابط RTSP؛ سيقوم الخادم بتشفيرها.', 'Do not put the password inside the RTSP URL; the server encrypts it separately.')}</p>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRecorderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                >
                  {t('حفظ وإضافة الجهاز', 'Save & Add Recorder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
