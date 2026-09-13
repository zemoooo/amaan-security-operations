import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

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
  SeverityLevel,
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

  addInventoryProduct: (
    product: Partial<InventoryProduct> & { name: string }
  ) => Promise<InventoryProduct>;

  addEmployee: (
    employee: Partial<Employee> & {
      name: string;
      department?: string;
      position?: string;
      employeeCode?: string;
      photoUrl?: string;
    }
  ) => Promise<Employee>;

  notifications: AlertNotification[];
  unreadAlertsCount: number;

  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  updateCameraStatus: (
    cameraId: string,
    status: Camera['status']
  ) => void;

  addCamera: (
    newCamera: Omit<Camera, 'id' | 'lastPing'>
  ) => Promise<void>;

  addRecorder: (
    newRecorder: Omit<RecorderDevice, 'id' | 'lastSync'>
  ) => Promise<void>;

  updateCameraZones: (
    cameraId: string,
    zones: CameraZone[]
  ) => void;

  updateIncidentStatus: (
    incidentId: string,
    status: SecurityIncident['status'],
    notes?: string
  ) => void;

  updateBehaviorStatus: (
    eventId: string,
    status: BehaviorEvent['reviewStatus'],
    notes?: string
  ) => void;

  adjustAttendance: (
    recordId: string,
    excuseType: string,
    notes: string
  ) => void;

  punchFaceAttendance: (
    employeeId: string | 'unknown',
    isEntry: boolean
  ) => {
    success: boolean;
    message: string;
    record?: AttendanceRecord;
  };

  triggerInventoryCountUpdate: (
    productId: string,
    newCount: number
  ) => void;

  activeEvidenceIncident: SecurityIncident | null;

  setActiveEvidenceIncident: (
    incident: SecurityIncident | null
  ) => void;

  customerWhatsAppSettings: CustomerWhatsAppSettings;

  updateCustomerWhatsAppSettings: (
    settings: Partial<CustomerWhatsAppSettings>
  ) => Promise<void>;

  whatsappCallState: WhatsAppCallState | null;

  triggerWhatsAppCall: (details: {
    title: string;
    reason: string;
    cameraName: string;
    severity?: SeverityLevel;
    incidentId?: string;
  }) => void;

  acceptWhatsAppCall: () => void;
  declineWhatsAppCall: () => void;

  dispatchWhatsAppAlert: (options?: {
    action?: 'MESSAGE' | 'CALL' | 'BOTH';
    incidentTitle?: string;
    reason?: string;
    cameraName?: string;
    severity?: SeverityLevel;
    incidentId?: string;
  }) => Promise<any>;

  whatsappDispatchLogs: WhatsAppDispatchLog[];

  lastWhatsAppToast: {
    message: string;
    type: 'MESSAGE' | 'CALL';
    visible: boolean;
  } | null;

  dismissWhatsAppToast: () => void;
}

const LiveCCTVContext = createContext<
  LiveCCTVContextType | undefined
>(undefined);

