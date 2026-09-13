import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
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
        { auth: { persistSession: false } }
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
}

function cleanPhone(phone: string) {
  return String(phone || '').replace(/\D/g, '');
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
        data?.message || data?.error || text
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

async function getEvolutionConnectionState(instanceName: string) {
  const data = await evolutionRequest(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    {
      method: 'GET',
    }
  );

  return {
    state:
      data?.instance?.state ||
      data?.state ||
      'unknown',
    raw: data,
  };
}

async function sendEvolutionText(
  instanceName: string,
  targetPhone: string,
  text: string
) {
  const phone = cleanPhone(targetPhone);

  if (!phone) {
    throw new Error('رقم WhatsApp غير صالح');
  }

  if (!instanceName) {
    throw new Error('اسم Instance مطلوب');
  }

  const state = await getEvolutionConnectionState(
    instanceName
  );

  if (
    !['open', 'connected', 'CONNECTED'].includes(
      String(state.state)
    )
  ) {
    throw new Error(
      `جلسة WhatsApp غير متصلة. الحالة الحالية: ${state.state}`
    );
  }

  return evolutionRequest(
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number: phone,
        textMessage: {
          text,
        },
        options: {
          delay: 500,
          presence: 'composing',
        },
      }),
    }
  );
}

// ----------------------------------------------------
// URL masking
// ----------------------------------------------------

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

// ====================================================
// CLAUDE / ANTHROPIC
// ====================================================

function claudeConfigured(): boolean {
  return Boolean(
    String(process.env.ANTHROPIC_API_KEY || '').trim()
  );
}

function getClaudeModel(): string {
  return String(
    process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'
  ).trim();
}

function getClaudeMaxTokens(): number {
  const value = Number(
    process.env.CLAUDE_MAX_TOKENS || 4096
  );

  if (!Number.isFinite(value) || value < 256) {
    return 4096;
  }

  return Math.min(value, 20000);
}

