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

  triggerSimulatedIncident: (
    type: 'THEFT' | 'INTRUSION' | 'LOITERING'
  ) => void;

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

  triggerWhatsAppCall: (
    details: {
      title: string;
      reason: string;
      cameraName: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => void;

  acceptWhatsAppCall: () => void;
  declineWhatsAppCall: () => void;

  dispatchWhatsAppAlert: (
    options?: {
      action?:
        | 'MESSAGE'
        | 'CALL'
        | 'BOTH'
        | 'MESSAGE_ONLY'
        | 'CALL_ONLY'
        | 'MESSAGE_AND_CALL';

      incidentTitle?: string;
      reason?: string;
      cameraName?: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => Promise<any>;

  whatsappDispatchLogs: WhatsAppDispatchLog[];

  lastWhatsAppToast: {
    message: string;
    type: 'MESSAGE' | 'CALL';
    visible: boolean;
  } | null;

  dismissWhatsAppToast: () => void;
}

const LiveCCTVContext =
  createContext<LiveCCTVContextType | undefined>(
    undefined
  );

const normalizePhoneNumber = (
  value: unknown
): string => {
  return String(value || '').replace(/[^\d]/g, '');
};

const sanitizeWhatsAppSettings = (
  settings: Partial<CustomerWhatsAppSettings>
): CustomerWhatsAppSettings => {
  const rawPhone =
    String(settings.phoneNumber || '').trim();

  const rawName =
    String(settings.customerName || '').trim();

  const phoneNumber = normalizePhoneNumber(rawPhone);
  const customerName = rawName;

  const instanceName =
    String(settings.instanceName || '').trim();

  return {
    instanceName,
    phoneNumber,
    customerName,

    enabled:
      settings.enabled === true,

    alertMode:
      settings.alertMode ||
      'MESSAGE_AND_CALL',

    minSeverity:
      settings.minSeverity ||
      'MEDIUM',

    callRingtoneEnabled:
      settings.callRingtoneEnabled !== false,

    autoPlayVoiceBriefing:
      settings.autoPlayVoiceBriefing !== false,

    language:
      settings.language || 'ar',
  };
};

export const LiveCCTVProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const {
    addAuditLog,
    currentTenant,
    currentUser,
  } = useAuth();

  const [
    cameras,
    setCameras,
  ] = useState<Camera[]>([]);

  const [
    selectedCamera,
    setSelectedCamera,
  ] = useState<Camera | null>(null);

  const [
    behaviorEvents,
    setBehaviorEvents,
  ] = useState<BehaviorEvent[]>([]);

  const [
    securityIncidents,
    setSecurityIncidents,
  ] = useState<SecurityIncident[]>([]);

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<AttendanceRecord[]>([]);

  const [
    inventoryProducts,
    setInventoryProducts,
  ] = useState<InventoryProduct[]>([]);

  const [
    outgoingEvents,
    setOutgoingEvents,
  ] = useState<OutgoingProductEvent[]>([]);

  const [
    agentHealth,
    setAgentHealth,
  ] = useState<AgentHealth>({
    status: 'OPTIMAL',
    cpuUsage: 0,
    ramUsage: 0,
    networkLatency: 0,
    gpuUsage: 0,
    temperature: 0,
    uptime: '0h 0m',
    lastPing: new Date().toISOString(),
  });

  const [devices] =
    useState<DeviceNode[]>([]);

  const [
    recorders,
    setRecorders,
  ] = useState<RecorderDevice[]>([]);

  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);

  const [
    activeEvidenceIncident,
    setActiveEvidenceIncident,
  ] =
    useState<SecurityIncident | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const fetchedCameras =
          await db.fetchCameras();

        if (cancelled) return;

        setCameras(
          fetchedCameras
        );

        if (
          fetchedCameras.length > 0
        ) {
          setSelectedCamera(
            fetchedCameras[0]
          );
        }

        setBehaviorEvents(
          await db.fetchBehaviorEvents()
        );

        setSecurityIncidents(
          await db.fetchSecurityIncidents()
        );

        setAttendanceRecords(
          await db.fetchAttendanceRecords()
        );

        setInventoryProducts(
          await db.fetchInventoryProducts()
        );

        setEmployees(
          await db.fetchEmployees()
        );
      } catch (error) {
        console.error(
          '[LiveCCTV] Failed to load data:',
          error
        );
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const [
    notifications,
    setNotifications,
  ] =
    useState<AlertNotification[]>([]);

  const unreadAlertsCount =
    notifications.filter(
      n => !n.read
    ).length;

  const DEFAULT_CUSTOMER_SETTINGS: CustomerWhatsAppSettings =
    {
      instanceName: '',
      phoneNumber: '',
      customerName: '',
      enabled: false,
      alertMode:
        'MESSAGE_AND_CALL',
      minSeverity: 'MEDIUM',
      callRingtoneEnabled: true,
      autoPlayVoiceBriefing: true,
      language: 'ar',
    };

  const [
    customerWhatsAppSettings,
    setCustomerWhatsAppSettings,
  ] =
    useState<CustomerWhatsAppSettings>(
      () => {
        try {
          const saved =
            localStorage.getItem(
              'cctv_customer_whatsapp'
            );

          if (!saved) {
            return DEFAULT_CUSTOMER_SETTINGS;
          }

          const parsed =
            JSON.parse(saved) as Partial<CustomerWhatsAppSettings>;

          const cleaned =
            sanitizeWhatsAppSettings(
              parsed
            );

          localStorage.setItem(
            'cctv_customer_whatsapp',
            JSON.stringify(cleaned)
          );

          return cleaned;
        } catch (error) {
          console.error(
            '[WhatsApp Settings] Failed to load local settings:',
            error
          );

          return DEFAULT_CUSTOMER_SETTINGS;
        }
      }
    );

  const [
    whatsappCallState,
    setWhatsappCallState,
  ] =
    useState<WhatsAppCallState | null>(
      null
    );

  const [
    whatsappDispatchLogs,
    setWhatsappDispatchLogs,
  ] =
    useState<WhatsAppDispatchLog[]>([]);

  const [
    lastWhatsAppToast,
    setLastWhatsAppToast,
  ] =
    useState<{
      message: string;
      type: 'MESSAGE' | 'CALL';
      visible: boolean;
    } | null>(null);

  useEffect(() => {
    if (
      !currentTenant?.id ||
      !currentUser?.email
    ) {
      return;
    }

    let cancelled = false;

    const loadWhatsAppData =
      async () => {
        try {
          const settingsResponse =
            await fetch(
              `/api/customer/whatsapp-settings?tenantId=${encodeURIComponent(
                currentTenant.id
              )}&customerEmail=${encodeURIComponent(
                currentUser.email
              )}`
            );

          let settingsData: any =
            null;

          try {
            settingsData =
              await settingsResponse.json();
          } catch {
            settingsData = null;
          }

          if (
            !cancelled &&
            settingsData?.success &&
            settingsData?.settings
          ) {
            const cleanedServerSettings =
              sanitizeWhatsAppSettings(
                settingsData.settings
              );

            setCustomerWhatsAppSettings(
              prev => {
                const merged =
                  sanitizeWhatsAppSettings({
                    ...prev,
                    ...cleanedServerSettings,
                  });

                try {
                  localStorage.setItem(
                    'cctv_customer_whatsapp',
                    JSON.stringify(
                      merged
                    )
                  );
                } catch {}

                return merged;
              }
            );
          }

          const logsResponse =
            await fetch(
              '/api/notifications/whatsapp/logs'
            );

          let logsData: any = null;

          try {
            logsData =
              await logsResponse.json();
          } catch {
            logsData = null;
          }

          if (
            !cancelled &&
            logsData?.success &&
            Array.isArray(
              logsData.logs
            )
          ) {
            setWhatsappDispatchLogs(
              logsData.logs
            );
          }
        } catch (error) {
          console.error(
            '[WhatsApp] Failed to load backend settings/logs:',
            error
          );
        }
      };

    loadWhatsAppData();

    return () => {
      cancelled = true;
    };
  }, [
    currentTenant?.id,
    currentUser?.email,
  ]);

  const updateCustomerWhatsAppSettings =
    async (
      partial: Partial<CustomerWhatsAppSettings>
    ) => {
      const updated =
        sanitizeWhatsAppSettings({
          ...customerWhatsAppSettings,
          ...partial,
        });

      setCustomerWhatsAppSettings(
        updated
      );

      try {
        localStorage.setItem(
          'cctv_customer_whatsapp',
          JSON.stringify(updated)
        );
      } catch (error) {
        console.error(
          '[WhatsApp Settings] LocalStorage save failed:',
          error
        );
      }

      if (
        !currentTenant?.id ||
        !currentUser?.email
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            '/api/customer/whatsapp-settings',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                ...updated,
                tenantId:
                  currentTenant.id,
                customerEmail:
                  currentUser.email,
              }),
            }
          );

        let data: any = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (
          !response.ok ||
          data?.success === false
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              `HTTP ${response.status}`
          );
        }
      } catch (error) {
        console.error(
          '[WhatsApp Settings] Failed to sync with backend:',
          error
        );
      }
    };

  const triggerWhatsAppCall = (
    details: {
      title: string;
      reason: string;
      cameraName: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => {
    const recipient =
      normalizePhoneNumber(
        customerWhatsAppSettings.phoneNumber
      );

    if (!recipient) {
      console.warn(
        '[WhatsApp Call] No valid recipient number'
      );

      return;
    }

    setWhatsappCallState({
      active: true,
      status: 'RINGING',
      recipient,
      incidentTitle:
        details.title,
      incidentReason:
        details.reason,
      cameraName:
        details.cameraName,
      time: new Date()
        .toTimeString()
        .substring(0, 5),
      severity:
        details.severity ||
        'CRITICAL',
      durationSec: 0,
      incidentId:
        details.incidentId,
    });
  };

  const acceptWhatsAppCall =
    () => {
      setWhatsappCallState(
        prev =>
          prev
            ? {
                ...prev,
                status:
                  'CONNECTED',
              }
            : null
      );
    };

  const declineWhatsAppCall =
    () => {
      setWhatsappCallState(null);
    };

  const dismissWhatsAppToast =
    () => {
      setLastWhatsAppToast(
        null
      );
    };

  const normalizeWhatsAppAction =
    (
      action:
        | 'MESSAGE'
        | 'CALL'
        | 'BOTH'
        | 'MESSAGE_ONLY'
        | 'CALL_ONLY'
        | 'MESSAGE_AND_CALL'
    ): 'MESSAGE' | 'CALL' | 'BOTH' => {
      switch (action) {
        case 'CALL':
        case 'CALL_ONLY':
          return 'CALL';

        case 'BOTH':
        case 'MESSAGE_AND_CALL':
          return 'BOTH';

        case 'MESSAGE':
        case 'MESSAGE_ONLY':
        default:
          return 'MESSAGE';
      }
    };

  const dispatchWhatsAppAlert =
    async (
      options?: {
        action?:
          | 'MESSAGE'
          | 'CALL'
          | 'BOTH'
          | 'MESSAGE_ONLY'
          | 'CALL_ONLY'
          | 'MESSAGE_AND_CALL';

        incidentTitle?: string;
        reason?: string;
        cameraName?: string;
        severity?: SeverityLevel;
        incidentId?: string;
      }
    ) => {
      if (
        !customerWhatsAppSettings.enabled
      ) {
        throw new Error(
          'تنبيهات واتساب غير مفعلة'
        );
      }

      const rawPhone =
        String(
          customerWhatsAppSettings.phoneNumber ||
            ''
        ).trim();

      if (!rawPhone) {
        throw new Error(
          'لم يتم إدخال رقم واتساب العميل'
        );
      }

      const phoneNumber =
        normalizePhoneNumber(
          rawPhone
        );

      if (!phoneNumber) {
        throw new Error(
          'رقم واتساب العميل غير صالح'
        );
      }

      const instanceName =
        String(
          customerWhatsAppSettings.instanceName ||
            ''
        ).trim();

      if (!instanceName) {
        throw new Error(
          'لم يتم إدخال اسم جلسة WhatsApp'
        );
      }

      const configuredAction =
        options?.action ||
        customerWhatsAppSettings.alertMode;

      const actionToTake =
        normalizeWhatsAppAction(
          configuredAction
        );

      const title =
        options?.incidentTitle?.trim() ||
        'تنبيه أمني';

      const reason =
        options?.reason?.trim() ||
        'تم تسجيل حدث أمني يحتاج إلى المراجعة';

      const camName =
        options?.cameraName?.trim() ||
        '';

      const sev =
        options?.severity ||
        'CRITICAL';

      const incId =
        options?.incidentId ||
        `INC-${Date.now()
          .toString(36)
          .toUpperCase()}`;

      if (
        !currentTenant?.id
      ) {
        throw new Error(
          'لا يوجد Tenant صالح لإرسال تنبيه WhatsApp'
        );
      }

      if (
        !currentUser?.email
      ) {
        throw new Error(
          'لا يوجد بريد مستخدم صالح لإرسال تنبيه WhatsApp'
        );
      }

      try {
        const response =
          await fetch(
            '/api/notifications/whatsapp/dispatch',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                phoneNumber,

                action:
                  actionToTake,

                incidentId:
                  incId,

                incidentTitle:
                  title,

                reason,

                cameraName:
                  camName,

                severity:
                  sev,

                tenantId:
                  currentTenant.id,

                customerEmail:
                  currentUser.email,

                instanceName,
              }),
            }
          );

        let data: any = null;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            `خادم WhatsApp أعاد استجابة غير صالحة (${response.status})`
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `فشل إرسال WhatsApp. HTTP ${response.status}`
          );
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              'فشل إرسال رسالة WhatsApp'
          );
        }

        if (
          data?.logEntry
        ) {
          setWhatsappDispatchLogs(
            prev => [
              data.logEntry,
              ...prev.slice(
                0,
                49
              ),
            ]
          );
        }

        const isCall =
          actionToTake ===
            'CALL' ||
          actionToTake ===
            'BOTH';

        setLastWhatsAppToast({
          message: isCall
            ? `🚨 تم إرسال تنبيه WhatsApp بنجاح إلى (${phoneNumber})`
            : `💬 تم إرسال رسالة WhatsApp بنجاح إلى (${phoneNumber})`,

          type: isCall
            ? 'CALL'
            : 'MESSAGE',

          visible: true,
        });

        if (isCall) {
          triggerWhatsAppCall({
            title,
            reason,
            cameraName:
              camName,
            severity: sev,
            incidentId:
              incId,
          });
        }

        return {
          success: true,
          phoneNumber,
          instanceName,
          action:
            actionToTake,
          data,
          sendResult:
            data?.sendResult ||
            data?.result ||
            data?.evolutionResponse ||
            data?.messageResult ||
            null,
        };
      } catch (error: any) {
        console.error(
          '[WhatsApp] Dispatch failed:',
          error
        );

        setLastWhatsAppToast({
          message:
            `❌ فشل إرسال رسالة WhatsApp: ${
              error?.message ||
              'خطأ غير معروف'
            }`,

          type: 'MESSAGE',

          visible: true,
        });

        throw error;
      }
    };

  useEffect(() => {
    const interval =
      setInterval(() => {
        setAgentHealth(
          prev => ({
            ...prev,

            fpsAverage:
              Number(
                (
                  115 +
                  Math.sin(
                    Date.now() /
                      3000
                  ) *
                    8
                ).toFixed(1)
              ),

            cpuPercent:
              Number(
                (
                  32 +
                  Math.cos(
                    Date.now() /
                      4000
                  ) *
                    5
                ).toFixed(1)
              ),

            gpuPercent:
              Number(
                (
                  60 +
                  Math.sin(
                    Date.now() /
                      2500
                  ) *
                    7
                ).toFixed(1)
              ),
          })
        );
      }, 3000);

    return () =>
      clearInterval(
        interval
      );
  }, []);

  const markNotificationAsRead =
    (id: string) => {
      setNotifications(
        prev =>
          prev.map(
            n =>
              n.id === id
                ? {
                    ...n,
                    read: true,
                  }
                : n
          )
      );
    };

  const markAllNotificationsAsRead =
    () => {
      setNotifications(
        prev =>
          prev.map(
            n => ({
              ...n,
              read: true,
            })
          )
      );
    };

  const addEmployee =
    async (
      employeeData: Partial<Employee> & {
        name: string;
      }
    ) => {
      const payload = {
        tenantId:
          currentTenant.id,

        name:
          employeeData.name,

        employeeCode:
          employeeData.employeeCode ||
          '',

        department:
          employeeData.department ||
          '',

        position:
          employeeData.position ||
          '',

        photoUrl:
          employeeData.photoUrl ||
          '',

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

          shiftStart:
            '08:00',

          shiftEnd:
            '17:00',

          graceMinutes:
            15,
        },
      };

      const response =
        await fetch(
          '/api/employees',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                payload
              ),
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

      const e =
        data.employee as Employee;

      const normalized: Employee =
        {
          ...e,

          tenantId:
            e.tenantId ||
            currentTenant.id,

          employeeCode:
            e.employeeCode ||
            '',

          name:
            e.name,

          department:
            e.department ||
            '',

          position:
            e.position ||
            '',

          phone:
            e.phone ||
            '',

          email:
            e.email ||
            '',

          photoUrl:
            e.photoUrl ||
            '',

          faceEmbeddingVector:
            e.faceEmbeddingVector ||
            [],

          isActive:
            e.isActive !== false,

          allowedZones:
            e.allowedZones ||
            [],

          schedule:
            e.schedule ||
            payload.schedule,
        };

      setEmployees(
        prev => [
          normalized,
          ...prev.filter(
            x =>
              x.id !==
              normalized.id
          ),
        ]
      );

      return normalized;
    };

  const updateCameraStatus =
    (
      cameraId: string,
      status: Camera['status']
    ) => {
      setCameras(
        prev =>
          prev.map(
            c =>
              c.id === cameraId
                ? {
                    ...c,
                    status,
                    lastPing:
                      'الآن',
                  }
                : c
          )
      );

      const targetCam =
        cameras.find(
          c =>
            c.id ===
            cameraId
        );

      addAuditLog(
        'UPDATE_CAMERA',
        `Camera: ${
          targetCam?.name ||
          cameraId
        }`,
        `تعديل حالة الكاميرا يدوياً إلى: ${status}`,
        cameraId
      );
    };

  const addCamera =
    async (
      newCamData: Omit<
        Camera,
        'id' | 'lastPing'
      >
    ) => {
      const newId =
        `cam-${Date.now()
          .toString(36)}`;

      const response =
        await fetch(
          '/api/cameras',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
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

      const cam: Camera = {
        ...newCamData,

        id:
          data.camera.id,

        lastPing:
          new Date().toISOString(),
      };

      setCameras(
        prev => [
          ...prev,
          cam,
        ]
      );

      addAuditLog(
        'ADD_CAMERA',
        `Camera: ${cam.name}`,
        `إضافة كاميرا جديدة بنظام ${cam.type} وتفعيل الذكاء الاصطناعي: ${cam.aiEnabled}`,
        cam.id
      );
    };

  const addRecorder =
    async (
      newRecorderData: Omit<
        RecorderDevice,
        'id' | 'lastSync'
      >
    ) => {
      const newId =
        `rec-${Date.now()
          .toString(36)}`;

      const response =
        await fetch(
          '/api/recorders',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
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

      const rec:
        RecorderDevice = {
        ...newRecorderData,

        id:
          data.recorder.id,

        lastSync:
          new Date().toISOString(),
      };

      setRecorders(
        prev => [
          ...prev,
          rec,
        ]
      );

      addAuditLog(
        'ADD_CAMERA',
        `Recorder: ${rec.name}`,
        `إضافة جهاز تسجيل جديد من نوع ${rec.type} بسعة ${rec.channels} قناة`,
        rec.id
      );
    };

  const updateCameraZones =
    (
      cameraId: string,
      zones: CameraZone[]
    ) => {
      setCameras(
        prev =>
          prev.map(
            c =>
              c.id === cameraId
                ? {
                    ...c,
                    zones,
                  }
                : c
          )
      );

      const cam =
        cameras.find(
          c =>
            c.id ===
            cameraId
        );

      addAuditLog(
        'ADD_WAREHOUSE_ZONE',
        `Camera: ${
          cam?.name ||
          cameraId
        }`,
        `تحديث مناطق الكشف والعد الجغرافي (${zones.length} مناطق محددة)`,
        cameraId
      );
    };

  const updateIncidentStatus =
    (
      incidentId: string,
      status: SecurityIncident['status'],
      notes?: string
    ) => {
      setSecurityIncidents(
        prev =>
          prev.map(
            inc => {
              if (
                inc.id ===
                incidentId
              ) {
                return {
                  ...inc,

                  status,

                  reviewedBy:
                    currentUser.name,

                  reviewedAt:
                    new Date()
                      .toISOString()
                      .replace(
                        'T',
                        ' '
                      )
                      .substring(
                        0,
                        19
                      ),

                  reviewNotes:
                    notes ||
                    inc.reviewNotes,
                };
              }

              return inc;
            }
          )
      );

      addAuditLog(
        'REVIEW_INCIDENT',
        `Incident: ${incidentId}`,
        `مراجعة بشرية للحادث وتحديث الحالة إلى ${status}. ملاحظات: ${
          notes ||
          'لا توجد'
        }`,
        incidentId
      );
    };

  const updateBehaviorStatus =
    (
      eventId: string,
      status: BehaviorEvent['reviewStatus'],
      notes?: string
    ) => {
      setBehaviorEvents(
        prev =>
          prev.map(
            evt => {
              if (
                evt.id ===
                eventId
              ) {
                return {
                  ...evt,

                  reviewStatus:
                    status,

                  reviewedBy:
                    currentUser.name,

                  reviewedAt:
                    new Date()
                      .toISOString()
                      .replace(
                        'T',
                        ' '
                      )
                      .substring(
                        0,
                        19
                      ),

                  notes:
                    notes ||
                    evt.notes,
                };
              }

              return evt;
            }
          )
      );

      addAuditLog(
        'REVIEW_INCIDENT',
        `BehaviorEvent: ${eventId}`,
        `مراجعة الحدث السلوكي وتحديث حالته إلى: ${status}`,
        eventId
      );
    };

  const adjustAttendance =
    (
      recordId: string,
      excuseType: string,
      notes: string
    ) => {
      setAttendanceRecords(
        prev =>
          prev.map(
            rec => {
              if (
                rec.id ===
                recordId
              ) {
                return {
                  ...rec,

                  status:
                    'LEAVE',

                  adjustedBySupervisor:
                    true,

                  adjustmentReason:
                    `[${excuseType}] ${notes} (تم التعديل بواسطة المشرف: ${currentUser.name})`,
                };
              }

              return rec;
            }
          )
      );

      const rec =
        attendanceRecords.find(r => r.id === recordId);

      addAuditLog(
        'REVIEW_INCIDENT',
        `Attendance: ${recordId}`,
        `تعديل سجل الحضور والانصراف (${excuseType}): ${notes}`,
        recordId
      );
    };

  const punchFaceAttendance = (
    employeeId: string | 'unknown',
    isEntry: boolean
  ) => {
    if (employeeId === 'unknown') {
      return {
        success: false,
        message: 'وجه غير معروف، لم يتم تسجيل الحضور',
      };
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'الموظف غير موجود في النظام',
      };
    }

    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 5);
    const dateStr = now.toISOString().split('T')[0];

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now().toString(36)}`,
      tenantId: currentTenant?.id || employee.tenantId,
      employeeId: employee.id,
      employeeName: employee.name,
      timestamp: `${dateStr} ${timeStr}`,
      type: isEntry ? 'ENTRY' : 'EXIT',
      status: 'PRESENT',
      method: 'FACE_RECOGNITION',
    };

    setAttendanceRecords(prev => [newRecord, ...prev]);

    return {
      success: true,
      message: `تم تسجيل ${isEntry ? 'دخول' : 'خروج'} الموظف: ${employee.name} بنجاح`,
      record: newRecord,
    };
  };

  const triggerSimulatedIncident = (
    type: 'THEFT' | 'INTRUSION' | 'LOITERING'
  ) => {
    const titles = {
      THEFT: 'اشتباه عملية سرقة أو اختلاس',
      INTRUSION: 'تسلل أو تجاوز حدود ممنوعة',
      LOITERING: 'تواجد مشبوه لفترة طويلة',
    };

    const newIncident: SecurityIncident = {
      id: `INC-${Date.now().toString(36).toUpperCase()}`,
      tenantId: currentTenant?.id || 'default-tenant',
      title: titles[type] || 'حدث أمني محتمل',
      description: `تم رصد حدث (${type}) بواسطة تحليل الذكاء الاصطناعي في الكاميرا النشطة.`,
      severity: 'HIGH',
      status: 'OPEN',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      cameraId: selectedCamera?.id || 'cam-1',
      cameraName: selectedCamera?.name || 'الكاميرا الرئيسية',
    };

    setSecurityIncidents(prev => [newIncident, ...prev]);

    const newNotification: AlertNotification = {
      id: `notif-${Date.now()}`,
      title: newIncident.title,
      message: newIncident.description,
      timestamp: new Date().toLocaleTimeString(),
      severity: 'HIGH',
      cameraName: newIncident.cameraName,
      read: false,
      incidentId: newIncident.id,
    };

    setNotifications(prev => [newNotification, ...prev]);

    addAuditLog(
      'TRIGGER_INCIDENT',
      `Incident: ${newIncident.id}`,
      `محاكاة وإنشاء حدث أمني نوع: ${type}`,
      newIncident.id
    );
  };

  const triggerInventoryCountUpdate = (
    productId: string,
    newCount: number
  ) => {
    setInventoryProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, currentStock: newCount, lastUpdated: new Date().toISOString() }
          : p
      )
    );
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
    throw new Error('useLiveCCTV must be used within a LiveCCTVProvider');
  }
  return context;
};import React, {
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

import { useAuth } from './AuthContext';[cite: 9, 10]
import * as db from '../lib/supabaseServices';[cite: 9, 10]

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

  triggerSimulatedIncident: (
    type: 'THEFT' | 'INTRUSION' | 'LOITERING'
  ) => void;

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

  triggerWhatsAppCall: (
    details: {
      title: string;
      reason: string;
      cameraName: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => void;

  acceptWhatsAppCall: () => void;
  declineWhatsAppCall: () => void;

  dispatchWhatsAppAlert: (
    options?: {
      action?:
        | 'MESSAGE'
        | 'CALL'
        | 'BOTH'
        | 'MESSAGE_ONLY'
        | 'CALL_ONLY'
        | 'MESSAGE_AND_CALL';

      incidentTitle?: string;
      reason?: string;
      cameraName?: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => Promise<any>;

  whatsappDispatchLogs: WhatsAppDispatchLog[];

  lastWhatsAppToast: {
    message: string;
    type: 'MESSAGE' | 'CALL';
    visible: boolean;
  } | null;

  dismissWhatsAppToast: () => void;
}

const LiveCCTVContext =
  createContext<LiveCCTVContextType | undefined>(
    undefined
  );

/*
 * ============================================================
 * تنظيف رقم الهاتف
 * ============================================================
 */

const normalizePhoneNumber = (
  value: unknown
): string => {
  return String(value || '').replace(/[^\d]/g, '');
};

/*
 * ============================================================
 * تنظيف إعدادات WhatsApp وتعديل الربط بـ Claude بدلاً من Gemini
 * ============================================================
 */

const sanitizeWhatsAppSettings = (
  settings: Partial<CustomerWhatsAppSettings>
): CustomerWhatsAppSettings => {
  const rawPhone =
    String(settings.phoneNumber || '').trim();

  const rawName =
    String(settings.customerName || '').trim();

  const phoneNumber = normalizePhoneNumber(rawPhone);
  const customerName = rawName;

  const instanceName =
    String(settings.instanceName || '').trim();

  return {
    instanceName,
    phoneNumber,
    customerName,

    enabled:
      settings.enabled === true,

    alertMode:
      settings.alertMode ||
      'MESSAGE_AND_CALL',

    minSeverity:
      settings.minSeverity ||
      'MEDIUM',

    callRingtoneEnabled:
      settings.callRingtoneEnabled !== false,

    autoPlayVoiceBriefing:
      settings.autoPlayVoiceBriefing !== false,

    language:
      settings.language || 'ar',
  };
};

export const LiveCCTVProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const {
    addAuditLog,
    currentTenant,
    currentUser,
  } = useAuth();[cite: 9, 10]

  const [
    cameras,
    setCameras,
  ] = useState<Camera[]>([]);

  const [
    selectedCamera,
    setSelectedCamera,
  ] = useState<Camera | null>(null);

  const [
    behaviorEvents,
    setBehaviorEvents,
  ] = useState<BehaviorEvent[]>([]);

  const [
    securityIncidents,
    setSecurityIncidents,
  ] = useState<SecurityIncident[]>([]);

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<AttendanceRecord[]>([]);

  const [
    inventoryProducts,
    setInventoryProducts,
  ] = useState<InventoryProduct[]>([]);

  const [
    outgoingEvents,
    setOutgoingEvents,
  ] = useState<OutgoingProductEvent[]>([]);

  const [
    agentHealth,
    setAgentHealth,
  ] = useState<AgentHealth>({
    status: 'OPTIMAL',
    cpuUsage: 0,
    ramUsage: 0,
    networkLatency: 0,
    gpuUsage: 0,
    temperature: 0,
    uptime: '0h 0m',
    lastPing: new Date().toISOString(),
  });

  const [devices] =
    useState<DeviceNode[]>([]);

  const [
    recorders,
    setRecorders,
  ] = useState<RecorderDevice[]>([]);

  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);

  const [
    activeEvidenceIncident,
    setActiveEvidenceIncident,
  ] =
    useState<SecurityIncident | null>(
      null
    );

  /*
   * ============================================================
   * تحميل بيانات النظام عبر خدمات Supabase
   * ============================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const fetchedCameras =
          await db.fetchCameras();[cite: 9]

        if (cancelled) return;

        setCameras(
          fetchedCameras
        );

        if (
          fetchedCameras.length > 0
        ) {
          setSelectedCamera(
            fetchedCameras[0]
          );
        }

        setBehaviorEvents(
          await db.fetchBehaviorEvents()
        );

        setSecurityIncidents(
          await db.fetchSecurityIncidents()
        );

        setAttendanceRecords(
          await db.fetchAttendanceRecords()
        );

        setInventoryProducts(
          await db.fetchInventoryProducts()
        );

        setEmployees(
          await db.fetchEmployees()
        );
      } catch (error) {
        console.error(
          '[LiveCCTV] Failed to load data:',
          error
        );
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const [
    notifications,
    setNotifications,
  ] =
    useState<AlertNotification[]>([]);

  const unreadAlertsCount =
    notifications.filter(
      n => !n.read
    ).length;

  const DEFAULT_CUSTOMER_SETTINGS: CustomerWhatsAppSettings =
    {
      instanceName: '',
      phoneNumber: '',
      customerName: '',
      enabled: false,
      alertMode:
        'MESSAGE_AND_CALL',
      minSeverity: 'MEDIUM',
      callRingtoneEnabled: true,
      autoPlayVoiceBriefing: true,
      language: 'ar',
    };

  const [
    customerWhatsAppSettings,
    setCustomerWhatsAppSettings,
  ] =
    useState<CustomerWhatsAppSettings>(
      () => {
        try {
          const saved =
            localStorage.getItem(
              'cctv_customer_whatsapp'
            );

          if (!saved) {
            return DEFAULT_CUSTOMER_SETTINGS;
          }

          const parsed =
            JSON.parse(saved) as Partial<CustomerWhatsAppSettings>;

          const cleaned =
            sanitizeWhatsAppSettings(
              parsed
            );

          localStorage.setItem(
            'cctv_customer_whatsapp',
            JSON.stringify(cleaned)
          );

          return cleaned;
        } catch (error) {
          console.error(
            '[WhatsApp Settings] Failed to load local settings:',
            error
          );

          return DEFAULT_CUSTOMER_SETTINGS;
        }
      }
    );

  const [
    whatsappCallState,
    setWhatsappCallState,
  ] =
    useState<WhatsAppCallState | null>(
      null
    );

  const [
    whatsappDispatchLogs,
    setWhatsappDispatchLogs,
  ] =
    useState<WhatsAppDispatchLog[]>([]);

  const [
    lastWhatsAppToast,
    setLastWhatsAppToast,
  ] =
    useState<{
      message: string;
      type: 'MESSAGE' | 'CALL';
      visible: boolean;
    } | null>(null);

  useEffect(() => {
    if (
      !currentTenant?.id ||
      !currentUser?.email
    ) {
      return;
    }

    let cancelled = false;

    const loadWhatsAppData =
      async () => {
        try {
          const settingsResponse =
            await fetch(
              `/api/customer/whatsapp-settings?tenantId=${encodeURIComponent(
                currentTenant.id
              )}&customerEmail=${encodeURIComponent(
                currentUser.email
              )}`
            );

          let settingsData: any =
            null;

          try {
            settingsData =
              await settingsResponse.json();
          } catch {
            settingsData = null;
          }

          if (
            !cancelled &&
            settingsData?.success &&
            settingsData?.settings
          ) {
            const cleanedServerSettings =
              sanitizeWhatsAppSettings(
                settingsData.settings
              );

            setCustomerWhatsAppSettings(
              prev => {
                const merged =
                  sanitizeWhatsAppSettings({
                    ...prev,
                    ...cleanedServerSettings,
                  });

                try {
                  localStorage.setItem(
                    'cctv_customer_whatsapp',
                    JSON.stringify(
                      merged
                    )
                  );
                } catch {}

                return merged;
              }
            );
          }

          const logsResponse =
            await fetch(
              '/api/notifications/whatsapp/logs'
            );

          let logsData: any = null;

          try {
            logsData =
              await logsResponse.json();
          } catch {
            logsData = null;
          }

          if (
            !cancelled &&
            logsData?.success &&
            Array.isArray(
              logsData.logs
            )
          ) {
            setWhatsappDispatchLogs(
              logsData.logs
            );
          }
        } catch (error) {
          console.error(
            '[WhatsApp] Failed to load backend settings/logs:',
            error
          );
        }
      };

    loadWhatsAppData();

    return () => {
      cancelled = true;
    };
  }, [
    currentTenant?.id,
    currentUser?.email,
  ]);

  const updateCustomerWhatsAppSettings =
    async (
      partial: Partial<CustomerWhatsAppSettings>
    ) => {
      const updated =
        sanitizeWhatsAppSettings({
          ...customerWhatsAppSettings,
          ...partial,
        });

      setCustomerWhatsAppSettings(
        updated
      );

      try {
        localStorage.setItem(
          'cctv_customer_whatsapp',
          JSON.stringify(updated)
        );
      } catch (error) {
        console.error(
          '[WhatsApp Settings] LocalStorage save failed:',
          error
        );
      }

      if (
        !currentTenant?.id ||
        !currentUser?.email
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            '/api/customer/whatsapp-settings',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                ...updated,
                tenantId:
                  currentTenant.id,
                customerEmail:
                  currentUser.email,
              }),
            }
          );

        let data: any = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (
          !response.ok ||
          data?.success === false
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              `HTTP ${response.status}`
          );
        }
      } catch (error) {
        console.error(
          '[WhatsApp Settings] Failed to sync with backend:',
          error
        );
      }
    };

  const triggerWhatsAppCall = (
    details: {
      title: string;
      reason: string;
      cameraName: string;
      severity?: SeverityLevel;
      incidentId?: string;
    }
  ) => {
    const recipient =
      normalizePhoneNumber(
        customerWhatsAppSettings.phoneNumber
      );

    if (!recipient) {
      console.warn(
        '[WhatsApp Call] No valid recipient number'
      );

      return;
    }

    setWhatsappCallState({
      active: true,
      status: 'RINGING',
      recipient,
      incidentTitle:
        details.title,
      incidentReason:
        details.reason,
      cameraName:
        details.cameraName,
      time: new Date()
        .toTimeString()
        .substring(0, 5),
      severity:
        details.severity ||
        'CRITICAL',
      durationSec: 0,
      incidentId:
        details.incidentId,
    });
  };

  const acceptWhatsAppCall =
    () => {
      setWhatsappCallState(
        prev =>
          prev
            ? {
                ...prev,
                status:
                  'CONNECTED',
              }
            : null
      );
    };

  const declineWhatsAppCall =
    () => {
      setWhatsappCallState(null);
    };

  const dismissWhatsAppToast =
    () => {
      setLastWhatsAppToast(
        null
      );
    };

  const normalizeWhatsAppAction =
    (
      action:
        | 'MESSAGE'
        | 'CALL'
        | 'BOTH'
        | 'MESSAGE_ONLY'
        | 'CALL_ONLY'
        | 'MESSAGE_AND_CALL'
    ): 'MESSAGE' | 'CALL' | 'BOTH' => {
      switch (action) {
        case 'CALL':
        case 'CALL_ONLY':
          return 'CALL';

        case 'BOTH':
        case 'MESSAGE_AND_CALL':
          return 'BOTH';

        case 'MESSAGE':
        case 'MESSAGE_ONLY':
        default:
          return 'MESSAGE';
      }
    };

  const dispatchWhatsAppAlert =
    async (
      options?: {
        action?:
          | 'MESSAGE'
          | 'CALL'
          | 'BOTH'
          | 'MESSAGE_ONLY'
          | 'CALL_ONLY'
          | 'MESSAGE_AND_CALL';

        incidentTitle?: string;
        reason?: string;
        cameraName?: string;
        severity?: SeverityLevel;
        incidentId?: string;
      }
    ) => {
      if (
        !customerWhatsAppSettings.enabled
      ) {
        throw new Error(
          'تنبيهات واتساب غير مفعلة'
        );
      }

      const rawPhone =
        String(
          customerWhatsAppSettings.phoneNumber ||
            ''
        ).trim();

      if (!rawPhone) {
        throw new Error(
          'لم يتم إدخال رقم واتساب العميل'
        );
      }

      const phoneNumber =
        normalizePhoneNumber(
          rawPhone
        );

      if (!phoneNumber) {
        throw new Error(
          'رقم واتساب العميل غير صالح'
        );
      }

      const instanceName =
        String(
          customerWhatsAppSettings.instanceName ||
            ''
        ).trim();

      if (!instanceName) {
        throw new Error(
          'لم يتم إدخال اسم جلسة WhatsApp'
        );
      }

      const configuredAction =
        options?.action ||
        customerWhatsAppSettings.alertMode;

      const actionToTake =
        normalizeWhatsAppAction(
          configuredAction
        );

      const title =
        options?.incidentTitle?.trim() ||
        'تنبيه أمني';

      const reason =
        options?.reason?.trim() ||
        'تم تسجيل حدث أمني يحتاج إلى المراجعة';

      const camName =
        options?.cameraName?.trim() ||
        '';

      const sev =
        options?.severity ||
        'CRITICAL';

      const incId =
        options?.incidentId ||
        `INC-${Date.now()
          .toString(36)
          .toUpperCase()}`;

      if (
        !currentTenant?.id
      ) {
        throw new Error(
          'لا يوجد Tenant صالح لإرسال تنبيه WhatsApp'
        );
      }

      if (
        !currentUser?.email
      ) {
        throw new Error(
          'لا يوجد بريد مستخدم صالح لإرسال تنبيه WhatsApp'
        );
      }

      try {
        const response =
          await fetch(
            '/api/notifications/whatsapp/dispatch',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                phoneNumber,

                action:
                  actionToTake,

                incidentId:
                  incId,

                incidentTitle:
                  title,

                reason,

                cameraName:
                  camName,

                severity:
                  sev,

                tenantId:
                  currentTenant.id,

                customerEmail:
                  currentUser.email,

                instanceName,
              }),
            }
          );

        let data: any = null;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            `خادم WhatsApp أعاد استجابة غير صالحة (${response.status})`
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `فشل إرسال WhatsApp. HTTP ${response.status}`
          );
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              'فشل إرسال رسالة WhatsApp'
          );
        }

        if (
          data?.logEntry
        ) {
          setWhatsappDispatchLogs(
            prev => [
              data.logEntry,
              ...prev.slice(
                0,
                49
              ),
            ]
          );
        }

        const isCall =
          actionToTake ===
            'CALL' ||
          actionToTake ===
            'BOTH';

        setLastWhatsAppToast({
          message: isCall
            ? `🚨 تم إرسال تنبيه WhatsApp بنجاح إلى (${phoneNumber})`
            : `💬 تم إرسال رسالة WhatsApp بنجاح إلى (${phoneNumber})`,

          type: isCall
            ? 'CALL'
            : 'MESSAGE',

          visible: true,
        });

        if (isCall) {
          triggerWhatsAppCall({
            title,
            reason,
            cameraName:
              camName,
            severity: sev,
            incidentId:
              incId,
          });
        }

        return {
          success: true,
          phoneNumber,
          instanceName,
          action:
            actionToTake,
          data,
          sendResult:
            data?.sendResult ||
            data?.result ||
            data?.evolutionResponse ||
            data?.messageResult ||
            null,
        };
      } catch (error: any) {
        console.error(
          '[WhatsApp] Dispatch failed:',
          error
        );

        setLastWhatsAppToast({
          message:
            `❌ فشل إرسال رسالة WhatsApp: ${
              error?.message ||
              'خطأ غير معروف'
            }`,

          type: 'MESSAGE',

          visible: true,
        });

        throw error;
      }
    };

  useEffect(() => {
    const interval =
      setInterval(() => {
        setAgentHealth(
          prev => ({
            ...prev,

            fpsAverage:
              Number(
                (
                  115 +
                  Math.sin(
                    Date.now() /
                      3000
                  ) *
                    8
                ).toFixed(1)
              ),

            cpuPercent:
              Number(
                (
                  32 +
                  Math.cos(
                    Date.now() /
                      4000
                  ) *
                    5
                ).toFixed(1)
              ),

            gpuPercent:
              Number(
                (
                  60 +
                  Math.sin(
                    Date.now() /
                      2500
                  ) *
                    7
                ).toFixed(1)
              ),
          })
        );
      }, 3000);

    return () =>
      clearInterval(
        interval
      );
  }, []);

  const markNotificationAsRead =
    (id: string) => {
      setNotifications(
        prev =>
          prev.map(
            n =>
              n.id === id
                ? {
                    ...n,
                    read: true,
                  }
                : n
          )
      );
    };

  const markAllNotificationsAsRead =
    () => {
      setNotifications(
        prev =>
          prev.map(
            n => ({
              ...n,
              read: true,
            })
          )
      );
    };

  const addEmployee =
    async (
      employeeData: Partial<Employee> & {
        name: string;
      }
    ) => {
      const payload = {
        tenantId:
          currentTenant.id,

        name:
          employeeData.name,

        employeeCode:
          employeeData.employeeCode ||
          '',

        department:
          employeeData.department ||
          '',

        position:
          employeeData.position ||
          '',

        photoUrl:
          employeeData.photoUrl ||
          '',

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

          shiftStart:
            '08:00',

          shiftEnd:
            '17:00',

          graceMinutes:
            15,
        },
      };

      const response =
        await fetch(
          '/api/employees',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                payload
              ),
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

      const e =
        data.employee as Employee;

      const normalized: Employee =
        {
          ...e,

          tenantId:
            e.tenantId ||
            currentTenant.id,

          employeeCode:
            e.employeeCode ||
            '',

          name:
            e.name,

          department:
            e.department ||
            '',

          position:
            e.position ||
            '',

          phone:
            e.phone ||
            '',

          email:
            e.email ||
            '',

          photoUrl:
            e.photoUrl ||
            '',

          faceEmbeddingVector:
            e.faceEmbeddingVector ||
            [],

          isActive:
            e.isActive !== false,

          allowedZones:
            e.allowedZones ||
            [],

          schedule:
            e.schedule ||
            payload.schedule,
        };

      setEmployees(
        prev => [
          normalized,
          ...prev.filter(
            x =>
              x.id !==
              normalized.id
          ),
        ]
      );

      return normalized;
    };

  const updateCameraStatus =
    (
      cameraId: string,
      status: Camera['status']
    ) => {
      setCameras(
        prev =>
          prev.map(
            c =>
              c.id === cameraId
                ? {
                    ...c,
                    status,
                    lastPing:
                      'الآن',
                  }
                : c
          )
      );

      const targetCam =
        cameras.find(
          c =>
            c.id ===
            cameraId
        );

      addAuditLog(
        'UPDATE_CAMERA',
        `Camera: ${
          targetCam?.name ||
          cameraId
        }`,
        `تعديل حالة الكاميرا يدوياً إلى: ${status}`,
        cameraId
      );
    };

  const addCamera =
    async (
      newCamData: Omit<
        Camera,
        'id' | 'lastPing'
      >
    ) => {
      const newId =
        `cam-${Date.now()
          .toString(36)}`;

      const response =
        await fetch(
          '/api/cameras',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
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

      const cam: Camera = {
        ...newCamData,

        id:
          data.camera.id,

        lastPing:
          new Date().toISOString(),
      };

      setCameras(
        prev => [
          ...prev,
          cam,
        ]
      );

      addAuditLog(
        'ADD_CAMERA',
        `Camera: ${cam.name}`,
        `إضافة كاميرا جديدة بنظام ${cam.type} وتفعيل الذكاء الاصطناعي: ${cam.aiEnabled}`,
        cam.id
      );
    };

  const addRecorder =
    async (
      newRecorderData: Omit<
        RecorderDevice,
        'id' | 'lastSync'
      >
    ) => {
      const newId =
        `rec-${Date.now()
          .toString(36)}`;

      const response =
        await fetch(
          '/api/recorders',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
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

      const rec:
        RecorderDevice = {
        ...newRecorderData,

        id:
          data.recorder.id,

        lastSync:
          new Date().toISOString(),
      };

      setRecorders(
        prev => [
          ...prev,
          rec,
        ]
      );

      addAuditLog(
        'ADD_CAMERA',
        `Recorder: ${rec.name}`,
        `إضافة جهاز تسجيل جديد من نوع ${rec.type} بسعة ${rec.channels} قناة`,
        rec.id
      );
    };

  const updateCameraZones =
    (
      cameraId: string,
      zones: CameraZone[]
    ) => {
      setCameras(
        prev =>
          prev.map(
            c =>
              c.id === cameraId
                ? {
                    ...c,
                    zones,
                  }
                : c
          )
      );

      const cam =
        cameras.find(
          c =>
            c.id ===
            cameraId
        );

      addAuditLog(
        'ADD_WAREHOUSE_ZONE',
        `Camera: ${
          cam?.name ||
          cameraId
        }`,
        `تحديث مناطق الكشف والعد الجغرافي (${zones.length} مناطق محددة)`,
        cameraId
      );
    };

  const updateIncidentStatus =
    (
      incidentId: string,
      status: SecurityIncident['status'],
      notes?: string
    ) => {
      setSecurityIncidents(
        prev =>
          prev.map(
            inc => {
              if (
                inc.id ===
                incidentId
              ) {
                return {
                  ...inc,

                  status,

                  reviewedBy:
                    currentUser.name,

                  reviewedAt:
                    new Date()
                      .toISOString()
                      .replace(
                        'T',
                        ' '
                      )
                      .substring(
                        0,
                        19
                      ),

                  reviewNotes:
                    notes ||
                    inc.reviewNotes,
                };
              }

              return inc;
            }
          )
      );

      addAuditLog(
        'REVIEW_INCIDENT',
        `Incident: ${incidentId}`,
        `مراجعة بشرية للحادث وتحديث الحالة إلى ${status}. ملاحظات: ${
          notes ||
          'لا توجد'
        }`,
        incidentId
      );
    };

  const updateBehaviorStatus =
    (
      eventId: string,
      status: BehaviorEvent['reviewStatus'],
      notes?: string
    ) => {
      setBehaviorEvents(
        prev =>
          prev.map(
            evt => {
              if (
                evt.id ===
                eventId
              ) {
                return {
                  ...evt,

                  reviewStatus:
                    status,

                  reviewedBy:
                    currentUser.name,

                  reviewedAt:
                    new Date()
                      .toISOString()
                      .replace(
                        'T',
                        ' '
                      )
                      .substring(
                        0,
                        19
                      ),

                  notes:
                    notes ||
                    evt.notes,
                };
              }

              return evt;
            }
          )
      );

      addAuditLog(
        'REVIEW_INCIDENT',
        `BehaviorEvent: ${eventId}`,
        `مراجعة الحدث السلوكي وتحديث حالته إلى: ${status}`,
        eventId
      );
    };

  const adjustAttendance =
    (
      recordId: string,
      excuseType: string,
      notes: string
    ) => {
      setAttendanceRecords(
        prev =>
          prev.map(
            rec => {
              if (
                rec.id ===
                recordId
              ) {
                return {
                  ...rec,

                  status:
                    'LEAVE',

                  adjustedBySupervisor:
                    true,

                  adjustmentReason:
                    `[${excuseType}] ${notes} (تم التعديل بواسطة المشرف: ${currentUser.name})`,
                };
              }

              return rec;
            }
          )
      );

      const rec =
        attendanceRecords.find(
          r =>
            r.id ===
            recordId
        );

      addAuditLog(
        'ADJUST_ATTENDANCE',
        `Attendance: ${
          rec?.employeeName
        }`,
        `تسجيل عذر مشرف [${excuseType}]: ${notes}`,
        recordId
      );
    };

  const punchFaceAttendance =
    (
      employeeId:
        | string
        | 'unknown',
      isEntry: boolean
    ) => {
      const now =
        new Date();

      const timeStr =
        now
          .toTimeString()
          .substring(
            0,
            8
          );

      const dateStr =
        now
          .toISOString()
          .substring(
            0,
            10
          );

      if (
        employeeId ===
        'unknown'
      ) {
        const unknownEventId =
          `evt-unknown-${Date.now()}`;

        const newEvt:
          BehaviorEvent = {
          id:
            unknownEventId,

          tenantId:
            currentTenant.id,

          cameraId:
            'cam-gate-01',

          cameraName:
            'البوابة الرئيسية - دخول الموظفين (Gate 01)',

          cameraLocation:
            'المدخل الإداري الشمالي',

          timestamp:
            `${dateStr} ${timeStr}`,

          eventType:
            'UNAUTHORIZED_ZONE_ENTRY',

          severity:
            'MEDIUM',

          confidence:
            0.92,

          personName:
            'شخص مجهول لم يتعرف عليه النظام (Unknown Person)',

          snapshotUrl:
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',

          videoClipUrl:
            '/demo/videos/unknown_person.mp4',

          reason:
            'تطابق بصمة الوجه أقل من العتبة المسموح بها (0.42 < 0.75) - لم يتم فتح البوابة الإلكترونية.',

          reviewStatus:
            'NEW',
        };

        setBehaviorEvents(
          prev => [
            newEvt,
            ...prev,
          ]
        );

        const newNotif:
          AlertNotification = {
          id:
            `notif-unknown-${Date.now()}`,

          title:
            'شخص غير مسجل عند البوابة',

          message:
            `تم رصد وجه مجهول يحاول الدخول عند البوابة الرئيسية في الساعة ${timeStr}`,

          timestamp:
            `${dateStr} ${timeStr}`,

          severity:
            'MEDIUM',

          cameraName:
            'البوابة الرئيسية',

          read: false,
        };

        setNotifications(
          prev => [
            newNotif,
            ...prev,
          ]
        );

        addAuditLog(
          'VIEW_CAMERA',
          'EntranceGate',
          'رصد شخص مجهول غير مسجل في قاعدة بيانات الموظفين عند البوابة'
        );

        return {
          success: false,

          message:
            'تم رصد وجه مجهول! لم يتطابق مع أي موظف مسجل. تم إنشاء حدث أمني وتنبيه المشرف.',
        };
      }

      const employee =
        employees.find(
          e =>
            e.id ===
            employeeId
        );

      if (!employee) {
        return {
          success: false,
          message:
            'الموظف غير موجود في النظام',
        };
      }

      let updatedRec:
        | AttendanceRecord
        | undefined;

      setAttendanceRecords(
        prev => {
          const existing =
            prev.find(
              r =>
                r.employeeId ===
                  employeeId &&
                r.date ===
                  dateStr
            );

          if (existing) {
            if (isEntry) {
              updatedRec = {
                ...existing,
                firstEntryTime:
                  timeStr,
              };
            } else {
              let totalMinutes =
                existing.totalWorkingMinutes;

              if (
                existing.firstEntryTime
              ) {
                const [
                  h1,
                  m1,
                ] =
                  existing.firstEntryTime
                    .split(':')
                    .map(
                      Number
                    );

                const [
                  h2,
                  m2,
                ] =
                  timeStr
                    .split(':')
                    .map(
                      Number
                    );

                totalMinutes =
                  Math.max(
                    0,
                    h2 *
                      60 +
                      m2 -
                      (h1 *
                        60 +
                        m1)
                  );
              }

              updatedRec = {
                ...existing,

                lastExitTime:
                  timeStr,

                totalWorkingMinutes:
                  totalMinutes,

                status:
                  existing.status ===
                  'LATE'
                    ? 'LATE'
                    : 'PRESENT',
              };
            }

            return prev.map(
              r =>
                r.id ===
                existing.id
                  ? updatedRec!
                  : r
            );
          }

          const isLate =
            timeStr >
            '08:15:00';

          updatedRec = {
            id:
              `att-${dateStr}-${employee.id}`,

            tenantId:
              currentTenant.id,

            employeeId:
              employee.id,

            employeeName:
              employee.name,

            department:
              employee.department,

            photoUrl:
              employee.photoUrl,

            date:
              dateStr,

            firstEntryTime:
              isEntry
                ? timeStr
                : null,

            lastExitTime:
              !isEntry
                ? timeStr
                : null,

            totalWorkingMinutes:
              0,

            lateMinutes:
              isLate
                ? 25
                : 0,

            earlyLeaveMinutes:
              0,

            overtimeMinutes:
              0,

            status:
              isLate
                ? 'LATE'
                : 'PRESENT',

            adjustedBySupervisor:
              false,
          };

          return [
            updatedRec,
            ...prev,
          ];
        }
      );

      addAuditLog(
        'ADJUST_ATTENDANCE',
        `EmployeePunch: ${employee.name}`,
        `تسجيل بصمة وجه AI تلقائية بنجاح عند البوابة [${
          isEntry
            ? 'دخول'
            : 'خروج'
        }] في الساعة ${timeStr} بنسبة ثقة 96.8%`,
        employee.id
      );

      return {
        success: true,

        message:
          `تم التعرف على ${employee.name} بنجاح وتسجيل ${
            isEntry
              ? 'الدخول'
              : 'الخروج'
          } (${timeStr}) بنسبة تطابق 96.8%!`,

        record:
          updatedRec,
      };
    };

  const triggerSimulatedIncident =
    (
      type:
        | 'THEFT'
        | 'INTRUSION'
        | 'LOITERING'
    ) => {
      const now =
        new Date();

      const timeStr =
        now
          .toISOString()
          .replace(
            'T',
            ' '
          )
          .substring(
            0,
            19
          );

      if (
        type ===
        'THEFT'
      ) {
        const newIncident:
          SecurityIncident = {
          id:
            `inc-theft-${Date.now().toString(36)}`,

          tenantId:
            currentTenant.id,

          cameraId:
            'cam-wh-rack-04',

          cameraName:
            'المستودع الرئيسي - ممر الرفوف 04',

          timestamp:
            timeStr,

          title:
            'اشتباه سحب منتج ومغادرة غير مصرح بها (Theft Pipeline)',

          incidentType:
            'THEFT_SUSPICION',

          severity:
            'CRITICAL',

          confidence:
            0.94,

          reason:
            'تم رصد إزالة صندوق من منطقة الرف 04-A + وجود شخص غير مصرح له في المنطقة + عدم تسجيل إذن صرف رسمي في النظام.',

          suspectDetails:
            {
              type:
                'UNKNOWN_PERSON',

              photoUrl:
                'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=200&auto=format&fit=crop&q=80',
            },

          involvedObjects:
            [
              'Carton Box (SKU-DISP-65UHD)',
            ],

          status:
            'NEW',

          videoEvidence:
            {
              clipUrl:
                '/demo/videos/evidence_70sec_incident_004.mp4',

              durationSec:
                70,

              preEventSec:
                30,

              eventSec:
                10,

              postEventSec:
                30,

              snapshots:
                [
                  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300&auto=format&fit=crop&q=80',

                  'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=300&auto=format&fit=crop&q=80',
                ],
            },
        };

        setSecurityIncidents(
          prev => [
            newIncident,
            ...prev,
          ]
        );

        setInventoryProducts(
          prev =>
            prev.map(
              p => {
                if (
                  p.sku ===
                  'SKU-DISP-65UHD'
                ) {
                  return {
                    ...p,

                    aiDetectedQuantity:
                      p.aiDetectedQuantity -
                      1,

                    difference:
                      p.difference -
                      1,

                    status:
                      'DISCREPANCY',
                  };
                }

                return p;
              }
            )
        );

        const notif:
          AlertNotification = {
          id:
            `notif-theft-${Date.now()}`,

          title:
            '🚨 تنبيه أمني عاجل: اشتباه سرقة بالمستودع',

          message:
            'تم إنشاء حادث أمني جديد يتطلب المراجعة البشرية ومطابقة الفيديو الجنائي (70 ثانية).',

          timestamp:
            timeStr,

          severity:
            'CRITICAL',

          cameraName:
            'المستودع الرئيسي - ممر الرفوف 04',

          read: false,

          incidentId:
            newIncident.id,
        };

        setNotifications(
          prev => [
            notif,
            ...prev,
          ]
        );

        addAuditLog(
          'REVIEW_INCIDENT',
          'TheftPipeline',
          'نظام AI كشف حالة اشتباه سرقة جديدة وأنشأ حادثاً للمراجعة البشرية',
          newIncident.id
        );

        dispatchWhatsAppAlert({
          action:
            customerWhatsAppSettings.alertMode,

          incidentTitle:
            newIncident.title,

          reason:
            newIncident.reason,

          cameraName:
            newIncident.cameraName,

          severity:
            newIncident.severity,

          incidentId:
            newIncident.id,
        }).catch(error => {
          console.error(
            '[WhatsApp] Theft alert failed:',
            error
          );
        });
      }

      if (
        type ===
        'INTRUSION'
      ) {
        const newEvt:
          BehaviorEvent = {
          id:
            `evt-intrusion-${Date.now().toString(36)}`,

          tenantId:
            currentTenant.id,

          cameraId:
            'cam-fence-east',

          cameraName:
            'سياج المحيط الأمني الشرقي',

          cameraLocation:
            'السياج الخارجي للمنشأة',

          timestamp:
            timeStr,

          eventType:
            'UNAUTHORIZED_ZONE_ENTRY',

          severity:
            'HIGH',

          confidence:
            0.91,

          personName:
            'متسلل غير معروف (Intruder)',

          snapshotUrl:
            'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=400&auto=format&fit=crop&q=80',

          videoClipUrl:
            '/demo/videos/fence_loitering.mp4',

          reason:
            'تجاوز الخط الوهمي الحرج لسياج المنشأة الشرقي وتفعيل صافرة الإنذار الميدانية.',

          reviewStatus:
            'NEW',
        };

        setBehaviorEvents(
          prev => [
            newEvt,
            ...prev,
          ]
        );

        const notif:
          AlertNotification = {
          id:
            `notif-intrude-${Date.now()}`,

          title:
            '⚠️ اختراق المنطقة الأمنية للسياج الشرقي',

          message:
            'تم رصد حركة إنسان مباشرة عند السياج الشرقي الخارجي.',

          timestamp:
            timeStr,

          severity:
            'HIGH',

          cameraName:
            'سياج المحيط الأمني الشرقي',

          read: false,
        };

        setNotifications(
          prev => [
            notif,
            ...prev,
          ]
        );

        addAuditLog(
          'VIEW_CAMERA',
          'PerimeterFence',
          'رصد تسلل عبر السياج الأمني الشرقي وتفعيل صفارة الإنذار'
        );

        dispatchWhatsAppAlert({
          action:
            customerWhatsAppSettings.alertMode,

          incidentTitle:
            '⚠️ اختراق المنطقة الأمنية للسياج الشرقي',

          reason:
            newEvt.reason,

          cameraName:
            newEvt.cameraName,

          severity:
            newEvt.severity,

          incidentId:
            newEvt.id,
        }).catch(error => {
          console.error(
            '[WhatsApp] Intrusion alert failed:',
            error
          );
        });
      }

      if (
        type ===
        'LOITERING'
      ) {
        const newEvt:
          BehaviorEvent = {
          id:
            `evt-loiter-${Date.now().toString(36)}`,

          tenantId:
            currentTenant.id,

          cameraId:
            'cam-server-room',

          cameraName:
            'غرفة الخوادم والاتصالات',

          cameraLocation:
            'مركز البيانات',

          timestamp:
            timeStr,

          eventType:
            'PROLONGED_LOITERING',

          severity:
            'MEDIUM',

          confidence:
            0.88,

          personName:
            'شخص بدون بطاقة تقنية معتمدة',

          snapshotUrl:
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',

          videoClipUrl:
            '/demo/videos/server_room_intrusion.mp4',

          reason:
            'البقاء أمام كابينة الخوادم الحساسة لأكثر من 30 ثانية دون فتح تذكرة صيانة.',

          reviewStatus:
            'NEW',
        };

        setBehaviorEvents(
          prev => [
            newEvt,
            ...prev,
          ]
        );

        const notif:
          AlertNotification = {
          id:
            `notif-loiter-${Date.now()}`,

          title:
            'تسكع مشبوه بغرفة الخوادم',

          message:
            'شخص متواجد دون حركة تشغيلية مصرح بها لأكثر من 30 ثانية.',

          timestamp:
            timeStr,

          severity:
            'MEDIUM',

          cameraName:
            'غرفة الخوادم',

          read: false,
        };

        setNotifications(
          prev => [
            notif,
            ...prev,
          ]
        );

        dispatchWhatsAppAlert({
          action:
            customerWhatsAppSettings.alertMode,

          incidentTitle:
            'تسكع مشبوه بغرفة الخوادم',

          reason:
            newEvt.reason,

          cameraName:
            newEvt.cameraName,

          severity:
            newEvt.severity,

          incidentId:
            newEvt.id,
        }).catch(error => {
          console.error(
            '[WhatsApp] Loitering alert failed:',
            error
          );
        });
      }
    };

  const triggerInventoryCountUpdate =
    (
      productId: string,
      newCount: number
    ) => {
      setInventoryProducts(
        prev =>
          prev.map(
            p => {
              if (
                p.id ===
                productId
              ) {
                const diff =
                  newCount -
                  p.expectedQuantity;

                return {
                  ...p,

                  aiDetectedQuantity:
                    newCount,

                  difference:
                    diff,

                  status:
                    diff !== 0
                      ? 'DISCREPANCY'
                      : newCount <=
                          p.lowStockThreshold
                        ? 'LOW_STOCK'
                        : 'NORMAL',

                  lastCountTimestamp:
                    new Date()
                      .toISOString()
                      .replace(
                        'T',
                        ' '
                      )
                      .substring(
                        0,
                        19
                      ),
                };
              }

              return p;
            }
          )
      );

      const prod =
        inventoryProducts.find(
          p =>
            p.id ===
            productId
        );

      addAuditLog(
        'ADJUST_INVENTORY',
        `Product: ${
          prod?.name ||
          productId
        }`,
        `معايرة عداد الرؤية الحاسوبية يدوياً إلى ${newCount} قطعة`,
        productId
      );
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

export const useLiveCCTV =
  () => {
    const context =
      useContext(
        LiveCCTVContext
      );

    if (!context) {
      throw new Error(
        'useLiveCCTV must be used within LiveCCTVProvider'
      );
    }

    return context;
  };
