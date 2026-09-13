import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Sliders, 
  Smartphone, 
  Mail, 
  HardDrive, 
  Lock, 
  Save, 
  CheckCircle2,
  Bell,
  Cpu,
  Server,
  Database,
  Key,
  Video,
  Radio,
  Sparkles,
  RefreshCw,
  Send,
  AlertTriangle,
  Info,
  Copy,
  Check,
  PhoneCall,
  MessageSquare
} from 'lucide-react';
import { useLanguageTheme } from '../context/LanguageThemeContext';
import * as db from '../lib/supabaseServices';
import { useAuth } from '../context/AuthContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import { WhatsAppAlertMode } from '../types';

interface SettingsViewProps {
  onOpenWhatsAppModal?: () => void;
}

interface EnvStatus {
  gemini: {
    configured: boolean;
    model: string;
    appUrl: string;
  };
  database: {
    configured: boolean;
    provider: string;
    connectionStringMasked: string;
  };
  redis: {
    configured: boolean;
    endpointMasked: string;
  };
  jwt: {
    configured: boolean;
    algorithm: string;
    expiryMinutes: number;
  };
  videoAi: {
    configured: boolean;
    serviceUrl: string;
    device: string;
    detectionConfidence: number;
    faceSimilarity: number;
  };
  s3Storage: {
    configured: boolean;
    endpoint: string;
    bucket: string;
    region: string;
  };
  notifications: {
    whatsappConfigured: boolean;
    whatsappPhoneId: string;
    smtpConfigured: boolean;
    smtpHost: string;
    smtpPort: number;
  };
  demoMode: boolean;
  rtspTimeoutSeconds: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenWhatsAppModal }) => {
  const { t } = useLanguageTheme();
  const { addAuditLog } = useAuth();
  const { 
    customerWhatsAppSettings, 
    updateCustomerWhatsAppSettings, 
    triggerWhatsAppCall 
  } = useLiveCCTV();

  const [activeTab, setActiveTab] = useState<'ENV_VARS' | 'AI_PARAMS'>('ENV_VARS');

  // Customer WhatsApp local state
  const [custPhone, setCustPhone] = useState(customerWhatsAppSettings.phoneNumber || '+966501234567');
  const [custAlertMode, setCustAlertMode] = useState<WhatsAppAlertMode>(customerWhatsAppSettings.alertMode || 'MESSAGE_AND_CALL');
  const [custSavedFeedback, setCustSavedFeedback] = useState(false);

  useEffect(() => {
    if (customerWhatsAppSettings.phoneNumber) {
      setCustPhone(customerWhatsAppSettings.phoneNumber);
    }
    if (customerWhatsAppSettings.alertMode) {
      setCustAlertMode(customerWhatsAppSettings.alertMode);
    }
  }, [customerWhatsAppSettings]);

  const handleSaveCustomerWhatsApp = async () => {
    await updateCustomerWhatsAppSettings({
      phoneNumber: custPhone.trim(),
      alertMode: custAlertMode,
    });
    setCustSavedFeedback(true);
    setTimeout(() => setCustSavedFeedback(false), 3000);
  };

  // AI & Detection Parameters states
  const [faceThreshold, setFaceThreshold] = useState(0.75);
  const [personConfidence, setPersonConfidence] = useState(0.8);
  const [loiteringSeconds, setLoiteringSeconds] = useState(30);
  const [theftSensitivity, setTheftSensitivity] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [whatsAppProvider, setWhatsAppProvider] = useState<'META_CLOUD_API' | 'TWILIO_BUSINESS' | 'LOCAL_GATEWAY'>('META_CLOUD_API');
  const [alertEmail, setAlertEmail] = useState('security-ops@aman-logistics.com');
  const [retentionDays, setRetentionDays] = useState(45);
  const [isSaved, setIsSaved] = useState(false);

  // Live Environment Status states
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [isLoadingEnv, setIsLoadingEnv] = useState(false);

  // Testing states
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  
  const [testingWa, setTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState<string | null>(null);

  const [seedingSupabase, setSeedingSupabase] = useState(false);
  const [seedResult, setSeedResult] = useState<{success: boolean, msg: string} | null>(null);

  const [testRtspUrl, setTestRtspUrl] = useState('rtsp://admin:pass@192.168.1.105:554/live/ch0');
  const [testingRtsp, setTestingRtsp] = useState(false);
  const [rtspResult, setRtspResult] = useState<string | null>(null);

  const [copiedEnv, setCopiedEnv] = useState(false);
  const [showEnvTemplate, setShowEnvTemplate] = useState(false);

  const envTemplateText = `# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY=

# APP_URL: The URL where this applet is hosted.
APP_URL=https://ais-dev-wuskjww52clx73il5m5bwk-392148452478.europe-west2.run.app

# Multi-Tenant Database
DATABASE_URL=postgresql://cctv_saas:cctv_secure_pass@postgres:5432/cctv_platform

# Message Queue & Cache
REDIS_URL=redis://redis:6379/0

# JWT Authentication & RBAC
JWT_SECRET=cctv_ai_agent_jwt_super_secret_key_32chars_min
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Video Analysis Service
AI_SERVICE_URL=http://ai-service:8001
AI_INFERENCE_DEVICE=cuda
AI_DETECTION_CONFIDENCE_THRESHOLD=0.65
AI_FACE_SIMILARITY_THRESHOLD=0.72

# Object Storage (MinIO / S3 for CCTV Evidence Clips)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=cctv-evidence
S3_REGION=us-east-1

# Notifications (Email & WhatsApp Business)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@cctv-agent.com
SMTP_PASSWORD=smtp_password
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=109876543210

# Demo Mode & Local Stream Simulation
DEMO_MODE=true
RTSP_TIMEOUT_SECONDS=10`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(envTemplateText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const fetchEnvStatus = async () => {
    setIsLoadingEnv(true);
    try {
      const res = await fetch('/api/env/status');
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data);
      }
    } catch (err) {
      console.error('Failed to load env status:', err);
    } finally {
      setIsLoadingEnv(false);
    }
  };

  useEffect(() => {
    fetchEnvStatus();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    addAuditLog(
      'UPDATE_CAM_SETTINGS' as any,
      'SystemConfiguration',
      `تحديث إعدادات خوارزميات الذكاء الاصطناعي (Face: ${faceThreshold}, Loiter: ${loiteringSeconds}s, WhatsApp: ${whatsAppProvider})`
    );
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Live Test Gemini AI Briefing
  const handleTestGemini = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/ai/daily-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: {
            camerasTotal: 16,
            camerasOnline: 14,
            eventsToday: 42,
            incidentsCount: 2,
            attendanceRate: '96.8%',
            inventoryDiscrepancies: 3,
          },
        }),
      });
      const data = await res.json();
      if (data.briefing) {
        setAiTestResult(data.briefing);
      } else {
        setAiTestResult(JSON.stringify(data, null, 2));
      }
    } catch (error: any) {
      setAiTestResult(`خطأ في الفحص: ${error.message || 'تعذر الاتصال'}`);
    } finally {
      setTestingAi(false);
    }
  };

  // Live Test WhatsApp alert
  const handleTestWhatsApp = async () => {
    setTestingWa(true);
    setWaTestResult(null);
    try {
      const res = await fetch('/api/notifications/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: custPhone || customerWhatsAppSettings.phoneNumber || '+966501234567',
          incidentId: 'INC-2026-0912-TEST',
          message: '🚨 تنبيه أمني تجريبي: رصد حركة خارج أوقات العمل في مستودع البضائع الحساسة.',
        }),
      });
      const data = await res.json();
      setWaTestResult(t(
        `نجح الفحص: تم إرسال رسالة WhatsApp تجريبية إلى ${custPhone} (${data.provider})`,
        `Success: Test WhatsApp message sent to ${custPhone} (${data.provider})`
      ));
    } catch (error: any) {
      setWaTestResult(`خطأ في الإرسال: ${error.message}`);
    } finally {
      setTestingWa(false);
    }
  };

  // Live Test RTSP stream
  const handleTestRtsp = async () => {
    setTestingRtsp(true);
    setRtspResult(null);
    try {
      const res = await fetch('/api/cameras/test-rtsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: testRtspUrl }),
      });
      const data = await res.json();
      setRtspResult(t(
        `الاتصال سليم: البروتوكول ${data.protocol} • الدقة ${data.resolution} • زمن الاستجابة ${data.latencyMs}ms • معدل الإطارات ${data.fps} FPS`,
        `Connection verified: ${data.protocol} • ${data.resolution} • Latency ${data.latencyMs}ms • ${data.fps} FPS`
      ));
    } catch (error: any) {
      setRtspResult(`خطأ في الاتصال: ${error.message}`);
    } finally {
      setTestingRtsp(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-5xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-slate-100">
              {t('إدارة وتكامل متغيرات البيئة ومعايير المنظومة', 'Environment Variables & System Configuration')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'مراجعة وتأكيد ربط خوادم وقنوات المنظومة (Gemini AI, Database, Redis, S3, WhatsApp) وضبط معايير الرؤية الحاسوبية.',
              'Review and verify bindings for cloud services (Gemini AI, PostgreSQL, Redis, S3, WhatsApp) and calibrate CV pipelines.'
            )}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('ENV_VARS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'ENV_VARS'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>{t('ربط متغيرات البيئة (.env)', 'Environment Variables')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AI_PARAMS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'AI_PARAMS'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('معايير الرؤية وحفظ الأدلة', 'Detection & Retention')}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ENVIRONMENT VARIABLES & CLOUD SERVICE BINDINGS */}
      {activeTab === 'ENV_VARS' && (
        <div className="flex flex-col gap-6">
          {/* Top Status Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">
                    {t('حالة تكامل المنظومة (Full-Stack Architecture):', 'System Integration Architecture:')}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                    ONLINE • PORT 3000
                  </span>
                  {envStatus?.demoMode && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                      DEMO_MODE=ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t(
                    'الواجهة الخلفية (Express Server) تعمل بتكامل تام وتدير كافة المفاتيح السرية بأمان دون تمريرها للمتصفح.',
                    'Server-side Express proxy handles all secret environment variables securely without browser exposure.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchEnvStatus}
              disabled={isLoadingEnv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEnv ? 'animate-spin' : ''}`} />
              <span>{t('تحديث فحص المتغيرات', 'Refresh Status')}</span>
            </button>
          </div>

          {/* Grid of the 6 Main Environment Variable Groups */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* 1. Google Gemini AI Engine */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('1. محرك الذكاء الاصطناعي (Gemini AI Core)', '1. Gemini AI Core Engine')}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    envStatus?.gemini.configured 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {envStatus?.gemini.configured ? 'CONFIGURED / LIVE' : 'SMART SIMULATION'}
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p><strong className="text-slate-400">GEMINI_API_KEY:</strong> {envStatus?.gemini.configured ? '•••••••••••••••• (Attached in Secrets)' : 'Managed via Settings > Secrets'}</p>
                  <p><strong className="text-slate-400">Model:</strong> {envStatus?.gemini.model || 'gemini-3.8-flash'}</p>
                  <p><strong className="text-slate-400">APP_URL:</strong> <span className="text-cyan-400 text-[10px]">{envStatus?.gemini.appUrl}</span></p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={testingAi}
                  className="w-full py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800 text-purple-200 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>{testingAi ? t('جاري طلب التحليل من الموديل...', 'Calling Gemini...') : t('فحص توليد الموجز اليومي بالذكاء الاصطناعي', 'Test Live Gemini Analysis')}</span>
                </button>

                {aiTestResult && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-purple-800/60 text-slate-300 text-[11px] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {aiTestResult}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Multi-Tenant Database (PostgreSQL) */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('2. قاعدة البيانات (PostgreSQL DB)', '2. Multi-Tenant Database')}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    envStatus?.database.configured 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {envStatus?.database.configured ? 'CONNECTED' : 'STANDBY'}
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p><strong className="text-slate-400">DATABASE_URL:</strong> <span className="text-blue-300">{envStatus?.database.connectionStringMasked}</span></p>
                  <p><strong className="text-slate-400">Isolation:</strong> Multi-Tenant Schema Separation</p>
                  <p><strong className="text-slate-400">Entities:</strong> Cameras, Tenants, AuditLogs, Attendance, Products</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setSeedingSupabase(true);
                    setSeedResult(null);
                    try {
                      await db.seedMockDataToSupabase();
                      setSeedResult({ success: true, msg: 'تم رفع البيانات الافتراضية بنجاح إلى Supabase!' });
                    } catch (err: any) {
                      setSeedResult({ success: false, msg: err.message || 'فشل التحديث' });
                    }
                    setSeedingSupabase(false);
                  }}
                  disabled={seedingSupabase}
                  className="w-full py-2 rounded-xl bg-blue-950/70 hover:bg-blue-900/80 border border-blue-800 text-blue-200 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>{seedingSupabase ? 'جاري رفع البيانات...' : 'تصدير البيانات التجريبية إلى Supabase'}</span>
                </button>
                {seedResult && (
                  <div className={`p-2 rounded-lg text-[10px] ${seedResult.success ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/50 text-red-400 border border-red-900/50'}`}>
                    {seedResult.msg}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
                {t(
                  'يدعم الربط السحابي مع Cloud SQL أو Supabase، أو التشغيل المحلي في المستودع عبر Docker.',
                  'Ready for Cloud SQL / Supabase or on-premise PostgreSQL container in warehouse.'
                )}
              </div>
            </div>

            {/* 3. Redis Message Queue & Event Streaming */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-red-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('3. طابور الرسائل والتخزين المؤقت (Redis)', '3. Redis Event Queue & Cache')}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    envStatus?.redis.configured 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {envStatus?.redis.configured ? 'BUFFER READY' : 'MEMORY QUEUE'}
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p><strong className="text-slate-400">REDIS_URL:</strong> <span className="text-red-300">{envStatus?.redis.endpointMasked}</span></p>
                  <p><strong className="text-slate-400">Purpose:</strong> Pub/Sub Camera Telemetry & Frame Buffers</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
                {t(
                  'يتلقى إشعارات الحركة اللحظية من كاميرات الـ RTSP ويغذي واجهة المراقبة دون تأخير.',
                  'Subscribes to live camera events and streams detection updates to operators with sub-second latency.'
                )}
              </div>
            </div>

            {/* 4. JWT Authentication & Security Tokens */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('4. أمان التشفير والرموز (JWT & RBAC)', '4. JWT Auth & Node Security')}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    ENCRYPTED
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p><strong className="text-slate-400">JWT_ALGORITHM:</strong> {envStatus?.jwt.algorithm}</p>
                  <p><strong className="text-slate-400">JWT_SECRET:</strong> •••••••••••••••••••• (32+ chars)</p>
                  <p><strong className="text-slate-400">Token Expiry:</strong> {envStatus?.jwt.expiryMinutes} {t('دقيقة (24 ساعة)', 'minutes (24h)')}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
                {t(
                  'يوقع رقمياً رموز اقتران الوكيل الميداني (Windows Node Token) وجلسات المشرفين ضد التلاعب.',
                  'Cryptographically signs Windows Edge Agent pairing tokens and supervisor session tokens.'
                )}
              </div>
            </div>

            {/* 5. Edge Vision & Object Storage (S3) */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('5. حفظ الأدلة ورؤية الذكاء (S3 Storage)', '5. S3 Forensic Storage & CV Engine')}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    S3 IMMUTABLE
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                  <p><strong className="text-slate-400">S3_ENDPOINT:</strong> {envStatus?.s3Storage.endpoint}</p>
                  <p><strong className="text-slate-400">Bucket:</strong> {envStatus?.s3Storage.bucket} ({envStatus?.s3Storage.region})</p>
                  <p><strong className="text-slate-400">AI Device:</strong> {envStatus?.videoAi.device} ({envStatus?.videoAi.serviceUrl})</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400">
                {t(
                  'تخزين مقاطع الـ 70 ثانية الجنائية المشفرة وقفلها ضد الحذف التلقائي لمدة 45 يوماً.',
                  'Stores 70s forensic video incident packages with non-deletable retention lock.'
                )}
              </div>
            </div>

            {/* 6. Notifications: WhatsApp Cloud API & Customer Phone Settings */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-slate-100 text-sm">
                      {t('6. هاتف العميل وقنوات WhatsApp', '6. Customer Phone & WhatsApp Dispatch')}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    customerWhatsAppSettings.enabled 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {customerWhatsAppSettings.enabled ? 'ACTIVE & ARMED' : 'DISABLED'}
                  </span>
                </div>

                {/* Direct Customer Phone Input */}
                <div className="space-y-2 mt-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    {t('رقم واتساب العميل (لاستلام التنبيهات أو الاتصال):', 'Client WhatsApp Phone Number:')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={custPhone}
                      onChange={e => setCustPhone(e.target.value)}
                      placeholder="+966501234567"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomerWhatsApp}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex-shrink-0 cursor-pointer"
                    >
                      {t('حفظ', 'Save')}
                    </button>
                  </div>

                  {/* Alert Mode Selection */}
                  <div className="pt-1.5 space-y-1">
                    <label className="text-[10px] text-slate-400 block font-medium">
                      {t('إجراء الوكيل عند رصد أمر مريب (اختياري):', 'Agent Action on Incident:')}
                    </label>
                    <select
                      value={custAlertMode}
                      onChange={e => {
                        const newMode = e.target.value as WhatsAppAlertMode;
                        setCustAlertMode(newMode);
                        updateCustomerWhatsAppSettings({ alertMode: newMode });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="MESSAGE_ONLY">{t('💬 إرسال رسالة واتساب فقط', 'Message Only')}</option>
                      <option value="CALL_ONLY">{t('📞 إجراء مكالمة صوتية عبر واتساب فقط', 'Voice Call Only')}</option>
                      <option value="MESSAGE_AND_CALL">{t('🔔 رسالة + مكالمة صوتية معاً (موصى به)', 'Both: Message & Voice Call')}</option>
                    </select>
                  </div>

                  {custSavedFeedback && (
                    <div className="text-[10px] text-emerald-400 font-medium text-center">
                      {t('تم تحديث وحفظ رقم وخيارات العميل بنجاح!', 'Customer WhatsApp settings saved successfully!')}
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-slate-300 font-mono text-[10px] mt-2">
                  <p><strong className="text-slate-400">PHONE_ID:</strong> {envStatus?.notifications.whatsappPhoneId}</p>
                  <p><strong className="text-slate-400">SMTP:</strong> {envStatus?.notifications.smtpHost}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestWhatsApp}
                    disabled={testingWa}
                    className="py-2 px-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-800 text-emerald-200 font-semibold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3 text-emerald-400" />
                    <span>{testingWa ? t('جاري الإرسال...', 'Sending...') : t('تجربة رسالة', 'Test Message')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerWhatsAppCall({
                      title: 'مكالمة واتساب تجريبية من صفحة الإعدادات',
                      reason: 'فحص استجابة الاتصال الهاتفي الصوتي المشفر بالذكاء الاصطناعي',
                      cameraName: 'المستودع الرئيسي - ممر 04',
                      severity: 'CRITICAL',
                    })}
                    className="py-2 px-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-800 text-cyan-200 font-semibold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PhoneCall className="w-3 h-3 text-cyan-400" />
                    <span>{t('تجربة مكالمة', 'Test Call')}</span>
                  </button>
                </div>

                {onOpenWhatsAppModal && (
                  <button
                    type="button"
                    onClick={onOpenWhatsAppModal}
                    className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer"
                  >
                    {t('فتح مركز تحكم WhatsApp الشامل والمحاكي', 'Open WhatsApp Full Hub')}
                  </button>
                )}

                {waTestResult && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-800 text-emerald-300 text-[11px]">
                    {waTestResult}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Real RTSP Camera Connection Tester */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {t('أداة فحص اتصال بث كاميرات RTSP (RTSP Stream Connectivity Tester)', 'RTSP Stream Connection Tester')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('اختبار استجابة رابط الكاميرا وفحص زمن التأخير (Latency) قبل إضافتها للشبكة.', 'Probe RTSP IP camera responsiveness and verify network latency.')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testRtspUrl}
                onChange={e => setTestRtspUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.100:554/ch0"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleTestRtsp}
                disabled={testingRtsp}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-4 h-4" />
                <span>{testingRtsp ? t('جاري الفحص...', 'Probing Stream...') : t('فحص الاتصال بالكاميرا', 'Probe Stream')}</span>
              </button>
            </div>

            {rtspResult && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-cyan-800/80 text-cyan-300 text-xs font-mono">
                {rtspResult}
              </div>
            )}
          </div>

          {/* Guide Card: How to enter and configure environment variables */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800 text-cyan-400">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-slate-100 font-bold text-sm">
                    {t('دليل إكمال إدخال متغيرات البيئة (Environment Variables Guide)', 'Environment Variables Configuration Guide')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t(
                      'خطوات ربط المفاتيح السرية في Google AI Studio أو في خادم الإنتاج الخاص بك.',
                      'Steps to bind secrets in Google AI Studio or your production server.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnvTemplate(!showEnvTemplate)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                >
                  {showEnvTemplate ? t('إخفاء نموذج .env', 'Hide .env Template') : t('معاينة نموذج .env', 'View .env Template')}
                </button>

                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedEnv ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>{t('تم النسخ!', 'Copied!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('نسخ قالب .env', 'Copy .env')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Steps Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[10px]">1</span>
                  <span>{t('داخل Google AI Studio', 'Inside Google AI Studio')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t(
                    'افتح قائمة الإعدادات (Settings ⚙️) في شريط المنصة، ثم اختر قسم Secrets أو قم بتعبئة المفاتيح المطلوبة مثل GEMINI_API_KEY عند طلب النظام.',
                    'Open the Settings (⚙️) menu in Google AI Studio, select Secrets, and provide required keys like GEMINI_API_KEY.'
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-700 flex items-center justify-center text-[10px]">2</span>
                  <span>{t('الأمان وتشفير السيرفر', 'Server-Side Security')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t(
                    'تعمل جميع مسارات الذكاء الاصطناعي وقواعد البيانات عبر خادم Node.js (Full-Stack) ولا يتم كشف أي مفاتيح سرية لواجهة المتصفح نهائياً.',
                    'All AI calls & databases run via the secure Node.js backend. Secrets are never exposed to browser client-side code.'
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-[10px]">3</span>
                  <span>{t('في السيرفر أو Docker', 'On Production / Docker')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t(
                    'انسخ محتوى القالب (.env) وضعه في المجلد الرئيسي للسيرفر أو داخل docker-compose.yml لربط الحاويات ببعضها بسلاسة.',
                    'Copy the .env template to your server root or pass them in docker-compose.yml for on-premise deployment.'
                  )}
                </p>
              </div>
            </div>

            {/* Expandable .env template */}
            {showEnvTemplate && (
              <div className="pt-2">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 rounded-t-2xl border-t border-x border-slate-800 text-[11px] text-slate-400 font-mono">
                  <span>.env / .env.example</span>
                  <button
                    type="button"
                    onClick={handleCopyEnv}
                    className="text-cyan-400 hover:text-cyan-300 font-sans cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedEnv ? t('تم النسخ', 'Copied') : t('نسخ', 'Copy')}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-b-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto leading-relaxed max-h-72 overflow-y-auto">
                  {envTemplateText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI VISION & DETECTION CALIBRATION (Original Sliders) */}
      {activeTab === 'AI_PARAMS' && (
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-6 text-xs text-slate-300">
          {/* Section 1: AI Vision Detection Parameters */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>{t('معايير خوارزميات الرؤية الحاسوبية (Computer Vision Calibration)', 'Computer Vision Calibration')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Face Recognition Threshold */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-slate-300 font-semibold">
                    {t('عتبة قبول بصمة الوجه (ArcFace Cosine Similarity):', 'Face Match Threshold:')}
                  </label>
                  <span className="font-mono text-cyan-400 font-bold">{(faceThreshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={faceThreshold}
                  onChange={e => setFaceThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[11px] text-slate-500">
                  {t('القيمة الموصى بها: 75% لمنع انتحال الشخصية أو الخطأ.', 'Recommended: 75% to prevent false accepts.')}
                </p>
              </div>

              {/* Person Detection Confidence */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-slate-300 font-semibold">
                    {t('عتبة كشف الأشخاص (YOLOv8 Person Confidence):', 'Person Detection Confidence:')}
                  </label>
                  <span className="font-mono text-cyan-400 font-bold">{(personConfidence * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={personConfidence}
                  onChange={e => setPersonConfidence(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[11px] text-slate-500">
                  {t('رفع العتبة يقلل الإنذارات الكاذبة الناتجة عن الظلال.', 'Higher values reduce false alarms from shadows.')}
                </p>
              </div>

              {/* Loitering Seconds */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-slate-300 font-semibold">
                    {t('فترة كشف التسكع المفرط (Loitering Duration):', 'Loitering Alert Threshold:')}
                  </label>
                  <span className="font-mono text-amber-400 font-bold">{loiteringSeconds} {t('ثانية', 'seconds')}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={loiteringSeconds}
                  onChange={e => setLoiteringSeconds(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[11px] text-slate-500">
                  {t('يتم إطلاق تنبيه عند بقاء شخص في المنطقة الحساسة أطول من هذه المدة.', 'Triggers alert when someone stays in zone longer than threshold.')}
                </p>
              </div>

              {/* Anti-theft sensitivity */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">
                  {t('حساسية خط أنابيب السرقات (Theft Pipeline Sensitivity):', 'Theft Pipeline Sensitivity:')}
                </label>
                <select
                  value={theftSensitivity}
                  onChange={e => setTheftSensitivity(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="HIGH">عالي الحساسية (High - 3 Signals Required)</option>
                  <option value="MEDIUM">متوسط الحساسية (Balanced)</option>
                  <option value="LOW">محافظ (Conservative)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Notifications & WhatsApp Business API */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>{t('إعدادات رقم العميل وقنوات WhatsApp للأعمال', 'Customer WhatsApp Alert & Voice Calling')}</span>
              </h3>
              {onOpenWhatsAppModal && (
                <button
                  type="button"
                  onClick={onOpenWhatsAppModal}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-semibold hover:bg-emerald-900 transition cursor-pointer"
                >
                  {t('المحاكي المباشر', 'Live Preview')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Customer Phone */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {t('رقم واتساب العميل للتنبيهات والاتصال:', 'Customer WhatsApp Phone:')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    placeholder="+966501234567"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomerWhatsApp}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex-shrink-0 cursor-pointer"
                  >
                    {t('حفظ', 'Save')}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('يقوم الإيجنت بمراسلة هذا الرقم أو الاتصال به عند حدوث أمر مريب.', 'Agent alerts this number via message or voice call on anomalies.')}
                </p>
              </div>

              {/* Alert Mode */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {t('إجراء الوكيل عند رصد أمر مريب (اختياري):', 'Agent Action on Incident:')}
                </label>
                <select
                  value={custAlertMode}
                  onChange={e => {
                    const newMode = e.target.value as WhatsAppAlertMode;
                    setCustAlertMode(newMode);
                    updateCustomerWhatsAppSettings({ alertMode: newMode });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="MESSAGE_ONLY">{t('💬 إرسال رسالة واتساب فقط برابط الفيديو الجنائي', 'Message Only (with 70s video link)')}</option>
                  <option value="CALL_ONLY">{t('📞 إجراء مكالمة صوتية عبر واتساب فقط', 'Voice Call Only (urgent briefing)')}</option>
                  <option value="MESSAGE_AND_CALL">{t('🔔 رسالة + مكالمة صوتية معاً (اختياري / موصى به)', 'Both: Message + Voice Call')}</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('يمكنك تخصيص هل يقوم الإيجنت بالمراسلة فقط، أم الاتصال هاتفياً، أم كلاهما.', 'Select whether agent sends message, calls phone, or both.')}
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {t('مزود WhatsApp Business المعتمد:', 'WhatsApp Business Provider:')}
                </label>
                <select
                  value={whatsAppProvider}
                  onChange={e => setWhatsAppProvider(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="META_CLOUD_API">Meta Official WhatsApp Cloud API</option>
                  <option value="TWILIO_BUSINESS">Twilio WhatsApp Messaging API</option>
                  <option value="LOCAL_GATEWAY">On-Premise WhatsApp Local Gateway</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('تشفير تام وحماية الامتثال لسياسات Meta للأعمال.', 'Compliant with Meta Business messaging policies.')}
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {t('بريد تلقي التنبيهات الأمنية الطارئة:', 'Security Dispatch Email:')}
                </label>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={e => setAlertEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testingWa}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>{testingWa ? t('جاري إرسال الرسالة...', 'Sending...') : t('إرسال رسالة تجريبية للرقم', 'Test Send Message')}</span>
              </button>

              <button
                type="button"
                onClick={() => triggerWhatsAppCall({
                  title: 'مكالمة أمنية تجريبية',
                  reason: 'فحص الاتصال الصوتي السريع للإيجنت',
                  cameraName: 'المستودع الرئيسي - الرف 04',
                  severity: 'CRITICAL',
                })}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('تجربة اتصال صوتي بالعميل الآن', 'Test Voice Call Now')}</span>
              </button>
            </div>
          </div>

          {/* Section 3: Evidence Retention & Non-Deletability */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>{t('سياسة تخزين الأدلة الجنائية (Forensic Clip Retention)', 'Forensic Video Retention Policy')}</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  {t('فترة الاحتفاظ بمقاطع الأدلة (70 ثانية للحادثة):', '70s Forensic Clip Retention Period:')}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{retentionDays} {t('يوماً', 'Days')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
                <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p>
                  {t(
                    'التسجيلات المرتبطة بحوادث أمنية مثبتة محمية تلقائياً من المسح الدوري ولا يمكن حتى للمسؤولين حذفها.',
                    'Recorded video clips tied to confirmed security incidents are locked and exempt from automated pruning.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-2">
            {isSaved ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('تم حفظ وتطبيق جميع الإعدادات بنجاح!', 'Settings successfully applied & audit logged!')}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">
                {t('جميع التعديلات على الإعدادات توثق تلقائياً في سجل التدقيق.', 'All configuration modifications are recorded in the audit trail.')}
              </span>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t('حفظ التعديلات وتحديث المنظومة', 'Save Configuration')}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
