import React, { useState } from 'react';
import { 
  UserCheck, 
  Search, 
  Calendar, 
  Download,
  UserPlus,
  Upload,
  X, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  FileEdit, 
  Sparkles,
  Layers,
  Scan
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { AttendanceRecord } from '../types';

interface AttendanceViewProps {
  onOpenFacePunch: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ onOpenFacePunch }) => {
  const { t } = useLanguageTheme();
  const { attendanceRecords, adjustAttendance, employees, cameras } = useLiveCCTV();
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState('');
  const [employeePosition, setEmployeePosition] = useState('');
  const [employeePhotoDataUrl, setEmployeePhotoDataUrl] = useState('');
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeMessage, setEmployeeMessage] = useState('');
  const [captureCameraId, setCaptureCameraId] = useState('');
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const [selectedDate, setSelectedDate] = useState('2026-09-12');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Supervisor Adjustment State
  const [adjustingRecord, setAdjustingRecord] = useState<AttendanceRecord | null>(null);
  const [excuseType, setExcuseType] = useState('إذن عمل ميداني رسمي');
  const [excuseNotes, setExcuseNotes] = useState('');

  const filteredRecords = attendanceRecords.filter(rec => {
    if (filterDepartment !== 'ALL' && rec.department !== filterDepartment) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rec.employeeName.toLowerCase().includes(q) ||
        rec.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
  const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;

  const handleCommitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingRecord) return;
    adjustAttendance(adjustingRecord.id, excuseType, excuseNotes);
    setAdjustingRecord(null);
    setExcuseNotes('');
  };

  const handleExportXlsx = async () => {
    const response = await fetch('/api/attendance/export.xlsx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: filteredRecords }) });
    if (!response.ok) { alert('تعذر إنشاء ملف Excel'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `ATTENDANCE_REPORT_${selectedDate}.xlsx`; link.click(); URL.revokeObjectURL(url);
  };

  const handleEmployeePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEmployeePhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleCaptureFromCamera = async () => {
    if (!captureCameraId) { setEmployeeMessage('اختر كاميرا أولاً'); return; }
    setCapturingPhoto(true);
    try {
      const res = await fetch('http://127.0.0.1:18765/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cameraId: captureCameraId }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'تعذر التقاط الصورة');
      setEmployeePhotoDataUrl(data.dataUrl); setEmployeeMessage('تم التقاط الصورة من الكاميرا المحلية.');
    } catch (err: any) { setEmployeeMessage('تعذر التقاط الصورة. تأكد أن AMAN Edge Agent يعمل على هذا الكمبيوتر وأن FFmpeg مثبت.'); } finally { setCapturingPhoto(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeSaving(true); setEmployeeMessage('');
    try {
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: 'tenant-aman-logistics', name: employeeName, employeeCode, department: employeeDepartment, position: employeePosition, photoDataUrl: employeePhotoDataUrl }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشل الحفظ');
      setEmployeeMessage('تمت إضافة الموظف وحفظ صورته بنجاح.');
      setEmployeeName(''); setEmployeeCode(''); setEmployeeDepartment(''); setEmployeePosition(''); setEmployeePhotoDataUrl('');
    } catch (err: any) { setEmployeeMessage(err.message || 'فشل حفظ الموظف'); } finally { setEmployeeSaving(false); }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('حضور وانصراف الوجه الذكي (AI Face Attendance)', 'Smart AI Face Attendance System')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'التعرف التلقائي على الموظفين عبر كاميرات البوابات، احتساب ساعات العمل، ومراجعة المشرف مع توثيق سجل التدقيق.',
              'Automated facial recognition punches at entry turnstiles, working hour tracking, and audit-logged supervisor excuses.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenFacePunch}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            <span>{t('محاكاة بصمة وجه بالبوابة', 'Test Face Punch Simulator')}</span>
          </button>

          <button onClick={() => setShowEmployeeModal(true)} className="px-3.5 py-2 rounded-xl bg-cyan-900/50 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"><UserPlus className="w-4 h-4" /><span>{t('إضافة موظف وصورته', 'Add Employee + Photo')}</span></button>
          <button onClick={handleExportXlsx} className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"><Download className="w-4 h-4" /><span>{t('تصدير Excel', 'Export Excel')}</span></button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('حضور في الموعد', 'Present On Time')}</span>
            <p className="text-xl font-bold font-mono text-slate-100">{presentCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('متأخرون', 'Late Arrivals')}</span>
            <p className="text-xl font-bold font-mono text-amber-400">{lateCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('غياب بدون عذر', 'Unexcused Absences')}</span>
            <p className="text-xl font-bold font-mono text-rose-400">{absentCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-700 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('دقة مطابقة الوجه', 'AI Face Accuracy')}</span>
            <p className="text-xl font-bold font-mono text-cyan-400">96.8%</p>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('بحث عن اسم موظف أو كود...', 'Search employee...')}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
            />
          </div>

          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 focus:outline-none"
          >
            <option value="ALL">{t('جميع الأقسام', 'All Departments')}</option>
            <option value="العمليات اللوجستية">العمليات اللوجستية</option>
            <option value="إدارة المستودعات">إدارة المستودعات</option>
            <option value="الأمن والسلامة">الأمن والسلامة</option>
            <option value="الإدارة العامة">الإدارة العامة</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">{t('التاريخ المعروض:', 'Date:')}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-bold text-slate-100">{t('موظفو النظام', 'System Employees')} ({employees.length})</h3><p className="text-[10px] text-slate-500">{t('يمكن رفع صورة الموظف لاستخدامها لاحقاً في مطابقة الوجه عند توفر محرك الرؤية المحلي.', 'Upload employee photos for later face matching when the local vision engine is connected.')}</p></div></div>
        <div className="flex gap-2 overflow-x-auto">{employees.slice(0,12).map(emp => <div key={emp.id} className="min-w-[150px] p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2"><img src={emp.photoUrl} className="w-9 h-9 rounded-full object-cover" /><div className="min-w-0"><p className="text-[11px] font-bold truncate">{emp.name}</p><p className="text-[9px] text-slate-500 truncate">{emp.department || 'بدون قسم'}</p></div></div>)}</div>
      </div>

      {/* Table Content */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-4">{t('الموظف', 'Employee')}</th>
                <th className="p-4">{t('القسم', 'Department')}</th>
                <th className="p-4">{t('أول دخول (First Entry)', 'First Entry')}</th>
                <th className="p-4">{t('آخر خروج (Last Exit)', 'Last Exit')}</th>
                <th className="p-4">{t('إجمالي الساعات', 'Total Hours')}</th>
                <th className="p-4">{t('التأخير', 'Late Time')}</th>
                <th className="p-4">{t('الحالة', 'Status')}</th>
                <th className="p-4 text-center">{t('إجراء المشرف', 'Supervisor Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={rec.photoUrl}
                        alt={rec.employeeName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 flex-shrink-0"
                      />
                      <div>
                        <p className="font-bold text-slate-100">{rec.employeeName}</p>
                        <span className="text-[10px] text-slate-500 font-mono">{rec.employeeId}</span>
                      </div>
                    </div>
                  </td>

                  <td className="p-4 text-slate-300">{rec.department}</td>

                  <td className="p-4 font-mono text-cyan-300">
                    {rec.firstEntryTime || <span className="text-slate-500">-</span>}
                  </td>

                  <td className="p-4 font-mono text-cyan-300">
                    {rec.lastExitTime || <span className="text-slate-500">-</span>}
                  </td>

                  <td className="p-4 font-mono font-semibold text-slate-200">
                    {(rec.totalWorkingMinutes / 60).toFixed(1)} {t('ساعة', 'hrs')}
                  </td>

                  <td className="p-4 font-mono">
                    {rec.lateMinutes > 0 ? (
                      <span className="text-amber-400 font-semibold">{rec.lateMinutes} {t('دقيقة', 'mins')}</span>
                    ) : (
                      <span className="text-emerald-400">0</span>
                    )}
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        rec.status === 'PRESENT'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : rec.status === 'LATE'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : rec.status === 'LEAVE'
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {rec.status === 'PRESENT'
                        ? t('حاضر', 'Present')
                        : rec.status === 'LATE'
                        ? t('متأخر', 'Late')
                        : rec.status === 'LEAVE'
                        ? t('إذن / عذر', 'Excused')
                        : t('غياب', 'Absent')}
                    </span>
                    {rec.adjustedBySupervisor && (
                      <span className="block text-[9px] text-cyan-400 mt-0.5">
                        {t('معدل بواسطة مشرف', 'Supervisor Adjusted')}
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-center">
                    <button
                      onClick={() => setAdjustingRecord(rec)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs transition cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>{t('تعديل عذر', 'Excuse')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Excuse Adjustment Modal */}
      {adjustingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-cyan-400" />
              <span>{t('تسجيل عذر مشرف وتعديل الحضور', 'Supervisor Attendance Adjustment')}</span>
            </h3>

            <p className="text-xs text-slate-400">
              {t('تعديل حالة الموظف:', 'Adjusting record for:')}{' '}
              <strong className="text-slate-200">{adjustingRecord.employeeName}</strong> ({adjustingRecord.date})
            </p>

            <form onSubmit={handleCommitAdjustment} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">{t('نوع العذر الرسمي:', 'Excuse Type:')}</label>
                <select
                  value={excuseType}
                  onChange={e => setExcuseType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="إذن عمل ميداني رسمي">إذن عمل ميداني رسمي (Field Work)</option>
                  <option value="عذر طبي معتمد">عذر طبي معتمد (Medical Leave)</option>
                  <option value="مهمة خارجية طارئة">مهمة خارجية طارئة (External Mission)</option>
                  <option value="إجازة سنوية معتمدة">إجازة سنوية معتمدة (Approved Leave)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('ملاحظات وسند التعديل (يسجل في Audit Log):', 'Audit Log Reason Notes:')}</label>
                <textarea
                  required
                  rows={3}
                  value={excuseNotes}
                  onChange={e => setExcuseNotes(e.target.value)}
                  placeholder={t('أدخل رقم الإذن أو سبب القبول...', 'Enter formal excuse permit ID or reason...')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingRecord(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                >
                  {t('اعتماد العذر وتوثيق السجل', 'Commit Excuse & Audit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold">{t('إضافة موظف جديد', 'Add Employee')}</h3><button onClick={() => setShowEmployeeModal(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
              <input required value={employeeName} onChange={e=>setEmployeeName(e.target.value)} placeholder={t('اسم الموظف','Employee name')} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
              <input value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} placeholder={t('كود الموظف','Employee code')} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
              <div className="grid grid-cols-2 gap-2"><input value={employeeDepartment} onChange={e=>setEmployeeDepartment(e.target.value)} placeholder={t('القسم','Department')} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700" /><input value={employeePosition} onChange={e=>setEmployeePosition(e.target.value)} placeholder={t('الوظيفة','Position')} className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700" /></div>
              <label className="block p-3 rounded-xl border border-dashed border-slate-700 text-slate-400 cursor-pointer"><Upload className="w-4 h-4 inline ml-1" /> {t('رفع صورة الموظف','Upload employee photo')}<input type="file" accept="image/*" className="hidden" onChange={e=>handleEmployeePhoto(e.target.files?.[0])} /></label>
              <div className="grid grid-cols-[1fr_auto] gap-2"><select value={captureCameraId} onChange={e=>setCaptureCameraId(e.target.value)} className="p-2.5 rounded-xl bg-slate-950 border border-slate-700"><option value="">{t('اختر كاميرا لالتقاط صورة','Choose camera')}</option>{cameras.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" onClick={handleCaptureFromCamera} disabled={capturingPhoto} className="px-3 rounded-xl bg-slate-800 border border-slate-700">{capturingPhoto ? '...' : t('التقاط','Capture')}</button></div>
              {employeePhotoDataUrl && <img src={employeePhotoDataUrl} className="w-20 h-20 rounded-xl object-cover border border-slate-700" />}
              {employeeMessage && <p className="text-cyan-300 text-[11px]">{employeeMessage}</p>}
              <button disabled={employeeSaving} className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 font-bold">{employeeSaving ? t('جارٍ الحفظ...','Saving...') : t('حفظ الموظف','Save employee')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