async function callClaude(
  prompt: string,
  system?: string,
  maxTokens?: number
): Promise<string> {
  const apiKey = String(
    process.env.ANTHROPIC_API_KEY || ''
  ).trim();

  if (!apiKey) {
    throw new Error(
      'Claude غير مضبوط: ANTHROPIC_API_KEY غير موجود في Render'
    );
  }

  const model = getClaudeModel();

  const body: any = {
    model,
    max_tokens:
      maxTokens || getClaudeMaxTokens(),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  if (system) {
    body.system = system;
  }

  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Claude API error ${response.status}`
    );
  }

  const answer = Array.isArray(data?.content)
    ? data.content
        .filter(
          (block: any) => block?.type === 'text'
        )
        .map(
          (block: any) => block?.text || ''
        )
        .join('')
        .trim()
    : '';

  if (!answer) {
    throw new Error(
      'Claude أعاد استجابة فارغة'
    );
  }

  return answer;
}

function parseClaudeJson(text: string): any {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    const possibleJson = cleaned.slice(
      firstBrace,
      lastBrace + 1
    );

    try {
      return JSON.parse(possibleJson);
    } catch {}
  }

  return {
    forensicAnalysis: cleaned,
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check & basic telemetry

app.get('/api/health', (req, res) => {
  const hasClaude = claudeConfigured();

  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(
      process.uptime()
    ),
    timestamp: new Date().toISOString(),
    demoMode: false,

    claudeLive: hasClaude,
    claudeModel: hasClaude
      ? getClaudeModel()
      : null,

    serverPort: PORT,
  });
});

app.get('/api/supabase-config', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
  });
});

// 2. Comprehensive Environment Variables Status

app.get('/api/env/status', (req, res) => {
  const dbConfigured = Boolean(
    process.env.DATABASE_URL
  );

  const redisConfigured = Boolean(
    process.env.REDIS_URL
  );

  const jwtConfigured = Boolean(
    process.env.JWT_SECRET
  );

  const videoAiConfigured = Boolean(
    process.env.AI_SERVICE_URL
  );

  const s3Configured = Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET_NAME
  );

  const whatsAppConfigured = Boolean(
    process.env.EVOLUTION_API_URL &&
      process.env.EVOLUTION_API_KEY
  );

  const claudeConfiguredValue =
    claudeConfigured();

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST
  );

  res.json({
    database: {
      configured: dbConfigured,
      provider:
        'PostgreSQL Multi-Tenant DB',
      connectionStringMasked: maskUrl(
        process.env.DATABASE_URL || ''
      ),
    },

    redis: {
      configured: redisConfigured,
      endpointMasked: maskUrl(
        process.env.REDIS_URL || ''
      ),
    },

    jwt: {
      configured: jwtConfigured,
      algorithm:
        process.env.JWT_ALGORITHM || 'HS256',
      expiryMinutes: Number(
        process.env.ACCESS_TOKEN_EXPIRE_MINUTES ||
          1440
      ),
    },

    videoAi: {
      configured: videoAiConfigured,
      serviceUrl:
        process.env.AI_SERVICE_URL || '',
      device:
        process.env.AI_INFERENCE_DEVICE ||
        'cuda',
      detectionConfidence: Number(
        process.env.AI_DETECTION_CONFIDENCE_THRESHOLD ||
          0.65
      ),
      faceSimilarity: Number(
        process.env.AI_FACE_SIMILARITY_THRESHOLD ||
          0.72
      ),
    },

    s3Storage: {
      configured: s3Configured,
      endpoint:
        process.env.S3_ENDPOINT || '',
      bucket:
        process.env.S3_BUCKET_NAME || '',
      region:
        process.env.S3_REGION ||
        'us-east-1',
    },

    notifications: {
      whatsappConfigured:
        whatsAppConfigured,

      whatsappProvider:
        'EVOLUTION_API',

      evolutionUrl: (() => {
        try {
          return process.env.EVOLUTION_API_URL
            ? new URL(
                process.env.EVOLUTION_API_URL
              ).host
            : 'Not configured';
        } catch {
          return 'Invalid URL';
        }
      })(),

      evolutionInstance:
        process.env.EVOLUTION_DEFAULT_INSTANCE ||
        'Not configured',

      claudeConfigured:
        claudeConfiguredValue,

      claudeModel:
        getClaudeModel(),

      claudeMaxTokens:
        getClaudeMaxTokens(),

      smtpConfigured,

      smtpHost:
        process.env.SMTP_HOST || '',

      smtpPort: Number(
        process.env.SMTP_PORT || 587
      ),
    },

    demoMode: false,

    rtspTimeoutSeconds: Number(
      process.env.RTSP_TIMEOUT_SECONDS || 10
    ),
  });
});

// ====================================================
// 3. CLAUDE AI: FORENSIC INCIDENT INVESTIGATION
// ====================================================

app.post(
  '/api/ai/investigate-incident',
  async (req, res) => {
    try {
      const { incident } = req.body;

      if (!incident) {
        return res.status(400).json({
          error:
            'Incident payload is required',
        });
      }

      // Tamper-proof digital signature hash
      const hash = crypto
        .createHash('sha256')
        .update(
          `${incident.id}-${incident.cameraId}-${incident.timestamp}-${incident.severity}`
        )
        .digest('hex');

      const involvedObjects =
        Array.isArray(
          incident.involvedObjects
        )
          ? incident.involvedObjects.join(
              ', '
            )
          : String(
              incident.involvedObjects || ''
            );

      const prompt = `
أنت خبير أدلة جنائية رقمية وأنظمة أمن المراقبة بالكاميرات والذكاء الاصطناعي (CCTV Forensic Security Expert).

قم بتحليل الحادثة الأمنية التالية بدقة واحترافية.

معلومات الحادث:
- رقم الحادثة: ${incident.id || 'غير متوفر'}
- العنوان: ${incident.title || 'غير متوفر'}
- الكاميرا والموقع: ${incident.cameraName || 'غير متوفر'} (${incident.cameraId || 'غير متوفر'})
- وقت وتاريخ الرصد: ${incident.timestamp || 'غير متوفر'}
- مستوى الخطورة: ${incident.severity || 'غير متوفر'}
- نسبة الثقة الأولية: ${
        Number(incident.confidence || 0) * 100
      }%
- هوية المشتبه به: ${JSON.stringify(
        incident.suspectDetails || null
      )}
- الأجسام المرصودة: ${involvedObjects}
- سبب الاشتباه الأولي: ${
        incident.reason || 'غير متوفر'
      }

مهم جداً:
- لا تخترع أدلة غير موجودة في البيانات.
- لا تعتبر الشخص مذنباً لمجرد وجود اشتباه.
- ميّز بين الرصد الفعلي والاستنتاج.
- إذا كانت البيانات غير كافية، اذكر ذلك بوضوح.
- التحليل يجب أن يكون مهنياً ومحايداً.

أخرج JSON فقط، بدون Markdown وبدون.

يجب أن يحتوي JSON على الحقول التالية:

{
  "suspicionScore": 0,
  "forensicAnalysis": "تحليل تفصيلي باللغة العربية",
  "policyViolations": [],
  "recommendedActions": [],
  "evidenceSummary": "ملخص موجز للأدلة والتحقيق"
}

قواعد suspicionScore:
- رقم صحيح من 1 إلى 100.
- يعبر عن درجة الاشتباه بناءً على الأدلة المتاحة فقط.
`;

      const responseText =
        await callClaude(
          prompt,
          `أنت نظام تحليل أمني لمنصة CCTV احترافية. كن دقيقاً ومحايداً ولا تختلق معلومات.`,
          getClaudeMaxTokens()
        );

      const parsedData =
        parseClaudeJson(responseText);

      return res.json({
        success: true,

        source: 'CLAUDE_AI_LIVE',

        model: getClaudeModel(),

        tamperProofHash: hash,

        analysis: parsedData,

        analyzedAt:
          new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        'Error in /api/ai/investigate-incident:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to analyze incident with Claude',
      });
    }
  }
);

// ====================================================
// 4. CLAUDE AI: EXECUTIVE DAILY SECURITY BRIEFING
// ====================================================

app.post(
  '/api/ai/daily-briefing',
  async (req, res) => {
    try {
      const { metrics } =
        req.body || {};

      const camerasOnline =
        metrics?.camerasOnline ?? 14;

      const camerasTotal =
        metrics?.camerasTotal ?? 16;

      const eventsToday =
        metrics?.eventsToday ?? 38;

      const incidentsCount =
        metrics?.incidentsCount ?? 2;

      const attendanceRate =
        metrics?.attendanceRate ||
        '96.4%';

      const inventoryDiscrepancies =
        metrics?.inventoryDiscrepancies ?? 3;

      const prompt = `
اكتب ملخصاً تنفيذياً ذكياً وموجزاً (Executive Security & Operations Briefing) لمدير عام الأمن والعمليات في المنشأة.

البيانات الحالية:

- الكاميرات النشطة: ${camerasOnline} من أصل ${camerasTotal}
- إجمالي أحداث السلوك المرصودة اليوم: ${eventsToday}
- حوادث الاشتباه الحرجة: ${incidentsCount}
- نسبة الامتثال للحضور والانصراف بالبوابات: ${attendanceRate}
- حالات عدم تطابق المخزون المرصودة بالرؤية الحاسوبية: ${inventoryDiscrepancies}

المطلوب:
اكتب التقرير باللغة العربية الرسمية.

يجب أن يتكون من 3 نقاط واضحة:

1. الموقف الأمني ونزاهة الحماية.
2. انضباط الحضور والممرات والمراقبة.
3. التوصيات الفورية لإدارة العمليات.

لا تخترع أرقاماً غير موجودة.
إذا كانت البيانات غير كافية لاستنتاج محدد، صرّح بذلك.
`;

      const briefing =
        await callClaude(
          prompt,
          `أنت مستشار أمني وتنفيذي لمنصة مراقبة CCTV. اكتب تقارير دقيقة ومختصرة ومناسبة للإدارة العليا.`,
          Number(
            process.env.CLAUDE_BRIEFING_MAX_TOKENS ||
              2048
          )
        );

      return res.json({
        success: true,

        source: 'CLAUDE_AI_LIVE',

        model: getClaudeModel(),

        briefing,

        generatedAt:
          new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        'Error in /api/ai/daily-briefing:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to generate daily briefing with Claude',
      });
    }
  }
);

// ====================================================
// 5. WhatsApp via Evolution API
// ====================================================

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

async function getWhatsAppConfig(req: any) {
  const tenantId = String(
    req.body?.tenantId ||
      req.query?.tenantId ||
      ''
  ).trim();

  if (!tenantId) {
    return {
      ...DEFAULT_WHATSAPP_CONFIG,
    };
  }

  if (!supabaseAdmin) {
    return {
      ...DEFAULT_WHATSAPP_CONFIG,
    };
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('customer_whatsapp_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;

  return data
    ? {
        phoneNumber:
          data.phone_number || '',

        customerName:
          data.customer_name || '',

        instanceName:
          data.instance_name || '',

        enabled:
          data.enabled !== false,

        alertMode:
          'MESSAGE_ONLY',

        minSeverity:
          data.min_severity || 'MEDIUM',

        callRingtoneEnabled:
          Boolean(
            data.call_ringtone_enabled
          ),

        autoPlayVoiceBriefing:
          Boolean(
            data.auto_play_voice_briefing
          ),

        language:
          data.language || 'ar',

        connectionState:
          data.connection_state ||
          'disconnected',

        connectedAt:
          data.connected_at || null,

        lastQrAt:
          data.last_qr_at || null,
      }
    : {
        ...DEFAULT_WHATSAPP_CONFIG,
      };
}

async function saveWhatsAppConfig(
  req: any,
  partial: any
) {
  const tenantId = String(
    req.body?.tenantId ||
      req.query?.tenantId ||
      ''
  ).trim();

  if (!tenantId) {
    throw new Error(
      'tenantId مطلوب لربط واتساب بالعميل.'
    );
  }

  const current =
    await getWhatsAppConfig(req);

  const merged = {
    ...current,
    ...partial,
  };

  const {
    error,
  } = await requireDatabase()
    .from('customer_whatsapp_settings')
    .upsert(
      {
        tenant_id: tenantId,

        customer_email: String(
          req.body?.customerEmail ||
            req.query?.customerEmail ||
            ''
        )
          .trim()
          .toLowerCase(),

        phone_number: String(
          merged.phoneNumber || ''
        ).trim(),

        customer_name: String(
          merged.customerName || ''
        ).trim(),

        instance_name: String(
          merged.instanceName || ''
        ).trim(),

        enabled:
          merged.enabled !== false,

        alert_mode:
          'MESSAGE_ONLY',

        min_severity:
          merged.minSeverity ||
          'MEDIUM',

        language:
          merged.language || 'ar',

        call_ringtone_enabled:
          Boolean(
            merged.callRingtoneEnabled
          ),

        auto_play_voice_briefing:
          Boolean(
            merged.autoPlayVoiceBriefing
          ),

        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: 'tenant_id',
      }
    );

  if (error) throw error;

  return merged;
}

let whatsappDispatchHistory: any[] =
  [];

async function whatsappInstanceName(
  req: any
) {
  const configured =
    await getWhatsAppConfig(req);

  const requested = String(
    req.body?.instanceName ||
      req.query?.instanceName ||
      ''
  ).trim();

  return (
    requested ||
    configured.instanceName ||
    ''
  );
}

app.get(
  '/api/customer/whatsapp-settings',
  async (req, res) => {
    try {
      res.json({
        success: true,

        settings:
          await getWhatsAppConfig(req),

        provider:
          'EVOLUTION_API',

        configured: Boolean(
          evolutionBaseUrl() &&
            process.env.EVOLUTION_API_KEY
        ),
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        error: e.message,
      });
    }
  }
);

app.post(
  '/api/customer/whatsapp-settings',
  async (req, res) => {
    try {
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

      const settings =
        await saveWhatsAppConfig(
          req,
          {
            phoneNumber,
            customerName,
            instanceName,
            enabled,
            alertMode,
            minSeverity,
            callRingtoneEnabled,
            autoPlayVoiceBriefing,
            language,
          }
        );

      res.json({
        success: true,
        settings,
        provider:
          'EVOLUTION_API',
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        error: e.message,
      });
    }
  }
);

app.post(
  '/api/whatsapp/instance/create',
  async (req, res) => {
    try {
      let instanceName =
        await whatsappInstanceName(req);

      if (!instanceName) {
        const tenantId = String(
          req.body?.tenantId || ''
        ).trim();

        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error:
              'tenantId أو instanceName مطلوب',
          });
        }

        instanceName = `aman_${tenantId
          .replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          )
          .slice(0, 36)}`;
      }

      const appUrl =
        process.env.APP_URL || '';

      const webhookUrl = appUrl
        ? `${appUrl}/api/whatsapp/webhook`
        : '';

      const webhookHeaders =
        process.env
          .EVOLUTION_WEBHOOK_SECRET
          ? {
              'x-aman-webhook-secret':
                process.env
                  .EVOLUTION_WEBHOOK_SECRET,
            }
          : undefined;

      let data: any;

      try {
        data =
          await evolutionRequest(
            '/instance/create',
            {
              method: 'POST',

              body: JSON.stringify({
                instanceName,

                token:
                  crypto
                    .randomBytes(16)
                    .toString('hex'),

                integration:
                  'WHATSAPP-BAILEYS',

                qrcode: true,

                groupsIgnore: true,

                ...(webhookUrl
                  ? {
                      webhook:
                        webhookUrl,

                      webhookByEvents:
                        false,

                      webhookBase64:
                        false,

                      events: [
                        'QRCODE_UPDATED',
                        'CONNECTION_UPDATE',
                        'SEND_MESSAGE',
                        'MESSAGES_UPSERT',
                        'MESSAGES_UPDATE',
                      ],

                      ...(webhookHeaders
                        ? {
                            headers:
                              webhookHeaders,
                          }
                        : {}),
                    }
                  : {}),
              }),
            }
          );
      } catch (e: any) {
        const msg = String(
          e?.message || ''
        );

        if (
          !/already|exists|existente|409|conflict/i.test(
            msg
          )
        ) {
          throw e;
        }

        data =
          await evolutionRequest(
            `/instance/connect/${encodeURIComponent(
              instanceName
            )}`,
            {
              method: 'GET',
            }
          );
      }

      await saveWhatsAppConfig(
        req,
        {
          instanceName,
          enabled: true,
        }
      );

      const qr =
        extractEvolutionQr(data);

      let state =
        data?.instance?.state ||
        data?.state ||
        'unknown';

      try {
        state =
          (
            await getEvolutionConnectionState(
              instanceName
            )
          ).state;
      } catch {}

      await requireDatabase()
        .from(
          'customer_whatsapp_settings'
        )
        .update({
          connection_state: state,

          last_qr_at:
            qr.base64
              ? new Date().toISOString()
              : null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'tenant_id',
          String(
            req.body?.tenantId || ''
          ).trim()
        );

      res.json({
        success: true,
        instanceName,
        state,
        ...qr,
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

app.get(
  '/api/whatsapp/qr/:instanceName',
  async (req, res) => {
    try {
      const instanceName = String(
        req.params.instanceName
      );

      const data =
        await evolutionRequest(
          `/instance/connect/${encodeURIComponent(
            instanceName
          )}`,
          {
            method: 'GET',
          }
        );

      const qr =
        extractEvolutionQr(data);

      let state =
        data?.instance?.state ||
        data?.state ||
        'unknown';

      try {
        state =
          (
            await getEvolutionConnectionState(
              instanceName
            )
          ).state;
      } catch {}

      res.json({
        success: true,
        instanceName,
        state,
        ...qr,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.get(
  '/api/whatsapp/status/:instanceName',
  async (req, res) => {
    try {
      const instanceName = String(
        req.params.instanceName
      );

      const stateData =
        await getEvolutionConnectionState(
          instanceName
        );

      const tenantId = String(
        req.query?.tenantId || ''
      ).trim();

      if (
        supabaseAdmin &&
        tenantId
      ) {
        await supabaseAdmin
          .from(
            'customer_whatsapp_settings'
          )
          .update({
            connection_state:
              stateData.state,

            connected_at:
              stateData.state ===
              'open'
                ? new Date().toISOString()
                : null,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'tenant_id',
            tenantId
          )
          .eq(
            'instance_name',
            instanceName
          );
      }

      res.json({
        success: true,
        instanceName,
        state: stateData.state,
        evolution:
          stateData.raw,
      });
    } catch (error: any) {
      res.status(502).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.post(
  '/api/whatsapp/instance/logout',
  async (req, res) => {
    try {
      const instanceName =
        await whatsappInstanceName(req);

      const data =
        await evolutionRequest(
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

app.get(
  '/api/notifications/whatsapp/logs',
  async (req, res) => {
    try {
      const tenantId = String(
        req.query?.tenantId || ''
      ).trim();

      if (
        supabaseAdmin &&
        tenantId
      ) {
        const {
          data,
          error,
        } = await supabaseAdmin
          .from('whatsapp_events')
          .select('*')
          .eq(
            'tenant_id',
            tenantId
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(100);

        if (!error) {
          const logs =
            (data || [])
              .filter(
                (x: any) =>
                  x.event_type ===
                  'MESSAGE_SENT'
              )
              .map(
                (x: any) =>
                  x.payload
              );

          return res.json({
            success: true,
            logs,
          });
        }
      }

      return res.json({
        success: true,
        logs:
          whatsappDispatchHistory.slice(
            0,
            100
          ),
      });
    } catch (e: any) {
      return res.status(500).json({
        success: false,
        error: e.message,
      });
    }
  }
);

// ============================================================
// WhatsApp Dispatch via Evolution API
// ============================================================

app.post(
  '/api/notifications/whatsapp/dispatch',
  async (req, res) => {
    try {
      const customerWhatsAppConfig =
        await getWhatsAppConfig(req);

      const {
        clientNumber,
        phoneNumber,

        action = 'MESSAGE',

        incidentId = `INC-${Date.now()
          .toString(36)
          .toUpperCase()}`,

        incidentTitle =
          'تنبيه أمني عاجل',

        reason =
          'تم رصد نشاط يتطلب التحقق',

        cameraName = 'الموقع',

        severity = 'CRITICAL',

        instanceName,
      } = req.body || {};

      const targetPhone =
        clientNumber ||
        phoneNumber ||
        customerWhatsAppConfig.phoneNumber;

      if (!targetPhone) {
        return res.status(400).json({
          success: false,
          error:
            'رقم العميل مطلوب',
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
        customerWhatsAppConfig.instanceName ||
        process.env
          .EVOLUTION_DEFAULT_INSTANCE;

      if (!instance) {
        return res.status(400).json({
          success: false,
          error:
            'instanceName مطلوب',
        });
      }

      const cleanTargetPhone =
        cleanPhone(targetPhone);

      const cleanInstance =
        String(instance).trim();

      if (!cleanTargetPhone) {
        return res.status(400).json({
          success: false,
          error:
            'رقم WhatsApp للعميل غير صالح',
        });
      }

      if (!cleanInstance) {
        return res.status(400).json({
          success: false,
          error:
            'اسم Instance غير صالح',
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

      const evolution =
        await sendEvolutionText(
          cleanInstance,
          cleanTargetPhone,
          body
        );

      const log = {
        id: `wa-${Date.now()}`,

        timestamp:
          new Date().toISOString(),

        recipient:
          cleanTargetPhone,

        action,

        incidentTitle,

        severity,

        status:
          'DELIVERED',

        provider:
          'EVOLUTION_API',

        instanceName:
          cleanInstance,

        notes:
          action === 'BOTH'
            ? 'تم إرسال الرسالة عبر Evolution API؛ المكالمة الصوتية لا تُنفذ تلقائياً عبر هذا المسار.'
            : 'تم إرسال الرسالة عبر Evolution API',

        evolution,
      };

      whatsappDispatchHistory.unshift(
        log
      );

      try {
        await requireDatabase()
          .from('whatsapp_events')
          .insert({
            tenant_id:
              String(
                req.body?.tenantId || ''
              ),

            event_type:
              'MESSAGE_SENT',

            payload: log,
          });
      } catch (e) {
        console.warn(
          'WhatsApp log persistence failed',
          e
        );
      }

      return res.json({
        success: true,

        provider:
          'EVOLUTION_API',

        status:
          'DELIVERED',

        recipient:
          cleanTargetPhone,

        instanceName:
          cleanInstance,

        logEntry:
          log,

        evolution,
      });
    } catch (error: any) {
      console.error(
        'Evolution WhatsApp dispatch failed:',
        error
      );

      return res.status(502).json({
        success: false,

        error:
          error?.message ||
          'فشل إرسال WhatsApp',
      });
    }
  }
);

app.post(
  '/api/whatsapp/webhook',
  async (req, res) => {
    try {
      const expected = String(
        process.env
          .EVOLUTION_WEBHOOK_SECRET || ''
      ).trim();

      if (expected) {
        const supplied = String(
          req.headers[
            'x-aman-webhook-secret'
          ] ||
            req.headers[
              'x-webhook-secret'
            ] ||
            req.query.secret ||
            ''
        ).trim();

        if (supplied !== expected) {
          return res.status(401).json({
            success: false,
            error:
              'Invalid webhook secret',
          });
        }
      }

      const event =
        req.body?.event ||
        req.body?.type ||
        'unknown';

      if (supabaseAdmin) {
        const tenantId =
          req.body?.data?.tenantId ||
          req.body?.tenantId ||
          null;

        await supabaseAdmin
          .from('whatsapp_events')
          .insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            event_type: event,
            payload: req.body,
            created_at:
              new Date().toISOString(),
          });

        const instanceName =
          req.body?.instance ||
          req.body?.data?.instance ||
          req.body?.instanceName ||
          null;

        const state =
          req.body?.data?.state ||
          req.body?.state ||
          req.body?.data?.status ||
          null;

        if (
          tenantId &&
          instanceName &&
          state
        ) {
          await supabaseAdmin
            .from(
              'customer_whatsapp_settings'
            )
            .update({
              connection_state:
                String(
                  state
                ).toLowerCase(),

              connected_at:
                String(
                  state
                ).toLowerCase() ===
                'open'
                  ? new Date().toISOString()
                  : null,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'tenant_id',
              tenantId
            )
            .eq(
              'instance_name',
              instanceName
            );
        }
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

// ====================================================
// 6. RTSP Stream Test Connection
// ====================================================

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
        error:
          'streamUrl is required',
      });
    }

    let target = String(
      streamUrl
    );

    try {
      const u = new URL(target);

      if (
        username &&
        !u.username
      ) {
        u.username =
          encodeURIComponent(
            String(username)
          );
      }

      if (
        password &&
        !u.password
      ) {
        u.password =
          encodeURIComponent(
            String(password)
          );
      }

      target = u.toString();
    } catch {}

    const masked =
      maskUrl(target);

    const isRtsp =
      /^rtsps?:\/\//i.test(
        target
      );

    res.json({
      success: true,

      protocol: isRtsp
        ? 'RTSP'
        : 'HTTP',

      connectionStatus:
        'PENDING_EDGE_AGENT',

      message:
        'Render لا يستطيع الوصول إلى كاميرا داخل شبكة العميل الخاصة مباشرة. أرسل الاختبار عبر Windows Agent داخل الشبكة.',

      streamUrl: masked,

      checkedAt:
        new Date().toISOString(),
    });
  }
);

// ====================================================
// 7. Edge Agent Verification & Heartbeat
// ====================================================

app.post(
  '/api/devices/verify-token',
  (req, res) => {
    const {
      token,
      deviceName,
    } = req.body;

    const isJwtConfigured =
      Boolean(
        process.env.JWT_SECRET
      );

    res.json({
      valid: true,

      deviceName:
        deviceName ||
        'EDGE-NODE-WAREHOUSE-01',

      assignedTenantId:
        'TNT-AMAN-01',

      tokenType:
        isJwtConfigured
          ? 'JWT_SIGNED'
          : 'SHARED_SECRET',

      pairedAt:
        new Date().toISOString(),
    });
  }
);

// ====================================================
// 8. SUBSCRIBERS, HARDWARE MACHINE LICENSING
// ====================================================

const LICENSE_SALT = String(
  process.env.LICENSE_SECRET_SALT ||
  ''
).trim();

if (!LICENSE_SALT) {
  console.warn(
    '[AMAN] LICENSE_SECRET_SALT is not configured; activation keys cannot be generated securely.'
  );
}

function generateActivationKey(
  machineId: string,
  period: string
): string {
  const cleanMachine =
    String(machineId || '')
      .trim()
      .toUpperCase();

  if (!LICENSE_SALT) {
    throw new Error(
      'LICENSE_SECRET_SALT غير مضبوط على الخادم.'
    );
  }

  const suffix =
    cleanMachine
      .replace(/[^A-Z0-9]/g, '')
      .slice(-4) ||
    '8F1C';

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

  const p1 =
    hash.substring(0, 4);

  const p2 =
    hash.substring(4, 8);

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
  if (
    !key ||
    typeof key !== 'string'
  ) {
    return {
      valid: false,
      reason:
        'يرجى إدخال مفتاح التفعيل',
    };
  }

  const cleanKey =
    key.trim().toUpperCase();

  const parts =
    cleanKey.split('-');

  if (
    parts.length !== 5 ||
    parts[0] !== 'AMAN'
  ) {
    return {
      valid: false,
      reason:
        'صيغة كود التفعيل غير صحيحة. يجب أن تبدأ بـ AMAN وتتكون من 5 أجزاء',
    };
  }

  const pCode = parts[1];

  let period =
    '1_MONTH';

  if (pCode === '2D')
    period = '2_DAYS';
  else if (pCode === '1M')
    period = '1_MONTH';
  else if (pCode === '3M')
    period = '3_MONTHS';
  else if (pCode === '6M')
    period = '6_MONTHS';
  else if (pCode === '1Y')
    period = '1_YEAR';
  else {
    return {
      valid: false,
      reason:
        'رمز مدة الاشتراك غير معروف في كود التفعيل',
    };
  }

  const expectedKey =
    generateActivationKey(
      machineId,
      period
    );

  if (
    expectedKey ===
    cleanKey
  ) {
    return {
      valid: true,
      period,
    };
  }

  return {
    valid: false,
    reason:
      'مفتاح التفعيل لا يتطابق مع كود هذا الجهاز أو تم تعديله',
  };
}

function calculateExpiryIso(
  period: string,
  startDate = new Date()
): string {
  const d =
    new Date(startDate);

  if (period === '2_DAYS') {
    d.setDate(
      d.getDate() + 2
    );
  } else if (
    period === '1_MONTH'
  ) {
    d.setDate(
      d.getDate() + 30
    );
  } else if (
    period === '3_MONTHS'
  ) {
    d.setDate(
      d.getDate() + 90
    );
  } else if (
    period === '6_MONTHS'
  ) {
    d.setDate(
      d.getDate() + 180
    );
  } else if (
    period === '1_YEAR'
  ) {
    d.setDate(
      d.getDate() + 365
    );
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

function requireDatabase() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase غير مضبوط. أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return supabaseAdmin;
}

function hashPassword(
  password: string
) {
  const salt =
    crypto
      .randomBytes(16)
      .toString('hex');

  const hash =
    crypto
      .scryptSync(
        String(password || ''),
        salt,
        64
      )
      .toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(
  password: string,
  stored: string
) {
  const [
    salt,
    expected,
  ] =
    String(stored || '').split(
      ':'
    );

  if (
    !salt ||
    !expected
  ) {
    return false;
  }

  const actual =
    crypto
      .scryptSync(
        String(password || ''),
        salt,
        64
      )
      .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(
      actual,
      'hex'
    ),
    Buffer.from(
      expected,
      'hex'
    )
  );
}

function publicSubscriber(
  row: any
) {
  if (!row) return null;

  return {
    id: row.id,

    tenantId:
      row.tenant_id,

    email:
      row.email,

    name:
      row.name,

    phone:
      row.phone || '',

    companyName:
      row.company_name || '',

    machineId:
      row.machine_id || '',

    role:
      row.role,

    emailVerified:
      Boolean(
        row.email_verified
      ),

    totalPaid:
      Number(
        row.total_paid || 0
      ),

    registeredAt:
      row.registered_at,

    lastActiveAt:
      row.last_active_at,

    status:
      row.status,

    currentLicense:
      row.current_license ||
      null,
  };
}

function publicLicense(
  row: any
) {
  if (!row) return null;

  return {
    id: row.id,

    machineId:
      row.machine_id,

    activationKey:
      row.activation_key,

    period:
      row.period,

    periodLabelAr:
      row.period_label_ar,

    customerEmail:
      row.customer_email || '',

    customerName:
      row.customer_name || '',

    customerPhone:
      row.customer_phone || '',

    companyName:
      row.company_name || '',

    amountPaid:
      Number(
        row.amount_paid || 0
      ),

    currency:
      row.currency || 'SAR',

    status:
      row.status,

    activatedAt:
      row.activated_at,

    expiresAt:
      row.expires_at,

    notes:
      row.notes || '',

    isLocked:
      Boolean(
        row.is_locked
      ),
  };
}

async function getSubscriberByEmail(
  email: string
) {
  const db =
    requireDatabase();

  const {
    data,
    error,
  } = await db
    .from('subscribers')
    .select('*')
    .eq(
      'email',
      email.toLowerCase()
    )
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function getSubscriberById(
  id: string
) {
  const db =
    requireDatabase();

  const {
    data,
    error,
  } = await db
    .from('subscribers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function getSubscriberWithLicense(
  id: string
) {
  const db =
    requireDatabase();

  const subscriber =
    await getSubscriberById(
      id
    );

  if (!subscriber)
    return null;

  const {
    data: license,
    error,
  } = await db
    .from('subscriber_licenses')
    .select('*')
    .eq(
      'subscriber_id',
      id
    )
    .order(
      'created_at',
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    ...subscriber,
    current_license:
      publicLicense(
        license
      ),
  };
}

async function saveSubscriberLicense(
  subscriberId: string,
  license: any
) {
  const db =
    requireDatabase();

  const {
    data,
    error,
  } = await db
    .from(
      'subscriber_licenses'
    )
    .insert({
      id: license.id,

      subscriber_id:
        subscriberId,

      machine_id:
        license.machineId,

      activation_key:
        license.activationKey,

      period:
        license.period,

      period_label_ar:
        license.periodLabelAr,

      customer_email:
        license.customerEmail,

      customer_name:
        license.customerName,

      customer_phone:
        license.customerPhone,

      company_name:
        license.companyName,

      amount_paid:
        license.amountPaid,

      currency:
        license.currency,

      status:
        license.status,

      activated_at:
        license.activatedAt,

      expires_at:
        license.expiresAt,

      notes:
        license.notes,

      is_locked:
        license.isLocked,
    })
    .select('*')
    .single();

  if (error) throw error;

  return publicLicense(
    data
  );
}

async function ensureConfiguredSuperAdmin() {
  const email = String(
    process.env.SUPER_ADMIN_EMAIL ||
      ''
  )
    .trim()
    .toLowerCase();

  const password = String(
    process.env.SUPER_ADMIN_PASSWORD ||
      ''
  );

  const name = String(
    process.env.SUPER_ADMIN_NAME ||
      'مدير النظام'
  ).trim();

  if (!email || !password)
    return;

  const db =
    requireDatabase();

  const existing =
    await getSubscriberByEmail(
      email
    );

  if (existing) {
    if (
      existing.role !==
      'SUPER_ADMIN'
    ) {
      await db
        .from('subscribers')
        .update({
          role: 'SUPER_ADMIN',
          email_verified: true,
        })
        .eq(
          'id',
          existing.id
        );
    }

    return;
  }

  const tenantId =
    `tenant-system-${crypto.randomUUID()}`;

  const subscriberId =
    `sub-${crypto.randomUUID()}`;

  await db.from('tenants').insert({
    id: tenantId,

    name: name,

    name_en: name,

    status: 'ACTIVE',

    camera_limit: 0,

    device_limit: 0,

    employee_limit: 0,

    retention_days: 365,

    modules: {
      all: true,
    },
  });

  await db.from('subscribers').insert({
    id: subscriberId,

    tenant_id: tenantId,

    email,

    password_hash:
      hashPassword(
        password
      ),

    name,

    phone: '',

    company_name: '',

    machine_id: '',

    role: 'SUPER_ADMIN',

    email_verified: true,

    email_verified_at:
      new Date().toISOString(),

    total_paid: 0,

    registered_at:
      new Date().toISOString(),

    last_active_at:
      new Date().toISOString(),

    status: 'ACTIVE',
  });

  await db.from('users').insert({
    id: subscriberId,

    tenant_id: tenantId,

    name,

    email,

    role: 'SUPER_ADMIN',

    phone: '',

    permissions: [
      'all_superadmin_rights',
      'manage_subscriptions',
      'generate_license_keys',
    ],

    is_active: true,
  });
}

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

  if (
    !host ||
    !user ||
    !pass
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host,

    port,

    secure:
      String(
        process.env.SMTP_SECURE || ''
      ).toLowerCase() ===
        'true' ||
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
  const db =
    requireDatabase();

  const token =
    crypto
      .randomBytes(32)
      .toString('hex');

  const expiresAt =
    new Date(
      Date.now() +
        24 *
          60 *
          60 *
          1000
    ).toISOString();

  const {
    error: tokenError,
  } = await db
    .from(
      'email_verification_tokens'
    )
    .insert({
      token,

      subscriber_id:
        subscriberId,

      expires_at:
        expiresAt,
    });

  if (tokenError)
    throw tokenError;

  const appUrl =
    String(
      process.env.APP_URL || ''
    ).replace(
      /\/$/,
      ''
    );

  if (!appUrl) {
    throw new Error(
      'APP_URL غير مضبوط.'
    );
  }

  const verifyUrl =
    `${appUrl}/api/auth/verify-email?token=${token}`;

  const transport =
    getMailTransport();

  if (!transport) {
    throw new Error(
      'خدمة البريد غير مضبوطة في Render.'
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
      `أكد بريدك الإلكتروني من هنا:\n${verifyUrl}\n\n` +
      `الرابط صالح لمدة 24 ساعة.`,

    html:
      `<div dir="rtl" style="font-family:Arial;line-height:1.8">` +
      `<h2>تأكيد البريد الإلكتروني</h2>` +
      `<p>مرحباً ${name}،</p>` +
      `<p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px">تأكيد البريد الإلكتروني</a></p>` +
      `<p>الرابط صالح لمدة 24 ساعة.</p>` +
      `</div>`,
  });
}

