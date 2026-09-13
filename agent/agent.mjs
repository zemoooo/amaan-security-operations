import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
dotenv.config();

const execFileAsync = promisify(execFile);
const CLOUD_URL = String(process.env.AMAN_CLOUD_URL || '').replace(/\/$/, '');
let TOKEN = process.env.AMAN_AGENT_TOKEN || '';
const AGENT_NAME = process.env.AMAN_AGENT_NAME || os.hostname();
const TENANT_ID = String(process.env.AMAN_TENANT_ID || '').trim();
if (!TENANT_ID) throw new Error('AMAN_TENANT_ID is required');
const VERSION = '2.0.0';
const INTERVAL_MS = Math.max(3000, Number(process.env.AI_MONITOR_INTERVAL_SECONDS || 10) * 1000);
const WORKING_HOURS = process.env.AI_WORKING_HOURS || '08:00-17:00';
const RESTRICTED_ZONES = (process.env.AI_RESTRICTED_ZONES || '').split(',').map(x => x.trim()).filter(Boolean);
const PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
const AI_MODEL = process.env.AI_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FRAME_DIR = path.resolve(process.env.AMAN_FRAME_DIR || '.aman-frames');
fs.mkdirSync(FRAME_DIR, { recursive: true });

if (!CLOUD_URL) throw new Error('AMAN_CLOUD_URL is required');

async function api(urlPath, init = {}) {
  const res = await fetch(`${CLOUD_URL}${urlPath}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function register() {
  const data = await api('/api/agent/register', { method: 'POST', body: JSON.stringify({ tenantId: TENANT_ID, name: AGENT_NAME, version: VERSION, os: process.platform }) });
  TOKEN = data.token;
  fs.writeFileSync('.aman-agent-token', TOKEN, { mode: 0o600 });
  console.log(`Registered agent ${data.agentId}. Token saved locally.`);
}

async function heartbeat() {
  const metrics = { cpuLoad: os.loadavg()[0], memoryFree: os.freemem(), memoryTotal: os.totalmem(), hostname: os.hostname(), monitoring: true, provider: PROVIDER, model: AI_MODEL };
  await api('/api/agent/heartbeat', { method: 'POST', body: JSON.stringify({ metrics }) });
}

function addCredentials(streamUrl, username, password) {
  if (!username && !password) return streamUrl;
  try {
    const u = new URL(streamUrl);
    if (!u.username) u.username = encodeURIComponent(String(username || ''));
    if (!u.password) u.password = encodeURIComponent(String(password || ''));
    return u.toString();
  } catch { return streamUrl; }
}

async function captureFrame(rtspUrl, outputPath) {
  await execFileAsync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-rtsp_transport', 'tcp', '-i', rtspUrl, '-frames:v', '1', '-vf', 'scale=1280:-1', '-q:v', '5', outputPath], { timeout: 20000 });
  return fs.readFileSync(outputPath).toString('base64');
}

function hourInWindow(now, window) {
  const m = String(window || '').match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) return true;
  const mins = d => Number(d.slice(0, 2)) * 60 + Number(d.slice(3));
  const n = now.getHours() * 60 + now.getMinutes();
  const a = mins(m[1]), b = mins(m[2]);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}

function parseJson(text) {
  const clean = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(clean); } catch { return null; }
}

async function analyzeAnthropic(imageBase64, camera, context) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic');
  const prompt = `أنت مسؤول مراقبة أمنية يعمل بشكل مستمر. حلل لقطة الكاميرا الحالية مقارنة بسياق المكان والوقت. لا تعتبر مجرد وجود شخص حادثاً. ابحث عن سلوك غير طبيعي أو دخول لمنطقة حساسة أو وجود خارج ساعات العمل أو نشاط يستحق تدخل المشرف. لا تتهم شخصاً بجريمة ولا تخترع تفاصيل غير مرئية. إذا كانت الصورة غير واضحة فاخفض الثقة.\n\nالكاميرا: ${camera.name}\nالموقع: ${camera.location || 'غير محدد'}\nالوقت المحلي: ${new Date().toLocaleString('ar-YE')}\nساعات العمل: ${WORKING_HOURS}\nهل نحن خارج الدوام: ${context.afterHours}\nالمناطق الحساسة المعلنة: ${RESTRICTED_ZONES.join('، ') || 'غير محددة'}\n\nأعد JSON فقط بهذا الشكل:\n{"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0.0,"eventType":"NORMAL|AFTER_HOURS_PERSON|RESTRICTED_AREA|UNUSUAL_BEHAVIOR|CROWDING|LINGERING|THEFT_SUSPECTED|FIGHT|FALL|TAILGATING|OBJECT_REMOVAL|VEHICLE_ANOMALY|OTHER","reason":"وصف قصير بالعربية لما يمكن رؤيته فقط","notify":false}`;
  const body = { model: AI_MODEL, max_tokens: 700, system: 'أنت محلل فيديو أمني محافظ. لا تختلق هوية أو نية. لا تجعل وجود شخص وحده تنبيهاً.', messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }] }] };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `Anthropic HTTP ${r.status}`);
  return parseJson(d?.content?.map(x => x.text || '').join('')) || { severity: 'LOW', confidence: 0, eventType: 'OTHER', reason: 'تعذر تفسير استجابة الذكاء الاصطناعي', notify: false };
}

