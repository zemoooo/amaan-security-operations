import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Camera,
  BehaviorEvent,
  SecurityIncident,
  AttendanceRecord,
  InventoryProduct,
  OutgoingProductEvent,
  AgentHealth,
  DeviceNode,
  RecorderDevice,
  Employee,
  CameraZone,
  CustomerWhatsAppSettings,
  WhatsAppDispatchLog,
  WhatsAppCallState,
  WhatsAppAlertMode,
  SeverityLevel
} from '../types';
import { useAuth } from './AuthContext';
import * as db from '../lib/supabaseServices';

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cameraName: string;
  read: boolean;
  incidentId?: string;
}

interface LiveCCTVContextType {
  cameras: Camera[];
  selectedCamera: Camera | null;
  setSelectedCamera: (cam: Camera | null) => void;
  behaviorEvents: BehaviorEvent[];
  securityIncidents: SecurityIncident[];
  attendanceRecords: AttendanceRecord[];
  inventoryProducts: InventoryProduct[];
  outgoingEvents: OutgoingProductEvent[];
  agentHealth: AgentHealth;
  devices: DeviceNode[];
  recorders: RecorderDevice[];
  employees: Employee[];
  addEmployee: (employee: Partial<Employee> & { name: string; department?: string; position?: string; employeeCode?: string; photoUrl?: string }) => Promise<Employee>;
  notifications: AlertNotification[];
  unreadAlertsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  updateCameraStatus: (cameraId: string, status: Camera['status']) => void;
  addCamera: (newCamera: Omit<Camera, 'id' | 'lastPing'>) => Promise<void>;
  addRecorder: (newRecorder: Omit<RecorderDevice, 'id' | 'lastSync'>) => Promise<void>;
  updateCameraZones: (cameraId: string, zones: CameraZone[]) => void;
  updateIncidentStatus: (incidentId: string, status: SecurityIncident['status'], notes?: string) => void;
  updateBehaviorStatus: (eventId: string, status: BehaviorEvent['reviewStatus'], notes?: string) => void;
  adjustAttendance: (recordId: string, excuseType: string, notes: string) => void;
  punchFaceAttendance: (employeeId: string | 'unknown', isEntry: boolean) => { success: boolean; message: string; record?: AttendanceRecord };
  triggerSimulatedIncident: (type: 'THEFT' | 'INTRUSION' | 'LOITERING') => void;
  triggerInventoryCountUpdate: (productId: string, newCount: number) => void;
  activeEvidenceIncident: SecurityIncident | null;
  setActiveEvidenceIncident: (incident: SecurityIncident | null) => void;
  customerWhatsAppSettings: CustomerWhatsAppSettings;
  updateCustomerWhatsAppSettings: (settings: Partial<CustomerWhatsAppSettings>) => Promise<void>;
  whatsappCallState: WhatsAppCallState | null;
  triggerWhatsAppCall: (details: { title: string; reason: string; cameraName: string; severity?: SeverityLevel; incidentId?: string; }) => void;
  acceptWhatsAppCall: () => void;
  declineWhatsAppCall: () => void;
  dispatchWhatsAppAlert: (options?: { action?: 'MESSAGE' | 'CALL' | 'BOTH'; incidentTitle?: string; reason?: string; cameraName?: string; severity?: SeverityLevel; incidentId?: string; }) => Promise<any>;
  whatsappDispatchLogs: WhatsAppDispatchLog[];
  lastWhatsAppToast: { message: string; type: 'MESSAGE' | 'CALL'; visible: boolean } | null;
  dismissWhatsAppToast: () => void;
}

const LiveCCTVContext = createContext<LiveCCTVContextType | undefined>(undefined);

