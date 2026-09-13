import React, { useState } from 'react';
import { 
  Shield, 
  Bell, 
  Globe, 
  Moon, 
  Sun, 
  User, 
  Building2, 
  Sparkles, 
  Laptop, 
  Smartphone, 
  Scan, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  ChevronDown, 
  Check, 
  CheckCheck, 
  Activity,
  KeyRound,
  UserPlus,
  Lock
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { useLicense } from '../context/LicenseContext';

interface NavbarProps {
  onOpenFacePunch: () => void;
  onOpenWhatsApp: () => void;
  onOpenWindowsAgent: () => void;
  onOpenReports: () => void;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenFacePunch,
  onOpenWhatsApp,
  onOpenWindowsAgent,
  onOpenReports,
  onOpenAuthModal,
}) => {
  const { lang, toggleLanguage, theme, toggleTheme, t } = useLanguageTheme();
  const { currentUser, currentTenant, availableTenants, availableUsers, switchTenant, switchUser, logoutUser } = useAuth();
  const { machineId, isLocked, status, daysRemaining } = useLicense();
  const { 
    notifications, 
    unreadAlertsCount, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    agentHealth, 
    triggerSimulatedIncident,
    setActiveEvidenceIncident,
    securityIncidents
  } = useLiveCCTV();

  const [showSimulateMenu, setShowSimulateMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifsDropdown, setShowNotifsDropdown] = useState(false);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Live Agent Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white font-sans">
                Aman AI CCTV
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                PRO SAAS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {t('وكيل الذكاء الاصطناعي للمراقبة والعمليات', 'AI Security & Operations Agent')}
            </p>
          </div>
        </div>

        {/* Live Pulse Metric Pill */}
        <div className="hidden xl:flex items-center gap-3 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            AI Online
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {agentHealth.fpsAverage} FPS
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono text-[11px]">
            GPU: {agentHealth.gpuPercent}%
          </span>
        </div>
      </div>

      {/* Center / Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* Quick Simulation Trigger Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSimulateMenu(!showSimulateMenu)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-rose-600/20 hover:from-amber-600/30 hover:to-rose-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">{t('محاكاة الأحداث الحية', 'Simulate AI Events')}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showSimulateMenu && (
            <div className="absolute left-0 sm:right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <button
                onClick={() => {
                  triggerSimulatedIncident('THEFT');
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-rose-950/60 text-right text-rose-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <div>
                  <p className="font-bold">محاكاة اشتباه سرقة بالمستودع</p>
                  <span className="text-[10px] text-slate-400">إزالة صندوق خارج الدوام + تنبيه جنائي</span>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerSimulatedIncident('INTRUSION');
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-amber-950/60 text-right text-amber-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-bold">محاكاة اختراق السياج الشرقي</p>
                  <span className="text-[10px] text-slate-400">تجاوز خط وهمي افتراضي لسياج المنشأة</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenFacePunch();
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-cyan-950/60 text-right text-cyan-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <Scan className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="font-bold">محاكي بصمة الوجه بالبوابة (Gate Punch)</p>
                  <span className="text-[10px] text-slate-400">اختبار موظف مسجل أو شخص مجهول</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenWhatsApp();
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-emerald-950/60 text-right text-emerald-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-bold">معاينة تنبيه WhatsApp للأعمال</p>
                  <span className="text-[10px] text-slate-400">رسالة تنبيه فورية متوافقة مع شروط Meta</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenWindowsAgent();
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-blue-950/60 text-right text-blue-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="font-bold">إعداد وكيل Windows Edge Agent</p>
                  <span className="text-[10px] text-slate-400">ربط خادم محلي عبر Secure Device Token</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenReports();
                  setShowSimulateMenu(false);
                }}
                className="p-2.5 rounded-xl hover:bg-slate-800 text-right text-slate-300 flex items-center gap-2.5 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="font-bold">مركز التقارير والجدولة الآلية</p>
                  <span className="text-[10px] text-slate-400">تصدير PDF وExcel وجدول Cron دوري</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Tenant Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTenantMenu(!showTenantMenu)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline max-w-[120px] truncate">{currentTenant.name}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showTenantMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <span className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">
                {t('مساحة العمل / المستأجر (Tenant):', 'Workspace Tenant:')}
              </span>
              {availableTenants.map(ten => (
                <button
                  key={ten.id}
                  onClick={() => {
                    switchTenant(ten.id);
                    setShowTenantMenu(false);
                  }}
                  className={`p-2 rounded-xl text-right flex items-center justify-between transition cursor-pointer ${
                    currentTenant.id === ten.id
                      ? 'bg-cyan-950 text-cyan-300 font-bold'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="truncate">{ten.name}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{ten.plan} Plan</span>
                  </div>
                  {currentTenant.id === ten.id && <Check className="w-4 h-4 text-cyan-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hardware Machine Code & License Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <Laptop className="w-3.5 h-3.5 text-cyan-400" />
          <code className="text-[11px] font-mono font-bold text-cyan-300">
            {machineId.slice(0, 16)}...
          </code>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isLocked
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {isLocked ? 'مقفل' : `${daysRemaining} يوم`}
          </span>
        </div>

        {/* Register / Login Customer Button */}
        {onOpenAuthModal && (
          <button
            onClick={onOpenAuthModal}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="تسجيل حساب عميل جديد أو تسجيل الدخول"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">تسجيل بالبريد</span>
          </button>
        )}

        {/* User / Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-white">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-right hidden lg:block">
              <span className="block text-xs font-semibold leading-tight">{currentUser.name}</span>
              <span className="text-[10px] text-cyan-400 leading-none">{currentUser.role}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <span className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">
                {t('الحساب والمشتركين (User & Account):', 'User & Account:')}
              </span>

              {onOpenAuthModal && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAuthModal();
                  }}
                  className="p-2 rounded-xl text-right bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 text-cyan-300 font-bold flex items-center justify-between transition cursor-pointer border border-cyan-800/50 mb-1"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                    <span>تسجيل حساب مشترك جديد بإيميلك</span>
                  </div>
                </button>
              )}

              <span className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase mt-1">
                {t('تبديل صلاحية المستخدم (RBAC Switch):', 'Switch Role / User:')}
              </span>
              {availableUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u.id);
                    setShowUserMenu(false);
                  }}
                  className={`p-2 rounded-xl text-right flex items-center justify-between transition cursor-pointer ${
                    currentUser.id === u.id
                      ? 'bg-cyan-950 text-cyan-300 font-bold'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <p className="truncate font-medium">{u.name}</p>
                    <span className="text-[10px] text-slate-400">{u.email}</span>
                  </div>
                  {currentUser.id === u.id && <Check className="w-4 h-4 text-cyan-400" />}
                </button>
              ))}

              <div className="border-t border-slate-800 mt-2 pt-2">
                <button
                  onClick={() => {
                    logoutUser();
                    setShowUserMenu(false);
                  }}
                  className="w-full p-2 rounded-xl text-right flex items-center gap-2 transition cursor-pointer hover:bg-rose-950/40 text-rose-400"
                >
                  <Lock className="w-4 h-4" />
                  <span className="font-bold">تسجيل الخروج</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifsDropdown(!showNotifsDropdown)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 relative transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>{t('التنبيهات الأمنية الحية', 'Security Alerts')}</span>
                </h3>
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {t('تعليم الكل كمقروء', 'Mark all read')}
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">
                    {t('لا توجد إشعارات جديدة', 'No new notifications')}
                  </p>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationAsRead(notif.id);
                        if (notif.incidentId) {
                          const inc = securityIncidents.find(i => i.id === notif.incidentId);
                          if (inc) {
                            setActiveEvidenceIncident(inc);
                            setShowNotifsDropdown(false);
                          }
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                        !notif.read
                          ? 'bg-rose-950/40 border-rose-900/60 hover:bg-rose-900/40'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-100 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {notif.timestamp.substring(11, 16)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                        {notif.message}
                      </p>
                      {notif.incidentId && (
                        <span className="inline-block mt-1 text-[10px] text-cyan-400 font-semibold underline">
                          مشاهدة فيديو الأدلة (70 ثانية) ➜
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
          title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>
    </header>
  );
};
