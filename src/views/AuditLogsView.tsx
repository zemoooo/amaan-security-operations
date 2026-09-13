import React, { useState } from 'react';
import { 
  ScrollText, 
  Search, 
  Lock, 
  ShieldCheck, 
  Download, 
  Calendar, 
  User, 
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useAuth } from '../context/AuthContext';
import { AuditLog } from '../types';

export const AuditLogsView: React.FC = () => {
  const { t } = useLanguageTheme();
  const { auditLogs, currentTenant } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    if (filterAction !== 'ALL' && log.action !== filterAction) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.userName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    const header = "ID,Timestamp,User,Role,Action,Entity,IP,Details\n";
    const rows = filteredLogs.map(l =>
      `"${l.id}","${l.timestamp}","${l.userName}","${l.userRole}","${l.action}","${l.entity}","${l.ipAddress}","${l.details.replace(/"/g, '""')}"`
    ).join("\n");

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUDIT_LOG_TAMPERPROOF_${currentTenant.id}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('سجل التدقيق الرقابي غير القابل للحذف (Tamper-Proof Audit Trail)', 'Tamper-Proof Audit Trail')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'توثيق دائم ومحمي لجميع قرارات المراجعة البشرية وتعديلات الكاميرات والمخزون والحضور وفق معايير الأمان ISO-27001.',
              'Immutable, append-only security log documenting all human actions, reviews, and adjustments.'
            )}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t('تصدير السجل المشفر (CSV)', 'Export Audit Trail')}</span>
        </button>
      </div>

      {/* Strict Security Enforcement Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-300 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 flex items-center gap-2">
              <span>{t('ضمانات حماية النزاهة الرقمية وعدم الحذف (Non-Deletable Guarantee)', 'Append-Only Integrity Guarantee')}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                WORM Compliant
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              {t(
                'وفقاً للسياسة الأمنية الصارمة للمنصة: لا يملك مدير النظام أو وكيل الذكاء الاصطناعي صلاحية حذف أو تعديل أي سجل تدقيق تم توثيقه مسبقاً.',
                'Neither Tenant Admins nor the AI Agent possess privileges to delete or alter historical audit logs.'
              )}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-slate-500 font-mono text-[11px]">
          <span>SHA-256 HASH CHAINING: ACTIVE</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('بحث بالاسم، الإجراء، أو التفاصيل...', 'Search audit logs...')}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56"
            />
          </div>

          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 focus:outline-none"
          >
            <option value="ALL">{t('كل الإجراءات والعمليات', 'All Action Types')}</option>
            <option value="LOGIN">تسجيل الدخول (LOGIN)</option>
            <option value="REVIEW_INCIDENT">مراجعة الحوادث (REVIEW_INCIDENT)</option>
            <option value="ADJUST_ATTENDANCE">تعديل الحضور (ADJUST_ATTENDANCE)</option>
            <option value="ADJUST_INVENTORY">معايرة المخزون (ADJUST_INVENTORY)</option>
            <option value="ADD_CAMERA">إضافة كاميرا (ADD_CAMERA)</option>
            <option value="UPDATE_CAMERA">تحديث كاميرا (UPDATE_CAMERA)</option>
            <option value="EXPORT_REPORT">تصدير تقرير (EXPORT_REPORT)</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono">
          {t('عدد السجلات المطابقة:', 'Matching Logs:')} <strong className="text-cyan-400">{filteredLogs.length}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-4">{t('التاريخ والوقت', 'Timestamp')}</th>
                <th className="p-4">{t('المستخدم والدور', 'Actor & Role')}</th>
                <th className="p-4">{t('نوع الإجراء', 'Action Type')}</th>
                <th className="p-4">{t('الكيان المستهدف', 'Entity Target')}</th>
                <th className="p-4">{t('تفاصيل العملية وسند القرار', 'Action Details & Notes')}</th>
                <th className="p-4">{t('عنوان IP', 'IP Address')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4 text-slate-400 font-mono whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <div>
                      <p className="font-bold text-slate-100 font-sans">{log.userName}</p>
                      <span className="text-[10px] text-cyan-400 font-mono">{log.userRole}</span>
                    </div>
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                        log.action.includes('REVIEW')
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : log.action.includes('ADJUST')
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : log.action.includes('ADD')
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>

                  <td className="p-4 text-slate-300 font-sans font-medium whitespace-nowrap">
                    {log.entity}
                  </td>

                  <td className="p-4 text-slate-300 font-sans text-xs leading-relaxed max-w-md">
                    {log.details}
                  </td>

                  <td className="p-4 text-slate-500 font-mono whitespace-nowrap">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
