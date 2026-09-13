import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Phone, 
  Building, 
  Laptop, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles,
  ArrowRight,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { useLanguageTheme } from '../context/LanguageThemeContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'register' }) => {
  const { registerUser, loginUser, switchUser, availableUsers } = useAuth();
  const { machineId, checkLicenseStatus } = useLicense();
  const { t } = useLanguageTheme();

  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'register') {
        if (!email || !name) {
          setErrorMsg('يرجى ملء البريد الإلكتروني والاسم الكامل');
          setLoading(false);
          return;
        }
        const res = await registerUser({
          email,
          password: password || '123456',
          name,
          phone,
          companyName,
          machineId,
        });

        if (res.success) {
          setSuccessMsg('تم إنشاء حسابك وتفعيل ترخيص تجريبي لجهازك بنجاح!');
          await checkLicenseStatus();
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setErrorMsg(res.error || 'فشل التسجيل');
        }
      } else {
        if (!email) {
          setErrorMsg('يرجى إدخال البريد الإلكتروني');
          setLoading(false);
          return;
        }
        const res = await loginUser(email, password);
        if (res.success) {
          setSuccessMsg('تم تسجيل الدخول بنجاح!');
          await checkLicenseStatus();
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setErrorMsg(res.error || 'بيانات الدخول غير صحيحة');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ في معالجة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const handleFastSwitchAdmin = () => {
    const admin = availableUsers.find(u => u.role === 'SUPER_ADMIN' || u.email === 'smarttechyeme@gmail.com');
    if (admin) {
      switchUser(admin.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-cyan-400" />
              {tab === 'register' ? 'تسجيل مشترك جديد في منظومة أمان' : 'تسجيل الدخول إلى حسابك'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'register' 
                ? 'سجل بريدك الإلكتروني لربط كود هذا الجهاز والحصول على تفعيل تجريبي'
                : 'أدخل بريدك الإلكتروني المسجل للوصول إلى النظام'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 m-4 rounded-2xl">
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              tab === 'register' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل حساب جديد (عميل)
          </button>
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              tab === 'login' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل دخول
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
          {/* Machine ID info */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 font-medium">كود هذا الجهاز:</span>
            </div>
            <code className="text-xs font-mono font-bold text-cyan-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              {machineId}
            </code>
          </div>

          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: م. أحمد الشمري"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف / الواتساب</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+9665XXXXXXXX"
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المنشأة / المستودع</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="مثال: مستودعات الأندلس"
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">البريد الإلكتروني *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'جاري المعالجة...' : tab === 'register' ? 'تسجيل وتفعيل ترخيص تجريبي' : 'تسجيل الدخول'}
          </button>
        </form>

        {/* Master Admin Fast Login Button */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            حساب مدير النظام الرئيسي:
          </div>
          <button
            type="button"
            onClick={handleFastSwitchAdmin}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>الدخول كـ Smart Tech (Super Admin)</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
