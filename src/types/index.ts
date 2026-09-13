/**
 * AI CCTV Security & Operations Agent SaaS - Core Type Definitions
 */

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'SUPERVISOR';

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  nameEn: string;
  planId: string;
  status: 'ACTIVE' | 'TRIAL' | 'GRACE_PERIOD' | 'SUSPENDED';
  trialEndsAt: string;
  subscriptionEndsAt: string;
  cameraLimit: number;
  deviceLimit: number;
  employeeLimit: number;
  retentionDays: number;
  modules: {
    inventoryVision: boolean;
    attendanceTracking: boolean;
    theftDetection: boolean;
    behaviorAnalytics: boolean;
    whatsappAlerts: boolean;
    windowsAgent: boolean;
  };
}

export interface CameraZone {
  id: string;
  name: string;
  type: 'INTRUSION' | 'LOITERING' | 'COUNTING' | 'EXCLUSION';
  color: string;
  polygon: { x: number; y: number }[]; // Coordinates in percentage (0 - 100)
}

export interface RecorderDevice {
  id: string;
  tenantId: string;
  name: string;
  type: 'NVR' | 'DVR';
  channels: 4 | 8 | 16 | 32 | 64;
  ipAddress: string;
  port: number;
  usernameEncrypted?: string;
  passwordEncrypted?: string;
  username?: string;
  password?: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  brand?: string;
  lastSync: string;
}

export interface Camera {
  id: string;
  tenantId: string;
  deviceId?: string;
  name: string;
  location: string;
  streamUrl: string;
  usernameEncrypted?: string;
  passwordEncrypted?: string;
  username?: string;
  password?: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  fps: number;
  resolution: string;
  aiEnabled: boolean;
  recordingEnabled: boolean;
  type: 'RTSP' | 'ONVIF' | 'IP_CAM' | 'USB' | 'DEMO';
  zones: CameraZone[];
  recorderId?: string;
  channel?: number;
  lastPing: string;
  detectionSettings: {
    detectPersons: boolean;
    detectVehicles: boolean;
    detectObjects: boolean;
    faceRecognition: boolean;
    confidenceThreshold: number;
    loiteringThresholdSeconds: number;
  };
}

export interface BoundingBox {
  id: string;
  label: 'person' | 'vehicle' | 'carton' | 'face' | 'unknown';
  confidence: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  trackId: number;
  metadata?: {
    employeeName?: string;
    employeeId?: string;
    loiteringTimeSec?: number;
    isViolatingZone?: boolean;
    speedPx?: number;
  };
}

