# AMAN Edge AI Monitoring Agent

هذا الوكيل يثبت داخل شبكة العميل على Windows أو Linux، ويصل إلى RTSP/NVR/DVR محلياً. يقوم بأخذ لقطات دورية من الكاميرات المفعلة للـAI، ويرسلها مباشرة إلى نموذج الرؤية المحدد في `AI_PROVIDER` لتحليلها. لا يرسل WhatsApp لكل لقطة: يرفع فقط الأحداث المهمة إلى AMAN Cloud، والخادم يطبق حد الخطورة والثقة وCooldown قبل إرسال التنبيه عبر Evolution API.

## متطلبات
- Node.js 20+
- FFmpeg في PATH أو `FFMPEG_PATH`
- وصول الجهاز إلى RTSP/NVR/DVR
- `AMAN_CLOUD_URL`
- مفتاح Anthropic أو Gemini حسب `AI_PROVIDER`

## تشغيل
```bash
npm install
copy .env.example .env
npm start
```
أول تشغيل يسجل الـAgent ويحفظ التوكن في `.aman-agent-token`.

## ملاحظة تشغيلية
المراقبة المستمرة تعتمد على sampling للقطات، وليس إرسال فيديو كامل إلى السحابة. غيّر `AI_MONITOR_INTERVAL_SECONDS` وفق عدد الكاميرات والميزانية. للمواقع الحساسة يمكن استخدام 5 ثوانٍ، وللمواقع العامة 10-15 ثانية.
