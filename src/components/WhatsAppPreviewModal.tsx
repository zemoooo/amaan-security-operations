import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Smartphone, 
  ShieldAlert, 
  CheckCheck, 
  ExternalLink, 
  Phone, 
  PhoneCall, 
  Sliders, 
  History, 
  CheckCircle2, 
  Sparkles,
  Volume2,
  Lock,
  Save,
  MessageSquare,
  QrCode,
  RefreshCw,
  Wifi
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { WhatsAppAlertMode, SeverityLevel } from '../types';

interface WhatsAppPreviewModalProps {
  onClose: () => void;
  eventDetails?: {
    cameraName: string;
    time: string;
    person: string;
    severity: string;
    reason: string;
    reviewUrl: string;
  };
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  onClose,
  eventDetails = {
    cameraName: 'الكاميرا المحددة',
    time: new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
    person: 'يحددها التحليل الفعلي',
    severity: 'HIGH',
    reason: 'تفاصيل الحدث الفعلي من Agent',
    reviewUrl: '',
  },
}) => {
  const { t } = useLanguageTheme();
  const { 
    customerWhatsAppSettings, 
    updateCustomerWhatsAppSettings, 
    dispatchWhatsAppAlert,
    whatsappDispatchLogs 
  } = useLiveCCTV();

  const [activeTab, setActiveTab] = useState<'CONFIG' | 'CONNECT' | 'PREVIEW' | 'HISTORY'>('CONFIG');
  const [instanceName, setInstanceName] = useState(customerWhatsAppSettings.instanceName || '');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [waState, setWaState] = useState<string>('unknown');
  const [qrLoading, setQrLoading] = useState(false);

  // Form local state
  const [phoneNumber, setPhoneNumber] = useState(customerWhatsAppSettings.phoneNumber || '');
  const [customerName, setCustomerName] = useState(customerWhatsAppSettings.customerName || '');
  const [enabled, setEnabled] = useState(customerWhatsAppSettings.enabled);
  const [alertMode, setAlertMode] = useState<WhatsAppAlertMode>(customerWhatsAppSettings.alertMode || 'MESSAGE_ONLY');
  const [minSeverity, setMinSeverity] = useState<SeverityLevel>(customerWhatsAppSettings.minSeverity || 'MEDIUM');
  const [callRingtoneEnabled, setCallRingtoneEnabled] = useState(customerWhatsAppSettings.callRingtoneEnabled);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSentFeedback, setMessageSentFeedback] = useState<string | null>(null);

  const loadQr = async () => {
    setQrLoading(true);
    try {
      const name = instanceName.trim();
      if (!name) throw new Error('instanceName مطلوب');
      await updateCustomerWhatsAppSettings({ instanceName: name });
      const create = await fetch('/api/whatsapp/instance/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceName: name }) });
      const data = await create.json();
      if (!create.ok || !data.success) throw new Error(data.error || 'تعذر إنشاء جلسة Evolution');
      if (data.base64) setQrImage(data.base64);
      setWaState(data.state || 'unknown');
      if (!data.base64 && !['open', 'connected', 'CONNECTED'].includes(String(data.state))) {
        const qr = await fetch(`/api/whatsapp/qr/${encodeURIComponent(name)}`);
        const qd = await qr.json();
        if (qd.base64) setQrImage(qd.base64);
        if (qd.state) setWaState(qd.state);
      }
    } catch (e: any) { setWaState('error'); setMessageSentFeedback(e.message || 'تعذر ربط Evolution API'); } finally { setQrLoading(false); }
  };

  React.useEffect(() => {
    if (activeTab !== 'CONNECT' || !instanceName.trim()) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/whatsapp/status/${encodeURIComponent(instanceName.trim())}`);
        const data = await res.json();
        if (data.state) setWaState(data.state);
        if (String(data.state).toLowerCase() === 'open') setQrImage(null);
      } catch {}
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeTab, instanceName]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await updateCustomerWhatsAppSettings({
      phoneNumber: phoneNumber.trim(),
      customerName: customerName.trim(),
      enabled,
      instanceName: instanceName.trim(),
      alertMode,
      minSeverity,
      callRingtoneEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestSendMessage = async () => {
    setIsSendingMessage(true);
    setMessageSentFeedback(null);
    try {
      await dispatchWhatsAppAlert({
        action: 'MESSAGE',
        incidentTitle: 'تجربة تنبيه واتساب للعميل',
        reason: 'اختبار نجاح ربط رقم العميل واستلام الإشعارات الميدانية',
        cameraName: eventDetails.cameraName,
        severity: 'HIGH',
      });
      setMessageSentFeedback(t(
        `تم إرسال رسالة تجريبية بنجاح إلى الرقم: ${phoneNumber}`,
        `Test message successfully sent to: ${phoneNumber}`
      ));
    } catch {
      setMessageSentFeedback(t('تعذر الإرسال، تحقق من صحة الرقم', 'Dispatch failed, please check number'));
    } finally {
      setIsSendingMessage(false);
      setTimeout(() => setMessageSentFeedback(null), 4500);
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        id="whatsapp-preview-modal-dialog"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {t('إدارة تنبيهات ومكالمات WhatsApp للعميل', 'Customer WhatsApp Alerts & Voice Calling')}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  LIVE AGENT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t(
                  'يدخل العميل رقمه ويقوم الذكاء الاصطناعي بإرسال إشعار فوري أو الاتصال به عند حدوث أمر مريب',
                  'Customer enters phone number; AI agent dispatches instant message or initiates voice call on suspicious events'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('CONFIG')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'CONFIG'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('إعدادات رقم العميل وخيارات التنبيه', 'Customer Settings & Alert Mode')}</span>
          </button>

          <button type="button" onClick={() => setActiveTab('CONNECT')} className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${activeTab === 'CONNECT' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}><QrCode className="w-4 h-4" /><span>{t('ربط الهاتف QR', 'Connect Phone')}</span></button>

          <button
            type="button"
            onClick={() => setActiveTab('PREVIEW')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'PREVIEW'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('معاينة رسالة التنبيه', 'Alert Message Preview')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t('سجل الإشعارات والاتصالات', 'Dispatch History')}</span>
            {whatsappDispatchLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {whatsappDispatchLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'CONFIG' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Toggle switch for auto dispatch */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    {t('تفعيل التنبيه التلقائي عبر الواتساب', 'Enable Autonomous WhatsApp Alerting')}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'يقوم وكيل الذكاء الاصطناعي بمراسلة العميل أو الاتصال به هاتفياً عند رصد أي سلوك مريب',
                      'AI agent automatically messages or rings client on suspicious anomalies'
                    )}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Customer Phone & Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t('رقم واتساب العميل (مع الرمز الدولي)', 'Client WhatsApp Number (with Country Code)')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      dir="ltr"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder=""
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500">📱</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {t('مثال:  للسعودية، أو +971501234567 للإمارات', 'e.g.  or +971501234567')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t('اسم العميل / صفة المستلم', 'Customer Name / Recipient Title')}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="م. "
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="text-[10px] text-slate-500">
                    {t('يستخدم للتوثيق في سجل العمليات وسياق التقرير', 'Used in security audit logs and incident reporting')}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60">
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold"><MessageSquare className="w-4 h-4" /> Evolution API — رسائل WhatsApp الحقيقية فقط</div>
                <p className="text-[11px] text-slate-400 mt-1">سيقوم Agent بإرسال رسالة فعلية إلى رقم المشرف عند تحقق شروط التنبيه. لا توجد مكالمات أو محاكاة محلية.</p>
              </div>

              {/* Minimum Severity Filter */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-300 font-bold block">{t('حساسية التنبيه (Minimum Severity Trigger):', 'Minimum Trigger Severity:')}</span>
                  <span className="text-[11px] text-slate-500">
                    {t('الحد الأدنى لدرجة الخطورة لتفعيل إرسال الواتساب', 'Events below this threshold will not trigger phone alerts')}
                  </span>
                </div>
                <select
                  value={minSeverity}
                  onChange={e => setMinSeverity(e.target.value as SeverityLevel)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="MEDIUM">{t('متوسط فأعلى (سرقة، تسلل، تسكع)', 'Medium+ (Theft, Intrusion, Loitering)')}</option>
                  <option value="HIGH">{t('عالي فأعلى (اقتحام سياج، سرقة)', 'High+ (Fence Intrusion, Theft)')}</option>
                  <option value="CRITICAL">{t('حرج فقط (اشتباه جنائي وسرقة مؤكدة)', 'Critical Only (Confirmed Theft)')}</option>
                </select>
              </div>

              {/* Action Buttons: Save & Quick Live Tests */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{t('حفظ إعدادات رقم العميل', 'Save Customer Settings')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestSendMessage}
                  disabled={isSendingMessage}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingMessage ? t('جارٍ الإرسال...', 'Sending...') : t('تجربة إرسال رسالة للعميل', 'Test WhatsApp Message')}</span>
                </button>
              </div>

              {/* Saved feedback */}
              {savedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs text-center font-medium flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t('تم حفظ وتفعيل رقم العميل بنجاح! الوكيل جاهز للتنبيه عند أي أمر مريب.', 'Customer settings saved successfully! Agent is armed and ready.')}</span>
                </div>
              )}

              {messageSentFeedback && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-600/60 text-emerald-300 text-xs text-center font-medium animate-in fade-in">
                  {messageSentFeedback}
                </div>
              )}
            </form>
          )}

          {activeTab === 'CONNECT' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800"><h3 className="font-bold text-slate-100 flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-400" />{t('ربط واتساب العميل عبر Evolution API', 'Connect customer WhatsApp via Evolution API')}</h3><p className="text-[11px] text-slate-400 mt-1">{t('اضغط إنشاء QR ثم امسح الرمز من الهاتف: واتساب ← الأجهزة المرتبطة ← ربط جهاز.', 'Create the QR then scan it from WhatsApp → Linked devices → Link a device.')}</p></div>
              <div className="grid grid-cols-2 gap-3"><input value={instanceName} onChange={e=>setInstanceName(e.target.value)} placeholder="aman_customer_01" className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100" /><button onClick={loadQr} disabled={qrLoading} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center gap-2"><RefreshCw className={`w-4 h-4 ${qrLoading ? 'animate-spin' : ''}`} />{t('إنشاء / تحديث QR','Create / Refresh QR')}</button></div>
              <div className="text-center text-xs text-slate-400">{t('حالة الجلسة:', 'Session status:')} <span className="font-mono text-emerald-300">{waState}</span></div>
              <div className="min-h-64 rounded-2xl bg-white flex items-center justify-center p-6">{qrImage ? <img src={qrImage} alt="WhatsApp QR" className="w-64 h-64 object-contain" /> : <div className="text-slate-500 text-xs">{t('لم يتم توليد QR بعد','QR not generated yet')}</div>}</div>
              <p className="text-[10px] text-amber-300/80">{t('هذا الربط يستخدم جلسة واتساب عبر Evolution API. لا تضع API Key في المتصفح؛ يبقى في Render كمتغير سري.', 'This uses an Evolution API WhatsApp session. Never put the API key in the browser; keep it in Render secrets.')}</p>
            </div>
          )}

          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t('المستلم المستهدف:', 'Target Recipient:')} <strong className="text-slate-200 font-mono">{phoneNumber}</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Evolution API Ready
                </span>
              </div>

              {/* Smartphone Chat Mockup Frame */}
              <div className="rounded-3xl border-4 border-slate-700 bg-[#0b141a] overflow-hidden shadow-2xl flex flex-col max-w-md mx-auto">
                {/* Phone Top Bar */}
                <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Aman AI CCTV Agent</h4>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        حساب أعمال رسمي موثق
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{eventDetails.time}</span>
                </div>

                {/* Message Bubble Body */}
                <div className="p-4 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                  <div className="max-w-[95%] bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md space-y-2 text-xs leading-relaxed">
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs pb-1 border-b border-emerald-700/50">
                      <ShieldAlert className="w-4 h-4" />
                      <span>🚨 تنبيه أمني عاجل: تم اكتشاف نشاط مشبوه</span>
                    </div>

                    <div className="space-y-1 text-slate-100 text-[11px]">
                      
                      <p><strong className="text-emerald-200">الكاميرا:</strong> {eventDetails.cameraName}</p>
                      <p><strong className="text-emerald-200">الوقت:</strong> {eventDetails.time}</p>
                      <p><strong className="text-emerald-200">الشخص:</strong> {eventDetails.person}</p>
                      <p><strong className="text-emerald-200">مستوى الخطورة:</strong> <span className="text-rose-300 font-bold">{eventDetails.severity}</span></p>
                      <p><strong className="text-emerald-200">السبب:</strong> {eventDetails.reason}</p>
                    </div>

                    {/* Direct Action Link in WhatsApp message */}
                    <div className="pt-2 border-t border-emerald-700/60">
                      <div className="p-2 rounded-xl bg-[#025144] border border-emerald-600/40 text-[11px] text-cyan-200 flex items-center justify-between">
                        <span>رابط مراجعة الحادث إذا وفره النظام</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/80 pt-1">
                      <span>{eventDetails.time}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons under preview */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestSendMessage}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال هذه الرسالة إلى {phoneNumber}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t('سجل الإرسال والاتصالات المسجلة على النظام:', 'WhatsApp Message Audit Log:')}</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {whatsappDispatchLogs.length} {t('عملية مسجلة', 'records logged')}
                </span>
              </div>

              {whatsappDispatchLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  {t('لم يتم إرسال أي تنبيهات بعد. جرب إرسال رسالة اختبار حقيقية.', 'No alerts dispatched yet. Send a real test message.')}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {whatsappDispatchLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          log.action === 'CALL' || log.action === 'BOTH'
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}>
                          {log.action === 'CALL' ? (
                            <Phone className="w-4 h-4" />
                          ) : log.action === 'BOTH' ? (
                            <PhoneCall className="w-4 h-4" />
                          ) : (
                            <MessageSquare className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{log.incidentTitle}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-900">
                              {log.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {log.recipient} • {log.timestamp}
                          </p>
                          {log.notes && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{log.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {log.status}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-1">
                          {log.provider}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