export interface Employee {
  id: string;
  tenantId: string;
  employeeCode: string;
  name: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  photoUrl: string;
  faceEmbeddingVector: number[]; // face embedding vector
  isActive: boolean;
  allowedZones: string[];
  schedule: {
    workDays: number[]; // 0 = Sunday, 1 = Monday, etc.
    shiftStart: string; // e.g., "08:00"
    shiftEnd: string;   // e.g., "17:00"
    graceMinutes: number; // e.g., 15
  };
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  photoUrl: string;
  date: string;
  firstEntryTime: string | null;
  lastExitTime: string | null;
  totalWorkingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'MISSING_EXIT';
  adjustedBySupervisor: boolean;
  adjustmentReason?: string;
  auditLogId?: string;
}

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BehaviorEvent {
  id: string;
  tenantId: string;
  cameraId: string;
  cameraName: string;
  cameraLocation: string;
  timestamp: string;
  eventType: 
    | 'UNAUTHORIZED_ZONE_ENTRY' 
    | 'PROLONGED_LOITERING' 
    | 'ABNORMAL_RAPID_MOVEMENT' 
    | 'OUT_OF_HOURS_ACTIVITY' 
    | 'LINE_CROSSING' 
    | 'CROWD_GATHERING'
    | 'SUSPICIOUS_OBJECT_REMOVAL'
    | 'FALL_DETECTION';
  severity: SeverityLevel;
  confidence: number;
  personName?: string;
  personPhoto?: string;
  reason: string;
  snapshotUrl: string;
  videoClipUrl: string;
  reviewStatus: 'NEW' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface SecurityIncident {
  id: string;
  tenantId: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  title: string;
  incidentType: 'THEFT_SUSPICION' | 'PERIMETER_BREACH' | 'ZONE_INTRUSION' | 'TAMPERING';
  severity: SeverityLevel;
  confidence: number;
  reason: string;
  suspectDetails: {
    type: 'KNOWN_EMPLOYEE' | 'UNKNOWN_PERSON';
    name?: string;
    photoUrl?: string;
  };
  involvedObjects: string[];
  status: 'NEW' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED';
  videoEvidence: {
    clipUrl: string;
    durationSec: number;
    preEventSec: number;
    eventSec: number;
    postEventSec: number;
    snapshots: string[];
  };
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface InventoryProduct {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode: string;
  warehouse: string;
  zone: string;
  cameraName: string;
  unit: string;
  unitsPerCarton: number;
  expectedQuantity: number;
  aiDetectedQuantity: number;
  confidence: number;
  difference: number;
  differenceReason?: string;
  outgoingCountToday: number;
  incomingCountToday: number;
  lastCountTimestamp: string;
  lowStockThreshold: number;
  status: 'NORMAL' | 'DISCREPANCY' | 'LOW_STOCK';
}

export interface OutgoingProductEvent {
  id: string;
  tenantId: string;
  productName: string;
  sku: string;
  quantity: number;
  timestamp: string;
  cameraName: string;
  direction: 'OUTGOING' | 'INCOMING';
  confidence: number;
  trackingId: number;
  transactionWindowId: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userName: string;
  userRole: UserRole;
  action: 
    | 'LOGIN' 
    | 'LOGOUT' 
    | 'FAILED_LOGIN'
    | 'VIEW_CAMERA' 
    | 'VIEW_VIDEO_EVIDENCE' 
    | 'CREATE_EMPLOYEE' 
    | 'UPDATE_EMPLOYEE' 
    | 'DELETE_EMPLOYEE'
    | 'ADD_CAMERA' 
    | 'UPDATE_CAMERA' 
    | 'DELETE_CAMERA'
    | 'ADD_WAREHOUSE_ZONE'
    | 'UPDATE_AI_CONFIG' 
    | 'REVIEW_INCIDENT' 
    | 'ADJUST_ATTENDANCE' 
    | 'ADJUST_INVENTORY'
    | 'EXPORT_REPORT'
    | 'CHANGE_SUBSCRIPTION';
  entity: string;
  entityId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details: string;
}

export interface AgentHealth {
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'ERROR';
  version: string;
  uptimeSeconds: number;
  cpuPercent: number;
  ramPercent: number;
  gpuPercent: number;
  fpsAverage: number;
  connectedCameras: number;
  eventsProcessedToday: number;
  queueDepth: number;
  activeWorkers: number;
  lastAnalysisTimestamp: string;
  errorCount24h: number;
}

export interface DeviceNode {
  id: string;
  tenantId: string;
  name: string;
  os: string;
  agentVersion: string;
  ipAddress: string;
  status: 'ONLINE' | 'OFFLINE';
  assignedCamerasCount: number;
  lastHeartbeat: string;
  tokenMasked: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameAr: string;
  priceMonthly: number;
  cameraQuota: number;
  deviceQuota: number;
  employeeQuota: number;
  retentionDays: number;
  features: string[];
}

export type WhatsAppAlertMode = 'MESSAGE_ONLY' | 'CALL_ONLY' | 'MESSAGE_AND_CALL';

export interface CustomerWhatsAppSettings {
  instanceName?: string;
  phoneNumber: string;
  customerName: string;
  enabled: boolean;
  alertMode: WhatsAppAlertMode;
  minSeverity: SeverityLevel;
  callRingtoneEnabled: boolean;
  autoPlayVoiceBriefing: boolean;
  language: 'ar' | 'en';
  connectionState?: string;
  connectedAt?: string | null;
  lastQrAt?: string | null;
}

export interface WhatsAppDispatchLog {
  id: string;
  timestamp: string;
  recipient: string;
  action: 'MESSAGE' | 'CALL' | 'BOTH';
  incidentTitle: string;
  severity: SeverityLevel;
  status: 'DELIVERED' | 'CALL_COMPLETED' | 'CALL_RINGING' | 'CALL_REJECTED' | 'QUEUED';
  provider: string;
  notes?: string;
}

export interface WhatsAppCallState {
  active: boolean;
  status: 'RINGING' | 'CONNECTED' | 'ENDED';
  recipient: string;
  incidentTitle: string;
  incidentReason: string;
  cameraName: string;
  time: string;
  severity: SeverityLevel;
  durationSec: number;
  incidentId?: string;
}

export type LicensePeriod = '2_DAYS' | '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'REVOKED' | 'UNACTIVATED';

export interface DeviceLicense {
  id: string;
  machineId: string;
  activationKey: string;
  period: LicensePeriod;
  periodLabelAr: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  companyName: string;
  amountPaid: number;
  currency: string;
  status: LicenseStatus;
  activatedAt: string;
  expiresAt: string;
  notes?: string;
  isLocked?: boolean;
}

export interface SubscriberRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  companyName: string;
  machineId: string;
  role: UserRole;
  currentLicense?: DeviceLicense;
  totalPaid: number;
  registeredAt: string;
  lastActiveAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED';
}

export interface SystemFinancialStats {
  totalRevenue: number;
  currency: string;
  activeSubscribersCount: number;
  expiredCount: number;
  trialCount: number;
  totalKeysGenerated: number;
}