export const LiveCCTVProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addAuditLog, currentTenant, currentUser } = useAuth();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([]);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [outgoingEvents, setOutgoingEvents] = useState<OutgoingProductEvent[]>([]);
  const [agentHealth, setAgentHealth] = useState<AgentHealth>({
    status: 'OPTIMAL',
    cpuUsage: 0,
    ramUsage: 0,
    networkLatency: 0,
    gpuUsage: 0,
    temperature: 0,
    uptime: '0h 0m',
    lastPing: new Date().toISOString()
  });
  const [devices] = useState<DeviceNode[]>([]);
  const [recorders, setRecorders] = useState<RecorderDevice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEvidenceIncident, setActiveEvidenceIncident] = useState<SecurityIncident | null>(null);

  useEffect(() => {
    async function loadData() {
      const fetchedCameras = await db.fetchCameras();
      setCameras(fetchedCameras);
      if (fetchedCameras.length > 0) {
        setSelectedCamera(fetchedCameras[0]);
      }

      setBehaviorEvents(await db.fetchBehaviorEvents());
      setSecurityIncidents(await db.fetchSecurityIncidents());
      setAttendanceRecords(await db.fetchAttendanceRecords());
      setInventoryProducts(await db.fetchInventoryProducts());
      setEmployees(await db.fetchEmployees());
    }
    
    loadData();
  }, []);

  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  const unreadAlertsCount = notifications.filter(n => !n.read).length;

  const DEFAULT_CUSTOMER_SETTINGS: CustomerWhatsAppSettings = {
    instanceName: 'aman_default',
    phoneNumber: '',
    customerName: 'م. أحمد الشمري (المالك / المدير العام)',
    enabled: true,
    alertMode: 'MESSAGE_AND_CALL',
    minSeverity: 'MEDIUM',
    callRingtoneEnabled: true,
    autoPlayVoiceBriefing: true,
    language: 'ar',
  };

  const [customerWhatsAppSettings, setCustomerWhatsAppSettings] = useState<CustomerWhatsAppSettings>(() => {
    try {
      const saved = localStorage.getItem('cctv_customer_whatsapp');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CUSTOMER_SETTINGS;
  });

  const [whatsappCallState, setWhatsappCallState] = useState<WhatsAppCallState | null>(null);
  const [whatsappDispatchLogs, setWhatsappDispatchLogs] = useState<WhatsAppDispatchLog[]>([]);
  const [lastWhatsAppToast, setLastWhatsAppToast] = useState<{ message: string; type: 'MESSAGE' | 'CALL'; visible: boolean } | null>(null);

  // Sync settings & logs with backend
  useEffect(() => {
    fetch('/api/customer/whatsapp-settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setCustomerWhatsAppSettings(prev => ({
            ...prev,
            ...data.settings,
          }));
        }
      })
      .catch(() => {});

    fetch('/api/notifications/whatsapp/logs')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.logs)) {
          setWhatsappDispatchLogs(data.logs);
        }
      })
      .catch(() => {});
  }, []);

  const updateCustomerWhatsAppSettings = async (partial: Partial<CustomerWhatsAppSettings>) => {
    const updated = { ...customerWhatsAppSettings, ...partial };
    setCustomerWhatsAppSettings(updated);
    try {
      localStorage.setItem('cctv_customer_whatsapp', JSON.stringify(updated));
      await fetch('/api/customer/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error('Failed to sync WhatsApp settings with backend', e);
    }
  };

  const triggerWhatsAppCall = (details: {
    title: string;
    reason: string;
    cameraName: string;
    severity?: SeverityLevel;
    incidentId?: string;
  }) => {
    setWhatsappCallState({
      active: true,
      status: 'RINGING',
      recipient: customerWhatsAppSettings.phoneNumber,
      incidentTitle: details.title,
      incidentReason: details.reason,
      cameraName: details.cameraName,
      time: new Date().toTimeString().substring(0, 5),
      severity: details.severity || 'CRITICAL',
      durationSec: 0,
      incidentId: details.incidentId,
    });
  };

  const acceptWhatsAppCall = () => {
    setWhatsappCallState(prev => prev ? { ...prev, status: 'CONNECTED' } : null);
  };

  const declineWhatsAppCall = () => {
    setWhatsappCallState(null);
  };

  const dismissWhatsAppToast = () => {
    setLastWhatsAppToast(null);
  };

  const dispatchWhatsAppAlert = async (options?: {
    action?: 'MESSAGE' | 'CALL' | 'BOTH';
    incidentTitle?: string;
    reason?: string;
    cameraName?: string;
    severity?: SeverityLevel;
    incidentId?: string;
  }) => {
    if (!customerWhatsAppSettings.enabled || !customerWhatsAppSettings.phoneNumber) {
      return;
    }

    const actionToTake = options?.action || customerWhatsAppSettings.alertMode;
    const title = options?.incidentTitle || 'تنبيه أمني عاجل';
    const reason = options?.reason || 'تم رصد نشاط مريب يتطلب التحقق الفوري';
    const camName = options?.cameraName || 'المستودع الرئيسي';
    const sev = options?.severity || 'CRITICAL';
    const incId = options?.incidentId || `INC-${Date.now().toString(36).toUpperCase()}`;

    // Show toast notification
    if (actionToTake === 'CALL_ONLY' || actionToTake === 'CALL') {
      setLastWhatsAppToast({
        message: `📞 جارٍ الاتصال بواتساب العميل (${customerWhatsAppSettings.phoneNumber}) لتنبيهه بالحدث!`,
        type: 'CALL',
        visible: true,
      });
    } else if (actionToTake === 'MESSAGE_AND_CALL' || actionToTake === 'BOTH') {
      setLastWhatsAppToast({
        message: `🚨 تم إرسال إشعار فوري وتفعيل نداء مكالمة واتساب إلى (${customerWhatsAppSettings.phoneNumber})!`,
        type: 'CALL',
        visible: true,
      });
    } else {
      setLastWhatsAppToast({
        message: `💬 تم إرسال رسالة تفصيلية إلى واتساب العميل (${customerWhatsAppSettings.phoneNumber}) بنجاح!`,
        type: 'MESSAGE',
        visible: true,
      });
    }

    // Trigger incoming phone call if requested
    if (actionToTake === 'CALL_ONLY' || actionToTake === 'CALL' || actionToTake === 'MESSAGE_AND_CALL' || actionToTake === 'BOTH') {
      triggerWhatsAppCall({
        title,
        reason,
        cameraName: camName,
        severity: sev,
        incidentId: incId,
      });
    }

    // Dispatch to server endpoint
    try {
      const res = await fetch('/api/notifications/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: customerWhatsAppSettings.phoneNumber,
          action: actionToTake,
          incidentId: incId,
          incidentTitle: title,
          reason,
          cameraName: camName,
          severity: sev,
        }),
      });
      const data = await res.json();
      if (data.success && data.logEntry) {
        setWhatsappDispatchLogs(prev => [data.logEntry, ...prev.slice(0, 49)]);
      }
      return data;
    } catch (err) {
      console.error('WhatsApp dispatch request failed:', err);
    }
  };

  // Background health pulsation simulator (FPS and CPU fluctuation)
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentHealth(prev => ({
        ...prev,
        fpsAverage: Number((115 + Math.sin(Date.now() / 3000) * 8).toFixed(1)),
        cpuPercent: Number((32 + Math.cos(Date.now() / 4000) * 5).toFixed(1)),
        gpuPercent: Number((60 + Math.sin(Date.now() / 2500) * 7).toFixed(1)),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addEmployee = async (employeeData: Partial<Employee> & { name: string }) => {
    const payload = { tenantId: currentTenant.id, name: employeeData.name, employeeCode: employeeData.employeeCode || '', department: employeeData.department || '', position: employeeData.position || '', photoUrl: employeeData.photoUrl || '', isActive: true, allowedZones: [], schedule: { workDays: [0,1,2,3,4,5], shiftStart: '08:00', shiftEnd: '17:00', graceMinutes: 15 } };
    const response = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'تعذر إضافة الموظف');
    const e = data.employee as Employee;
    const normalized: Employee = { ...e, tenantId: e.tenantId || currentTenant.id, employeeCode: e.employeeCode || '', name: e.name, department: e.department || '', position: e.position || '', phone: e.phone || '', email: e.email || '', photoUrl: e.photoUrl || '', faceEmbeddingVector: e.faceEmbeddingVector || [], isActive: e.isActive !== false, allowedZones: e.allowedZones || [], schedule: e.schedule || payload.schedule };
    setEmployees(prev => [normalized, ...prev.filter(x => x.id !== normalized.id)]);
    return normalized;
  };

  const updateCameraStatus = (cameraId: string, status: Camera['status']) => {
    setCameras(prev =>
      prev.map(c => (c.id === cameraId ? { ...c, status, lastPing: 'الآن' } : c))
    );
    const targetCam = cameras.find(c => c.id === cameraId);
    addAuditLog('UPDATE_CAMERA', `Camera: ${targetCam?.name || cameraId}`, `تعديل حالة الكاميرا يدوياً إلى: ${status}`, cameraId);
  };

  const addCamera = async (newCamData: Omit<Camera, 'id' | 'lastPing'>) => {
    const newId = `cam-${Date.now().toString(36)}`;
    const response = await fetch('/api/cameras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCamData, id: newId }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'تعذر حفظ الكاميرا');
    const cam: Camera = { ...newCamData, id: data.camera.id, lastPing: new Date().toISOString() };
    setCameras(prev => [...prev, cam]);
    addAuditLog('ADD_CAMERA', `Camera: ${cam.name}`, `إضافة كاميرا جديدة بنظام ${cam.type} وتفعيل الذكاء الاصطناعي: ${cam.aiEnabled}`, cam.id);
  };

  const addRecorder = async (newRecorderData: Omit<RecorderDevice, 'id' | 'lastSync'>) => {
    const newId = `rec-${Date.now().toString(36)}`;
    const response = await fetch('/api/recorders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newRecorderData, id: newId }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'تعذر حفظ جهاز التسجيل');
    const rec: RecorderDevice = { ...newRecorderData, id: data.recorder.id, lastSync: new Date().toISOString() };
    setRecorders(prev => [...prev, rec]);
    addAuditLog('ADD_CAMERA', `Recorder: ${rec.name}`, `إضافة جهاز تسجيل جديد من نوع ${rec.type} بسعة ${rec.channels} قناة`, rec.id);
  };

  const updateCameraZones = (cameraId: string, zones: CameraZone[]) => {
    setCameras(prev =>
      prev.map(c => (c.id === cameraId ? { ...c, zones } : c))
    );
    const cam = cameras.find(c => c.id === cameraId);
    addAuditLog('ADD_WAREHOUSE_ZONE', `Camera: ${cam?.name || cameraId}`, `تحديث مناطق الكشف والعد الجغرافي (${zones.length} مناطق محددة)`, cameraId);
  };

  const updateIncidentStatus = (incidentId: string, status: SecurityIncident['status'], notes?: string) => {
    setSecurityIncidents(prev =>
      prev.map(inc => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            status,
            reviewedBy: currentUser.name,
            reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            reviewNotes: notes || inc.reviewNotes,
          };
        }
        return inc;
      })
    );
    addAuditLog('REVIEW_INCIDENT', `Incident: ${incidentId}`, `مراجعة بشرية للحادث وتحديث الحالة إلى ${status}. ملاحظات: ${notes || 'لا توجد'}`, incidentId);
  };

  const updateBehaviorStatus = (eventId: string, status: BehaviorEvent['reviewStatus'], notes?: string) => {
    setBehaviorEvents(prev =>
      prev.map(evt => {
        if (evt.id === eventId) {
          return {
            ...evt,
            reviewStatus: status,
            reviewedBy: currentUser.name,
            reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            notes: notes || evt.notes,
          };
        }
        return evt;
      })
    );
    addAuditLog('REVIEW_INCIDENT', `BehaviorEvent: ${eventId}`, `مراجعة الحدث السلوكي وتحديث حالته إلى: ${status}`, eventId);
  };

  const adjustAttendance = (recordId: string, excuseType: string, notes: string) => {
    setAttendanceRecords(prev =>
      prev.map(rec => {
        if (rec.id === recordId) {
          return {
            ...rec,
            status: 'LEAVE',
            adjustedBySupervisor: true,
            adjustmentReason: `[${excuseType}] ${notes} (تم التعديل بواسطة المشرف: ${currentUser.name})`,
          };
        }
        return rec;
      })
    );
    const rec = attendanceRecords.find(r => r.id === recordId);
    addAuditLog('ADJUST_ATTENDANCE', `Attendance: ${rec?.employeeName}`, `تسجيل عذر مشرف [${excuseType}]: ${notes}`, recordId);
  };

  const punchFaceAttendance = (employeeId: string | 'unknown', isEntry: boolean) => {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    const dateStr = now.toISOString().substring(0, 10);

    if (employeeId === 'unknown') {
      // Trigger Unknown Person Event
      const unknownEventId = `evt-unknown-${Date.now()}`;
      const newEvt: BehaviorEvent = {
        id: unknownEventId,
        tenantId: currentTenant.id,
        cameraId: 'cam-gate-01',
        cameraName: 'البوابة الرئيسية - دخول الموظفين (Gate 01)',
        cameraLocation: 'المدخل الإداري الشمالي',
        timestamp: `${dateStr} ${timeStr}`,
        eventType: 'UNAUTHORIZED_ZONE_ENTRY',
        severity: 'MEDIUM',
        confidence: 0.92,
        personName: 'شخص مجهول لم يتعرف عليه النظام (Unknown Person)',
        snapshotUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        videoClipUrl: '/demo/videos/unknown_person.mp4',
        reason: 'تطابق بصمة الوجه أقل من العتبة المسموح بها (0.42 < 0.75) - لم يتم فتح البوابة الإلكترونية.',
        reviewStatus: 'NEW',
      };
      setBehaviorEvents(prev => [newEvt, ...prev]);

      const newNotif: AlertNotification = {
        id: `notif-unknown-${Date.now()}`,
        title: 'شخص غير مسجل عند البوابة',
        message: `تم رصد وجه مجهول يحاول الدخول عند البوابة الرئيسية في الساعة ${timeStr}`,
        timestamp: `${dateStr} ${timeStr}`,
        severity: 'MEDIUM',
        cameraName: 'البوابة الرئيسية',
        read: false,
      };
      setNotifications(prev => [newNotif, ...prev]);
      addAuditLog('VIEW_CAMERA', 'EntranceGate', `رصد شخص مجهول غير مسجل في قاعدة بيانات الموظفين عند البوابة`);

      return {
        success: false,
        message: 'تم رصد وجه مجهول! لم يتطابق مع أي موظف مسجل. تم إنشاء حدث أمني وتنبيه المشرف.',
      };
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
      return { success: false, message: 'الموظف غير موجود في النظام' };
    }

    let updatedRec: AttendanceRecord | undefined;

    setAttendanceRecords(prev => {
      const existing = prev.find(r => r.employeeId === employeeId && r.date === dateStr);
      if (existing) {
        if (isEntry) {
          updatedRec = { ...existing, firstEntryTime: timeStr };
        } else {
          // calculate hours
          let totalMinutes = existing.totalWorkingMinutes;
          if (existing.firstEntryTime) {
            const [h1, m1] = existing.firstEntryTime.split(':').map(Number);
            const [h2, m2] = timeStr.split(':').map(Number);
            totalMinutes = Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
          }
          updatedRec = {
            ...existing,
            lastExitTime: timeStr,
            totalWorkingMinutes: totalMinutes,
            status: existing.status === 'LATE' ? 'LATE' : 'PRESENT',
          };
        }
        return prev.map(r => (r.id === existing.id ? updatedRec! : r));
      } else {
        // New record for today
        const isLate = timeStr > '08:15:00';
        updatedRec = {
          id: `att-${dateStr}-${employee.id}`,
          tenantId: currentTenant.id,
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          photoUrl: employee.photoUrl,
          date: dateStr,
          firstEntryTime: isEntry ? timeStr : null,
          lastExitTime: !isEntry ? timeStr : null,
          totalWorkingMinutes: 0,
          lateMinutes: isLate ? 25 : 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          status: isLate ? 'LATE' : 'PRESENT',
          adjustedBySupervisor: false,
        };
        return [updatedRec, ...prev];
      }
    });

    addAuditLog(
      'ADJUST_ATTENDANCE',
      `EmployeePunch: ${employee.name}`,
      `تسجيل بصمة وجه AI تلقائية بنجاح عند البوابة [${isEntry ? 'دخول' : 'خروج'}] في الساعة ${timeStr} بنسبة ثقة 96.8%`,
      employee.id
    );

    return {
      success: true,
      message: `تم التعرف على ${employee.name} بنجاح وتسجيل ${isEntry ? 'الدخول' : 'الخروج'} (${timeStr}) بنسبة تطابق 96.8%!`,
      record: updatedRec,
    };
  };

  const triggerSimulatedIncident = (type: 'THEFT' | 'INTRUSION' | 'LOITERING') => {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);

    if (type === 'THEFT') {
      const newIncident: SecurityIncident = {
        id: `inc-theft-${Date.now().toString(36)}`,
        tenantId: currentTenant.id,
        cameraId: 'cam-wh-rack-04',
        cameraName: 'المستودع الرئيسي - ممر الرفوف 04',
        timestamp: timeStr,
        title: 'اشتباه سحب منتج ومغادرة غير مصرح بها (Theft Pipeline)',
        incidentType: 'THEFT_SUSPICION',
        severity: 'CRITICAL',
        confidence: 0.94,
        reason: 'تم رصد إزالة صندوق من منطقة الرف 04-A + وجود شخص غير مصرح له في المنطقة + عدم تسجيل إذن صرف رسمي في النظام.',
        suspectDetails: {
          type: 'UNKNOWN_PERSON',
          photoUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=200&auto=format&fit=crop&q=80',
        },
        involvedObjects: ['Carton Box (SKU-DISP-65UHD)'],
        status: 'NEW',
        videoEvidence: {
          clipUrl: '/demo/videos/evidence_70sec_incident_004.mp4',
          durationSec: 70,
          preEventSec: 30,
          eventSec: 10,
          postEventSec: 30,
          snapshots: [
            'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=300&auto=format&fit=crop&q=80',
          ],
        },
      };

      setSecurityIncidents(prev => [newIncident, ...prev]);

      // Also adjust inventory difference
      setInventoryProducts(prev =>
        prev.map(p => {
          if (p.sku === 'SKU-DISP-65UHD') {
            return {
              ...p,
              aiDetectedQuantity: p.aiDetectedQuantity - 1,
              difference: p.difference - 1,
              status: 'DISCREPANCY',
            };
          }
          return p;
        })
      );

      const notif: AlertNotification = {
        id: `notif-theft-${Date.now()}`,
        title: '🚨 تنبيه أمني عاجل: اشتباه سرقة بالمستودع',
        message: 'تم إنشاء حادث أمني جديد يتطلب المراجعة البشرية ومطابقة الفيديو الجنائي (70 ثانية).',
        timestamp: timeStr,
        severity: 'CRITICAL',
        cameraName: 'المستودع الرئيسي - ممر الرفوف 04',
        read: false,
        incidentId: newIncident.id,
      };
      setNotifications(prev => [notif, ...prev]);
      addAuditLog('REVIEW_INCIDENT', 'TheftPipeline', `نظام AI كشف حالة اشتباه سرقة جديدة وأنشأ حادثاً للمراجعة البشرية`, newIncident.id);

      // Automatic WhatsApp Alert & Call to Customer upon suspicious incident
      dispatchWhatsAppAlert({
        action: customerWhatsAppSettings.alertMode,
        incidentTitle: newIncident.title,
        reason: newIncident.reason,
        cameraName: newIncident.cameraName,
        severity: newIncident.severity,
        incidentId: newIncident.id,
      });
    } else if (type === 'INTRUSION') {
      const newEvt: BehaviorEvent = {
        id: `evt-intrusion-${Date.now().toString(36)}`,
        tenantId: currentTenant.id,
        cameraId: 'cam-fence-east',
        cameraName: 'سياج المحيط الأمني الشرقي',
        cameraLocation: 'السياج الخارجي للمنشأة',
        timestamp: timeStr,
        eventType: 'UNAUTHORIZED_ZONE_ENTRY',
        severity: 'HIGH',
        confidence: 0.91,
        personName: 'متسلل غير معروف (Intruder)',
        snapshotUrl: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=400&auto=format&fit=crop&q=80',
        videoClipUrl: '/demo/videos/fence_loitering.mp4',
        reason: 'تجاوز الخط الوهمي الحرج لسياج المنشأة الشرقي وتفعيل صافرة الإنذار الميدانية.',
        reviewStatus: 'NEW',
      };
      setBehaviorEvents(prev => [newEvt, ...prev]);
      const notif: AlertNotification = {
        id: `notif-intrude-${Date.now()}`,
        title: '⚠️ اختراق المنطقة الأمنية للسياج الشرقي',
        message: 'تم رصد حركة إنسان مباشرة عند السياج الشرقي الخارجي.',
        timestamp: timeStr,
        severity: 'HIGH',
        cameraName: 'سياج المحيط الأمني الشرقي',
        read: false,
      };
      setNotifications(prev => [notif, ...prev]);
      addAuditLog('VIEW_CAMERA', 'PerimeterFence', `رصد تسلل عبر السياج الأمني الشرقي وتفعيل صفارة الإنذار`);

      // Automatic WhatsApp Alert & Call to Customer
      dispatchWhatsAppAlert({
        action: customerWhatsAppSettings.alertMode,
        incidentTitle: '⚠️ اختراق المنطقة الأمنية للسياج الشرقي',
        reason: newEvt.reason,
        cameraName: newEvt.cameraName,
        severity: newEvt.severity,
        incidentId: newEvt.id,
      });
    } else if (type === 'LOITERING') {
      const newEvt: BehaviorEvent = {
        id: `evt-loiter-${Date.now().toString(36)}`,
        tenantId: currentTenant.id,
        cameraId: 'cam-server-room',
        cameraName: 'غرفة الخوادم والاتصالات',
        cameraLocation: 'مركز البيانات',
        timestamp: timeStr,
        eventType: 'PROLONGED_LOITERING',
        severity: 'MEDIUM',
        confidence: 0.88,
        personName: 'شخص بدون بطاقة تقنية معتمدة',
        snapshotUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
        videoClipUrl: '/demo/videos/server_room_intrusion.mp4',
        reason: 'البقاء أمام كابينة الخوادم الحساسة لأكثر من 30 ثانية دون فتح تذكرة صيانة.',
        reviewStatus: 'NEW',
      };
      setBehaviorEvents(prev => [newEvt, ...prev]);
      const notif: AlertNotification = {
        id: `notif-loiter-${Date.now()}`,
        title: 'تسكع مشبوه بغرفة الخوادم',
        message: 'شخص متواجد دون حركة تشغيلية مصرح بها لأكثر من 30 ثانية.',
        timestamp: timeStr,
        severity: 'MEDIUM',
        cameraName: 'غرفة الخوادم',
        read: false,
      };
      setNotifications(prev => [notif, ...prev]);

      // Automatic WhatsApp Alert & Call to Customer
      dispatchWhatsAppAlert({
        action: customerWhatsAppSettings.alertMode,
        incidentTitle: 'تسكع مشبوه بغرفة الخوادم',
        reason: newEvt.reason,
        cameraName: newEvt.cameraName,
        severity: newEvt.severity,
        incidentId: newEvt.id,
      });
    }
  };

  const triggerInventoryCountUpdate = (productId: string, newCount: number) => {
    setInventoryProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const diff = newCount - p.expectedQuantity;
          return {
            ...p,
            aiDetectedQuantity: newCount,
            difference: diff,
            status: diff !== 0 ? 'DISCREPANCY' : newCount <= p.lowStockThreshold ? 'LOW_STOCK' : 'NORMAL',
            lastCountTimestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
        }
        return p;
      })
    );
    const prod = inventoryProducts.find(p => p.id === productId);
    addAuditLog('ADJUST_INVENTORY', `Product: ${prod?.name || productId}`, `معايرة عداد الرؤية الحاسوبية يدوياً إلى ${newCount} قطعة`, productId);
  };

  return (
    <LiveCCTVContext.Provider
      value={{
        cameras,
        selectedCamera,
        setSelectedCamera,
        behaviorEvents,
        securityIncidents,
        attendanceRecords,
        inventoryProducts,
        outgoingEvents,
        agentHealth,
        devices,
        recorders,
        employees,
        addEmployee,
        notifications,
        unreadAlertsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        updateCameraStatus,
        addCamera,
        addRecorder,
        updateCameraZones,
        updateIncidentStatus,
        updateBehaviorStatus,
        adjustAttendance,
        punchFaceAttendance,
        triggerSimulatedIncident,
        triggerInventoryCountUpdate,
        activeEvidenceIncident,
        setActiveEvidenceIncident,
        customerWhatsAppSettings,
        updateCustomerWhatsAppSettings,
        whatsappCallState,
        triggerWhatsAppCall,
        acceptWhatsAppCall,
        declineWhatsAppCall,
        dispatchWhatsAppAlert,
        whatsappDispatchLogs,
        lastWhatsAppToast,
        dismissWhatsAppToast,
      }}
    >
      {children}
    </LiveCCTVContext.Provider>
  );
};

export const useLiveCCTV = () => {
  const context = useContext(LiveCCTVContext);
  if (!context) {
    throw new Error('useLiveCCTV must be used within LiveCCTVProvider');
  }
  return context;
};
