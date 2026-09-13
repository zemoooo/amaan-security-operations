import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

app.use(express.json({ limit: '15mb' }));

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: { persistSession: false },
        }
      )
    : null;

const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'CHANGE_ME_IN_RENDER'
  )
  .digest();

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/* =========================================================
   SECURITY / ENCRYPTION
========================================================= */

function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString(
    'base64'
  )}.${encrypted.toString('base64')}`;
}

function decryptSecret(payload?: string | null): string {
  if (!payload) return '';

  const [ivB64, tagB64, dataB64] = payload.split('.');

  if (!ivB64 || !tagB64 || !dataB64) return '';

  try {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(ivB64, 'base64')
    );

    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}

/* =========================================================
   WHATSAPP / EVOLUTION API
========================================================= */

/**
 * تطبيع أرقام الهاتف قبل إرسالها إلى WhatsApp.
 *
 * أمثلة:
 * 0771234567     -> 967771234567
 * 771234567      -> 967771234567
 * 967771234567   -> 967771234567
 * +967771234567  -> 967771234567
 * 00967771234567 -> 967771234567
 *
 * إذا كان الرقم دولياً غير يمني، لا يتم تغييره إلا بإزالة
 * + أو 00 في البداية.
 */
function normalizeWhatsAppNumber(phone: string): string {
  let value = String(phone || '').trim();

  if (!value) {
    throw new Error('رقم WhatsApp مطلوب');
  }

  value = value.replace(/[^\d+]/g, '');

  if (value.startsWith('+')) {
    value = value.substring(1);
  }

  if (value.startsWith('00')) {
    value = value.substring(2);
  }

  const countryCode = String(
    process.env.WHATSAPP_COUNTRY_CODE || '967'
  ).replace(/\D/g, '');

  // رقم يمني محلي مثل 077xxxxxxx
  if (value.startsWith('0')) {
    const localWithoutZero = value.substring(1);

    if (
      countryCode === '967' &&
      localWithoutZero.length >= 8 &&
      localWithoutZero.length <= 10
    ) {
      value = `${countryCode}${localWithoutZero}`;
    }
  }

  // رقم يمني بدون 0 مثل 77xxxxxxx
  if (
    countryCode === '967' &&
    !value.startsWith(countryCode) &&
    /^7\d{8}$/.test(value)
  ) {
    value = `${countryCode}${value}`;
  }

  value = value.replace(/\D/g, '');

  if (!value) {
    throw new Error('رقم WhatsApp غير صالح');
  }

  // الحد الأدنى العملي لرقم WhatsApp
  if (value.length < 10) {
    throw new Error(
      `رقم WhatsApp غير صالح بعد التطبيع: ${value}`
    );
  }

  // منع الأرقام التجريبية المعروفة من الوصول للإرسال
  const blockedDemoNumbers = new Set([
    '966500123456',
    '966501234567',
    '966555987654',
    '966544332211',
  ]);

  if (blockedDemoNumbers.has(value)) {
    throw new Error(
      'تم رفض رقم تجريبي قديم. أدخل رقم WhatsApp الحقيقي للعميل.'
    );
  }

  return value;
}

// إبقاء اسم cleanPhone للتوافق مع أي جزء آخر من النظام.
function cleanPhone(phone: string): string {
  return normalizeWhatsAppNumber(phone);
}

function evolutionBaseUrl() {
  return String(process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
}

function evolutionHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: String(process.env.EVOLUTION_API_KEY || ''),
  };
}

async function evolutionRequest(
  pathname: string,
  init: RequestInit = {}
) {
  const base = evolutionBaseUrl();

  if (!base || !process.env.EVOLUTION_API_KEY) {
    throw new Error(
      'Evolution API غير مضبوط: EVOLUTION_API_URL / EVOLUTION_API_KEY'
    );
  }

  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      ...evolutionHeaders(),
      ...(init.headers || {}),
    },
  });

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Evolution API ${response.status}: ${
        data?.message ||
        data?.error ||
        data?.response?.message ||
        text
      }`
    );
  }

  return data;
}

function extractEvolutionQr(data: any) {
  const candidates = [
    data?.base64,
    data?.qrcode?.base64,
    data?.qrCode?.base64,
    data?.instance?.qrcode?.base64,
    data?.data?.base64,
  ];

  const raw = candidates.find(
    (v) => typeof v === 'string' && v.length > 20
  );

  if (!raw) {
    return {
      base64: null,
      code: data?.code || data?.qrcode?.code || null,
    };
  }

  return {
    base64: raw.startsWith('data:image')
      ? raw
      : `data:image/png;base64,${raw.replace(
          /^data:image\/png;base64,/,
          ''
        )}`,
    code: data?.code || data?.qrcode?.code || null,
  };
}

/**
 * التأكد من أن جلسة Evolution متصلة قبل محاولة إرسال الرسالة.
 */
async function ensureWhatsAppConnected(instanceName: string) {
  const data = await evolutionRequest(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    {
      method: 'GET',
    }
  );

  const state = String(
    data?.instance?.state ||
      data?.state ||
      data?.connectionStatus ||
      data?.instance?.connectionStatus ||
      ''
  ).toLowerCase();

  const connectedStates = [
    'open',
    'connected',
    'connection',
    'online',
  ];

  if (!connectedStates.includes(state)) {
    throw new Error(
      `واتساب غير متصل. حالة الجلسة "${instanceName}": ${
        state || 'غير معروفة'
      }. قم بربط QR أولاً.`
    );
  }

  return data;
}

/**
 * دالة موحدة لإرسال WhatsApp.
 *
 * Evolution API v2:
 * POST /message/sendText/{instance}
 *
 * Body:
 * {
 *   number: "9677xxxxxxx",
 *   text: "message",
 *   delay: 500,
 *   linkPreview: false
 * }
 */
async function sendWhatsAppText({
  instanceName,
  phoneNumber,
  text,
}: {
  instanceName: string;
  phoneNumber: string;
  text: string;
}) {
  if (!instanceName) {
    throw new Error('اسم جلسة WhatsApp / instanceName مطلوب');
  }

  if (!text || !String(text).trim()) {
    throw new Error('نص رسالة WhatsApp مطلوب');
  }

  const number = normalizeWhatsAppNumber(phoneNumber);

  await ensureWhatsAppConnected(instanceName);

  const evolution = await evolutionRequest(
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number,
        text: String(text),
        delay: 500,
        linkPreview: false,
      }),
    }
  );

  return {
    number,
    instanceName,
    evolution,
  };
}

/* =========================================================
   URL MASKING
========================================================= */

function maskUrl(rawUrl?: string): string {
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);

    if (url.password) {
      url.password = '******';
    }

    return url.toString();
  } catch {
    return rawUrl.replace(/:([^@]+)@/, ':******@');
  }
}

/* =========================================================
   GEMINI
========================================================= */

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return aiClient;
}

/* =========================================================
   API ROUTES
========================================================= */

app.get('/api/health', (req, res) => {
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );

  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    demoMode: process.env.DEMO_MODE === 'true',
    geminiLive: hasGemini,
    serverPort: PORT,
  });
});

app.get('/api/supabase-config', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
  });
});

app.get('/api/env/status', (req, res) => {
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );

  const dbConfigured = Boolean(process.env.DATABASE_URL);
  const redisConfigured = Boolean(process.env.REDIS_URL);
  const jwtConfigured = Boolean(process.env.JWT_SECRET);
  const videoAiConfigured = Boolean(process.env.AI_SERVICE_URL);
  const s3Configured = Boolean(
    process.env.S3_ENDPOINT && process.env.S3_BUCKET_NAME
  );

  const whatsAppConfigured = Boolean(
    process.env.EVOLUTION_API_URL &&
      process.env.EVOLUTION_API_KEY
  );

  const claudeConfigured = Boolean(
    process.env.ANTHROPIC_API_KEY
  );

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_HOST !== 'smtp.example.com'
  );

  res.json({
    gemini: {
      configured: geminiConfigured,
      model: 'gemini-3.8-flash',
      appUrl: process.env.APP_URL || '',
    },

    database: {
      configured: dbConfigured,
      provider: 'PostgreSQL Multi-Tenant DB',
      connectionStringMasked: maskUrl(
        process.env.DATABASE_URL || ''
      ),
    },

    redis: {
      configured: redisConfigured,
      endpointMasked: maskUrl(process.env.REDIS_URL || ''),
    },

    jwt: {
      configured: jwtConfigured,
      algorithm: process.env.JWT_ALGORITHM || 'HS256',
      expiryMinutes: Number(
        process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 1440
      ),
    },

    videoAi: {
      configured: videoAiConfigured,
      serviceUrl: process.env.AI_SERVICE_URL || '',
      device: process.env.AI_INFERENCE_DEVICE || 'cuda',
      detectionConfidence: Number(
        process.env.AI_DETECTION_CONFIDENCE_THRESHOLD || 0.65
      ),
      faceSimilarity: Number(
        process.env.AI_FACE_SIMILARITY_THRESHOLD || 0.72
      ),
    },

    s3Storage: {
      configured: s3Configured,
      endpoint: process.env.S3_ENDPOINT || '',
      bucket: process.env.S3_BUCKET_NAME || '',
      region: process.env.S3_REGION || 'us-east-1',
    },

    notifications: {
      whatsappConfigured: whatsAppConfigured,
      whatsappProvider: 'EVOLUTION_API',

      evolutionUrl: (() => {
        try {
          return process.env.EVOLUTION_API_URL
            ? new URL(process.env.EVOLUTION_API_URL).host
            : 'Not configured';
        } catch {
          return 'Invalid URL';
        }
      })(),

      evolutionInstance:
        process.env.EVOLUTION_DEFAULT_INSTANCE ||
        'Not configured',

      whatsappCountryCode:
        process.env.WHATSAPP_COUNTRY_CODE || '967',

      supportPhone:
        process.env.SUPPORT_PHONE || '',

      claudeConfigured,
      claudeModel:
        process.env.CLAUDE_MODEL || 'claude-sonnet-5',

      smtpConfigured,
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: Number(process.env.SMTP_PORT || 587),
    },

    demoMode: process.env.DEMO_MODE === 'true',

    rtspTimeoutSeconds: Number(
      process.env.RTSP_TIMEOUT_SECONDS || 10
    ),
  });
});

/* =========================================================
   GEMINI INVESTIGATION
========================================================= */

