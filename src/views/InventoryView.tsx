import React, { useState } from 'react';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Truck, 
  ArrowRight, 
  Layers, 
  Video, 
  RefreshCw,
  Plus,
  ShieldAlert
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { InventoryProduct } from '../types';

interface InventoryViewProps {
  onOpenZoneDrawer: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onOpenZoneDrawer }) => {
  const { t } = useLanguageTheme();
  const { 
    inventoryProducts, 
    outgoingEvents, 
    triggerInventoryCountUpdate 
  } = useLiveCCTV();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'OUTGOING'>('PRODUCTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDiscrepancyOnly, setFilterDiscrepancyOnly] = useState(false);

  // Calibrate modal state
  const [calibratingProduct, setCalibratingProduct] = useState<InventoryProduct | null>(null);
  const [manualCountInput, setManualCountInput] = useState<number>(0);

  const filteredProducts = inventoryProducts.filter(p => {
    if (filterDiscrepancyOnly && p.difference === 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.warehouseZone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const discrepanciesCount = inventoryProducts.filter(p => p.difference !== 0).length;

  const handleOpenCalibrate = (p: InventoryProduct) => {
    setCalibratingProduct(p);
    setManualCountInput(p.aiDetectedQuantity);
  };

  const handleSaveCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calibratingProduct) return;
    triggerInventoryCountUpdate(calibratingProduct.id, manualCountInput);
    setCalibratingProduct(null);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('رؤية مخزون المستودعات وتتبع الخروج (Warehouse Computer Vision)', 'Warehouse Vision & Inventory Tracking')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'حصر الصناديق عبر الرؤية الحاسوبية، مطابقة الكمية مع ERP، وتتبع خروج المنتجات عبر عدة كاميرات.',
              'Automated bounding-box counting across shelf zones with ERP discrepancy alerts & multi-camera movement tracking.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenZoneDrawer}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>{t('تحديد مناطق رفوف جديدة (Zones)', 'Draw Shelf Zones')}</span>
          </button>
        </div>
      </div>

      {/* Discrepancy Banner if variance detected */}
      {discrepanciesCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-700/80 text-xs text-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-bold">
                {t(
                  `تم رصد ${discrepanciesCount} فارق في المخزون بين الرؤية الحاسوبية والكميات المتوقعة!`,
                  `${discrepanciesCount} inventory discrepancies detected between CV count & expected records!`
                )}
              </p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                {t(
                  'تحقق من كاميرا ممر الرفوف 04 للتحقق من اختفاء الصناديق أو إزالتها بدون إذن صرف رسمي.',
                  'Review Warehouse Rack 04 feed to verify carton removal without registered stock dispatch.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterDiscrepancyOnly(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer flex-shrink-0"
          >
            {t('تصفية الفوارق فقط', 'View Discrepancies')}
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'PRODUCTS' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{t('حصر المخزون بالرؤية الحاسوبية', 'Vision Inventory Stock')} ({inventoryProducts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('OUTGOING')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'OUTGOING' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{t('تتبع خروج المنتجات (Multi-Camera)', 'Multi-Cam Outgoing Items')} ({outgoingEvents.length})</span>
          </button>
        </div>

        {activeTab === 'PRODUCTS' && (
          <div className="flex items-center gap-2.5 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('بحث عن SKU أو صنف...', 'Search SKU or product...')}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
              />
            </div>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filterDiscrepancyOnly}
                onChange={e => setFilterDiscrepancyOnly(e.target.checked)}
                className="rounded text-amber-500"
              />
              <span>{t('الفوارق فقط', 'Discrepancies Only')}</span>
            </label>
          </div>
        )}
      </div>

      {/* Content Table or Timeline */}
      {activeTab === 'PRODUCTS' ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="p-4">{t('المنتج / الصنف', 'Product / SKU')}</th>
                  <th className="p-4">{t('منطقة الرف والكاميرا', 'Shelf Zone & Camera')}</th>
                  <th className="p-4 text-center">{t('العدد المتوقع (ERP)', 'Expected')}</th>
                  <th className="p-4 text-center">{t('رصد الذكاء الاصطناعي (AI)', 'AI Detected')}</th>
                  <th className="p-4 text-center">{t('الفارق (Variance)', 'Variance')}</th>
                  <th className="p-4">{t('الحالة', 'Status')}</th>
                  <th className="p-4 text-center">{t('المعايرة اليدوية', 'Calibrate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-slate-100">{prod.name}</p>
                        <span className="text-[10px] text-slate-500 font-mono">{prod.sku}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-200 block">{prod.warehouseZone}</span>
                        <span className="text-[10px] text-cyan-400 font-mono">{prod.cameraName}</span>
                      </div>
                    </td>

                    <td className="p-4 text-center font-mono font-bold text-slate-200">
                      {prod.expectedQuantity}
                    </td>

                    <td className="p-4 text-center font-mono font-bold text-cyan-300">
                      {prod.aiDetectedQuantity}
                    </td>

                    <td className="p-4 text-center font-mono font-bold">
                      {prod.difference === 0 ? (
                        <span className="text-emerald-400">0</span>
                      ) : prod.difference < 0 ? (
                        <span className="text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                          {prod.difference} ({t('نقص', 'Shortage')})
                        </span>
                      ) : (
                        <span className="text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                          +{prod.difference} ({t('زيادة', 'Surplus')})
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          prod.status === 'NORMAL'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : prod.status === 'DISCREPANCY'
                            ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                            : 'bg-amber-950 text-amber-300 border-amber-800'
                        }`}
                      >
                        {prod.status === 'NORMAL'
                          ? t('متطابق', 'Normal')
                          : prod.status === 'DISCREPANCY'
                          ? t('يوجد فارق', 'Discrepancy')
                          : t('مخزون منخفض', 'Low Stock')}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenCalibrate(prod)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs transition cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>{t('معايرة', 'Calibrate')}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Multi-Camera Outgoing Tracking Feed */
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <h3 className="font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              <span>{t('تتبع خروج البضائع عبر عدة كاميرات متزامنة (Cross-Camera Journey)', 'Multi-Camera Outgoing Journey')}</span>
            </h3>
            <p className="text-slate-400 text-[11px]">
              {t(
                'يتم تتبع مسار الصناديق من لحظة سحبها من الرف حتى تحميلها في شاحنة النقل، ومطابقتها الفورية مع أذون الصرف الرسمية.',
                'Tracks pallets from shelf pick to loading dock. Flags suspicious unpermitted moves automatically.'
              )}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {outgoingEvents.map(evt => (
              <div
                key={evt.id}
                className={`p-5 rounded-3xl border flex flex-col gap-4 shadow-xl ${
                  evt.isAuthorized
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-rose-950/20 border-rose-900/60 ring-1 ring-rose-500/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          evt.isAuthorized
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}
                      >
                        {evt.isAuthorized ? t('خروج مصرح به (Authorized)', 'Authorized') : t('اشتباه خروج غير مصرح به (Suspicious)', 'Suspicious Outgoing')}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{evt.productName}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block mt-1">
                      SKU: {evt.sku} • {t('الكمية الخارجة:', 'Quantity:')} {evt.quantity} • {t('الباب:', 'Gate:')} {evt.doorUsed}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-500">{evt.timestamp}</span>
                </div>

                {/* Camera Path Stepper */}
                <div className="flex items-center gap-2 overflow-x-auto py-2">
                  {evt.cameraPath.map((cam, idx) => (
                    <React.Fragment key={idx}>
                      <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 flex-shrink-0">
                        <Video className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{cam}</span>
                      </div>
                      {idx < evt.cameraPath.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {t('إذن الصرف الرسمي:', 'Work Permit:')}{' '}
                    <strong className={evt.workPermitId ? 'text-emerald-400' : 'text-rose-400'}>
                      {evt.workPermitId || t('غير مسجل (لا يوجد إذن صرف)', 'None (Unregistered)')}
                    </strong>
                  </span>
                  <span>
                    {t('المشغل / الموظف:', 'Operator:')}{' '}
                    <strong className="text-slate-200">{evt.personIdentified || t('شخص مجهول', 'Unknown')}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Calibration Modal */}
      {calibratingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>{t('معايرة عداد الرؤية الحاسوبية يدوياً', 'Manual Vision Counter Calibration')}</span>
            </h3>

            <p className="text-xs text-slate-400">
              {t('معايرة الصنف:', 'Calibrating product:')}{' '}
              <strong className="text-slate-200">{calibratingProduct.name}</strong> ({calibratingProduct.sku})
            </p>

            <form onSubmit={handleSaveCalibration} className="space-y-4 text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('الكمية المتوقعة في السجلات:', 'Expected Quantity:')}</span>
                  <span className="font-mono font-bold text-slate-200">{calibratingProduct.expectedQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('رصد الكاميرا الحالي:', 'Current AI Detection:')}</span>
                  <span className="font-mono font-bold text-cyan-400">{calibratingProduct.aiDetectedQuantity}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  {t('أدخل العدد الفعلي المؤكد بعد التدقيق البصري:', 'Verified Actual Count:')}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={manualCountInput}
                  onChange={e => setManualCountInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-base font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                {t(
                  'سيتم تحديث كمية الرؤية وتوثيق المعايرة في سجل التدقيق غير القابل للتعديل.',
                  'This manual calibration will be logged in the immutable audit log.'
                )}
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalibratingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition cursor-pointer"
                >
                  {t('حفظ المعايرة وتوثيق السجل', 'Save Calibration & Audit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