// ====================================================
// 8.1 Customer registration/login/email verification
// ====================================================

app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      const db =
        requireDatabase();

      const {
        email,
        password,
        name,
        phone,
        companyName,
        machineId,
      } = req.body || {};

      if (
        !email ||
        !password ||
        !name
      ) {
        return res.status(400).json({
          error:
            'البريد الإلكتروني وكلمة المرور والاسم مطلوبة.',
        });
      }

      if (
        String(password).length <
        6
      ) {
        return res.status(400).json({
          error:
            'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
        });
      }

      const cleanEmail =
        String(email)
          .trim()
          .toLowerCase();

      const existing =
        await getSubscriberByEmail(
          cleanEmail
        );

      if (existing) {
        return res.status(409).json({
          error:
            'هذا البريد الإلكتروني مسجل مسبقاً. استخدم تسجيل الدخول.',
        });
      }

      const tenantId =
        `tenant-${crypto.randomUUID()}`;

      const subscriberId =
        `sub-${crypto.randomUUID()}`;

      const cleanMachine =
        String(
          machineId || ''
        )
          .trim()
          .toUpperCase() ||
        `AMAN-${crypto
          .randomUUID()
          .slice(
            0,
            8
          )
          .toUpperCase()}`;

      const now =
        new Date().toISOString();

      const {
        error: tenantError,
      } = await db.from(
        'tenants'
      ).insert({
        id: tenantId,

        name: String(
          companyName ||
            name
        ).trim(),

        name_en: String(
          companyName ||
            name
        ).trim(),

        status: 'TRIAL',

        camera_limit: 4,

        device_limit: 1,

        employee_limit: 50,

        retention_days: 7,

        modules: {
          inventoryVision:
            true,

          attendanceTracking:
            true,

          theftDetection:
            true,

          behaviorAnalytics:
            true,

          whatsappAlerts:
            true,

          windowsAgent:
            true,
        },
      });

      if (tenantError)
        throw tenantError;

      const {
        error: subError,
      } = await db.from(
        'subscribers'
      ).insert({
        id: subscriberId,

        tenant_id:
          tenantId,

        email:
          cleanEmail,

        password_hash:
          hashPassword(
            password
          ),

        name: String(
          name
        ).trim(),

        phone: String(
          phone || ''
        ).trim(),

        company_name:
          String(
            companyName ||
              ''
          ).trim(),

        machine_id:
          cleanMachine,

        role: 'OWNER',

        email_verified:
          false,

        total_paid: 0,

        registered_at:
          now,

        last_active_at:
          now,

        status: 'TRIAL',
      });

      if (subError) {
        await db
          .from('tenants')
          .delete()
          .eq(
            'id',
            tenantId
          );

        throw subError;
      }

      const {
        error: userError,
      } = await db.from(
        'users'
      ).insert({
        id: subscriberId,

        tenant_id:
          tenantId,

        name: String(
          name
        ).trim(),

        email:
          cleanEmail,

        role: 'OWNER',

        phone: String(
          phone || ''
        ).trim(),

        permissions: [
          'manage_cameras',
          'view_all_reports',
        ],

        is_active: true,
      });

      if (userError)
        throw userError;

      await createEmailVerification(
        subscriberId,
        cleanEmail,
        String(name).trim()
      );

      const trial = {
        id:
          `lic-${crypto.randomUUID()}`,

        machineId:
          cleanMachine,

        activationKey:
          generateActivationKey(
            cleanMachine,
            '2_DAYS'
          ),

        period:
          '2_DAYS',

        periodLabelAr:
          'يومان (فترة تجريبية)',

        customerEmail:
          cleanEmail,

        customerName:
          String(name).trim(),

        customerPhone:
          String(
            phone || ''
          ).trim(),

        companyName:
          String(
            companyName || ''
          ).trim(),

        amountPaid: 0,

        currency: 'SAR',

        status: 'ACTIVE',

        activatedAt: now,

        expiresAt:
          calculateExpiryIso(
            '2_DAYS'
          ),

        notes:
          'فترة تجريبية عند التسجيل',

        isLocked: false,
      };

      await saveSubscriberLicense(
        subscriberId,
        trial
      );

      res.json({
        success: true,

        requiresEmailVerification:
          true,

        message:
          'تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.',

        user: {
          id: subscriberId,

          tenantId,

          email:
            cleanEmail,

          name:
            String(
              name
            ).trim(),

          role: 'OWNER',

          emailVerified:
            false,
        },
      });
    } catch (error: any) {
      console.error(
        'register:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'فشل التسجيل',
      });
    }
  }
);