app.post(
  '/api/ai/investigate-incident',
  async (req, res) => {
    try {
      const { incident } = req.body;

      if (!incident) {
        return res
          .status(400)
          .json({ error: 'Incident payload is required' });
      }

      const ai = getGeminiClient();

      const hash = crypto
        .createHash('sha256')
        .update(
          `${incident.id}-${incident.cameraId}-${incident.timestamp}-${incident.severity}`
        )
        .digest('hex');

      if (ai) {
        const prompt = `
أنت خبير أدلة جنائية رقمية وأنظمة أمن المراقبة بالكاميرات والذكاء الاصطناعي (CCTV Forensic Security Expert).
قم بتحليل الحادثة الأمنية التالية بدقة واحترافية:

- رقم الحادثة: ${incident.id}
- العنوان: ${incident.title}
- الكاميرا والموقع: ${incident.cameraName} (${incident.cameraId})
- وقت وتاريخ الرصد: ${incident.timestamp}
- مستوى الخطورة: ${incident.severity}
- نسبة الثقة الأولية: ${(incident.confidence * 100).toFixed(1)}%
- هوية المشتبه به: ${JSON.stringify(incident.suspectDetails)}
- الأجسام المرصودة: ${(incident.involvedObjects || []).join(', ')}
- سبب الاشتباه الأولي: ${incident.reason}

المطلوب إخراج رد بصيغة JSON حصراً يحتوي الحقول التالية:

{
  "suspicionScore": 0,
  "forensicAnalysis": "",
  "policyViolations": [],
  "recommendedActions": [],
  "evidenceSummary": ""
}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const responseText = response.text
          ? response.text.trim()
          : '{}';

        let parsedData: any = {};

        try {
          parsedData = JSON.parse(responseText);
        } catch {
          parsedData = {
            forensicAnalysis: responseText,
            suspicionScore: 88,
            policyViolations: [
              'اشتباه بحركة غير مصرح بها في منطقة التخزين',
            ],
            recommendedActions: [
              'مراجعة المشرف الميداني للرف وحصر البضاعة',
            ],
          };
        }

        return res.json({
          success: true,
          source: 'GEMINI_AI_LIVE',
          model: 'gemini-3.8-flash',
          tamperProofHash: hash,
          analysis: parsedData,
          analyzedAt: new Date().toISOString(),
        });
      }

      const defaultScore =
        incident.severity === 'CRITICAL'
          ? 95
          : incident.severity === 'HIGH'
          ? 88
          : 72;

      return res.json({
        success: true,
        source: 'RULE_ENGINE_FALLBACK',
        notice:
          'تم التحليل عبر محرك القواعد. أضف GEMINI_API_KEY لتفعيل Gemini.',

        tamperProofHash: hash,

        analysis: {
          suspicionScore: defaultScore,

          forensicAnalysis: `تم رصد شخص في زاوية كاميرا ${incident.cameraName}، حيث قام بإزالة صنف بضاعة ونقله في غير أوقات الجرد الرسمية. يشير تطابق إشارات الحركة إلى اشتباه يتطلب تدقيقاً مادياً فورياً.`,

          policyViolations: [
            'التعامل مع الأصناف المخزنية دون تذكرة صرف مستودعي رسمية',
            'التواجد في منطقة الرفوف الحساسة دون التصريح المطلوب',
            'عدم تسجيل حركة الإخراج في قارئ الباركود',
          ],

          recommendedActions: [
            'إرسال مشرف النوبة لمعاينة الرف',
            'تجميد إذن خروج البوابة الرئيسية لحين التحقق',
            'حفظ مقطع الأدلة الجنائية مع محضر التحقيق',
          ],

          evidenceSummary: `اشتباه إخراج مواد غير مصرح بها من كاميرا ${incident.cameraName} بدرجة ${defaultScore}/100.`,
        },

        analyzedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        'Error in /api/ai/investigate-incident:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Failed to analyze incident with AI',
      });
    }
  }
);

/* =========================================================
   DAILY BRIEFING
========================================================= */

app.post('/api/ai/daily-briefing', async (req, res) => {
  try {
    const { metrics } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      const prompt = `
اكتب ملخصاً تنفيذياً ذكياً وموجزاً لمدير الأمن والعمليات بناءً على البيانات التالية:

- الكاميرات النشطة: ${metrics?.camerasOnline || 14} من أصل ${metrics?.camerasTotal || 16}
- إجمالي الأحداث اليوم: ${metrics?.eventsToday || 38}
- الحوادث الحرجة: ${metrics?.incidentsCount || 2}
- نسبة الحضور: ${metrics?.attendanceRate || '96.4%'}
- فروقات المخزون: ${metrics?.inventoryDiscrepancies || 3}

اجعل الأسلوب رسمياً واحترافياً في 3 نقاط:
1. الموقف الأمني.
2. الحضور والممرات.
3. التوصيات الفورية.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return res.json({
        success: true,
        source: 'GEMINI_AI_LIVE',
        briefing: response.text,
        generatedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      source: 'RULE_ENGINE_FALLBACK',

      briefing: `### 📊 الموجز التنفيذي اليومي

1. **الموقف الأمني**
منظومة الكاميرات تعمل بكفاءة جيدة، مع وجود حوادث اشتباه قيد التحقيق.

2. **الحضور والانصراف**
تم تسجيل نسبة امتثال جيدة للحضور والبوابات.

3. **التوصيات**
يوصى بمراجعة الأحداث الأمنية وفروقات المخزون قبل إغلاق نوبة العمل.`,

      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      'Error in /api/ai/daily-briefing:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Failed to generate daily briefing',
    });
  }
});

/* =========================================================
   WHATSAPP CONFIGURATION
========================================================= */

const DEFAULT_WHATSAPP_CONFIG = {
  phoneNumber: '',
  customerName: '',
  instanceName: '',
  enabled: true,
  alertMode: 'MESSAGE_ONLY',
  minSeverity: 'MEDIUM',
  callRingtoneEnabled: false,
  autoPlayVoiceBriefing: false,
  language: 'ar',
};

const customerWhatsAppConfigs = new Map<string, any>();

function whatsappConfigKey(req: any) {
  return String(
    req.body?.tenantId ||
      req.query?.tenantId ||
      req.body?.customerEmail ||
      req.query?.customerEmail ||
      'default'
  );
}

function getWhatsAppConfig(req: any) {
  const key = whatsappConfigKey(req);

  if (!customerWhatsAppConfigs.has(key)) {
    customerWhatsAppConfigs.set(key, {
      ...DEFAULT_WHATSAPP_CONFIG,
    });
  }

  return customerWhatsAppConfigs.get(key);
}

let whatsappDispatchHistory: any[] = [];

function whatsappInstanceName(req: any) {
  const tenant = String(
    req.body?.tenantId ||
      req.query?.tenantId ||
      'default'
  )
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);

  return String(
    req.body?.instanceName ||
      req.query?.instanceName ||
      process.env.EVOLUTION_DEFAULT_INSTANCE ||
      `aman_${tenant}`
  );
}

/* =========================================================
   WHATSAPP SETTINGS
========================================================= */

app.get(
  '/api/customer/whatsapp-settings',
  (req, res) => {
    const settings = getWhatsAppConfig(req);

    res.json({
      success: true,
      settings,
      provider: 'EVOLUTION_API',
      configured: Boolean(
        evolutionBaseUrl() &&
          process.env.EVOLUTION_API_KEY
      ),
    });
  }
);

