import process from 'node:process';

const APP_URL = String(process.env.APP_URL || '').replace(/\/$/, '');
const INSTANCE = process.env.EVOLUTION_DEFAULT_INSTANCE || 'aman_default';
const PHONE = process.env.TEST_WHATSAPP_PHONE || '';

if (!APP_URL) throw new Error('APP_URL is required');

async function call(path, options = {}) {
  const r = await fetch(`${APP_URL}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  console.log(path, r.status, JSON.stringify(data).slice(0, 1000));
  if (!r.ok) throw new Error(`${path}: ${data.error || r.status}`);
  return data;
}

await call('/api/health');
await call(`/api/whatsapp/status/${encodeURIComponent(INSTANCE)}`);
await call(`/api/whatsapp/qr/${encodeURIComponent(INSTANCE)}`);
if (PHONE) {
  await call('/api/notifications/whatsapp/dispatch', {
    method: 'POST',
    body: JSON.stringify({ instanceName: INSTANCE, phoneNumber: PHONE, action: 'MESSAGE', incidentTitle: 'اختبار إنتاج', reason: 'رسالة اختبار حقيقية من نظام أمان', cameraName: 'TEST-CAMERA', severity: 'LOW' })
  });
}
console.log('Production smoke test completed.');
