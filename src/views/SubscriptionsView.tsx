import React, { useState } from 'react';
import { 
  CreditCard, 
  Check, 
  ShieldCheck, 
  Video, 
  Laptop, 
  Clock, 
  Zap, 
  ArrowUpRight,
  Sparkles,
  KeyRound,
  Copy,
  MessageSquare,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';

export const SubscriptionsView: React.FC = () => {
  const { t } = useLanguageTheme();
  const { currentTenant, addAuditLog } = useAuth();
  const { 
    machineId, 
    license, 
    isLocked, 
    daysRemaining, 
    activateWithKey, 
    supportPhone, 
    supportEmail 
  } = useLicense();

  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'>('PROFESSIONAL');
  const [upgradedNotice, setUpgradedNotice] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyMachineCode = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setActivating(true);
    setActivationMsg(null);

    const res = await activateWithKey(inputKey.trim());
    setActivating(false);

    if (res.success) {
      setActivationMsg({ type: 'success', text: 'تم تفعيل الترخيص وتمديد الصلاحية بنجاح على هذا الجهاز!' });
      setInputKey('');
    } else {
      setActivationMsg({ type: 'error', text: res.error || 'فشل التفعيل. يرجى التأكد من صحة المفتاح وكود الجهاز.' });
    }
  };

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم ورحمة الله، أرغب في تجديد أو تفعيل ترخيص برنامج المراقبة Aman AI CCTV.\nكود جهازي هو: ${machineId}`
  );
  const adminWhatsAppUrl = `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

  const plans = [
    {
      id: 'STARTER' as const,
      name: t('الباقة الأساسية (Starter)', 'Starter Plan'),
      price: '$149',
      period: t('/ شهرياً', '/ month'),
      cameraLimit: 'حتى 4 كاميرات RTSP',
      retentionDays: '15 يوماً احتفاظ بالأدلة',
      agentNodes: 'جهاز Windows Edge واحد',
      aiFeatures: [
        'كشف التسكع والتسلل',
        'حضور وانصراف بالوجه (حتى 25 موظف)',
        'تنبيهات بريد إلكتروني',
      ],
      isPopular: false,
    },
    {
      id: 'PROFESSIONAL' as const,
      name: t('الباقة الاحترافية (Professional)', 'Professional Plan'),
      price: '$399',
      period: t('/ شهرياً', '/ month'),
      cameraLimit: 'حتى 16 كاميرا RTSP',
      retentionDays: '45 يوماً احتفاظ كامل بالأدلة',
      agentNodes: 'حتى 4 أجهزة Windows Edge',
      aiFeatures: [
        'خط أنابيب اشتباه السرقات المتعدد (Theft Pipeline)',
        'حضور ذكي غير محدود مع بوابات إلكترونية',
        'رؤية مخزون المستودعات وتتبع الصناديق',
        'تنبيهات WhatsApp للأعمال الفورية',
        'سجل تدقيق رقابي ISO-27001 غير قابل للحذف',
      ],
      isPopular: true,
    },
    {
      id: 'ENTERPRISE' as const,
      name: t('باقة المنشآت الكبرى (Enterprise)', 'Enterprise Tier'),
      price: '$899',
      period: t('/ شهرياً', '/ month'),
      cameraLimit: 'كاميرات غير محدودة (Unlimited)',
      retentionDays: 'سنة كاملة (365 يوماً)',
      agentNodes: 'أسطول Windows Edge غير محدود',
      aiFeatures: [
        'معالجة متعددة السيرفرات وخوادم GPU مخصصة',
        'تتبع حركة بضائع عبر مئات الكاميرات المتزامنة',
        'تخصيص نماذج AI ومناطق المستودعات المخصصة',
        'تكامل مباشر مع أنظمة SAP / Oracle ERP',
        'دعم فني مخصص 24/7 مع SLA 99.99%',
      ],
      isPopular: false,
    },
  ];

  const handlePlanUpgrade = (planId: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') => {
    setSelectedPlan(planId);
    addAuditLog(
      'UPDATE_CAM_SETTINGS' as any,
      `SubscriptionPlan: ${currentTenant.name}`,
      `ترقية باقة المستأجر إلى الباقة: ${planId}`
    );
    setUpgradedNotice(t(`تم تحديث باقة الاشتراك إلى ${planId} بنجاح!`, `Successfully updated subscription to ${planId}!`));
    setTimeout(() => setUpgradedNotice(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('إدارة باقات الاشتراك والميزات (Multi-Tenant SaaS)', 'SaaS Subscriptions & Tenant Limits')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'عزل كامل لحساب المستأجر وتحديد سعة الكاميرات، مدة حفظ الفيديوهات الجنائية، وأجهزة Windows Agent.',
              'Tenant resource quotas, forensic retention days, camera limits, and enterprise AI add-ons.'
            )}
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{currentTenant.name} • {currentTenant.plan} Plan</span>
        </div>
      </div>

      {/* Hardware Device License Card (Client Machine Code & Key Activation) */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  ترخيص هذا الجهاز (Hardware Device License)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isLocked
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  }`}
                >
                  {isLocked ? 'البرنامج مقفل (منتهي الصلاحية)' : `مفعل (${daysRemaining} يوم متبقي)`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                البرنامج مربوط بكود عتاد هذا الجهاز حصراً. لتجديد الاشتراك، أرسل الكود لإدارة البرنامج للحصول على مفتاح التفعيل.
              </p>
            </div>
          </div>

          {/* WhatsApp Admin Contact */}
          <a
            href={adminWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <MessageSquare className="w-4 h-4" />
            طلب مفتاح تفعيل عبر واتساب الإدارة
          </a>
        </div>

        {/* Machine Code Display & In-Place Key Entry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Machine ID Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                كود هذا الجهاز (Machine ID):
              </span>
              <button
                onClick={handleCopyMachineCode}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-cyan-300 font-bold text-sm tracking-wider select-all break-all">
              {machineId}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>الفترة الحالية: <strong className="text-slate-200">{license?.periodLabelAr || 'فترة تجريبية'}</strong></span>
              <span>تاريخ الانتهاء: <strong className="text-slate-200">{license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString('ar-SA') : 'غير محدد'}</strong></span>
            </div>
          </div>

          {/* Enter Key Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>إدخال مفتاح التفعيل الصادر من الإدارة:</span>
            </div>

            <form onSubmit={handleActivateSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                placeholder="مثال: AMAN-1M-XXXX-XXXX-XXXX"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 uppercase tracking-wider focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={activating || !inputKey.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {activating ? 'جاري التحقق...' : 'تفعيل المفتاح'}
              </button>
            </form>

            {activationMsg && (
              <div
                className={`p-2 rounded-xl text-xs font-bold ${
                  activationMsg.type === 'success'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                {activationMsg.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Quota Consumption Progress */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('استهلاك الكاميرات', 'Camera Slots')}</span>
            <span className="font-mono text-cyan-400 font-bold">5 / {currentTenant.maxCameras}</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(5 / currentTenant.maxCameras) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('مدة حفظ فيديوهات الأدلة', 'Evidence Retention')}</span>
            <span className="font-mono text-cyan-400 font-bold">{currentTenant.retentionDays} {t('يوماً', 'days')}</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('أجهزة Windows Agent', 'Edge Nodes')}</span>
            <span className="font-mono text-cyan-400 font-bold">2 / 4 {t('أجهزة', 'nodes')}</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: '50%' }} />
          </div>
        </div>
      </div>

      {upgradedNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs text-center font-bold">
          {upgradedNotice}
        </div>
      )}

      {/* Plans Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = plan.id === selectedPlan;

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-3xl border flex flex-col justify-between gap-6 transition relative shadow-2xl ${
                isCurrent
                  ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-cyan-600 text-white shadow-md uppercase tracking-wider">
                  الأكثر طلباً للشركات
                </span>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-extrabold text-white font-mono">{plan.price}</span>
                    <span className="text-xs text-slate-400">{plan.period}</span>
                  </div>
                </div>

                {/* Specs List */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>{plan.cameraLimit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{plan.retentionDays}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>{plan.agentNodes}</span>
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 block mb-2">
                    {t('الميزات المضمنة:', 'Included Features:')}
                  </span>
                  {plan.aiFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handlePlanUpgrade(plan.id)}
                className={`w-full py-2.5 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isCurrent
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <span>{isCurrent ? t('الخطة الحالية النشطة', 'Current Active Plan') : t('الترقية إلى هذه الخطة', 'Switch to This Plan')}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