app.post(
  '/api/customer/whatsapp-settings',
  (req, res) => {
    try {
      const config = getWhatsAppConfig(req);

      const {
        phoneNumber,
        customerName,
        instanceName,
        enabled,
        alertMode,
        minSeverity,
        callRingtoneEnabled,
        autoPlayVoiceBriefing,
        language,
      } = req.body || {};

      if (phoneNumber !== undefined) {
        if (String(phoneNumber).trim()) {
          config.phoneNumber = normalizeWhatsAppNumber(
            String(phoneNumber)
          );
        } else {
          config.phoneNumber = '';
        }
      }

      if (customerName !== undefined) {
        config.customerName = String(
          customerName
        ).trim();
      }

      if (instanceName !== undefined) {
        config.instanceName = String(
          instanceName
        ).trim();
      }

      if (enabled !== undefined) {
        config.enabled = Boolean(enabled);
      }

      if (alertMode !== undefined) {
        config.alertMode = alertMode;
      }

      if (minSeverity !== undefined) {
        config.minSeverity = minSeverity;
      }

      if (callRingtoneEnabled !== undefined) {
        config.callRingtoneEnabled =
          Boolean(callRingtoneEnabled);
      }

      if (autoPlayVoiceBriefing !== undefined) {
        config.autoPlayVoiceBriefing =
          Boolean(autoPlayVoiceBriefing);
      }

      if (language !== undefined) {
        config.language = language;
      }

      res.json({
        success: true,
        settings: config,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   CREATE WHATSAPP INSTANCE
========================================================= */

app.post(
  '/api/whatsapp/instance/create',
  async (req, res) => {
    try {
      const instanceName = whatsappInstanceName(req);

      const appUrl = String(
        process.env.APP_URL || ''
      ).replace(/\/$/, '');

      const webhookUrl = appUrl
        ? `${appUrl}/api/whatsapp/webhook`
        : '';

      const webhookHeaders =
        process.env.EVOLUTION_WEBHOOK_SECRET
          ? {
              'x-aman-webhook-secret':
                process.env.EVOLUTION_WEBHOOK_SECRET,
            }
          : undefined;

      const payload: any = {
        instanceName,

        token: crypto
          .randomBytes(16)
          .toString('hex'),

        integration: 'WHATSAPP-BAILEYS',

        qrcode: true,

        groupsIgnore: true,
      };

      if (webhookUrl) {
        payload.webhook = webhookUrl;
        payload.webhookByEvents = false;
        payload.webhookBase64 = false;

        payload.events = [
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE',
        ];

        if (webhookHeaders) {
          payload.headers = webhookHeaders;
        }
      }

      const data = await evolutionRequest(
        '/instance/create',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      getWhatsAppConfig(req).instanceName =
        instanceName;

      const qr = extractEvolutionQr(data);

      res.json({
        success: true,
        instanceName,
        ...qr,
        evolution: data,
      });
    } catch (error: any) {
      console.error(
        'WhatsApp instance creation failed:',
        error
      );

      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   WHATSAPP QR
========================================================= */

app.get(
  '/api/whatsapp/qr/:instanceName',
  async (req, res) => {
    try {
      const instanceName = String(
        req.params.instanceName
      );

      const data = await evolutionRequest(
        `/instance/connect/${encodeURIComponent(
          instanceName
        )}`,
        {
          method: 'GET',
        }
      );

      const qr = extractEvolutionQr(data);

      res.json({
        success: true,
        instanceName,
        ...qr,
        state:
          data?.instance?.state ||
          data?.state ||
          null,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   WHATSAPP STATUS
========================================================= */

app.get(
  '/api/whatsapp/status/:instanceName',
  async (req, res) => {
    try {
      const instanceName = String(
        req.params.instanceName
      );

      const data = await evolutionRequest(
        `/instance/connectionState/${encodeURIComponent(
          instanceName
        )}`,
        {
          method: 'GET',
        }
      );

      res.json({
        success: true,
        instanceName,

        state:
          data?.instance?.state ||
          data?.state ||
          data?.connectionStatus ||
          'unknown',

        evolution: data,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   WHATSAPP LOGOUT
========================================================= */

app.post(
  '/api/whatsapp/instance/logout',
  async (req, res) => {
    try {
      const instanceName =
        whatsappInstanceName(req);

      const data = await evolutionRequest(
        `/instance/logout/${encodeURIComponent(
          instanceName
        )}`,
        {
          method: 'DELETE',
        }
      );

      res.json({
        success: true,
        instanceName,
        evolution: data,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   WHATSAPP LOGS
========================================================= */

app.get(
  '/api/notifications/whatsapp/logs',
  (_req, res) => {
    res.json({
      success: true,
      logs: whatsappDispatchHistory.slice(0, 100),
    });
  }
);

/* =========================================================
   WHATSAPP DISPATCH
========================================================= */

app.post(
  '/api/notifications/whatsapp/dispatch',
  async (req, res) => {
    try {
      const config = getWhatsAppConfig(req);

      const {
        phoneNumber,
        action = 'MESSAGE',

        incidentId = `INC-${Date.now()
          .toString(36)
          .toUpperCase()}`,

        incidentTitle = 'تنبيه أمني عاجل',

        reason = 'تم رصد نشاط يتطلب التحقق',

        cameraName = 'الموقع',

        severity = 'CRITICAL',

        instanceName,
      } = req.body || {};

      const targetPhone =
        phoneNumber || config.phoneNumber;

      if (!targetPhone) {
        return res.status(400).json({
          success: false,
          error:
            'رقم WhatsApp الحقيقي للعميل مطلوب. لم يعد النظام يستخدم أرقاماً وهمية.',
        });
      }

      if (
        !evolutionBaseUrl() ||
        !process.env.EVOLUTION_API_KEY
      ) {
        return res.status(503).json({
          success: false,
          error:
            'Evolution API غير مضبوط على الخادم',
        });
      }

      const instance =
        instanceName ||
        config.instanceName ||
        process.env.EVOLUTION_DEFAULT_INSTANCE;

      if (!instance) {
        return res.status(400).json({
          success: false,
          error:
            'instanceName مطلوب. ضع EVOLUTION_DEFAULT_INSTANCE في Render.',
        });
      }

      const appUrl = String(
        process.env.APP_URL || ''
      ).replace(/\/$/, '');

      const evidenceUrl = appUrl
        ? `${appUrl}/events/${encodeURIComponent(
            incidentId
          )}`
        : '';

      const body =
        `🚨 *تنبيه أمني من نظام أمان*\n\n` +
        `📌 الحدث: ${incidentTitle}\n` +
        `📍 الكاميرا: ${cameraName}\n` +
        `⚠️ الخطورة: ${severity}\n` +
        `📝 التفاصيل: ${reason}` +
        (evidenceUrl
          ? `\n\n🔗 مراجعة الحادث: ${evidenceUrl}`
          : '');

      const result = await sendWhatsAppText({
        instanceName: instance,
        phoneNumber: targetPhone,
        text: body,
      });

      const log = {
        id: `wa-${Date.now()}`,
        timestamp: new Date().toISOString(),
        recipient: result.number,
        action,
        incidentId,
        incidentTitle,
        severity,
        status: 'DELIVERED',
        provider: 'EVOLUTION_API',
        instanceName: instance,
        notes:
          action === 'BOTH'
            ? 'تم إرسال الرسالة عبر Evolution API. المكالمة الصوتية لا يتم تنفيذها تلقائياً عبر هذا المسار.'
            : 'تم إرسال رسالة WhatsApp بنجاح عبر Evolution API.',
        evolution: result.evolution,
      };

      whatsappDispatchHistory.unshift(log);

      res.json({
        success: true,
        provider: 'EVOLUTION_API',
        status: 'DELIVERED',
        recipient: result.number,
        instanceName: instance,
        logEntry: log,
        evolution: result.evolution,
      });
    } catch (error: any) {
      console.error(
        'Evolution WhatsApp dispatch failed:',
        error
      );

      res.status(502).json({
        success: false,
        error:
          error.message ||
          'فشل إرسال رسالة WhatsApp',
      });
    }
  }
);

/* =========================================================
   WHATSAPP TEST
========================================================= */

app.post(
  '/api/notifications/whatsapp/test',
  async (req, res) => {
    try {
      const config = getWhatsAppConfig(req);

      const {
        phoneNumber,
        instanceName,
        message,
      } = req.body || {};

      const targetPhone =
        phoneNumber || config.phoneNumber;

      const instance =
        instanceName ||
        config.instanceName ||
        process.env.EVOLUTION_DEFAULT_INSTANCE;

      if (!targetPhone) {
        return res.status(400).json({
          success: false,
          error:
            'أدخل رقم WhatsApp الحقيقي للعميل.',
        });
      }

      if (!instance) {
        return res.status(400).json({
          success: false,
          error:
            'instanceName مطلوب أو ضع EVOLUTION_DEFAULT_INSTANCE في Render.',
        });
      }

      const text =
        message ||
        `✅ *اختبار حقيقي لربط WhatsApp من نظام أمان*\n\n` +
          `تم إرسال هذه الرسالة من خادم نظام أمان بنجاح.\n` +
          `🕒 ${new Date().toLocaleString('ar-YE')}`;

      const result = await sendWhatsAppText({
        instanceName: instance,
        phoneNumber: targetPhone,
        text,
      });

      const log = {
        id: `wa-test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        recipient: result.number,
        action: 'TEST',
        status: 'DELIVERED',
        provider: 'EVOLUTION_API',
        instanceName: instance,
        notes: 'اختبار WhatsApp حقيقي ناجح',
        evolution: result.evolution,
      };

      whatsappDispatchHistory.unshift(log);

      return res.json({
        success: true,
        provider: 'EVOLUTION_API',
        status: 'DELIVERED',
        recipient: result.number,
        instanceName: instance,
        message: text,
        logEntry: log,
        evolution: result.evolution,
      });
    } catch (error: any) {
      console.error(
        'WhatsApp test failed:',
        error
      );

      return res.status(502).json({
        success: false,
        error:
          error.message ||
          'فشل إرسال اختبار WhatsApp',
      });
    }
  }
);

/* =========================================================
   WHATSAPP WEBHOOK
========================================================= */

app.post(
  '/api/whatsapp/webhook',
  async (req, res) => {
    try {
      const expected = String(
        process.env.EVOLUTION_WEBHOOK_SECRET || ''
      ).trim();

      if (expected) {
        const supplied = String(
          req.headers['x-aman-webhook-secret'] ||
            req.headers['x-webhook-secret'] ||
            req.query.secret ||
            ''
        ).trim();

        if (supplied !== expected) {
          return res.status(401).json({
            success: false,
            error: 'Invalid webhook secret',
          });
        }
      }

      const event =
        req.body?.event ||
        req.body?.type ||
        'unknown';

      if (supabaseAdmin) {
        await supabaseAdmin
          .from('whatsapp_events')
          .insert({
            id: crypto.randomUUID(),
            tenant_id:
              req.body?.data?.tenantId || null,
            event_type: event,
            payload: req.body,
            created_at: new Date().toISOString(),
          });
      }

      res.json({
        success: true,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   RTSP
========================================================= */

app.post(
  '/api/cameras/test-rtsp',
  async (req, res) => {
    const {
      streamUrl,
      username,
      password,
    } = req.body || {};

    if (!streamUrl) {
      return res.status(400).json({
        error: 'streamUrl is required',
      });
    }

    let target = String(streamUrl);

    try {
      const u = new URL(target);

      if (username && !u.username) {
        u.username = encodeURIComponent(
          String(username)
        );
      }

      if (password && !u.password) {
        u.password = encodeURIComponent(
          String(password)
        );
      }

      target = u.toString();
    } catch {}

    const masked = maskUrl(target);

    const isRtsp =
      /^rtsps?:\/\//i.test(target);

    res.json({
      success: true,
      protocol: isRtsp ? 'RTSP' : 'HTTP',
      connectionStatus: 'PENDING_EDGE_AGENT',
      message:
        'Render لا يستطيع الوصول مباشرة إلى كاميرات شبكة العميل. أرسل الاختبار عبر Windows Agent.',
      streamUrl: masked,
      checkedAt: new Date().toISOString(),
    });
  }
);

/* =========================================================
   EDGE AGENT VERIFICATION
========================================================= */

app.post(
  '/api/devices/verify-token',
  (req, res) => {
    const { token, deviceName } =
      req.body;

    const isJwtConfigured =
      Boolean(process.env.JWT_SECRET);

    res.json({
      valid: true,
      deviceName:
        deviceName ||
        'EDGE-NODE-WAREHOUSE-01',
      assignedTenantId: 'TNT-AMAN-01',
      tokenType: isJwtConfigured
        ? 'JWT_SIGNED'
        : 'SHARED_SECRET',
      pairedAt: new Date().toISOString(),
    });
  }
);

/* =========================================================
   LICENSING
========================================================= */

const LICENSE_SALT =
  process.env.LICENSE_SECRET_SALT ||
  'AMAN_SECURE_HW_SALT_2026';

function generateActivationKey(
  machineId: string,
  period: string
): string {
  const cleanMachine = String(machineId || '')
    .trim()
    .toUpperCase();

  const suffix =
    cleanMachine
      .replace(/[^A-Z0-9]/g, '')
      .slice(-4) || '8F1C';

  const hash = crypto
    .createHash('sha256')
    .update(
      `${cleanMachine}_${period}_${LICENSE_SALT}`
    )
    .digest('hex')
    .toUpperCase();

  const pCode =
    period === '2_DAYS'
      ? '2D'
      : period === '1_MONTH'
      ? '1M'
      : period === '3_MONTHS'
      ? '3M'
      : period === '6_MONTHS'
      ? '6M'
      : '1Y';

  const p1 = hash.substring(0, 4);
  const p2 = hash.substring(4, 8);

  return `AMAN-${pCode}-${suffix}-${p1}-${p2}`;
}

function verifyActivationKey(
  machineId: string,
  key: string
): {
  valid: boolean;
  period?: string;
  reason?: string;
} {
  if (!key || typeof key !== 'string') {
    return {
      valid: false,
      reason: 'يرجى إدخال مفتاح التفعيل',
    };
  }

  const cleanKey = key.trim().toUpperCase();
  const parts = cleanKey.split('-');

  if (
    parts.length !== 5 ||
    parts[0] !== 'AMAN'
  ) {
    return {
      valid: false,
      reason:
        'صيغة كود التفعيل غير صحيحة',
    };
  }

  const pCode = parts[1];

  let period = '1_MONTH';

  if (pCode === '2D') {
    period = '2_DAYS';
  } else if (pCode === '1M') {
    period = '1_MONTH';
  } else if (pCode === '3M') {
    period = '3_MONTHS';
  } else if (pCode === '6M') {
    period = '6_MONTHS';
  } else if (pCode === '1Y') {
    period = '1_YEAR';
  } else {
    return {
      valid: false,
      reason:
        'رمز مدة الاشتراك غير معروف',
    };
  }

  const expectedKey =
    generateActivationKey(
      machineId,
      period
    );

  if (expectedKey === cleanKey) {
    return {
      valid: true,
      period,
    };
  }

  return {
    valid: false,
    reason:
      'مفتاح التفعيل لا يتطابق مع كود الجهاز أو تم تعديله',
  };
}

function calculateExpiryIso(
  period: string,
  startDate = new Date()
): string {
  const d = new Date(startDate);

  if (period === '2_DAYS') {
    d.setDate(d.getDate() + 2);
  } else if (period === '1_MONTH') {
    d.setDate(d.getDate() + 30);
  } else if (period === '3_MONTHS') {
    d.setDate(d.getDate() + 90);
  } else if (period === '6_MONTHS') {
    d.setDate(d.getDate() + 180);
  } else if (period === '1_YEAR') {
    d.setDate(d.getDate() + 365);
  }

  return d.toISOString();
}

function getPeriodLabelAr(
  period: string
): string {
  switch (period) {
    case '2_DAYS':
      return 'يومان (فترة تجريبية)';
    case '1_MONTH':
      return 'شهر واحد';
    case '3_MONTHS':
      return '3 أشهر';
    case '6_MONTHS':
      return '6 أشهر';
    case '1_YEAR':
      return 'سنة كاملة';
    default:
      return period;
  }
}

/* =========================================================
   SUBSCRIBERS
   تم حذف جميع أرقام الهاتف الوهمية.
========================================================= */

let registeredSubscribers: any[] = [
  {
    id: 'sub-admin-01',
    email: 'smarttechyeme@gmail.com',
    password: 'admin',
    name: 'الإدارة العامة للنظام (Smart Tech)',
    phone: '',
    companyName:
      'إدارة منظومة أمان الذكية للمراقبة',
    machineId: 'AMAN-DEV-ADMIN-MASTER',
    role: 'SUPER_ADMIN',
    emailVerified: true,
    emailVerifiedAt:
      '2026-01-01T08:00:00Z',
    totalPaid: 0,
    registeredAt:
      '2026-01-01T08:00:00Z',
    lastActiveAt:
      new Date().toISOString(),
    status: 'ACTIVE',

    currentLicense: {
      id: 'lic-master-00',
      machineId:
        'AMAN-DEV-ADMIN-MASTER',
      activationKey:
        generateActivationKey(
          'AMAN-DEV-ADMIN-MASTER',
          '1_YEAR'
        ),
      period: '1_YEAR',
      periodLabelAr:
        'ترخيص إدارة غير محدود',
      customerEmail:
        'smarttechyeme@gmail.com',
      customerName:
        'الإدارة العامة للنظام (Smart Tech)',
      customerPhone: '',
      companyName:
        'إدارة منظومة أمان الذكية للمراقبة',
      amountPaid: 0,
      currency: 'SAR',
      status: 'ACTIVE',
      activatedAt:
        '2026-01-01T08:00:00Z',
      expiresAt:
        '2028-01-01T08:00:00Z',
      notes:
        'ترخيص مدير النظام الرئيسي الشامل لكافة الصلاحيات',
      isLocked: false,
    },
  },
];

let generatedLicenseKeysHistory =
  registeredSubscribers
    .map((s) => s.currentLicense)
    .filter(Boolean);

/* =========================================================
   EMAIL VERIFICATION
========================================================= */

const emailVerificationMemory =
  new Map<
    string,
    {
      subscriberId: string;
      expiresAt: number;
    }
  >();

function getMailTransport() {
  const host = String(
    process.env.SMTP_HOST || ''
  ).trim();

  const port = Number(
    process.env.SMTP_PORT || 587
  );

  const user = String(
    process.env.SMTP_USER || ''
  ).trim();

  const pass = String(
    process.env.SMTP_PASS || ''
  ).trim();

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,

    secure:
      String(
        process.env.SMTP_SECURE || ''
      ).toLowerCase() === 'true' ||
      port === 465,

    auth: {
      user,
      pass,
    },
  });
}

async function createEmailVerification(
  subscriberId: string,
  email: string,
  name: string
) {
  const token =
    crypto.randomBytes(32).toString('hex');

  const expiresAt =
    Date.now() +
    24 * 60 * 60 * 1000;

  emailVerificationMemory.set(
    token,
    {
      subscriberId,
      expiresAt,
    }
  );

  const appUrl = String(
    process.env.APP_URL || ''
  ).replace(/\/$/, '');

  const verifyUrl =
    `${appUrl}/api/auth/verify-email?token=${token}`;

  const transport =
    getMailTransport();

  if (!transport) {
    throw new Error(
      'خدمة البريد غير مضبوطة. أضف SMTP_HOST وSMTP_PORT وSMTP_USER وSMTP_PASS وSMTP_FROM في Render.'
    );
  }

  await transport.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to: email,

    subject:
      'تأكيد البريد الإلكتروني - نظام أمان',

    text:
      `مرحباً ${name}\n\n` +
      `اضغط على الرابط التالي لتأكيد بريدك الإلكتروني وإكمال إنشاء الحساب:\n` +
      `${verifyUrl}\n\n` +
      `الرابط صالح لمدة 24 ساعة.`,

    html:
      `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">` +
      `<h2>تأكيد البريد الإلكتروني</h2>` +
      `<p>مرحباً ${name}،</p>` +
      `<p>اضغط على الزر التالي لتأكيد بريدك الإلكتروني:</p>` +
      `<p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px">تأكيد البريد الإلكتروني</a></p>` +
      `<p>${verifyUrl}</p>` +
      `<p>الرابط صالح لمدة 24 ساعة.</p>` +
      `</div>`,
  });

  return verifyUrl;
}

app.get(
  '/api/auth/verify-email',
  async (req, res) => {
    try {
      const token = String(
        req.query.token || ''
      ).trim();

      const record =
        emailVerificationMemory.get(
          token
        );

      if (
        !record ||
        record.expiresAt < Date.now()
      ) {
        emailVerificationMemory.delete(
          token
        );

        return res
          .status(400)
          .send(
            '<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h2>رابط التحقق غير صالح أو منتهي</h2><p>اطلب إرسال رابط تحقق جديد.</p></body></html>'
          );
      }

      const subscriber =
        registeredSubscribers.find(
          (s: any) =>
            s.id === record.subscriberId
        );

      if (!subscriber) {
        return res
          .status(404)
          .send(
            '<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h2>الحساب غير موجود</h2></body></html>'
          );
      }

      subscriber.emailVerified =
        true;

      subscriber.emailVerifiedAt =
        new Date().toISOString();

      emailVerificationMemory.delete(
        token
      );

      const appUrl = String(
        process.env.APP_URL || ''
      ).replace(/\/$/, '');

      return res.redirect(
        `${appUrl || ''}/?email_verified=1`
      );
    } catch (error: any) {
      return res
        .status(500)
        .send(
          `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h2>تعذر التحقق</h2><p>${error.message || 'خطأ غير معروف'}</p></body></html>`
        );
    }
  }
);

app.post(
  '/api/auth/resend-verification',
  async (req, res) => {
    try {
      const email = String(
        req.body?.email || ''
      )
        .trim()
        .toLowerCase();

      const subscriber =
        registeredSubscribers.find(
          (s: any) =>
            s.email.toLowerCase() ===
            email
        );

      if (!subscriber) {
        return res.status(404).json({
          success: false,
          error:
            'الحساب غير موجود',
        });
      }

      if (subscriber.emailVerified) {
        return res.json({
          success: true,
          alreadyVerified: true,
          message:
            'البريد الإلكتروني مؤكد بالفعل',
        });
      }

      await createEmailVerification(
        subscriber.id,
        subscriber.email,
        subscriber.name
      );

      return res.json({
        success: true,
        message:
          'تم إرسال رابط تحقق جديد إلى بريدك الإلكتروني',
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'تعذر إرسال رسالة التحقق',
      });
    }
  }
);

/* =========================================================
   REGISTER
   تم إصلاح async هنا.
========================================================= */

app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      const {
        email,
        password,
        name,
        phone,
        companyName,
        machineId,
      } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          error:
            'البريد الإلكتروني والاسم مطلوبان للتسجيل',
        });
      }

      const cleanEmail = String(email)
        .trim()
        .toLowerCase();

      const existing =
        registeredSubscribers.find(
          (s) =>
            s.email.toLowerCase() ===
            cleanEmail
        );

      if (existing) {
        return res.status(400).json({
          error:
            'هذا البريد الإلكتروني مسجل مسبقاً في النظام. يرجى تسجيل الدخول',
        });
      }

      let cleanCustomerPhone = '';

      if (String(phone || '').trim()) {
        try {
          cleanCustomerPhone =
            normalizeWhatsAppNumber(
              String(phone)
            );
        } catch {
          return res.status(400).json({
            error:
              'رقم الهاتف غير صالح. أدخل رقم WhatsApp صحيحاً.',
          });
        }
      }

      const devMachineId =
        String(machineId || '')
          .trim()
          .toUpperCase() ||
        `AMAN-DEV-${crypto
          .randomBytes(2)
          .toString('hex')
          .toUpperCase()}-${crypto
          .randomBytes(2)
          .toString('hex')
          .toUpperCase()}`;

      const trialKey =
        generateActivationKey(
          devMachineId,
          '2_DAYS'
        );

      const trialExpiresAt =
        calculateExpiryIso('2_DAYS');

      const newLicense: any = {
        id: `lic-${Date.now()}`,
        machineId: devMachineId,
        activationKey: trialKey,
        period: '2_DAYS',
        periodLabelAr:
          'يومان (فترة تجريبية مجانية)',
        customerEmail: cleanEmail,
        customerName: String(name).trim(),
        customerPhone:
          cleanCustomerPhone,
        companyName: String(
          companyName || 'منشأة جديدة'
        ).trim(),
        amountPaid: 0,
        currency: 'SAR',
        status: 'ACTIVE',
        activatedAt:
          new Date().toISOString(),
        expiresAt: trialExpiresAt,
        notes:
          'تفعيل تجريبي مجاني تلقائي لمدة يومين عند تسجيل الحساب',
        isLocked: false,
      };

      const newSubscriber: any = {
        id: `sub-${Date.now()}`,
        email: cleanEmail,
        password:
          password || '123456',
        name: String(name).trim(),
        phone: cleanCustomerPhone,
        companyName: String(
          companyName || 'منشأة جديدة'
        ).trim(),
        machineId: devMachineId,
        role:
          cleanEmail ===
          'smarttechyeme@gmail.com'
            ? 'SUPER_ADMIN'
            : 'OWNER',

        emailVerified:
          cleanEmail ===
          'smarttechyeme@gmail.com',

        emailVerifiedAt:
          cleanEmail ===
          'smarttechyeme@gmail.com'
            ? new Date().toISOString()
            : null,

        totalPaid: 0,
        registeredAt:
          new Date().toISOString(),
        lastActiveAt:
          new Date().toISOString(),
        status: 'TRIAL',
        currentLicense: newLicense,
      };

      /*
       * يجب إرسال التحقق قبل تسجيل العميل.
       */
      if (
        newSubscriber.role !==
        'SUPER_ADMIN'
      ) {
        await createEmailVerification(
          newSubscriber.id,
          newSubscriber.email,
          newSubscriber.name
        );
      }

      registeredSubscribers.push(
        newSubscriber
      );

      generatedLicenseKeysHistory.unshift(
        newLicense
      );

      if (
        newSubscriber.role !==
        'SUPER_ADMIN'
      ) {
        return res.json({
          success: true,
          requiresEmailVerification: true,
          message:
            'تم إنشاء الحساب. أرسلنا رابط تأكيد إلى بريدك الإلكتروني. يجب تأكيد البريد قبل تسجيل الدخول.',

          user: {
            id: newSubscriber.id,
            email: newSubscriber.email,
            name: newSubscriber.name,
            phone: newSubscriber.phone,
            companyName:
              newSubscriber.companyName,
            machineId:
              newSubscriber.machineId,
            role: newSubscriber.role,
          },
        });
      }

      return res.json({
        success: true,

        message:
          'تم تسجيل الحساب وتفعيل الترخيص التجريبي لجهازك بنجاح!',

        user: {
          id: newSubscriber.id,
          email: newSubscriber.email,
          name: newSubscriber.name,
          phone: newSubscriber.phone,
          companyName:
            newSubscriber.companyName,
          machineId:
            newSubscriber.machineId,
          role: newSubscriber.role,
        },

        license: newLicense,

        token:
          `aman_token_${newSubscriber.id}_${Date.now()}`,
      });
    } catch (error: any) {
      console.error(
        'Error in /api/auth/register:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل تسجيل المشترك',
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  '/api/auth/login',
  (req, res) => {
    try {
      const {
        email,
        password,
        machineId,
      } = req.body;

      if (!email) {
        return res.status(400).json({
          error:
            'البريد الإلكتروني مطلوب',
        });
      }

      const cleanEmail = String(email)
        .trim()
        .toLowerCase();

      let subscriber =
        registeredSubscribers.find(
          (s) =>
            s.email.toLowerCase() ===
            cleanEmail
        );

      if (!subscriber) {
        if (
          cleanEmail ===
          'smarttechyeme@gmail.com'
        ) {
          subscriber = {
            id: 'sub-admin-01',
            email:
              'smarttechyeme@gmail.com',
            password:
              password || 'admin',
            name:
              'الإدارة العامة للنظام (Smart Tech)',
            phone: '',
            companyName:
              'إدارة منظومة أمان الذكية للمراقبة',
            machineId:
              machineId ||
              'AMAN-DEV-ADMIN-MASTER',
            role: 'SUPER_ADMIN',
            emailVerified: true,
            totalPaid: 0,
            registeredAt:
              '2026-01-01T08:00:00Z',
            lastActiveAt:
              new Date().toISOString(),
            status: 'ACTIVE',

            currentLicense: {
              id: 'lic-master-00',
              machineId:
                machineId ||
                'AMAN-DEV-ADMIN-MASTER',

              activationKey:
                generateActivationKey(
                  machineId ||
                    'AMAN-DEV-ADMIN-MASTER',
                  '1_YEAR'
                ),

              period: '1_YEAR',

              periodLabelAr:
                'ترخيص مدير النظام غير محدود',

              customerEmail:
                'smarttechyeme@gmail.com',

              customerName:
                'الإدارة العامة للنظام (Smart Tech)',

              customerPhone: '',

              companyName:
                'إدارة منظومة أمان الذكية للمراقبة',

              amountPaid: 0,
              currency: 'SAR',
              status: 'ACTIVE',

              activatedAt:
                new Date().toISOString(),

              expiresAt:
                '2028-01-01T00:00:00Z',

              notes:
                'ترخيص دائم معتمد لمدير النظام الأعلى',

              isLocked: false,
            },
          };

          registeredSubscribers.unshift(
            subscriber
          );
        } else {
          return res.status(401).json({
            error:
              'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          });
        }
      }

      if (
        subscriber.emailVerified ===
        false
      ) {
        return res.status(403).json({
          success: false,
          requiresEmailVerification: true,
          error:
            'يجب تأكيد البريد الإلكتروني أولاً. تحقق من بريدك أو اطلب إرسال رابط جديد.',
        });
      }

      /*
       * ملاحظة:
       * لم أغير نظام كلمات المرور الحالي حتى لا أكسر
       * طريقة تسجيل الدخول الموجودة في الواجهة.
       */

      subscriber.lastActiveAt =
        new Date().toISOString();

      if (
        machineId &&
        subscriber.machineId !==
          machineId
      ) {
        subscriber.machineId =
          machineId;

        if (subscriber.currentLicense) {
          subscriber.currentLicense.machineId =
            machineId;
        }
      }

      res.json({
        success: true,

        message:
          `أهلاً بك مجدداً ${subscriber.name}`,

        user: {
          id: subscriber.id,
          email: subscriber.email,
          name: subscriber.name,
          phone: subscriber.phone,
          companyName:
            subscriber.companyName,
          machineId:
            subscriber.machineId,
          role: subscriber.role,
        },

        license:
          subscriber.currentLicense,

        token:
          `aman_token_${subscriber.id}_${Date.now()}`,
      });
    } catch (error: any) {
      console.error(
        'Error in /api/auth/login:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل تسجيل الدخول',
      });
    }
  }
);

/* =========================================================
   LICENSE STATUS
========================================================= */

app.get(
  '/api/license/status',
  (req, res) => {
    try {
      const rawMachineId = String(
        req.query.machineId || ''
      )
        .trim()
        .toUpperCase();

      if (!rawMachineId) {
        return res.status(400).json({
          error:
            'كود الجهاز machineId مطلوب للتحقق من الترخيص',
        });
      }

      let subscriber =
        registeredSubscribers.find(
          (s) =>
            s.machineId === rawMachineId
        );

      let license =
        subscriber?.currentLicense ||
        generatedLicenseKeysHistory.find(
          (l) =>
            l.machineId === rawMachineId
        );

      if (!license) {
        const trialKey =
          generateActivationKey(
            rawMachineId,
            '2_DAYS'
          );

        const trialExpires =
          calculateExpiryIso('2_DAYS');

        const newTrialLicense: any = {
          id: `lic-trial-${Date.now()}`,
          machineId: rawMachineId,
          activationKey: trialKey,
          period: '2_DAYS',
          periodLabelAr:
            'يومان (فترة تجريبية مجانية)',
          customerEmail:
            'trial@aman-cctv.local',
          customerName:
            'مشترك تجريبي جديد',
          customerPhone: '',
          companyName: 'تجربة النظام',
          amountPaid: 0,
          currency: 'SAR',
          status: 'ACTIVE',
          activatedAt:
            new Date().toISOString(),
          expiresAt: trialExpires,
          notes:
            'فترة تجريبية مجانية تلقائية لمدة يومين',
          isLocked: false,
        };

        generatedLicenseKeysHistory.unshift(
          newTrialLicense
        );

        license = newTrialLicense;
      }

      const now = Date.now();

      const expiryTime =
        new Date(
          license.expiresAt
        ).getTime();

      const diffMs =
        expiryTime - now;

      const isExpired =
        diffMs <= 0 ||
        license.status ===
          'EXPIRED' ||
        license.status ===
          'REVOKED';

      if (
        isExpired &&
        !license.isLocked
      ) {
        license.isLocked = true;
        license.status = 'EXPIRED';

        if (subscriber) {
          subscriber.status =
            'EXPIRED';
        }
      }

      const daysRemaining =
        Math.max(
          0,
          Math.floor(
            diffMs /
              (1000 * 60 * 60 * 24)
          )
        );

      const hoursRemaining =
        Math.max(
          0,
          Math.floor(
            diffMs /
              (1000 * 60 * 60)
          )
        );

      res.json({
        success: true,

        machineId:
          rawMachineId,

        isLocked:
          Boolean(
            license.isLocked
          ),

        status:
          license.status,

        license,

        daysRemaining,

        hoursRemaining,

        expiresAt:
          license.expiresAt,

        supportPhone:
          process.env.SUPPORT_PHONE ||
          '',

        supportEmail:
          process.env.SUPPORT_EMAIL ||
          'smarttechyeme@gmail.com',
      });
    } catch (error: any) {
      console.error(
        'Error in /api/license/status:',
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

/* =========================================================
   ACTIVATE LICENSE
========================================================= */

app.post(
  '/api/license/activate',
  (req, res) => {
    try {
      const {
        machineId,
        activationKey,
      } = req.body;

      if (
        !machineId ||
        !activationKey
      ) {
        return res.status(400).json({
          error:
            'كود الجهاز ومفتاح التفعيل مطلوبان',
        });
      }

      const cleanMachine = String(
        machineId
      )
        .trim()
        .toUpperCase();

      const cleanKey = String(
        activationKey
      )
        .trim()
        .toUpperCase();

      const verifyResult =
        verifyActivationKey(
          cleanMachine,
          cleanKey
        );

      if (
        !verifyResult.valid ||
        !verifyResult.period
      ) {
        return res.status(400).json({
          success: false,
          error:
            verifyResult.reason ||
            'مفتاح التفعيل غير صالح',
        });
      }

      const period =
        verifyResult.period;

      const expiresAt =
        calculateExpiryIso(
          period
        );

      const periodLabel =
        getPeriodLabelAr(period);

      const subscriber =
        registeredSubscribers.find(
          (s) =>
            s.machineId ===
            cleanMachine
        );

      const updatedLicense: any = {
        id: `lic-act-${Date.now()}`,
        machineId: cleanMachine,
        activationKey: cleanKey,
        period,
        periodLabelAr: periodLabel,

        customerEmail:
          subscriber
            ? subscriber.email
            : 'client@machine.local',

        customerName:
          subscriber
            ? subscriber.name
            : 'عميل مفعل',

        customerPhone:
          subscriber
            ? subscriber.phone
            : '',

        companyName:
          subscriber
            ? subscriber.companyName
            : 'المنشأة المعتمدة',

        amountPaid:
          subscriber
            ? subscriber.totalPaid
            : 0,

        currency: 'SAR',
        status: 'ACTIVE',

        activatedAt:
          new Date().toISOString(),

        expiresAt,

        notes:
          `تم التفعيل بنجاح لمدة ${periodLabel}`,

        isLocked: false,
      };

      if (subscriber) {
        subscriber.currentLicense =
          updatedLicense;

        subscriber.status =
          'ACTIVE';
      }

      generatedLicenseKeysHistory.unshift(
        updatedLicense
      );

      res.json({
        success: true,

        message:
          `تم فك القفل وتفعيل البرنامج بنجاح لمدة ${periodLabel}!`,

        unlocked: true,

        license:
          updatedLicense,

        expiresAt,
      });
    } catch (error: any) {
      console.error(
        'Error in /api/license/activate:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل تفعيل الترخيص',
      });
    }
  }
);

/* =========================================================
   ADMIN SUBSCRIBERS
========================================================= */

app.get(
  '/api/admin/subscribers',
  (req, res) => {
    try {
      const totalRevenue =
        registeredSubscribers.reduce(
          (sum, s) =>
            sum +
            (Number(
              s.totalPaid
            ) || 0),
          0
        );

      const activeSubscribersCount =
        registeredSubscribers.filter(
          (s) =>
            s.status === 'ACTIVE'
        ).length;

      const expiredCount =
        registeredSubscribers.filter(
          (s) =>
            s.status === 'EXPIRED'
        ).length;

      const trialCount =
        registeredSubscribers.filter(
          (s) =>
            s.status === 'TRIAL'
        ).length;

      res.json({
        success: true,

        subscribers:
          registeredSubscribers,

        financialStats: {
          totalRevenue,
          currency: 'SAR',
          activeSubscribersCount,
          expiredCount,
          trialCount,
          totalKeysGenerated:
            generatedLicenseKeysHistory.length,
        },

        licensesHistory:
          generatedLicenseKeysHistory,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  }
);

/* =========================================================
   ADMIN GENERATE KEY
========================================================= */

app.post(
  '/api/admin/generate-key',
  async (req, res) => {
    try {
      const {
        machineId,
        period = '1_MONTH',
        customerEmail,
        customerName,
        customerPhone,
        companyName,
        amountPaid = 0,
        currency = 'SAR',
        notes = '',
        sendWhatsApp = true,
        instanceName,
      } = req.body;

      if (!machineId) {
        return res.status(400).json({
          error:
            'كود جهاز العميل مطلوب',
        });
      }

      const cleanMachine = String(
        machineId
      )
        .trim()
        .toUpperCase();

      const key =
        generateActivationKey(
          cleanMachine,
          period
        );

      const expiresAt =
        calculateExpiryIso(
          period
        );

      const periodLabel =
        getPeriodLabelAr(period);

      let cleanCustomerPhone = '';

      if (
        String(
          customerPhone || ''
        ).trim()
      ) {
        try {
          cleanCustomerPhone =
            normalizeWhatsAppNumber(
              String(customerPhone)
            );
        } catch (error: any) {
          return res.status(400).json({
            error:
              error.message ||
              'رقم WhatsApp غير صالح',
          });
        }
      }

      const newLicense: any = {
        id: `lic-gen-${Date.now()}`,
        machineId: cleanMachine,
        activationKey: key,
        period,
        periodLabelAr: periodLabel,

        customerEmail:
          String(
            customerEmail || ''
          ).trim(),

        customerName:
          String(
            customerName ||
              'مشترك جديد'
          ).trim(),

        customerPhone:
          cleanCustomerPhone,

        companyName:
          String(
            companyName ||
              'منشأة العميل'
          ).trim(),

        amountPaid:
          Number(amountPaid) || 0,

        currency:
          String(
            currency || 'SAR'
          ).trim(),

        status: 'ACTIVE',

        activatedAt:
          new Date().toISOString(),

        expiresAt,

        notes:
          notes ||
          `مفتاح تفعيل صادر من إدارة النظام لمدة ${periodLabel}`,

        isLocked: false,
      };

      let subscriber =
        registeredSubscribers.find(
          (s) =>
            s.machineId ===
              cleanMachine ||
            (customerEmail &&
              s.email.toLowerCase() ===
                String(
                  customerEmail
                ).toLowerCase())
        );

      if (subscriber) {
        subscriber.machineId =
          cleanMachine;

        subscriber.currentLicense =
          newLicense;

        subscriber.status =
          period === '2_DAYS'
            ? 'TRIAL'
            : 'ACTIVE';

        subscriber.totalPaid =
          (Number(
            subscriber.totalPaid
          ) || 0) +
          (Number(
            amountPaid
          ) || 0);

        if (customerName) {
          subscriber.name =
            customerName;
        }

        if (
          customerPhone
        ) {
          subscriber.phone =
            cleanCustomerPhone;
        }

        if (companyName) {
          subscriber.companyName =
            companyName;
        }
      } else if (
        customerEmail
      ) {
        subscriber = {
          id: `sub-${Date.now()}`,

          email:
            String(
              customerEmail
            ).trim()
            .toLowerCase(),

          password:
            'defaultPassword',

          name:
            customerName ||
            'مشترك جديد',

          phone:
            cleanCustomerPhone,

          companyName:
            companyName ||
            'منشأة العميل',

          machineId:
            cleanMachine,

          role: 'OWNER',

          emailVerified:
            false,

          emailVerifiedAt:
            null,

          totalPaid:
            Number(
              amountPaid
            ) || 0,

          registeredAt:
            new Date().toISOString(),

          lastActiveAt:
            new Date().toISOString(),

          status:
            period === '2_DAYS'
              ? 'TRIAL'
              : 'ACTIVE',

          currentLicense:
            newLicense,
        };

        registeredSubscribers.push(
          subscriber
        );
      }

      generatedLicenseKeysHistory.unshift(
        newLicense
      );

      const waText =
        `مرحباً ${
          customerName ||
          'عزيزي العميل'
        } 👋\n\n` +
        `تم إصدار مفتاح تفعيل برنامج أمان للمراقبة والذكاء الاصطناعي لجهازك بنجاح ✅\n\n` +
        `💻 كود الجهاز:\n${cleanMachine}\n\n` +
        `⏳ مدة الترخيص:\n${periodLabel}\n\n` +
        `🔑 مفتاح التفعيل:\n*${key}*\n\n` +
        `يرجى نسخ المفتاح ولصقه في شاشة التفعيل لإلغاء القفل.\n\n` +
        `إدارة نظام أمان`;

      let whatsappResult: any = null;
      let whatsappError = '';

      /*
       * إذا كان الرقم موجوداً و sendWhatsApp=true،
       * يتم إرسال الرسالة فعلياً.
       */
      if (
        sendWhatsApp !== false &&
        cleanCustomerPhone &&
        evolutionBaseUrl() &&
        process.env.EVOLUTION_API_KEY
      ) {
        const config =
          getWhatsAppConfig({
            body: {
              customerEmail,
              tenantId:
                subscriber?.id ||
                'default',
            },
          });

        const selectedInstance =
          instanceName ||
          config.instanceName ||
          process.env.EVOLUTION_DEFAULT_INSTANCE;

        if (selectedInstance) {
          try {
            whatsappResult =
              await sendWhatsAppText({
                instanceName:
                  selectedInstance,
                phoneNumber:
                  cleanCustomerPhone,
                text: waText,
              });

            const log = {
              id: `wa-license-${Date.now()}`,
              timestamp:
                new Date().toISOString(),
              recipient:
                whatsappResult.number,
              action:
                'LICENSE_KEY',
              incidentTitle:
                'مفتاح تفعيل جديد',
              severity: 'INFO',
              status:
                'DELIVERED',
              provider:
                'EVOLUTION_API',
              instanceName:
                selectedInstance,
              notes:
                'تم إرسال مفتاح التفعيل للعميل عبر WhatsApp.',
            };

            whatsappDispatchHistory.unshift(
              log
            );
          } catch (error: any) {
            whatsappError =
              error.message ||
              'فشل إرسال WhatsApp';
          }
        } else {
          whatsappError =
            'لا يوجد instanceName أو EVOLUTION_DEFAULT_INSTANCE';
        }
      } else if (
        cleanCustomerPhone
      ) {
        whatsappError =
          'Evolution API غير مضبوط على الخادم';
      }

      /*
       * رابط WhatsApp يظل موجوداً كخيار احتياطي.
       * لا يتم إنشاء رابط wa.me بدون رقم.
       */
      const whatsappUrl =
        cleanCustomerPhone
          ? `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(
              waText
            )}`
          : '';

      res.json({
        success: true,

        message:
          `تم توليد مفتاح التفعيل لجهاز [${cleanMachine}] لمدة ${periodLabel} بنجاح!`,

        activationKey: key,

        license: newLicense,

        expiresAt,

        whatsapp: {
          attempted:
            Boolean(
              cleanCustomerPhone
            ),
          sent:
            Boolean(
              whatsappResult
            ),
          recipient:
            cleanCustomerPhone ||
            null,
          error:
            whatsappError || null,
        },

        whatsappUrl,
      });
    } catch (error: any) {
      console.error(
        'Error in /api/admin/generate-key:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل توليد المفتاح',
      });
    }
  }
);

/* =========================================================
   SIMULATE LOCK
========================================================= */

app.post(
  '/api/admin/simulate-lock',
  (req, res) => {
    const {
      machineId,
      lock = true,
    } = req.body;

    const cleanMachine = String(
      machineId || ''
    )
      .trim()
      .toUpperCase();

    const sub =
      registeredSubscribers.find(
        (s) =>
          s.machineId ===
          cleanMachine
      );

    if (
      sub &&
      sub.currentLicense
    ) {
      sub.currentLicense.isLocked =
        Boolean(lock);

      sub.currentLicense.status =
        lock
          ? 'EXPIRED'
          : 'ACTIVE';

      sub.status =
        lock
          ? 'EXPIRED'
          : 'ACTIVE';

      if (lock) {
        sub.currentLicense.expiresAt =
          new Date(
            Date.now() -
              1000 * 60 * 60
          ).toISOString();
      } else {
        sub.currentLicense.expiresAt =
          calculateExpiryIso(
            '1_MONTH'
          );
      }
    }

    res.json({
      success: true,
      machineId:
        cleanMachine,
      isLocked:
        Boolean(lock),
      message: lock
        ? `تم قفل البرنامج على الجهاز ${cleanMachine}`
        : `تم فك قفل الجهاز ${cleanMachine}`,
    });
  }
);

/* =========================================================
   MASTER UNLOCK
========================================================= */

app.post(
  '/api/admin/master-unlock',
  (req, res) => {
    try {
      const { machineId } =
        req.body;

      const cleanMachine =
        String(
          machineId || ''
        )
          .trim()
          .toUpperCase() ||
        'AMAN-DEV-ADMIN-MASTER';

      const masterKey =
        generateActivationKey(
          cleanMachine,
          '1_YEAR'
        );

      const masterLicense: any = {
        id: `lic-master-${Date.now()}`,

        machineId:
          cleanMachine,

        activationKey:
          masterKey,

        period: '1_YEAR',

        periodLabelAr:
          'ترخيص إدارة النظام المعتمد',

        customerEmail:
          'smarttechyeme@gmail.com',

        customerName:
          'الإدارة العامة للنظام (Smart Tech)',

        customerPhone: '',

        companyName:
          'إدارة منظومة أمان الذكية للمراقبة',

        amountPaid: 0,

        currency: 'SAR',

        status: 'ACTIVE',

        activatedAt:
          new Date().toISOString(),

        expiresAt:
          '2028-01-01T00:00:00Z',

        notes:
          'تم فك القفل وتفعيل صلاحيات المدير العام للنظام فورياً',

        isLocked: false,
      };

      let subscriber =
        registeredSubscribers.find(
          (s) =>
            s.email ===
            'smarttechyeme@gmail.com'
        );

      if (subscriber) {
        subscriber.machineId =
          cleanMachine;

        subscriber.currentLicense =
          masterLicense;

        subscriber.status =
          'ACTIVE';

        subscriber.lastActiveAt =
          new Date().toISOString();
      } else {
        registeredSubscribers.unshift({
          id: 'sub-admin-01',
          email:
            'smarttechyeme@gmail.com',
          password: 'admin',
          name:
            'الإدارة العامة للنظام (Smart Tech)',
          phone: '',
          companyName:
            'إدارة منظومة أمان الذكية للمراقبة',
          machineId:
            cleanMachine,
          role: 'SUPER_ADMIN',
          totalPaid: 0,
          registeredAt:
            '2026-01-01T08:00:00Z',
          lastActiveAt:
            new Date().toISOString(),
          status: 'ACTIVE',
          emailVerified: true,
          currentLicense:
            masterLicense,
        });
      }

      const existingLic =
        generatedLicenseKeysHistory.find(
          (l) =>
            l.machineId ===
            cleanMachine
        );

      if (existingLic) {
        existingLic.isLocked =
          false;

        existingLic.status =
          'ACTIVE';

        existingLic.period =
          '1_YEAR';

        existingLic.expiresAt =
          '2028-01-01T00:00:00Z';
      } else {
        generatedLicenseKeysHistory.unshift(
          masterLicense
        );
      }

      res.json({
        success: true,

        unlocked: true,

        message:
          'تم فك قفل البرنامج وتأكيد دخول إدارة النظام بنجاح!',

        license:
          masterLicense,

        user: {
          id:
            'user-superadmin-01',

          email:
            'smarttechyeme@gmail.com',

          name:
            'الإدارة العامة للنظام (Smart Tech)',

          role: 'SUPER_ADMIN',

          phone: '',

          companyName:
            'إدارة منظومة أمان الذكية للمراقبة',

          machineId:
            cleanMachine,
        },
      });
    } catch (error: any) {
      console.error(
        'Error in /api/admin/master-unlock:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل فك قفل النظام',
      });
    }
  }
);

/* =========================================================
   START TRIAL
========================================================= */

app.post(
  '/api/license/start-trial',
  (req, res) => {
    try {
      const { machineId } =
        req.body;

      const cleanMachine =
        String(
          machineId || ''
        )
          .trim()
          .toUpperCase();

      if (!cleanMachine) {
        return res.status(400).json({
          error:
            'كود الجهاز مطلوب',
        });
      }

      const trialKey =
        generateActivationKey(
          cleanMachine,
          '2_DAYS'
        );

      const trialExpires =
        calculateExpiryIso(
          '2_DAYS'
        );

      const trialLicense: any = {
        id: `lic-trial-${Date.now()}`,
        machineId:
          cleanMachine,
        activationKey:
          trialKey,
        period: '2_DAYS',
        periodLabelAr:
          'يومان (فترة تجريبية مجانية)',
        customerEmail:
          'trial@aman-cctv.local',
        customerName:
          'مشترك تجريبي',
        customerPhone: '',
        companyName:
          'تجربة النظام',
        amountPaid: 0,
        currency: 'SAR',
        status: 'ACTIVE',
        activatedAt:
          new Date().toISOString(),
        expiresAt:
          trialExpires,
        notes:
          'بدء فترة تجريبية مجانية لمدة يومين وفك القفل',
        isLocked: false,
      };

      const subscriber =
        registeredSubscribers.find(
          (s) =>
            s.machineId ===
            cleanMachine
        );

      if (subscriber) {
        subscriber.currentLicense =
          trialLicense;

        subscriber.status =
          'TRIAL';
      }

      const existingLic =
        generatedLicenseKeysHistory.find(
          (l) =>
            l.machineId ===
            cleanMachine
        );

      if (existingLic) {
        existingLic.isLocked =
          false;

        existingLic.status =
          'ACTIVE';

        existingLic.period =
          '2_DAYS';

        existingLic.expiresAt =
          trialExpires;
      } else {
        generatedLicenseKeysHistory.unshift(
          trialLicense
        );
      }

      res.json({
        success: true,

        unlocked: true,

        message:
          'تم تفعيل الفترة التجريبية المجانية (يومان) وفك القفل فوراً!',

        license:
          trialLicense,
      });
    } catch (error: any) {
      console.error(
        'Error in /api/license/start-trial:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل تفعيل الفترة التجريبية',
      });
    }
  }
);

/* =========================================================
   CAMERAS
========================================================= */

app.post(
  '/api/cameras',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Supabase service role غير مضبوط',
      });
    }

    const b = req.body || {};

    if (!b.name || !b.streamUrl) {
      return res.status(400).json({
        success: false,
        error:
          'name وstreamUrl مطلوبان',
      });
    }

    const row: any = {
      id:
        b.id ||
        crypto.randomUUID(),

      tenant_id:
        b.tenantId ||
        'tenant-aman-logistics',

      name: b.name,

      location:
        b.location || '',

      stream_url:
        b.streamUrl,

      username_encrypted:
        b.username
          ? encryptSecret(
              String(b.username)
            )
          : null,

      password_encrypted:
        b.password
          ? encryptSecret(
              String(b.password)
            )
          : null,

      status:
        b.status || 'OFFLINE',

      fps:
        Number(b.fps || 0),

      resolution:
        b.resolution || '',

      ai_enabled:
        Boolean(b.aiEnabled),

      recording_enabled:
        Boolean(b.recordingEnabled),

      type:
        b.type || 'RTSP',

      recorder_id:
        b.recorderId || null,

      channel:
        b.channel || null,

      detection_settings:
        b.detectionSettings || {},

      zones:
        b.zones || [],

      agent_id:
        b.agentId || null,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('cameras')
      .upsert(row, {
        onConflict: 'id',
      })
      .select(
        'id,tenant_id,name,location,stream_url,status,fps,resolution,ai_enabled,recording_enabled,type,recorder_id,channel,detection_settings,zones,agent_id,created_at'
      )
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      camera: data,
    });
  }
);

/* =========================================================
   RECORDERS
========================================================= */

app.post(
  '/api/recorders',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Supabase service role غير مضبوط',
      });
    }

    const b = req.body || {};

    if (!b.name || !b.ipAddress) {
      return res.status(400).json({
        success: false,
        error:
          'name وipAddress مطلوبان',
      });
    }

    const row = {
      id:
        b.id ||
        crypto.randomUUID(),

      tenant_id:
        b.tenantId ||
        'tenant-aman-logistics',

      name: b.name,

      type:
        b.type || 'NVR',

      brand:
        b.brand || '',

      ip_address:
        b.ipAddress,

      port:
        Number(b.port || 8000),

      username_encrypted:
        b.username
          ? encryptSecret(
              String(b.username)
            )
          : null,

      password_encrypted:
        b.password
          ? encryptSecret(
              String(b.password)
            )
          : null,

      channels:
        Number(b.channels || 8),

      status:
        b.status || 'OFFLINE',

      last_sync:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('recorder_devices')
      .upsert(row, {
        onConflict: 'id',
      })
      .select(
        'id,tenant_id,name,type,brand,ip_address,port,channels,status,last_sync,created_at'
      )
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      recorder: data,
    });
  }
);

/* =========================================================
   EMPLOYEES
========================================================= */

app.get(
  '/api/employees',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.json({
        success: true,
        employees: [],
      });
    }

    const tenantId = String(
      req.query.tenantId ||
        'tenant-aman-logistics'
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq(
        'tenant_id',
        tenantId
      )
      .order('name');

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      employees: data || [],
    });
  }
);

app.post(
  '/api/employees',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Supabase service role غير مضبوط',
      });
    }

    const b = req.body || {};

    let photoUrl =
      b.photoUrl || '';

    if (
      b.photoDataUrl &&
      /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(
        String(b.photoDataUrl)
      )
    ) {
      const match =
        String(
          b.photoDataUrl
        ).match(
          /^data:image\/([^;]+);base64,(.+)$/i
        );

      if (match) {
        const ext = match[1]
          .toLowerCase()
          .replace(
            'jpeg',
            'jpg'
          );

        const bytes =
          Buffer.from(
            match[2],
            'base64'
          );

        const filePath =
          `${
            b.tenantId ||
            'tenant-aman-logistics'
          }/${
            b.id ||
            crypto.randomUUID()
          }.${ext}`;

        const uploaded =
          await supabaseAdmin.storage
            .from(
              'employee-photos'
            )
            .upload(
              filePath,
              bytes,
              {
                contentType:
                  `image/${ext}`,
                upsert: true,
              }
            );

        if (!uploaded.error) {
          const publicData =
            supabaseAdmin.storage
              .from(
                'employee-photos'
              )
              .getPublicUrl(
                filePath
              );

          photoUrl =
            publicData.data
              .publicUrl;
        }
      }
    }

    const row = {
      id:
        b.id ||
        crypto.randomUUID(),

      tenant_id:
        b.tenantId ||
        'tenant-aman-logistics',

      employee_code:
        b.employeeCode || '',

      name: b.name,

      department:
        b.department || '',

      position:
        b.position || '',

      phone:
        b.phone || '',

      email:
        b.email || '',

      photo_url:
        photoUrl,

      face_embedding_vector:
        b.faceEmbeddingVector ||
        null,

      is_active:
        b.isActive !== false,

      allowed_zones:
        b.allowedZones || [],

      schedule:
        b.schedule || {},
    };

    if (!row.name) {
      return res.status(400).json({
        success: false,
        error:
          'اسم الموظف مطلوب',
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('employees')
      .upsert(row, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      employee: data,
    });
  }
);

/* =========================================================
   ATTENDANCE EXPORT
========================================================= */

app.post(
  '/api/attendance/export.xlsx',
  async (req, res) => {
    try {
      const rows =
        Array.isArray(
          req.body?.rows
        )
          ? req.body.rows
          : [];

      const wb =
        XLSX.utils.book_new();

      const data = rows.map(
        (r: any) => ({
          'الاسم':
            r.employeeName,

          'القسم':
            r.department,

          'التاريخ':
            r.date,

          'الدخول':
            r.firstEntryTime ||
            '',

          'الخروج':
            r.lastExitTime ||
            '',

          'الساعات':
            Number(
              (
                (r.totalWorkingMinutes ||
                  0) /
                60
              ).toFixed(2)
            ),

          'التأخير بالدقائق':
            r.lateMinutes || 0,

          'الحالة':
            r.status,

          'الصورة':
            r.photoUrl || '',
        })
      );

      const ws =
        XLSX.utils.json_to_sheet(
          data
        );

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        'الحضور والغياب'
      );

      const buffer =
        XLSX.write(wb, {
          type: 'buffer',
          bookType: 'xlsx',
        });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''attendance-${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.xlsx`
      );

      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   EDGE AGENT
========================================================= */

function hashAgentToken(
  token: string
) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

async function requireAgent(
  req: any,
  res: any,
  next: any
) {
  const auth = String(
    req.headers.authorization ||
      ''
  );

  const token = auth.startsWith(
    'Bearer '
  )
    ? auth.slice(7)
    : String(
        req.headers[
          'x-agent-token'
        ] || ''
      );

  if (!token) {
    return res.status(401).json({
      success: false,
      error:
        'Agent token مطلوب',
    });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error:
        'Supabase service role غير مضبوط',
    });
  }

  const {
    data,
  } =
    await supabaseAdmin
      .from('edge_agents')
      .select('*')
      .eq(
        'token_hash',
        hashAgentToken(token)
      )
      .eq(
        'is_active',
        true
      )
      .maybeSingle();

  if (!data) {
    return res.status(401).json({
      success: false,
      error:
        'Agent token غير صالح',
    });
  }

  req.edgeAgent =
    data;

  next();
}

app.post(
  '/api/agent/register',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error:
          'Supabase service role غير مضبوط',
      });
    }

    const b = req.body || {};

    const token =
      crypto
        .randomBytes(32)
        .toString('hex');

    const id =
      crypto.randomUUID();

    const {
      error,
    } =
      await supabaseAdmin
        .from('edge_agents')
        .insert({
          id,

          tenant_id:
            b.tenantId ||
            'tenant-aman-logistics',

          name:
            b.name ||
            'AMAN Edge Agent',

          token_hash:
            hashAgentToken(
              token
            ),

          version:
            b.version ||
            '1.0.0',

          os:
            b.os ||
            'windows',

          is_active: true,

          last_heartbeat:
            new Date().toISOString(),
        });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      agentId: id,
      token,
      warning:
        'احفظ التوكن؛ لن يعاد عرضه كاملاً مرة أخرى.',
    });
  }
);

app.post(
  '/api/agent/heartbeat',
  requireAgent,
  async (req, res) => {
    const {
      error,
    } =
      await supabaseAdmin!
        .from('edge_agents')
        .update({
          last_heartbeat:
            new Date().toISOString(),

          metadata:
            req.body?.metrics ||
            {},
        })
        .eq(
          'id',
          req.edgeAgent.id
        );

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      serverTime:
        new Date().toISOString(),
      agentId:
        req.edgeAgent.id,
    });
  }
);

app.get(
  '/api/agent/camera-config',
  requireAgent,
  async (req, res) => {
    const tenantId =
      req.edgeAgent.tenant_id;

    const {
      data,
      error,
    } =
      await supabaseAdmin!
        .from('cameras')
        .select(
          'id,name,location,stream_url,username_encrypted,password_encrypted,status,ai_enabled,recording_enabled,type,recorder_id,channel'
        )
        .eq(
          'tenant_id',
          tenantId
        )
        .or(
          `agent_id.eq.${req.edgeAgent.id},agent_id.is.null`
        );

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const cameras =
      (data || []).map(
        (c: any) => ({
          ...c,

          username:
            decryptSecret(
              c.username_encrypted
            ),

          password:
            decryptSecret(
              c.password_encrypted
            ),
        })
      );

    res.json({
      success: true,
      cameras,
    });
  }
);

/* =========================================================
   AI SECURITY MONITORING
========================================================= */

const alertCooldown =
  new Map<string, number>();

const severityRank: Record<
  string,
  number
> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function shouldNotify(
  key: string,
  severity: string,
  cooldownSeconds = 600
) {
  const now = Date.now();

  const last =
    alertCooldown.get(key) ||
    0;

  const rank =
    severityRank[
      String(
        severity
      ).toUpperCase()
    ] || 1;

  if (
    now - last <
      cooldownSeconds *
        1000 &&
    rank < 4
  ) {
    return false;
  }

  alertCooldown.set(
    key,
    now
  );

  return true;
}

app.post(
  '/api/agent/security-event',
  requireAgent,
  async (req, res) => {
    try {
      const b =
        req.body || {};

      const cameraId =
        String(
          b.cameraId || ''
        );

      const cameraName =
        String(
          b.cameraName ||
            cameraId ||
            'Camera'
        );

      const severity =
        String(
          b.severity ||
            'LOW'
        ).toUpperCase();

      const confidence =
        Number(
          b.confidence || 0
        );

      const eventType =
        String(
          b.eventType ||
            'UNUSUAL_BEHAVIOR'
        );

      const reason =
        String(
          b.reason ||
            'سلوك غير اعتيادي تم رصده بواسطة وكيل المراقبة الذكي'
        );

      const tenantId =
        req.edgeAgent
          .tenant_id;

      if (!cameraId) {
        return res.status(400).json({
          success: false,
          error:
            'cameraId مطلوب',
        });
      }

      let snapshotUrl =
        b.snapshotUrl ||
        null;

      if (
        b.snapshotBase64 &&
        supabaseAdmin
      ) {
        const raw =
          String(
            b.snapshotBase64
          ).replace(
            /^data:image\/\w+;base64,/,
            ''
          );

        const bytes =
          Buffer.from(
            raw,
            'base64'
          );

        const pathName =
          `${tenantId}/${cameraId}/${Date.now()}.jpg`;

        const upload =
          await supabaseAdmin.storage
            .from(
              'security-evidence'
            )
            .upload(
              pathName,
              bytes,
              {
                contentType:
                  'image/jpeg',
                upsert: false,
              }
            );

        if (!upload.error) {
          const pub =
            supabaseAdmin.storage
              .from(
                'security-evidence'
              )
              .getPublicUrl(
                pathName
              );

          snapshotUrl =
            pub.data.publicUrl;
        }
      }

      const id =
        crypto.randomUUID();

      const row = {
        id,

        tenant_id:
          tenantId,

        camera_id:
          cameraId,

        camera_name:
          cameraName,

        timestamp:
          b.timestamp ||
          new Date().toISOString(),

        event_type:
          eventType,

        severity,

        confidence,

        person_name:
          b.personName ||
          null,

        snapshot_url:
          snapshotUrl,

        video_clip_url:
          b.videoClipUrl ||
          null,

        reason,

        review_status:
          'PENDING',
      };

      if (supabaseAdmin) {
        const {
          error,
        } =
          await supabaseAdmin
            .from(
              'behavior_events'
            )
            .insert(row);

        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message,
          });
        }
      }

      const notifyThreshold =
        String(
          process.env.AI_ALERT_MIN_SEVERITY ||
            'HIGH'
        ).toUpperCase();

      const thresholdRank =
        severityRank[
          notifyThreshold
        ] || 3;

      const eligible =
        (severityRank[
          severity
        ] || 1) >=
          thresholdRank &&
        confidence >=
          Number(
            process.env
              .AI_ALERT_MIN_CONFIDENCE ||
              0.8
          );

      const key =
        `${tenantId}:${cameraId}:${eventType}`;

      let notified =
        false;

      let whatsappError =
        '';

      if (
        eligible &&
        shouldNotify(
          key,
          severity,
          Number(
            process.env
              .AI_ALERT_COOLDOWN_SECONDS ||
              600
          )
        )
      ) {
        const agentWhatsAppConfig =
          getWhatsAppConfig({
            body: {
              tenantId,
              customerEmail:
                b.customerEmail,
            },
          });

        const targetPhone =
          b.alertPhone ||
          agentWhatsAppConfig.phoneNumber;

        const instance =
          b.instanceName ||
          agentWhatsAppConfig.instanceName ||
          process.env
            .EVOLUTION_DEFAULT_INSTANCE;

        if (
          targetPhone &&
          instance &&
          evolutionBaseUrl() &&
          process.env.EVOLUTION_API_KEY
        ) {
          const evidence =
            snapshotUrl
              ? `\n🖼️ الصورة: ${snapshotUrl}`
              : '';

          const text =
            `🚨 *تنبيه أمني من نظام أمان*\n\n` +
            `📌 الحدث: ${eventType}\n` +
            `📍 الكاميرا: ${cameraName}\n` +
            `⚠️ الخطورة: ${severity}\n` +
            `🎯 الثقة: ${(confidence * 100).toFixed(0)}%\n` +
            `🕒 الوقت: ${new Date(
              row.timestamp
            ).toLocaleString(
              'ar-YE'
            )}\n` +
            `📝 ${reason}` +
            evidence;

          try {
            const result =
              await sendWhatsAppText({
                instanceName:
                  instance,
                phoneNumber:
                  targetPhone,
                text,
              });

            notified = true;

            whatsappDispatchHistory.unshift(
              {
                id: `wa-event-${Date.now()}`,
                timestamp:
                  new Date().toISOString(),
                recipient:
                  result.number,
                action:
                  'SECURITY_ALERT',
                severity,
                status:
                  'DELIVERED',
                provider:
                  'EVOLUTION_API',
                instanceName:
                  instance,
                incidentId: id,
                notes:
                  'تم إرسال التنبيه الأمني تلقائياً.',
              }
            );
          } catch (
            e: any
          ) {
            whatsappError =
              e.message ||
              'فشل إرسال WhatsApp';

            console.error(
              'Agent alert WhatsApp failed:',
              e
            );
          }
        } else if (
          eligible
        ) {
          whatsappError =
            'لا يوجد رقم WhatsApp حقيقي أو instance متصل.';
        }
      }

      res.json({
        success: true,

        eventId: id,

        eligibleForAlert:
          eligible,

        whatsappNotified:
          notified,

        whatsappError:
          whatsappError ||
          null,

        snapshotUrl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.get(
  '/api/agent/monitoring-policy',
  requireAgent,
  async (req, res) => {
    res.json({
      success: true,

      policy: {
        enabled:
          process.env
            .AI_MONITORING_ENABLED !==
          'false',

        intervalSeconds:
          Number(
            process.env
              .AI_MONITOR_INTERVAL_SECONDS ||
              5
          ),

        minConfidence:
          Number(
            process.env
              .AI_ANALYSIS_MIN_CONFIDENCE ||
              0.75
          ),

        alertMinSeverity:
          process.env
            .AI_ALERT_MIN_SEVERITY ||
          'HIGH',

        alertMinConfidence:
          Number(
            process.env
              .AI_ALERT_MIN_CONFIDENCE ||
              0.8
          ),

        cooldownSeconds:
          Number(
            process.env
              .AI_ALERT_COOLDOWN_SECONDS ||
              600
          ),

        workingHours:
          process.env
            .AI_WORKING_HOURS ||
          '08:00-17:00',

        restrictedZones:
          (
            process.env
              .AI_RESTRICTED_ZONES ||
            ''
          )
            .split(',')
            .map((x) =>
              x.trim()
            )
            .filter(Boolean),
      },
    });
  }
);

/* =========================================================
   CLAUDE
========================================================= */

app.post(
  '/api/agent/ask',
  async (req, res) => {
    try {
      if (
        !process.env
          .ANTHROPIC_API_KEY
      ) {
        return res.status(503).json({
          success: false,
          error:
            'ANTHROPIC_API_KEY غير مضبوط',
        });
      }

      const prompt =
        String(
          req.body?.prompt ||
            ''
        ).trim();

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            'prompt مطلوب',
        });
      }

      const model =
        process.env.CLAUDE_MODEL ||
        'claude-sonnet-5';

      const response =
        await fetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',

            headers: {
              'content-type':
                'application/json',

              'x-api-key':
                process.env
                  .ANTHROPIC_API_KEY,

              'anthropic-version':
                '2023-06-01',
            },

            body: JSON.stringify({
              model,

              max_tokens: 2048,

              system:
                'أنت وكيل تشغيل لمنصة أمان للمراقبة والكاميرات والحضور وواتساب. لا تدّعي تنفيذ شيء لم يتم تنفيذه. اقترح خطوات واضحة واستدعاءات API مناسبة، واحترم حدود الوصول والخصوصية.',

              messages: [
                {
                  role: 'user',
                  content:
                    prompt,
                },
              ],
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return res.status(502).json({
          success: false,
          error:
            data?.error?.message ||
            'Claude API error',
        });
      }

      res.json({
        success: true,

        model,

        answer:
          data?.content
            ?.map(
              (x: any) =>
                x.text || ''
            )
            .join('') || '',

        raw: data,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/* =========================================================
   VITE / STATIC SERVING
========================================================= */

async function startServer() {
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const {
      createServer:
        createViteServer,
    } = await import(
      'vite'
    );

    const vite =
      await createViteServer({
        server: {
          middlewareMode: true,
        },

        appType: 'spa',
      });

    app.use(
      vite.middlewares
    );
  } else {
    const distPath =
      path.join(
        process.cwd(),
        'dist'
      );

    app.use(
      express.static(
        distPath
      )
    );

    app.get(
      '*',
      (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      }
    );
  }

  app.listen(
    PORT,
    HOST,
    () => {
      console.log(
        `[CCTV Platform Server] running on http://0.0.0.0:${PORT}`
      );
    }
  );
}

startServer().catch(
  (err) => {
    console.error(
      '[CCTV Platform Server] Startup Error:',
      err
    );
  }
);