export const LiveCCTVProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const {
    addAuditLog,
    currentTenant,
    currentUser,
  } = useAuth();

  // =========================================================
  // Cameras
  // =========================================================

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] =
    useState<Camera | null>(null);

  // =========================================================
  // Security / AI Events
  // =========================================================

  const [behaviorEvents, setBehaviorEvents] =
    useState<BehaviorEvent[]>([]);

  const [securityIncidents, setSecurityIncidents] =
    useState<SecurityIncident[]>([]);

  // =========================================================
  // Attendance
  // =========================================================

  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>([]);

  // =========================================================
  // Inventory
  // =========================================================

  const [inventoryProducts, setInventoryProducts] =
    useState<InventoryProduct[]>([]);

  const [outgoingEvents] =
    useState<OutgoingProductEvent[]>([]);

  // =========================================================
  // Agent Health
  // =========================================================

  const [agentHealth, setAgentHealth] =
    useState<AgentHealth>({
      status: 'OPTIMAL',
      cpuUsage: 0,
      ramUsage: 0,
      networkLatency: 0,
      gpuUsage: 0,
      temperature: 0,
      uptime: '0h 0m',
      lastPing: new Date().toISOString(),
    });

  // =========================================================
  // Devices
  // =========================================================

  const [devices] = useState<DeviceNode[]>([]);

  const [recorders, setRecorders] =
    useState<RecorderDevice[]>([]);

  // =========================================================
  // Employees
  // =========================================================

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  // =========================================================
  // Evidence
  // =========================================================

  const [activeEvidenceIncident, setActiveEvidenceIncident] =
    useState<SecurityIncident | null>(null);

  // =========================================================
  // Load initial data
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const fetchedCameras =
          await db.fetchCameras();

        if (cancelled) return;

        setCameras(fetchedCameras);

        if (fetchedCameras.length > 0) {
          setSelectedCamera(fetchedCameras[0]);
        }

        const [
          fetchedBehaviorEvents,
          fetchedSecurityIncidents,
          fetchedAttendanceRecords,
          fetchedEmployees,
        ] = await Promise.all([
          db.fetchBehaviorEvents(),
          db.fetchSecurityIncidents(),
          db.fetchAttendanceRecords(),
          db.fetchEmployees(),
        ]);

        if (cancelled) return;

        setBehaviorEvents(fetchedBehaviorEvents);
        setSecurityIncidents(fetchedSecurityIncidents);
        setAttendanceRecords(fetchedAttendanceRecords);
        setEmployees(fetchedEmployees);

        try {
          const invRes = await fetch(
            `/api/inventory/products?tenantId=${encodeURIComponent(
              currentTenant.id
            )}`
          );

          const invData = await invRes.json();

          if (!cancelled) {
            setInventoryProducts(
              invData.success
                ? invData.products || []
                : []
            );
          }
        } catch {
          if (!cancelled) {
            setInventoryProducts([]);
          }
        }
      } catch (error) {
        console.error(
          'Failed to load CCTV context data:',
          error
        );
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [currentTenant.id]);

  // =========================================================
  // Notifications
  // =========================================================

  const [notifications, setNotifications] =
    useState<AlertNotification[]>([]);

  const unreadAlertsCount =
    notifications.filter(
      notification => !notification.read
    ).length;

  // =========================================================
  // WhatsApp Default Settings
  // =========================================================

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

  const [
    customerWhatsAppSettings,
    setCustomerWhatsAppSettings,
  ] = useState<CustomerWhatsAppSettings>(
    DEFAULT_CUSTOMER_SETTINGS
  );

  // =========================================================
  // WhatsApp Call
  // =========================================================

  const [whatsappCallState, setWhatsappCallState] =
    useState<WhatsAppCallState | null>(null);

  // =========================================================
  // WhatsApp Logs
  // =========================================================

  const [whatsappDispatchLogs, setWhatsappDispatchLogs] =
    useState<WhatsAppDispatchLog[]>([]);

  // =========================================================
  // WhatsApp Toast
  // =========================================================

  const [lastWhatsAppToast, setLastWhatsAppToast] =
    useState<{
      message: string;
      type: 'MESSAGE' | 'CALL';
      visible: boolean;
    } | null>(null);

  // =========================================================
  // Sync WhatsApp settings & logs
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function syncWhatsAppData() {
      try {
        const settingsRes = await fetch(
          `/api/customer/whatsapp-settings?tenantId=${encodeURIComponent(
            currentTenant.id
          )}&customerEmail=${encodeURIComponent(
            currentUser.email
          )}`
        );

        const settingsData =
          await settingsRes.json();

        if (
          !cancelled &&
          settingsData.success &&
          settingsData.settings
        ) {
          setCustomerWhatsAppSettings(prev => ({
            ...prev,
            ...settingsData.settings,
          }));
        }
      } catch (error) {
        console.error(
          'Failed to load WhatsApp settings:',
          error
        );
      }

      try {
        const logsRes = await fetch(
          `/api/notifications/whatsapp/logs?tenantId=${encodeURIComponent(
            currentTenant.id
          )}`
        );

        const logsData =
          await logsRes.json();

        if (
          !cancelled &&
          logsData.success &&
          Array.isArray(logsData.logs)
        ) {
          setWhatsappDispatchLogs(
            logsData.logs
          );
        }
      } catch (error) {
        console.error(
          'Failed to load WhatsApp logs:',
          error
        );
      }
    }

    syncWhatsAppData();

    return () => {
      cancelled = true;
    };
  }, [
    currentTenant.id,
    currentUser.email,
  ]);

  // =========================================================
  // Update WhatsApp Settings
  // =========================================================

  const updateCustomerWhatsAppSettings =
    async (
      partial: Partial<CustomerWhatsAppSettings>
    ) => {
      const updated = {
        ...customerWhatsAppSettings,
        ...partial,
      };

      setCustomerWhatsAppSettings(updated);

      try {
        const response = await fetch(
          '/api/customer/whatsapp-settings',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...updated,
              tenantId: currentTenant.id,
              customerEmail: currentUser.email,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              'فشل حفظ إعدادات WhatsApp'
          );
        }
      } catch (error) {
        console.error(
          'Failed to sync WhatsApp settings with backend:',
          error
        );

        throw error;
      }
    };

  // =========================================================
  // Trigger WhatsApp Call UI
  // =========================================================

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
      recipient:
        customerWhatsAppSettings.phoneNumber,
      incidentTitle: details.title,
      incidentReason: details.reason,
      cameraName: details.cameraName,
      time: new Date()
        .toTimeString()
        .substring(0, 5),
      severity:
        details.severity || 'CRITICAL',
      durationSec: 0,
      incidentId: details.incidentId,
    });
  };

  // =========================================================
  // Accept WhatsApp Call
  // =========================================================

  const acceptWhatsAppCall = () => {
    setWhatsappCallState(prev =>
      prev
        ? {
            ...prev,
            status: 'CONNECTED',
          }
        : null
    );
  };

  // =========================================================
  // Decline WhatsApp Call
  // =========================================================

  const declineWhatsAppCall = () => {
    setWhatsappCallState(null);
  };

  // =========================================================
  // Dismiss WhatsApp Toast
  // =========================================================

  const dismissWhatsAppToast = () => {
    setLastWhatsAppToast(null);
  };

  // =========================================================
  // Dispatch WhatsApp Alert
  // =========================================================

  const dispatchWhatsAppAlert = async (
    options?: {
      action?: 'MESSAGE' | 'CALL' | 'BOTH';
      incidentTitle?: string;
      reason?: string;
      cameraName?: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => {
    if (!customerWhatsAppSettings.enabled) {
      throw new Error(
        'تنبيهات WhatsApp معطلة'
      );
    }

    if (
      !customerWhatsAppSettings.phoneNumber
    ) {
      throw new Error(
        'أدخل رقم WhatsApp للمشرف'
      );
    }

    if (
      !customerWhatsAppSettings.instanceName
    ) {
      throw new Error(
        'اربط Instance عبر QR أولاً'
      );
    }

    // Determine action
    const actionToTake =
      options?.action ||
      (
        customerWhatsAppSettings.alertMode ===
        'MESSAGE_ONLY'
          ? 'MESSAGE'
          : customerWhatsAppSettings.alertMode ===
              'CALL_ONLY'
            ? 'CALL'
            : 'BOTH'
      );

    const title =
      options?.incidentTitle ||
      'تنبيه أمني عاجل';

    const reason =
      options?.reason ||
      'تم رصد نشاط مريب يتطلب التحقق الفوري';

    const camName =
      options?.cameraName ||
      'المستودع الرئيسي';

    const sev =
      options?.severity ||
      'CRITICAL';

    const incId =
      options?.incidentId ||
      `INC-${Date.now()
        .toString(36)
        .toUpperCase()}`;

    // =======================================================
    // Toast
    // =======================================================

    if (actionToTake === 'CALL') {
      setLastWhatsAppToast({
        message:
          `📞 جارٍ تفعيل تنبيه المكالمة لواتساب العميل (${customerWhatsAppSettings.phoneNumber})`,
        type: 'CALL',
        visible: true,
      });
    } else if (actionToTake === 'BOTH') {
      setLastWhatsAppToast({
        message:
          `🚨 سيتم إرسال رسالة وتنبيه مكالمة إلى واتساب العميل (${customerWhatsAppSettings.phoneNumber})`,
        type: 'CALL',
        visible: true,
      });
    } else {
      setLastWhatsAppToast({
        message:
          `💬 جارٍ إرسال رسالة إلى واتساب العميل (${customerWhatsAppSettings.phoneNumber})`,
        type: 'MESSAGE',
        visible: true,
      });
    }

    // =======================================================
    // Send to backend
    // =======================================================

    try {
      const response = await fetch(
        '/api/notifications/whatsapp/dispatch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Send both names for backend compatibility
            clientNumber:
              customerWhatsAppSettings.phoneNumber,

            phoneNumber:
              customerWhatsAppSettings.phoneNumber,

            action: actionToTake,

            incidentId: incId,
            incidentTitle: title,
            reason,
            cameraName: camName,
            severity: sev,

            tenantId: currentTenant.id,
            customerEmail:
              currentUser.email,

            instanceName:
              customerWhatsAppSettings.instanceName,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            'فشل إرسال WhatsApp'
        );
      }

      if (data.logEntry) {
        setWhatsappDispatchLogs(
          previous => [
            data.logEntry,
            ...previous.slice(0, 49),
          ]
        );
      }

      // Successful message
      setLastWhatsAppToast({
        message:
          actionToTake === 'CALL'
            ? `📞 تم إرسال تنبيه المكالمة بنجاح إلى ${customerWhatsAppSettings.phoneNumber}`
            : actionToTake === 'BOTH'
              ? `🚨 تم إرسال رسالة وتنبيه المكالمة إلى ${customerWhatsAppSettings.phoneNumber}`
              : `💬 تم إرسال رسالة WhatsApp بنجاح إلى ${customerWhatsAppSettings.phoneNumber}`,
        type:
          actionToTake === 'MESSAGE'
            ? 'MESSAGE'
            : 'CALL',
        visible: true,
      });

      return data;
    } catch (error) {
      console.error(
        'WhatsApp dispatch request failed:',
        error
      );

      setLastWhatsAppToast({
        message:
          error instanceof Error
            ? `❌ ${error.message}`
            : '❌ فشل إرسال تنبيه WhatsApp',
        type:
          actionToTake === 'MESSAGE'
            ? 'MESSAGE'
            : 'CALL',
        visible: true,
      });

      // IMPORTANT:
      // Do not hide the error from the caller.
      throw error;
    }
  };

  // =========================================================
  // Notification Read State
  // =========================================================

  const markNotificationAsRead = (
    id: string
  ) => {
    setNotifications(previous =>
      previous.map(notification =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );
  };

  const markAllNotificationsAsRead =
    () => {
      setNotifications(previous =>
        previous.map(notification => ({
          ...notification,
          read: true,
        }))
      );
    };

  // =========================================================
  // Add Inventory Product
  // =========================================================

  const addInventoryProduct =
    async (
      productData: Partial<InventoryProduct> & {
        name: string;
      }
    ) => {
      const payload = {
        tenantId: currentTenant.id,
        name: productData.name,
        sku: productData.sku || '',
        barcode: productData.barcode || '',
        warehouse:
          productData.warehouse || '',
        zone: productData.zone || '',
        cameraName:
          productData.cameraName || '',
        unit:
          productData.unit || 'قطعة',
        unitsPerCarton:
          productData.unitsPerCarton || 1,
        expectedQuantity:
          productData.expectedQuantity || 0,
        aiDetectedQuantity:
          productData.aiDetectedQuantity || 0,
        lowStockThreshold:
          productData.lowStockThreshold || 0,
      };

      const response = await fetch(
        '/api/inventory/products',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            'تعذر إضافة الصنف'
        );
      }

      const normalized =
        data.product as InventoryProduct;

      setInventoryProducts(previous => [
        normalized,
        ...previous.filter(
          product =>
            product.id !== normalized.id
        ),
      ]);

      return normalized;
    };

  // =========================================================
  // Add Employee
  // =========================================================

  const addEmployee =
    async (
      employeeData: Partial<Employee> & {
        name: string;
      }
    ) => {
      const payload = {
        tenantId: currentTenant.id,
        name: employeeData.name,
        employeeCode:
          employeeData.employeeCode || '',
        department:
          employeeData.department || '',
        position:
          employeeData.position || '',
        photoUrl:
          employeeData.photoUrl || '',
        isActive: true,
        allowedZones: [],
        schedule: {
          workDays: [
            0,
            1,
            2,
            3,
            4,
            5,
          ],
          shiftStart: '08:00',
          shiftEnd: '17:00',
          graceMinutes: 15,
        },
      };

      const response = await fetch(
        '/api/employees',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            'تعذر إضافة الموظف'
        );
      }

      const employee =
        data.employee as Employee;

      const normalized: Employee = {
        ...employee,
        tenantId:
          employee.tenantId ||
          currentTenant.id,
        employeeCode:
          employee.employeeCode || '',
        name: employee.name,
        department:
          employee.department || '',
        position:
          employee.position || '',
        phone: employee.phone || '',
        email: employee.email || '',
        photoUrl:
          employee.photoUrl || '',
        faceEmbeddingVector:
          employee.faceEmbeddingVector ||
          [],
        isActive:
          employee.isActive !== false,
        allowedZones:
          employee.allowedZones || [],
        schedule:
          employee.schedule ||
          payload.schedule,
      };

      setEmployees(previous => [
        normalized,
        ...previous.filter(
          employee =>
            employee.id !== normalized.id
        ),
      ]);

      return normalized;
    };

  // =========================================================
  // Camera Status
  // =========================================================

  const updateCameraStatus = (
    cameraId: string,
    status: Camera['status']
  ) => {
    setCameras(previous =>
      previous.map(camera =>
        camera.id === cameraId
          ? {
              ...camera,
              status,
              lastPing: 'الآن',
            }
          : camera
      )
    );

    const targetCamera =
      cameras.find(
        camera =>
          camera.id === cameraId
      );

    addAuditLog(
      'UPDATE_CAMERA',
      `Camera: ${
        targetCamera?.name || cameraId
      }`,
      `تعديل حالة الكاميرا يدوياً إلى: ${status}`,
      cameraId
    );
  };

  // =========================================================
  // Add Camera
  // =========================================================

  const addCamera = async (
    newCamData: Omit<
      Camera,
      'id' | 'lastPing'
    >
  ) => {
    const newId =
      `cam-${Date.now().toString(36)}`;

    const response = await fetch(
      '/api/cameras',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          ...newCamData,
          id: newId,
        }),
      }
    );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          'تعذر حفظ الكاميرا'
      );
    }

    const camera: Camera = {
      ...newCamData,
      id: data.camera.id,
      lastPing:
        new Date().toISOString(),
    };

    setCameras(previous => [
      ...previous,
      camera,
    ]);

    addAuditLog(
      'ADD_CAMERA',
      `Camera: ${camera.name}`,
      `إضافة كاميرا جديدة بنظام ${camera.type} وتفعيل الذكاء الاصطناعي: ${camera.aiEnabled}`,
      camera.id
    );
  };

  // =========================================================
  // Add Recorder
  // =========================================================

  const addRecorder = async (
    newRecorderData: Omit<
      RecorderDevice,
      'id' | 'lastSync'
    >
  ) => {
    const newId =
      `rec-${Date.now().toString(36)}`;

    const response = await fetch(
      '/api/recorders',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          ...newRecorderData,
          id: newId,
        }),
      }
    );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          'تعذر حفظ جهاز التسجيل'
      );
    }

    const recorder: RecorderDevice = {
      ...newRecorderData,
      id: data.recorder.id,
      lastSync:
        new Date().toISOString(),
    };

    setRecorders(previous => [
      ...previous,
      recorder,
    ]);

    addAuditLog(
      'ADD_CAMERA',
      `Recorder: ${recorder.name}`,
      `إضافة جهاز تسجيل جديد من نوع ${recorder.type} بسعة ${recorder.channels} قناة`,
      recorder.id
    );
  };

  // =========================================================
  // Camera Zones
  // =========================================================

  const updateCameraZones = (
    cameraId: string,
    zones: CameraZone[]
  ) => {
    setCameras(previous =>
      previous.map(camera =>
        camera.id === cameraId
          ? {
              ...camera,
              zones,
            }
          : camera
      )
    );

    const camera =
      cameras.find(
        item =>
          item.id === cameraId
      );

    addAuditLog(
      'ADD_WAREHOUSE_ZONE',
      `Camera: ${
        camera?.name || cameraId
      }`,
      `تحديث مناطق الكشف والعد الجغرافي (${zones.length} مناطق محددة)`,
      cameraId
    );
  };

  // =========================================================
  // Incident Status
  // =========================================================

  const updateIncidentStatus = (
    incidentId: string,
    status: SecurityIncident['status'],
    notes?: string
  ) => {
    setSecurityIncidents(previous =>
      previous.map(incident => {
        if (
          incident.id !== incidentId
        ) {
          return incident;
        }

        return {
          ...incident,
          status,
          reviewedBy:
            currentUser.name,
          reviewedAt:
            new Date()
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19),
          reviewNotes:
            notes ||
            incident.reviewNotes,
        };
      })
    );

    addAuditLog(
      'REVIEW_INCIDENT',
      `Incident: ${incidentId}`,
      `مراجعة بشرية للحادث وتحديث الحالة إلى ${status}. ملاحظات: ${
        notes || 'لا توجد'
      }`,
      incidentId
    );
  };

  // =========================================================
  // Behavior Status
  // =========================================================

  const updateBehaviorStatus = (
    eventId: string,
    status: BehaviorEvent['reviewStatus'],
    notes?: string
  ) => {
    setBehaviorEvents(previous =>
      previous.map(event => {
        if (event.id !== eventId) {
          return event;
        }

        return {
          ...event,
          reviewStatus: status,
          reviewedBy:
            currentUser.name,
          reviewedAt:
            new Date()
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19),
          notes:
            notes || event.notes,
        };
      })
    );

    addAuditLog(
      'REVIEW_INCIDENT',
      `BehaviorEvent: ${eventId}`,
      `مراجعة الحدث السلوكي وتحديث حالته إلى: ${status}`,
      eventId
    );
  };

  // =========================================================
  // Attendance Adjustment
  // =========================================================

  const adjustAttendance = (
    recordId: string,
    excuseType: string,
    notes: string
  ) => {
    setAttendanceRecords(previous =>
      previous.map(record => {
        if (record.id !== recordId) {
          return record;
        }

        return {
          ...record,
          status: 'LEAVE',
          adjustedBySupervisor: true,
          adjustmentReason:
            `[${excuseType}] ${notes} (تم التعديل بواسطة المشرف: ${currentUser.name})`,
        };
      })
    );

    const record =
      attendanceRecords.find(
        item =>
          item.id === recordId
      );

    addAuditLog(
      'ADJUST_ATTENDANCE',
      `Attendance: ${
        record?.employeeName || ''
      }`,
      `تسجيل عذر مشرف [${excuseType}]: ${notes}`,
      recordId
    );
  };

  // =========================================================
  // Face Attendance
  // =========================================================

  const punchFaceAttendance = (
    employeeId: string | 'unknown',
    isEntry: boolean
  ) => {
    if (employeeId === 'unknown') {
      return {
        success: false,
        message:
          'التعرف على شخص غير مسجل يتم فقط من وكيل AI الحقيقي؛ لا يتم إنشاء أحداث وهمية.',
      };
    }

    const employee =
      employees.find(
        item =>
          item.id === employeeId
      );

    if (!employee) {
      return {
        success: false,
        message:
          'الموظف غير موجود.',
      };
    }

    const now = new Date();

    const date =
      now.toISOString().slice(0, 10);

    const time =
      now.toTimeString().slice(0, 8);

    const existing =
      attendanceRecords.find(
        record =>
          record.employeeId ===
            employeeId &&
          record.date === date
      );

    const updated: AttendanceRecord =
      existing
        ? {
            ...existing,
            firstEntryTime: isEntry
              ? existing.firstEntryTime ||
                time
              : existing.firstEntryTime,
            lastExitTime: !isEntry
              ? time
              : existing.lastExitTime,
            status: 'PRESENT',
          }
        : {
            id: `att-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            tenantId:
              currentTenant.id,
            employeeId,
            employeeName:
              employee.name,
            department:
              employee.department ||
              '',
            photoUrl:
              employee.photoUrl || '',
            date,
            firstEntryTime:
              isEntry ? time : '',
            lastExitTime:
              !isEntry ? time : '',
            totalWorkingMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            overtimeMinutes: 0,
            status: 'PRESENT',
            adjustedBySupervisor: false,
          };

    setAttendanceRecords(previous => [
      updated,
      ...previous.filter(
        record =>
          record.id !== updated.id
      ),
    ]);

    return {
      success: true,
      message: isEntry
        ? `تم تسجيل دخول ${employee.name}`
        : `تم تسجيل خروج ${employee.name}`,
      record: updated,
    };
  };

  // =========================================================
  // Inventory Count
  // =========================================================

  const triggerInventoryCountUpdate = (
    productId: string,
    newCount: number
  ) => {
    setInventoryProducts(previous =>
      previous.map(product => {
        if (product.id !== productId) {
          return product;
        }

        const difference =
          newCount -
          product.expectedQuantity;

        return {
          ...product,
          aiDetectedQuantity:
            newCount,
          difference,
          status:
            difference !== 0
              ? 'DISCREPANCY'
              : newCount <=
                  product.lowStockThreshold
                ? 'LOW_STOCK'
                : 'NORMAL',
          lastCountTimestamp:
            new Date()
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19),
        };
      })
    );

    const product =
      inventoryProducts.find(
        item =>
          item.id === productId
      );

    addAuditLog(
      'ADJUST_INVENTORY',
      `Product: ${
        product?.name || productId
      }`,
      `معايرة عداد الرؤية الحاسوبية يدوياً إلى ${newCount} قطعة`,
      productId
    );
  };

  // =========================================================
  // Provider
  // =========================================================

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

// ===========================================================
// Hook
// ===========================================================

export const useLiveCCTV = () => {
  const context =
    useContext(LiveCCTVContext);

  if (!context) {
    throw new Error(
      'useLiveCCTV must be used within LiveCCTVProvider'
    );
  }

  return context;
};