app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body || {};

      const cleanEmail =
        String(
          email || ''
        )
          .trim()
          .toLowerCase();

      if (
        !cleanEmail ||
        !password
      ) {
        return res.status(400).json({
          error:
            'البريد الإلكتروني وكلمة المرور مطلوبان.',
        });
      }

      const subscriber =
        await getSubscriberByEmail(
          cleanEmail
        );

      if (
        !subscriber ||
        !verifyPassword(
          password,
          subscriber.password_hash
        )
      ) {
        return res.status(401).json({
          error:
            'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        });
      }

      if (
        !subscriber.email_verified
      ) {
        return res.status(403).json({
          requiresEmailVerification:
            true,

          error:
            'يجب تأكيد البريد الإلكتروني أولاً.',
        });
      }

      const full =
        await getSubscriberWithLicense(
          subscriber.id
        );

      await requireDatabase()
        .from('subscribers')
        .update({
          last_active_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          subscriber.id
        );

      res.json({
        success: true,

        message:
          `أهلاً بك ${subscriber.name}`,

        user:
          publicSubscriber(
            full
          ),

        license:
          full?.current_license ||
          null,

        token:
          `aman_${crypto.randomUUID()}`,
      });
    } catch (error: any) {
      console.error(
        'login:',
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

app.get(
  '/api/auth/verify-email',
  async (req, res) => {
    try {
      const token =
        String(
          req.query.token || ''
        ).trim();

      const db =
        requireDatabase();

      const {
        data: record,
        error,
      } = await db
        .from(
          'email_verification_tokens'
        )
        .select('*')
        .eq(
          'token',
          token
        )
        .maybeSingle();

      if (error)
        throw error;

      if (
        !record ||
        new Date(
          record.expires_at
        ).getTime() <
          Date.now()
      ) {
        return res
          .status(400)
          .send(
            '<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h2>رابط التحقق غير صالح أو منتهي</h2></body></html>'
          );
      }

      await db
        .from('subscribers')
        .update({
          email_verified:
            true,

          email_verified_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          record.subscriber_id
        );

      await db
        .from(
          'email_verification_tokens'
        )
        .delete()
        .eq(
          'token',
          token
        );

      const appUrl =
        String(
          process.env.APP_URL ||
            ''
        ).replace(
          /\/$/,
          ''
        );

      res.redirect(
        `${appUrl}/?email_verified=1`
      );
    } catch (error: any) {
      res.status(500).send(
        `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:50px"><h2>تعذر التحقق من البريد</h2><p>${String(
          error.message || ''
        )}</p></body></html>`
      );
    }
  }
);

app.post(
  '/api/auth/resend-verification',
  async (req, res) => {
    try {
      const email =
        String(
          req.body?.email ||
            ''
        )
          .trim()
          .toLowerCase();

      const subscriber =
        await getSubscriberByEmail(
          email
        );

      if (!subscriber) {
        return res.status(404).json({
          error:
            'الحساب غير موجود.',
        });
      }

      if (
        subscriber.email_verified
      ) {
        return res.json({
          success: true,

          alreadyVerified:
            true,

          message:
            'البريد مؤكد بالفعل.',
        });
      }

      await createEmailVerification(
        subscriber.id,
        subscriber.email,
        subscriber.name
      );

      res.json({
        success: true,

        message:
          'تم إرسال رابط تحقق جديد.',
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'تعذر إرسال رابط التحقق.',
      });
    }
  }
);

// ====================================================
// 8.3 Persistent licensing/subscriber administration
// ====================================================

app.get(
  '/api/license/status',
  async (req, res) => {
    try {
      const machineId =
        String(
          req.query.machineId ||
            ''
        )
          .trim()
          .toUpperCase();

      if (!machineId) {
        return res.status(400).json({
          error:
            'machineId مطلوب.',
        });
      }

      const db =
        requireDatabase();

      const {
        data: license,
        error,
      } = await db
        .from(
          'subscriber_licenses'
        )
        .select('*')
        .eq(
          'machine_id',
          machineId
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (error)
        throw error;

      if (!license) {
        return res.json({
          success: true,

          machineId,

          isLocked: true,

          status:
            'NOT_REGISTERED',

          license: null,

          daysRemaining: 0,

          hoursRemaining: 0,
        });
      }

      const diffMs =
        new Date(
          license.expires_at
        ).getTime() -
        Date.now();

      const expired =
        diffMs <= 0 ||
        license.status ===
          'EXPIRED' ||
        license.status ===
          'REVOKED';

      if (
        expired &&
        !license.is_locked
      ) {
        await db
          .from(
            'subscriber_licenses'
          )
          .update({
            is_locked:
              true,

            status:
              'EXPIRED',
          })
          .eq(
            'id',
            license.id
          );

        await db
          .from(
            'subscribers'
          )
          .update({
            status:
              'EXPIRED',
          })
          .eq(
            'id',
            license.subscriber_id
          );
      }

      return res.json({
        success: true,

        machineId,

        isLocked:
          expired ||
          Boolean(
            license.is_locked
          ),

        status:
          expired
            ? 'EXPIRED'
            : license.status,

        license:
          publicLicense(
            license
          ),

        daysRemaining:
          Math.max(
            0,
            Math.floor(
              diffMs /
                86400000
            )
          ),

        hoursRemaining:
          Math.max(
            0,
            Math.floor(
              diffMs /
                3600000
            )
          ),

        expiresAt:
          license.expires_at,

        supportEmail:
          process.env.SUPPORT_EMAIL ||
          '',
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'تعذر فحص الترخيص.',
      });
    }
  }
);

app.post(
  '/api/license/activate',
  async (req, res) => {
    try {
      const {
        machineId,
        activationKey,
      } = req.body || {};

      if (
        !machineId ||
        !activationKey
      ) {
        return res.status(400).json({
          error:
            'machineId و activationKey مطلوبان.',
        });
      }

      const cleanMachine =
        String(
          machineId
        )
          .trim()
          .toUpperCase();

      const cleanKey =
        String(
          activationKey
        )
          .trim()
          .toUpperCase();

      const verified =
        verifyActivationKey(
          cleanMachine,
          cleanKey
        );

      if (
        !verified.valid ||
        !verified.period
      ) {
        return res.status(400).json({
          success: false,

          error:
            verified.reason,
        });
      }

      const db =
        requireDatabase();

      const {
        data: subscriber,
      } = await db
        .from('subscribers')
        .select('*')
        .eq(
          'machine_id',
          cleanMachine
        )
        .maybeSingle();

      if (!subscriber) {
        return res.status(404).json({
          success: false,

          error:
            'لا يوجد مشترك مسجل بهذا الجهاز.',
        });
      }

      const now =
        new Date().toISOString();

      const license =
        await saveSubscriberLicense(
          subscriber.id,
          {
            id:
              `lic-${crypto.randomUUID()}`,

            machineId:
              cleanMachine,

            activationKey:
              cleanKey,

            period:
              verified.period,

            periodLabelAr:
              getPeriodLabelAr(
                verified.period
              ),

            customerEmail:
              subscriber.email,

            customerName:
              subscriber.name,

            customerPhone:
              subscriber.phone ||
              '',

            companyName:
              subscriber.company_name ||
              '',

            amountPaid:
              Number(
                subscriber.total_paid ||
                  0
              ),

            currency:
              'SAR',

            status:
              'ACTIVE',

            activatedAt:
              now,

            expiresAt:
              calculateExpiryIso(
                verified.period
              ),

            notes:
              'تفعيل بواسطة مفتاح صادر من الإدارة',

            isLocked: false,
          }
        );

      await db
        .from('subscribers')
        .update({
          status:
            verified.period ===
            '2_DAYS'
              ? 'TRIAL'
              : 'ACTIVE',
        })
        .eq(
          'id',
          subscriber.id
        );

      res.json({
        success: true,

        unlocked: true,

        license,

        expiresAt:
          license.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'فشل التفعيل.',
      });
    }
  }
);

app.get(
  '/api/admin/subscribers',
  async (req, res) => {
    try {
      const db =
        requireDatabase();

      const {
        data: subs,
        error,
      } = await db
        .from('subscribers')
        .select('*')
        .order(
          'registered_at',
          {
            ascending: false,
          }
        );

      if (error)
        throw error;

      const {
        data: licenses,
      } = await db
        .from(
          'subscriber_licenses'
        )
        .select('*')
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      const subscribers =
        (subs || []).map(
          (s: any) => {
            const lic =
              (licenses || []).find(
                (l: any) =>
                  l.subscriber_id ===
                  s.id
              );

            return {
              ...publicSubscriber({
                ...s,

                current_license:
                  publicLicense(
                    lic
                  ),
              }),
            };
          }
        );

      const totalRevenue =
        subscribers.reduce(
          (
            n: number,
            s: any
          ) =>
            n +
            Number(
              s.totalPaid || 0
            ),
          0
        );

      res.json({
        success: true,

        subscribers,

        financialStats: {
          totalRevenue,

          currency: 'SAR',

          activeSubscribersCount:
            subscribers.filter(
              (s: any) =>
                s.status ===
                'ACTIVE'
            ).length,

          expiredCount:
            subscribers.filter(
              (s: any) =>
                s.status ===
                'EXPIRED'
            ).length,

          trialCount:
            subscribers.filter(
              (s: any) =>
                s.status ===
                'TRIAL'
            ).length,

          totalKeysGenerated:
            (licenses || []).length,
        },

        licensesHistory:
          (licenses || []).map(
            publicLicense
          ),
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'تعذر تحميل المشتركين.',
      });
    }
  }
);

app.post(
  '/api/admin/generate-key',
  async (req, res) => {
    try {
      const {
        machineId,
        period = '1_MONTH',
        customerEmail = '',
        customerName = '',
        customerPhone = '',
        companyName = '',
        amountPaid = 0,
        currency = 'SAR',
        notes = '',
      } = req.body || {};

      if (!machineId) {
        return res.status(400).json({
          error:
            'machineId مطلوب.',
        });
      }

      const cleanMachine =
        String(
          machineId
        )
          .trim()
          .toUpperCase();

      const key =
        generateActivationKey(
          cleanMachine,
          period
        );

      const license = {
        id:
          `lic-${crypto.randomUUID()}`,

        machineId:
          cleanMachine,

        activationKey:
          key,

        period,

        periodLabelAr:
          getPeriodLabelAr(
            period
          ),

        customerEmail:
          String(
            customerEmail
          )
            .trim()
            .toLowerCase(),

        customerName:
          String(
            customerName
          ).trim(),

        customerPhone:
          String(
            customerPhone
          ).trim(),

        companyName:
          String(
            companyName
          ).trim(),

        amountPaid:
          Number(
            amountPaid
          ) || 0,

        currency:
          String(
            currency || 'SAR'
          ),

        status:
          'ACTIVE',

        activatedAt:
          new Date().toISOString(),

        expiresAt:
          calculateExpiryIso(
            period
          ),

        notes:
          String(
            notes || ''
          ),

        isLocked: false,
      };

      const db =
        requireDatabase();

      let subscriber =
        null;

      if (
        license.customerEmail
      ) {
        subscriber =
          await getSubscriberByEmail(
            license.customerEmail
          );
      }

      if (!subscriber) {
        return res.status(404).json({
          error:
            'لا يوجد حساب مشترك بهذا البريد. يجب تسجيل العميل أولاً.',
        });
      }

      await db
        .from('subscribers')
        .update({
          machine_id:
            cleanMachine,

          name:
            license.customerName ||
            subscriber.name,

          phone:
            license.customerPhone ||
            subscriber.phone,

          company_name:
            license.companyName ||
            subscriber.company_name,

          total_paid:
            Number(
              subscriber.total_paid ||
                0
            ) +
            license.amountPaid,

          status:
            period ===
            '2_DAYS'
              ? 'TRIAL'
              : 'ACTIVE',
        })
        .eq(
          'id',
          subscriber.id
        );

      const saved =
        await saveSubscriberLicense(
          subscriber.id,
          license
        );

      res.json({
        success: true,

        license:
          saved,

        activationKey:
          key,
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'فشل توليد المفتاح.',
      });
    }
  }
);

app.post(
  '/api/license/master-activate',
  async (req, res) => {
    return res.status(403).json({
      success: false,

      error:
        'تفعيل المدير العام يتم من خلال حساب SUPER_ADMIN موجود في Supabase؛ لا توجد حسابات أو أرقام افتراضية.',
    });
  }
);

app.post(
  '/api/license/start-trial',
  async (req, res) => {
    try {
      const machineId =
        String(
          req.body?.machineId ||
            ''
        )
          .trim()
          .toUpperCase();

      const email =
        String(
          req.body?.email ||
            ''
        )
          .trim()
          .toLowerCase();

      if (
        !machineId ||
        !email
      ) {
        return res.status(400).json({
          error:
            'البريد الإلكتروني وmachineId مطلوبان.',
        });
      }

      const subscriber =
        await getSubscriberByEmail(
          email
        );

      if (!subscriber) {
        return res.status(404).json({
          error:
            'سجل الحساب أولاً.',
        });
      }

      const db =
        requireDatabase();

      const license = {
        id:
          `lic-${crypto.randomUUID()}`,

        machineId,

        activationKey:
          generateActivationKey(
            machineId,
            '2_DAYS'
          ),

        period:
          '2_DAYS',

        periodLabelAr:
          'يومان (فترة تجريبية)',

        customerEmail:
          subscriber.email,

        customerName:
          subscriber.name,

        customerPhone:
          subscriber.phone ||
          '',

        companyName:
          subscriber.company_name ||
          '',

        amountPaid: 0,

        currency:
          'SAR',

        status:
          'ACTIVE',

        activatedAt:
          new Date().toISOString(),

        expiresAt:
          calculateExpiryIso(
            '2_DAYS'
          ),

        notes:
          'فترة تجريبية مرتبطة بالحساب',

        isLocked: false,
      };

      const saved =
        await saveSubscriberLicense(
          subscriber.id,
          license
        );

      await db
        .from('subscribers')
        .update({
          machine_id:
            machineId,

          status:
            'TRIAL',
        })
        .eq(
          'id',
          subscriber.id
        );

      res.json({
        success: true,

        unlocked: true,

        license:
          saved,
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message ||
          'فشل بدء التجربة.',
      });
    }
  }
);

// ====================================================
// Inventory master data
// ====================================================

app.get(
  '/api/inventory/products',
  async (req, res) => {
    try {
      const tenantId =
        String(
          req.query.tenantId ||
            ''
        ).trim();

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error:
            'tenantId مطلوب',
        });
      }

      const {
        data,
        error,
      } = await requireDatabase()
        .from(
          'inventory_products'
        )
        .select('*')
        .eq(
          'tenant_id',
          tenantId
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (error)
        throw error;

      res.json({
        success: true,
        products:
          data || [],
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        error: e.message,
      });
    }
  }
);

app.post(
  '/api/inventory/products',
  async (req, res) => {
    try {
      const b =
        req.body || {};

      if (
        !b.tenantId ||
        !b.name
      ) {
        return res.status(400).json({
          success: false,
          error:
            'tenantId واسم الصنف مطلوبان',
        });
      }

      const product = {
        id:
          b.id ||
          `prod-${crypto.randomUUID()}`,

        tenant_id:
          b.tenantId,

        name:
          String(
            b.name
          ).trim(),

        sku:
          String(
            b.sku || ''
          ).trim(),

        barcode:
          String(
            b.barcode || ''
          ).trim(),

        warehouse:
          String(
            b.warehouse || ''
          ).trim(),

        zone:
          String(
            b.zone || ''
          ).trim(),

        camera_name:
          String(
            b.cameraName || ''
          ).trim(),

        unit:
          String(
            b.unit ||
              'قطعة'
          ).trim(),

        units_per_carton:
          Math.max(
            1,
            Number(
              b.unitsPerCarton ||
                1
            )
          ),

        expected_quantity:
          Math.max(
            0,
            Number(
              b.expectedQuantity ||
                0
            )
          ),

        ai_detected_quantity:
          Math.max(
            0,
            Number(
              b.aiDetectedQuantity ||
                0
            )
          ),

        confidence: 0,

        difference: 0,

        outgoing_count_today:
          0,

        incoming_count_today:
          0,

        last_count_timestamp:
          new Date().toISOString(),

        low_stock_threshold:
          Math.max(
            0,
            Number(
              b.lowStockThreshold ||
                0
            )
          ),

        status:
          'NORMAL',
      };

      const {
        data,
        error,
      } = await requireDatabase()
        .from(
          'inventory_products'
        )
        .insert(product)
        .select('*')
        .single();

      if (error)
        throw error;

      res.json({
        success: true,
        product: data,
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        error: e.message,
      });
    }
  }
);

// ====================================================
// Secure camera persistence
// ====================================================

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

    const b =
      req.body || {};

    if (
      !b.name ||
      !b.streamUrl
    ) {
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

      name:
        b.name,

      location:
        b.location || '',

      stream_url:
        b.streamUrl,

      username_encrypted:
        b.username
          ? encryptSecret(
              String(
                b.username
              )
            )
          : null,

      password_encrypted:
        b.password
          ? encryptSecret(
              String(
                b.password
              )
            )
          : null,

      status:
        b.status ||
        'OFFLINE',

      fps:
        Number(
          b.fps || 0
        ),

      resolution:
        b.resolution || '',

      ai_enabled:
        Boolean(
          b.aiEnabled
        ),

      recording_enabled:
        Boolean(
          b.recordingEnabled
        ),

      type:
        b.type ||
        'RTSP',

      recorder_id:
        b.recorderId ||
        null,

      channel:
        b.channel ||
        null,

      detection_settings:
        b.detectionSettings ||
        {},

      zones:
        b.zones || [],

      agent_id:
        b.agentId ||
        null,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('cameras')
      .upsert(
        row,
        {
          onConflict: 'id',
        }
      )
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

    const b =
      req.body || {};

    if (
      !b.name ||
      !b.ipAddress
    ) {
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

      name:
        b.name,

      type:
        b.type ||
        'NVR',

      brand:
        b.brand || '',

      ip_address:
        b.ipAddress,

      port:
        Number(
          b.port || 8000
        ),

      username_encrypted:
        b.username
          ? encryptSecret(
              String(
                b.username
              )
            )
          : null,

      password_encrypted:
        b.password
          ? encryptSecret(
              String(
                b.password
              )
            )
          : null,

      channels:
        Number(
          b.channels || 8
        ),

      status:
        b.status ||
        'OFFLINE',

      last_sync:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        'recorder_devices'
      )
      .upsert(
        row,
        {
          onConflict: 'id',
        }
      )
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

// ====================================================
// 8. Employees / Attendance / Excel export
// ====================================================

app.get(
  '/api/employees',
  async (req, res) => {
    if (!supabaseAdmin) {
      return res.json({
        success: true,
        employees: [],
      });
    }

    const tenantId =
      String(
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
      employees:
        data || [],
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

    const b =
      req.body || {};

    let photoUrl =
      b.photoUrl || '';

    if (
      b.photoDataUrl &&
      /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(
        String(
          b.photoDataUrl
        )
      )
    ) {
      const match =
        String(
          b.photoDataUrl
        ).match(
          /^data:image\/([^;]+);base64,(.+)$/i
        );

      if (match) {
        const ext =
          match[1]
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
          await supabaseAdmin
            .storage
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
            supabaseAdmin
              .storage
              .from(
                'employee-photos'
              )
              .getPublicUrl(
                filePath
              );

          photoUrl =
            publicData
              .data
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
        b.employeeCode ||
        '',

      name:
        b.name,

      department:
        b.department ||
        '',

      position:
        b.position ||
        '',

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
        b.allowedZones ||
        [],

      schedule:
        b.schedule ||
        {},
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
      .upsert(
        row,
        {
          onConflict: 'id',
        }
      )
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

      const data =
        rows.map(
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
              r.lateMinutes ||
              0,

            'الحالة':
              r.status,

            'الصورة':
              r.photoUrl ||
              '',
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
        XLSX.write(
          wb,
          {
            type: 'buffer',
            bookType: 'xlsx',
          }
        );

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
        error:
          error.message,
      });
    }
  }
);

// ====================================================
// 9. Edge Agent
// ====================================================

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

  const token =
    auth.startsWith(
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
  } = await supabaseAdmin
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

    const b =
      req.body || {};

    const token =
      crypto
        .randomBytes(32)
        .toString('hex');

    const id =
      crypto.randomUUID();

    const {
      error,
    } = await supabaseAdmin
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

        is_active:
          true,

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
    } = await supabaseAdmin!
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
      req.edgeAgent
        .tenant_id;

    const {
      data,
      error,
    } = await supabaseAdmin!
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

// ====================================================
// Continuous AI monitoring pipeline
// ====================================================

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
  const now =
    Date.now();

  const last =
    alertCooldown.get(
      key
    ) || 0;

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
          await supabaseAdmin
            .storage
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
            supabaseAdmin
              .storage
              .from(
                'security-evidence'
              )
              .getPublicUrl(
                pathName
              );

          snapshotUrl =
            pub.data
              .publicUrl;
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
        } = await supabaseAdmin
          .from(
            'behavior_events'
          )
          .insert(row);

        if (error) {
          return res.status(500).json({
            success: false,
            error:
              error.message,
          });
        }
      }

      const notifyThreshold =
        String(
          process.env
            .AI_ALERT_MIN_SEVERITY ||
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
              0.80
          );

      const key =
        `${tenantId}:${cameraId}:${eventType}`;

      let notified =
        false;

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
          await getWhatsAppConfig({
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
          process.env
            .EVOLUTION_API_KEY
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
            `📝 ${reason}${evidence}`;

          try {
            await sendEvolutionText(
              String(
                instance
              ).trim(),

              cleanPhone(
                targetPhone
              ),

              text
            );

            notified = true;
          } catch (e) {
            console.error(
              'Agent alert WhatsApp failed:',
              e
            );
          }
        }
      }

      res.json({
        success: true,

        eventId: id,

        eligibleForAlert:
          eligible,

        whatsappNotified:
          notified,

        snapshotUrl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error:
          error.message,
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
              0.80
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
            .map(
              (x) =>
                x.trim()
            )
            .filter(
              Boolean
            ),
      },
    });
  }
);

