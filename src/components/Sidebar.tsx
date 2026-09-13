import React from 'react';
import { 
  LayoutDashboard, 
  Video, 
  ShieldAlert, 
  UserCheck, 
  Boxes, 
  Laptop, 
  ScrollText, 
  CreditCard, 
  Settings, 
  ChevronRight,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { useLicense } from '../context/LicenseContext';

export type AppView = 
  | 'dashboard'
  | 'cameras'
  | 'security'
  | 'attendance'
  | 'inventory'
  | 'devices'
  | 'audit'
  | 'admin_subscribers'
  | 'subscriptions'
  | 'settings';

interface SidebarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView }) => {
  const { t } = useLanguageTheme();
  const { currentUser, isOwner, isSuperAdmin } = useAuth();
  const { unreadAlertsCount, securityIncidents } = useLiveCCTV();
  const { machineId, isLocked, status, daysRemaining } = useLicense();

  const newIncidentsCount = securityIncidents.filter(i => i.status === 'NEW').length;

  const navItems = [
    {
      id: 'dashboard' as AppView,
      label: t('لوحة التحكم العامة', 'Executive Dashboard'),
      icon: LayoutDashboard,
    },
    {
      id: 'cameras' as AppView,
      label: t('كاميرات المراقبة الحية', 'Live CCTV & Cameras'),
      icon: Video,
      badge: '5 Live',
    },
    {
      id: 'security' as AppView,
      label: t('الحوادث والأدلة الجنائية', 'Security & Evidence'),
      icon: ShieldAlert,
      badge: newIncidentsCount > 0 ? `${newIncidentsCount} جديد` : undefined,
      badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
    },
    {
      id: 'attendance' as AppView,
      label: t('حضور الوجه الذكي', 'AI Face Attendance'),
      icon: UserCheck,
    },
    {
      id: 'inventory' as AppView,
      label: t('رؤية مخزون المستودعات', 'Warehouse CV Inventory'),
      icon: Boxes,
    },
    {
      id: 'devices' as AppView,
      label: t('أجهزة Windows Agent', 'Windows Edge Fleet'),
      icon: Laptop,
    },
    {
      id: 'admin_subscribers' as AppView,
      label: t('إدارة النظام والمشتركين', 'Subscribers & Key Gen'),
      icon: KeyRound,
      badge: isSuperAdmin ? 'إدارة المفاتيح' : undefined,
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    },
    {
      id: 'audit' as AppView,
      label: t('سجل التدقيق الرقابي', 'Audit Logs (Protected)'),
      icon: ScrollText,
    },
    {
      id: 'subscriptions' as AppView,
      label: t('الاشتراكات والباقات', 'Subscriptions & SaaS'),
      icon: CreditCard,
    },
    {
      id: 'settings' as AppView,
      label: t('إعدادات النظام وAI', 'System & AI Settings'),
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between hidden md:flex">
      {/* Navigation List */}
      <div className="p-4 flex flex-col gap-1.5">
        <span className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {t('الوحدات التشغيلية', 'Operational Modules')}
        </span>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-300 border border-cyan-500/30 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom User RBAC & Hardware License Card */}
      <div className="p-3 border-t border-slate-900 bg-slate-950/80 m-2 rounded-2xl border border-slate-800/80 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300 font-bold text-xs">
            {currentUser.name.charAt(0)}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</h4>
            <span className="text-[10px] font-mono text-cyan-400 block truncate">{currentUser.email}</span>
          </div>
        </div>

        {/* Machine ID Badge */}
        <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px]">
          <span className="text-slate-500 font-mono flex items-center gap-1">
            <Laptop className="w-3 h-3 text-slate-400" />
            {machineId.slice(0, 16)}...
          </span>
          <span
            className={`px-1.5 py-0.5 rounded font-bold ${
              isLocked
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {isLocked ? 'مقفل' : `${daysRemaining} يوم`}
          </span>
        </div>
      </div>
    </aside>
  );
};
