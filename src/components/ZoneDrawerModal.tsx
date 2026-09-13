import React, { useState, useRef } from 'react';
import { Camera, CameraZone } from '../types';
import { X, Layers, Plus, Trash2, Check, RotateCcw, Palette } from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';

interface ZoneDrawerModalProps {
  camera: Camera;
  onClose: () => void;
}

export const ZoneDrawerModal: React.FC<ZoneDrawerModalProps> = ({ camera, onClose }) => {
  const { t } = useLanguageTheme();
  const { updateCameraZones } = useLiveCCTV();

  const [zones, setZones] = useState<CameraZone[]>(camera.zones || []);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id || null);
  const [isDrawingNew, setIsDrawingNew] = useState(false);
  const [newPoints, setNewPoints] = useState<{ x: number; y: number }[]>([]);
  const [newZoneName, setNewZoneName] = useState('منطقة كشف مخصصة');
  const [newZoneType, setNewZoneType] = useState<CameraZone['type']>('COUNTING');
  const [newZoneColor, setNewZoneColor] = useState('#3b82f6');

  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingNew || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    setNewPoints(prev => [...prev, { x, y }]);
  };

  const handleFinishNewZone = () => {
    if (newPoints.length < 3) {
      alert(t('يرجى النقر على 3 نقاط على الأقل لتكوين مضلع المنطقة', 'Please place at least 3 points to form a polygon'));
      return;
    }

    const createdZone: CameraZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName,
      type: newZoneType,
      color: newZoneColor,
      polygon: newPoints,
    };

    const updated = [...zones, createdZone];
    setZones(updated);
    updateCameraZones(camera.id, updated);
    setIsDrawingNew(false);
    setNewPoints([]);
    setSelectedZoneId(createdZone.id);
  };

  const handleDeleteZone = (id: string) => {
    const updated = zones.filter(z => z.id !== id);
    setZones(updated);
    updateCameraZones(camera.id, updated);
    if (selectedZoneId === id) {
      setSelectedZoneId(updated[0]?.id || null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="zone-drawer-modal-dialog"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('محرر مناطق الرؤية الحاسوبية (Warehouse & Detection Zones)', 'Camera Computer Vision Zone Editor')}
              </h2>
              <p className="text-xs text-slate-400">
                {camera.name} • {t('رسم مناطق المضلعات التفاعلية لحساب المخزون وكشف التسلل والتسكع', 'Draw polygon zones for inventory counting & security')}
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

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Interactive Frame Surface (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div
              ref={containerRef}
              onClick={handleCanvasClick}
              className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-inner select-none cursor-crosshair flex items-center justify-center"
            >
              {/* Reference background preview */}
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center pointer-events-none opacity-40">
                <span className="text-xs font-mono text-slate-500">
                  {camera.name} ({camera.resolution})
                </span>
              </div>

              {/* Render existing zones */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {zones.map(zone => {
                  if (!zone.polygon || zone.polygon.length < 3) return null;
                  const pointsStr = zone.polygon.map(p => `${p.x}%,${p.y}%`).join(' ');
                  const isSelected = selectedZoneId === zone.id;

                  return (
                    <g key={zone.id}>
                      <polygon
                        points={pointsStr}
                        fill={`${zone.color}33`}
                        stroke={zone.color}
                        strokeWidth={isSelected ? 3 : 1.5}
                        strokeDasharray={isSelected ? 'none' : '4 3'}
                      />
                      <text
                        x={`${zone.polygon[0].x + 1}%`}
                        y={`${zone.polygon[0].y + 4}%`}
                        fill={zone.color}
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="'IBM Plex Sans Arabic', sans-serif"
                      >
                        {zone.name}
                      </text>
                    </g>
                  );
                })}

                {/* Render in-progress polygon points */}
                {isDrawingNew && newPoints.length > 0 && (
                  <g>
                    {newPoints.map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={`${pt.x}%`}
                        cy={`${pt.y}%`}
                        r={5}
                        fill="#ffffff"
                        stroke={newZoneColor}
                        strokeWidth={2}
                      />
                    ))}
                    {newPoints.length >= 2 && (
                      <polyline
                        points={newPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                        fill="none"
                        stroke={newZoneColor}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                    )}
                  </g>
                )}
              </svg>

              {/* Helper prompt banner */}
              {isDrawingNew && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-cyan-600/90 text-white text-xs font-medium shadow-lg pointer-events-none">
                  {t(
                    `انقر لتحديد زوايا المضلع (النقاط المحددة: ${newPoints.length})`,
                    `Click to place polygon corners (Points: ${newPoints.length})`
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              {isDrawingNew
                ? t('انقر بالماوس على شاشة البث لوضع نقاط المنطقة، ثم اضغط "اعتماد المنطقة"', 'Click on stream to set polygon corners, then click "Complete Zone"')
                : t('حدد منطقة من القائمة لمراجعتها أو اضغط "إضافة منطقة جديدة"', 'Select a zone from the list or click "Add New Zone"')}
            </p>
          </div>

          {/* Right Sidebar: Zones List & Creator */}
          <div className="flex flex-col gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            {!isDrawingNew ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200">
                    {t('المناطق المعرفة بالكاميرا', 'Defined Camera Zones')} ({zones.length})
                  </h3>
                  <button
                    onClick={() => {
                      setIsDrawingNew(true);
                      setNewPoints([]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('إضافة منطقة', 'Add Zone')}</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {zones.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      {t('لا توجد مناطق معرفة حتى الآن', 'No zones defined yet')}
                    </div>
                  ) : (
                    zones.map(zone => (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                          selectedZoneId === zone.id
                            ? 'bg-slate-900 border-cyan-500/80 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: zone.color }}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-100">{zone.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {zone.type} • {zone.polygon.length} {t('نقاط', 'pts')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* New Zone Form */
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  {t('إعدادات المنطقة الجديدة', 'New Zone Settings')}
                </h3>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {t('اسم المنطقة:', 'Zone Name:')}
                  </label>
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={e => setNewZoneName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {t('نوع الاستخدام والتحليل:', 'Zone Type:')}
                  </label>
                  <select
                    value={newZoneType}
                    onChange={e => setNewZoneType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="COUNTING">{t('عد وحصر مخزون (Inventory Counting)', 'Inventory Counting')}</option>
                    <option value="INTRUSION">{t('كشف اختراق وتسلل (Intrusion Detection)', 'Intrusion Detection')}</option>
                    <option value="LOITERING">{t('كشف التسكع المفرط (Loitering Detection)', 'Loitering Detection')}</option>
                    <option value="EXCLUSION">{t('منطقة استبعاد وعدم كشف (Exclusion)', 'Exclusion Zone')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {t('لون التمييز:', 'Highlight Color:')}
                  </label>
                  <div className="flex items-center gap-2">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewZoneColor(c)}
                        className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                          newZoneColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleFinishNewZone}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{t('اعتماد وحفظ المنطقة', 'Complete & Save Zone')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawingNew(false);
                      setNewPoints([]);
                    }}
                    className="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                  >
                    {t('إلغاء', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
