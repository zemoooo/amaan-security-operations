import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Phone, Building, CheckCircle2, ShieldAlert, KeyRound, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';

export const AuthView: React.FC = () => {
  const { registerUser, loginUser } = useAuth();
  const { machineId, checkLicenseStatus } = useLicense();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resending, setResending] = useState(false);

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
          setVerificationPending(true);
          setSuccessMsg(res.message || 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني قبل تسجيل الدخول.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fade-in relative z-10">
        <div className="p-8 pb-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-4 ring-cyan-500/20 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Aman AI CCTV
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            وكيل الذكاء الاصطناعي للمراقبة والعمليات
          </p>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 mx-6 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer ${
              tab === 'login' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer ${
              tab === 'register' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            إنشاء حساب
          </button>
        </div>

        {verificationPending && (
          <div className="mx-6 mb-4 p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800 text-cyan-200 text-sm">
            <div className="flex items-center gap-2 font-bold mb-2"><Mail className="w-4 h-4" /> تحقق من بريدك الإلكتروني</div>
            <p className="text-xs text-cyan-100/80 leading-6">تم إرسال رابط التحقق إلى <strong>{email}</strong>. افتح الرسالة واضغط رابط التأكيد، ثم ارجع وسجّل الدخول.</p>
            <button type="button" disabled={resending} onClick={async () => {
              setResending(true); setErrorMsg(null);
              try {
                const r = await fetch('/api/auth/resend-verification', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
                const d = await r.json();
                if (d.success) setSuccessMsg(d.message || 'تم إرسال رابط جديد'); else setErrorMsg(d.error || 'تعذر إعادة الإرسال');
              } catch { setErrorMsg('تعذر الاتصال بالخادم'); } finally { setResending(false); }
            }} className="mt-3 text-xs font-bold text-cyan-300 hover:text-white disabled:opacity-50">{resending ? 'جاري الإرسال...' : 'إعادة إرسال رابط التحقق'}</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full pr-10 pl-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966"
                      className="w-full pr-10 pl-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المنشأة</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="اسم الشركة"
                      className="w-full pr-10 pl-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">البريد الإلكتروني *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pr-10 pl-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 mt-2 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 mt-2 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'جاري المعالجة...' : (tab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد')}
            <KeyRound className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>
    </div>
  );
};