async function analyzeGemini(imageBase64, camera, context) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is required for AI_PROVIDER=gemini');
  const prompt = `أنت مسؤول مراقبة أمنية مستمر. حلل هذه اللقطة. لا تعتبر وجود شخص عادياً حادثاً. أبلغ فقط عن سلوك غير طبيعي يمكن رؤيته. ساعات العمل ${WORKING_HOURS}; خارج الدوام=${context.afterHours}; المناطق الحساسة=${RESTRICTED_ZONES.join('، ')}. أعد JSON فقط: {"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0.0,"eventType":"NORMAL|AFTER_HOURS_PERSON|RESTRICTED_AREA|UNUSUAL_BEHAVIOR|CROWDING|LINGERING|THEFT_SUSPECTED|FIGHT|FALL|TAILGATING|OBJECT_REMOVAL|VEHICLE_ANOMALY|OTHER","reason":"وصف عربي قصير","notify":false}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(AI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `Gemini HTTP ${r.status}`);
  return parseJson(d?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('')) || { severity: 'LOW', confidence: 0, eventType: 'OTHER', reason: 'تعذر تفسير استجابة الذكاء الاصطناعي', notify: false };
}

async function analyze(imageBase64, camera, context) {
  return PROVIDER === 'gemini' ? analyzeGemini(imageBase64, camera, context) : analyzeAnthropic(imageBase64, camera, context);
}

async function submitEvent(camera, analysis, snapshotBase64) {
  const payload = {
    cameraId: camera.id,
    cameraName: camera.name,
    eventType: analysis.eventType || 'UNUSUAL_BEHAVIOR',
    severity: String(analysis.severity || 'LOW').toUpperCase(),
    confidence: Number(analysis.confidence || 0),
    reason: String(analysis.reason || ''),
    snapshotBase64: analysis.notify ? snapshotBase64 : undefined,
    timestamp: new Date().toISOString(),
  };
  return api('/api/agent/security-event', { method: 'POST', body: JSON.stringify(payload) });
}

async function monitorCamera(camera) {
  if (camera.ai_enabled === false) return;
  const stream = addCredentials(camera.stream_url, camera.username, camera.password);
  if (!stream) return;
  const file = path.join(FRAME_DIR, `${String(camera.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`);
  try {
    const image = await captureFrame(stream, file);
    const now = new Date();
    const result = await analyze(image, camera, { afterHours: !hourInWindow(now, WORKING_HOURS) });
    const severity = String(result.severity || 'LOW').toUpperCase();
    const confidence = Number(result.confidence || 0);
    const meaningful = severity !== 'LOW' && confidence >= Number(process.env.AI_ANALYSIS_MIN_CONFIDENCE || 0.75) && result.eventType !== 'NORMAL';
    if (meaningful || result.notify) {
      const response = await submitEvent(camera, { ...result, severity, confidence, notify: result.notify || severityRank(severity) >= 3 }, image);
      console.log(`[${new Date().toISOString()}] ${camera.name}: ${severity} ${result.eventType} -> whatsapp=${response.whatsappNotified}`);
    }
  } catch (err) {
    console.error(`[monitor ${camera.name}]`, err.message);
  } finally { try { fs.unlinkSync(file); } catch {} }
}

function severityRank(s) { return ({ LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 })[String(s).toUpperCase()] || 1; }

async function monitoringLoop() {
  if (process.env.AI_MONITORING_ENABLED === 'false') return;
  try {
    const cfg = await api('/api/agent/camera-config');
    const cameras = (cfg.cameras || []).filter(c => c.ai_enabled !== false && c.stream_url);
    for (const camera of cameras) await monitorCamera(camera);
  } catch (err) { console.error('[monitor loop]', err.message); }
}

async function main() {
  if (!TOKEN && fs.existsSync('.aman-agent-token')) TOKEN = fs.readFileSync('.aman-agent-token', 'utf8').trim();
  if (!TOKEN) await register();
  await heartbeat();
  console.log(`AMAN AI Monitoring Agent ${VERSION} started. Provider=${PROVIDER}, Model=${AI_MODEL}, interval=${INTERVAL_MS / 1000}s`);
  setInterval(() => heartbeat().catch(e => console.error('[heartbeat]', e.message)), 30000);
  await monitoringLoop();
  setInterval(() => monitoringLoop().catch(e => console.error('[monitor]', e.message)), INTERVAL_MS);
}
main().catch(err => { console.error(err); process.exit(1); });
