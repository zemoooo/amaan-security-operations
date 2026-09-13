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
  addInventoryProduct: (product: Partial<InventoryProduct> & { name: string }) => Promise<InventoryProduct>;
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
      try {
        const invRes = await fetch(`/api/inventory/products?tenantId=${encodeURIComponent(currentTenant.id)}`);
        const invData = await invRes.json();
        setInventoryProducts(invData.success ? (invData.products || []) : []);
      } catch { setInventoryProducts([]); }
      setEmployees(await db.fetchEmployees());
    }
    
    loadData();
  }, []);

  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  const unreadAlertsCount = notifications.filter(n => !n.read).length;

  const DEFAULT_CUSTOMER_SETTINGS: CustomerWhatsAppSettings = {
    instanceName: '',
    phoneNumber: '',
    customerName: '',
    enabled: true,
    alertMode: 'MESSAGE_ONLY',
    minSeverity: 'MEDIUM',
    callRingtoneEnabled: true,
    autoPlayVoiceBriefing: true,
    language: 'ar',
  };

  const [customerWhatsAppSettings, setCustomerWhatsAppSettings] = useState<CustomerWhatsAppSettings>(DEFAULT_CUSTOMER_SETTINGS);

  const [whatsappCallState, setWhatsappCallState] = useState<WhatsAppCallState | null>(null);
  const [whatsappDispatchLogs, setWhatsappDispatchLogs] = useState<WhatsAppDispatchLog[]>([]);
  const [lastWhatsAppToast, setLastWhatsAppToast] = useState<{ message: string; type: 'MESSAGE' | 'CALL'; visible: boolean } | null>(null);

  // Sync settings & logs with backend
  useEffect(() => {
    fetch(`/api/customer/whatsapp-settings?tenantId=${encodeURIComponent(currentTenant.id)}&customerEmail=${encodeURIComponent(currentUser.email)}`)
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

    fetch(`/api/notifications/whatsapp/logs?tenantId=${encodeURIComponent(currentTenant.id)}`)
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
      await fetch('/api/customer/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, tenantId: currentTenant.id, customerEmail: currentUser.email }),
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
    if (!customerWhatsAppSettings.enabled) throw new Error('تنبيهات WhatsApp معطلة');
    if (!customerWhatsAppSettings.phoneNumber) throw new Error('أدخل رقم WhatsApp للمشرف');
    if (!customerWhatsAppSettings.instanceName) throw new Error('اربط Instance عبر QR أولاً');

    const actionToTake = 'MESSAGE';
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
          tenantId: currentTenant.id,
          customerEmail: currentUser.email,
          instanceName: customerWhatsAppSettings.instanceName,
        }),
      });
      const data = await res.json();
      if (data.success && data.logEntry) {
        setWhatsappDispatchLogs(prev => [data.logEntry, ...prev.slice(0, 49)]);
      }
      if (!data.success) throw new Error(data.error || 'فشل إرسال WhatsApp');
      return data;
    } catch (err) {
      console.error('WhatsApp dispatch request failed:', err);
    }
  };

  // Agent health is populated only from real Edge Agent heartbeats; no synthetic metrics.


  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addInventoryProduct = async (productData: Partial<InventoryProduct> & { name: string }) => {
    const payload = {
      tenantId: currentTenant.id, name: productData.name, sku: productData.sku || '',
      barcode: productData.barcode || '', warehouse: productData.warehouse || '',
      zone: productData.zone || '', cameraName: productData.cameraName || '',
      unit: productData.unit || 'قطعة', unitsPerCarton: productData.unitsPerCarton || 1,
      expectedQuantity: productData.expectedQuantity || 0,
      aiDetectedQuantity: productData.aiDetectedQuantity || 0,
      lowStockThreshold: productData.lowStockThreshold || 0
    };
    const response = await fetch('/api/inventory/products', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'تعذر إضافة الصنف');
    const normalized = data.product as InventoryProduct;
    setInventoryProducts(prev => [normalized, ...prev.filter(x => x.id !== normalized.id)]);
    return normalized;
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
    if (employeeId === 'unknown') {
      return { success: false, message: 'التعرف على شخص غير مسجل يتم فقط من وكيل AI الحقيقي؛ لا يتم إنشاء أحداث وهمية.' };
    }
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return { success: false, message: 'الموظف غير موجود.' };
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8);
    const existing = attendanceRecords.find(r => r.employeeId === employeeId && r.date === date);
    const updated: AttendanceRecord = existing ? {
      ...existing,
      firstEntryTime: isEntry ? (existing.firstEntryTime || time) : existing.firstEntryTime,
      lastExitTime: !isEntry ? time : existing.lastExitTime,
      status: 'PRESENT'
    } : {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, tenantId: currentTenant.id, employeeId,
      employeeName: employee.name, department: employee.department || '', photoUrl: employee.photoUrl || '',
      date, firstEntryTime: isEntry ? time : '', lastExitTime: !isEntry ? time : '',
      totalWorkingMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0,
      status: 'PRESENT', adjustedBySupervisor: false
    };
    setAttendanceRecords(prev => [updated, ...prev.filter(r => r.id !== updated.id)]);
    return { success: true, message: isEntry ? `تم تسجيل دخول ${employee.name}` : `تم تسجيل خروج ${employee.name}`, record: updated };
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
        addInventoryProduct,
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
