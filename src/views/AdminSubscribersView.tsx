import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Users, 
  CreditCard, 
  Laptop, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Copy, 
  Check, 
  MessageSquare, 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  Lock, 
  Unlock, 
  DollarSign, 
  Send, 
  Mail, 
  Phone, 
  Building, 
  Calendar,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { LicensePeriod, SubscriberRecord } from '../types';

export const AdminSubscribersView: React.FC = () => {
  const { 
    machineId: currentMachineId, 
    subscribers, 
    financialStats, 
    licensesHistory, 
    loadingAdmin, 
    loadAdminSubscribers, 
    generateKeyForClient, 
    simulateLock,
    activateWithKey,
    isLocked,
    supportPhone,
    supportEmail
  } = useLicense();
  const { currentUser, isSuperAdmin } = useAuth();
  const { t } = useLanguageTheme();

  // Generator form state
  const [targetMachineId, setTargetMachineId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<LicensePeriod>('1_MONTH');
  const [custEmail, setCustEmail] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(185);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Generation output state
  const [generatedResult, setGeneratedResult] = useState<{
    key: string;
    period: string;
    machineId: string;
    whatsappUrl?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [appliedOnCurrent, setAppliedOnCurrent] = useState(false);

  // Table filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'TRIAL'>('ALL');

  // Load real data from server on mount
  useEffect(() => {
    loadAdminSubscribers();
  }, [loadAdminSubscribers]);

  // Adjust default price when period changes
  const handlePeriodChange = (period: LicensePeriod) => {
    setSelectedPeriod(period);
    switch (period) {
      case '2_DAYS':
        setAmountPaid(0);
        break;
      case '1_MONTH':
        setAmountPaid(185);
        break;
      case '3_MONTHS':
        setAmountPaid(480);
        break;
      case '6_MONTHS':
        setAmountPaid(860);
        break;
      case '1_YEAR':
        setAmountPaid(1500);
        break;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMachineId.trim()) {
      alert('يرجى إدخال كود الجهاز (Machine ID)');
      return;
    }

    setGenerating(true);
    setGeneratedResult(null);
    setAppliedOnCurrent(false);

    const res = await generateKeyForClient({
      machineId: targetMachineId.trim().toUpperCase(),
      period: selectedPeriod,
      customerEmail: custEmail.trim(),
      customerName: custName.trim(),
      customerPhone: custPhone.trim(),
      companyName: custCompany.trim(),
      amountPaid: Number(amountPaid) || 0,
      currency: 'SAR',
      notes: notes.trim(),
    });

    setGenerating(false);

    if (res.success && res.activationKey) {
      setGeneratedResult({
        key: res.activationKey,
        period: selectedPeriod,
        machineId: targetMachineId.trim().toUpperCase(),
        whatsappUrl: res.whatsappUrl,
      });
    } else {
      alert(res.error || 'فشل توليد المفتاح');
    }
  };

  const handleCopyKey = async () => {
    if (!generatedResult) return;
    try {
      await navigator.clipboard.writeText(generatedResult.key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleApplyOnCurrentMachine = async () => {
    if (!generatedResult) return;
    const res = await activateWithKey(generatedResult.key);
    if (res.success) {
      setAppliedOnCurrent(true);
      setTimeout(() => setAppliedOnCurrent(false), 3000);
    } else {
      alert(res.error || 'فشل تطبيق المفتاح على هذا الجهاز');
    }
  };

  // Quick fill generator for existing subscriber
  const handleRenewSubscriber = (sub: SubscriberRecord) => {
    setTargetMachineId(sub.machineId);
    setCustEmail(sub.email);
    setCustName(sub.name);
    setCustPhone(sub.phone);
    setCustCompany(sub.companyName);
    handlePeriodChange('1_MONTH');
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // Filter subscribers
  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch = 
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.machineId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && sub.status === statusFilter;
  });

  // حماية إضافية داخل الصفحة نفسها، حتى لو تم الوصول إليها من رابط/حالة مباشرة.
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-fade-in text-right" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              لوحة الإدارة العليا (Super Admin Only)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              المسؤول: {currentUser.email}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            صفحة إدارة النظام والمشتركين وتوليد مفاتيح الأجهزة
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            إدارة اشتراكات العملاء، إصدار مفاتيح التفعيل المربوطة بأكواد الأجهزة لفترات محددة، ومتابعة المبالغ المحصلة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAdminSubscribers()}
            disabled={loadingAdmin}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAdmin ? 'animate-spin text-cyan-400' : ''}`} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Financial & Subscription Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900/90 border border-emerald-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">إجمالي المبالغ المحصلة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {financialStats.totalRevenue.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-300">{financialStats.currency}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">سداد مباشر عبر التراخيص</span>
        </div>

        {/* Active Subscribers */}
        <div className="bg-slate-900/90 border border-cyan-500/30 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400">المشتركون النشطون</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {financialStats.activeSubscribersCount}
            </span>
            <span className="text-xs font-bold text-cyan-300">أجهزة مرخصة</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">يعملون بدون قفل</span>
        </div>

        {/* Expired / Locked */}
        <div className="bg-slate-900/90 border border-rose-500/30 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400">الاشتراكات المنتهية (المقفلة)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-700/60 flex items-center justify-center text-rose-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-400">
              {financialStats.expiredCount}
            </span>
            <span className="text-xs font-bold text-rose-300">أجهزة مقفلة</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">بانتظار تجديد المفتاح</span>
        </div>

        {/* Trial Subscriptions */}
        <div className="bg-slate-900/90 border border-amber-500/30 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">فترة تجريبية (يومان)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {financialStats.trialCount}
            </span>
            <span className="text-xs font-bold text-amber-300">مشتركين جدد</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">تجربة مجانية</span>
        </div>

        {/* Total Keys Generated */}
        <div className="bg-slate-900/90 border border-purple-500/30 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400">إجمالي المفاتيح المولدة</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-400">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {financialStats.totalKeysGenerated}
            </span>
            <span className="text-xs font-bold text-purple-300">مفتاح مشفر</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">مسجل في قاعدة البيانات</span>
        </div>
      </div>

      {/* Key Generation Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                توليد مفتاح تفعيل لجهاز عميل (Hardware License Key Generator)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                يقوم العميل بإرسال كود جهازه الحصري، وتقوم أنت باختيار المدة والمبلغ لتوليد مفتاح التفعيل المشفر.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Target Machine ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-cyan-400" />
                كود جهاز العميل (Client Machine ID) *
              </label>
              <button
                type="button"
                onClick={() => setTargetMachineId(currentMachineId)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
              >
                استخدام كود هذا الجهاز الحالي ({currentMachineId})
              </button>
            </div>
            <input
              type="text"
              required
              value={targetMachineId}
              onChange={(e) => setTargetMachineId(e.target.value.toUpperCase())}
              placeholder="مثال: AMAN-DEV-98A2-F41C"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-cyan-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2.5">
              مدة صلاحية الترخيص *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: '2_DAYS' as LicensePeriod, label: 'يومان', sub: 'تجريبي مجاني', price: 0 },
                { id: '1_MONTH' as LicensePeriod, label: 'شهر واحد', sub: 'اشتراك شهري', price: 185 },
                { id: '3_MONTHS' as LicensePeriod, label: '3 أشهر', sub: 'اشتراك ربع سنوي', price: 480 },
                { id: '6_MONTHS' as LicensePeriod, label: '6 أشهر', sub: 'نصف سنوي', price: 860 },
                { id: '1_YEAR' as LicensePeriod, label: 'سنة كاملة', sub: 'سنوي معتمد', price: 1500 },
              ].map((p) => {
                const isSelected = selectedPeriod === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePeriodChange(p.id)}
                    className={`p-3.5 rounded-2xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-cyan-950/80 to-blue-950/40 border-cyan-400 text-cyan-200 shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-extrabold">{p.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{p.sub}</div>
                    <div className="text-xs font-bold text-amber-400 mt-1">
                      {p.price === 0 ? 'مجاناً' : `${p.price} ر.س`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">البريد الإلكتروني للعميل</label>
              <input
                type="email"
                value={custEmail}
                onChange={(e) => setCustEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم العميل</label>
              <input
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="مثال: م. أحمد الشمري"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رقم الواتساب للعميل</label>
              <input
                type="text"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="+9665XXXXXXXX"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المحصل (ر.س)</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>المفتاح الناتج لن يعمل إلا على هذا الجهاز حصراً، وعند انتهاء المدة سيقفل البرنامج تلقائياً.</span>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-xl shadow-amber-950/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generating ? <Clock className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {generating ? 'جاري تشفير وتوليد المفتاح...' : 'توليد مفتاح التفعيل المعتمد 🔑'}
            </button>
          </div>
        </form>

        {/* Generated Key Result Box */}
        {generatedResult && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-950 border-2 border-amber-500/60 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>تم توليد مفتاح التفعيل بنجاح لجهاز [{generatedResult.machineId}]:</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800">
                جاهز للإرسال للعميل
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
              <code className="text-xl md:text-2xl font-mono font-black text-amber-300 tracking-wider select-all">
                {generatedResult.key}
              </code>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? 'تم النسخ' : 'نسخ المفتاح'}
                </button>

                {generatedResult.whatsappUrl && (
                  <a
                    href={generatedResult.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    إرسال واتساب للعميل
                  </a>
                )}
              </div>
            </div>

            {/* Quick self-apply button if generated for current machine */}
            {generatedResult.machineId === currentMachineId && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  تم توليد هذا المفتاح لكود جهازك الحالي ({currentMachineId}):
                </span>
                <button
                  type="button"
                  onClick={handleApplyOnCurrentMachine}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  {appliedOnCurrent ? '✓ تم تطبيق وتفعيل الترخيص على هذا الجهاز!' : 'تطبيق وتفعيل المفتاح على هذا الجهاز فوراً'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lock Testing & Simulation Controls for Admin */}
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              اختبار آلية قفل البرنامج على هذا الجهاز (Simulation Testing)
            </h4>
            <p className="text-xs text-slate-400">
              يمكنك محاكاة انتهاء الصلاحية فوراً للتحقق من ظهور شاشة القفل وتجربة فكها بالمفتاح.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => simulateLock(currentMachineId, true)}
            className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            قفل البرنامج على جهازي الآن (تجربة القفل)
          </button>

          <button
            onClick={() => simulateLock(currentMachineId, false)}
            className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Unlock className="w-3.5 h-3.5" />
            فك القفل فوراً
          </button>
        </div>
      </div>

      {/* Subscribers Table Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              سجل المشتركين والأجهزة المربوطة ({filteredSubscribers.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              كافة حسابات العملاء المسجلين بإيميلاتهم وحالة تراخيص أجهزتهم والمبالغ المدفوعة.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الإيميل، أو كود الجهاز..."
                className="pr-9 pl-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">كافة الحالات</option>
              <option value="ACTIVE">النشطة فقط</option>
              <option value="EXPIRED">المنتهية (المقفلة)</option>
              <option value="TRIAL">التجريبية</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                <th className="pb-3 px-3">العميل / المنشأة</th>
                <th className="pb-3 px-3">كود الجهاز (Hardware ID)</th>
                <th className="pb-3 px-3">الحالة والمدة</th>
                <th className="pb-3 px-3">تاريخ الانتهاء</th>
                <th className="pb-3 px-3">إجمالي المبالغ</th>
                <th className="pb-3 px-3 text-center">إجراءات الإدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا يوجد مشتركون مطابقون لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => {
                  const lic = sub.currentLicense;
                  const isDeviceLocked = lic?.isLocked || sub.status === 'EXPIRED';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition">
                      {/* Name & Contact */}
                      <td className="py-4 px-3">
                        <div className="font-bold text-slate-200">{sub.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-cyan-400" />
                          <span>{sub.email}</span>
                        </div>
                        {sub.phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{sub.phone}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5">{sub.companyName}</div>
                      </td>

                      {/* Machine ID */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5">
                          <code className="px-2 py-1 bg-slate-950 rounded-lg text-cyan-300 font-mono text-[11px] border border-slate-800 select-all">
                            {sub.machineId}
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(sub.machineId)}
                            className="p-1 hover:text-cyan-400 text-slate-500 transition cursor-pointer"
                            title="نسخ كود الجهاز"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Status & Period */}
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                : sub.status === 'EXPIRED'
                                ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                                : 'bg-amber-950/60 text-amber-300 border-amber-800'
                            }`}
                          >
                            {sub.status === 'ACTIVE' ? 'نشط (مفعل)' : sub.status === 'EXPIRED' ? 'منتهي (مقفل)' : 'فترة تجريبية'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {lic?.periodLabelAr || 'ترخيص أساسي'}
                          </span>
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-4 px-3 text-slate-300">
                        {lic?.expiresAt ? (
                          <div>
                            <span className="font-mono text-[11px]">
                              {new Date(lic.expiresAt).toLocaleDateString('ar-SA')}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {new Date(lic.expiresAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">غير محدد</span>
                        )}
                      </td>

                      {/* Total Amount Paid */}
                      <td className="py-4 px-3">
                        <span className="font-bold text-emerald-400 text-sm">
                          {Number(sub.totalPaid || 0).toLocaleString()} ر.س
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRenewSubscriber(sub)}
                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="توليد مفتاح تفعيل/تجديد لهذا المشترك"
                          >
                            <KeyRound className="w-3 h-3" />
                            توليد مفتاح
                          </button>

                          {isDeviceLocked ? (
                            <button
                              type="button"
                              onClick={() => simulateLock(sub.machineId, false)}
                              className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded-lg transition cursor-pointer"
                              title="فك قفل هذا الجهاز"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => simulateLock(sub.machineId, true)}
                              className="p-1.5 bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-800 rounded-lg transition cursor-pointer"
                              title="قفل البرنامج على هذا الجهاز فوراً"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {sub.phone && (
                            <a
                              href={`https://wa.me/${sub.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 border border-emerald-700/60 rounded-lg transition"
                              title="مراسلة واتساب"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