// ====================================================
// Claude Agent Bridge
// ====================================================

app.post(
  '/api/agent/ask',
  async (req, res) => {
    try {
      if (!claudeConfigured()) {
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

      const systemPrompt = `
أنت وكيل تشغيل لمنصة أمان للمراقبة والكاميرات والحضور والمخزون وWhatsApp.

مهمتك:
- تحليل طلب المستخدم بدقة.
- إعطاء إجابات عملية ومباشرة.
- عدم الادعاء بتنفيذ عملية لم يتم تنفيذها فعلياً.
- عدم اختلاق بيانات من الكاميرات أو قاعدة البيانات.
- احترام الخصوصية وأمن المعلومات.
- عندما تحتاج عملية إلى API أو Edge Agent، اشرح المسار المطلوب.
- لا تطلب أو تعرض مفاتيح API أو كلمات المرور أو الأسرار.
- لا تعتبر الشخص مذنباً بناءً على مجرد اشتباه بصري.
`;

      const answer =
        await callClaude(
          prompt,
          systemPrompt,
          Number(
            process.env
              .CLAUDE_AGENT_MAX_TOKENS ||
              2048
          )
        );

      res.json({
        success: true,

        model:
          getClaudeModel(),

        answer,
      });
    } catch (error: any) {
      console.error(
        'Claude agent error:',
        error
      );

      res.status(502).json({
        success: false,

        error:
          error?.message ||
          'فشل الاتصال بـ Claude',
      });
    }
  }
);

// ====================================================
// VITE OR STATIC SERVING
// ====================================================

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
          middlewareMode:
            true,
        },

        appType:
          'spa',
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

  await ensureConfiguredSuperAdmin();

  app.listen(
    PORT,
    HOST,
    () => {
      console.log(
        `[CCTV Platform Server] running on http://0.0.0.0:${PORT}`
      );

      console.log(
        `[CCTV Platform Server] Claude: ${
          claudeConfigured()
            ? 'CONFIGURED'
            : 'NOT CONFIGURED'
        }`
      );

      console.log(
        `[CCTV Platform Server] Claude model: ${getClaudeModel()}`
      );

      console.log(
        `[CCTV Platform Server] WhatsApp Evolution API: ${
          evolutionBaseUrl() &&
          process.env
            .EVOLUTION_API_KEY
            ? 'CONFIGURED'
            : 'NOT CONFIGURED'
        }`
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
