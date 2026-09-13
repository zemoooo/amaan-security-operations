import React, { useState } from 'react';
import {
  X,
  Send,
  Smartphone,
  ShieldAlert,
  CheckCheck,
  ExternalLink,
  Phone,
  PhoneCall,
  Sliders,
  History,
  CheckCircle2,
  Sparkles,
  Save,
  MessageSquare,
  QrCode,
  RefreshCw,
  Wifi
} from 'lucide-react';

import { useLanguageTheme } from '../context/LanguageThemeContext';
import { useLiveCCTV } from '../context/LiveCCTVContext';
import {
  WhatsAppAlertMode,
  SeverityLevel
} from '../types';

interface WhatsAppPreviewModalProps {
  onClose: () => void;

  eventDetails?: {
    cameraName: string;
    time: string;
    person: string;
    severity: string;
    reason: string;
    reviewUrl: string;
  };
}

export const WhatsAppPreviewModal: React.FC<
  WhatsAppPreviewModalProps
> = ({
  onClose,
  eventDetails
}) => {
  const { t } = useLanguageTheme();

  const {
    customerWhatsAppSettings,
    updateCustomerWhatsAppSettings,
    triggerWhatsAppCall,
    dispatchWhatsAppAlert,
    whatsappDispatchLogs
  } = useLiveCCTV();

  /*
   * ============================================================
   * Tabs
   * ============================================================
   */

  const [activeTab, setActiveTab] =
    useState<
      'CONFIG' |
      'CONNECT' |
      'PREVIEW' |
      'HISTORY'
    >('CONFIG');

  /*
   * ============================================================
   * WhatsApp Instance
   * لا يوجد اسم Instance وهمي.
   * يتم استخدام القيمة الموجودة في إعدادات النظام فقط.
   * ============================================================
   */

  const [
    instanceName,
    setInstanceName
  ] = useState(
    customerWhatsAppSettings.instanceName || ''
  );

  /*
   * ============================================================
   * QR
   * ============================================================
   */

  const [qrImage, setQrImage] =
    useState<string | null>(null);

  const [waState, setWaState] =
    useState<string>('غير متصل');

  const [qrLoading, setQrLoading] =
    useState(false);

  /*
   * ============================================================
   * Customer Settings
   *
   * لا توجد أرقام أو أسماء افتراضية.
   * ============================================================
   */

  const [phoneNumber, setPhoneNumber] =
    useState(
      customerWhatsAppSettings.phoneNumber || ''
    );

  const [customerName, setCustomerName] =
    useState(
      customerWhatsAppSettings.customerName || ''
    );

  const [enabled, setEnabled] =
    useState(
      customerWhatsAppSettings.enabled
    );

  const [alertMode, setAlertMode] =
    useState<WhatsAppAlertMode>(
      customerWhatsAppSettings.alertMode ||
      'MESSAGE_AND_CALL'
    );

  const [minSeverity, setMinSeverity] =
    useState<SeverityLevel>(
      customerWhatsAppSettings.minSeverity ||
      'MEDIUM'
    );

  const [
    callRingtoneEnabled,
    setCallRingtoneEnabled
  ] = useState(
    customerWhatsAppSettings.callRingtoneEnabled
  );

  /*
   * ============================================================
   * UI States
   * ============================================================
   */

  const [savedSuccess, setSavedSuccess] =
    useState(false);

  const [
    isSendingMessage,
    setIsSendingMessage
  ] = useState(false);

  const [
    messageSentFeedback,
    setMessageSentFeedback
  ] = useState<string | null>(null);

  /*
   * ============================================================
   * Event details
   *
   * لا توجد بيانات حادثة وهمية.
   * إذا لم تصل بيانات حقيقية من النظام يتم عرض شرطة فقط.
   * ============================================================
   */

  const eventCameraName =
    eventDetails?.cameraName || '—';

  const eventTime =
    eventDetails?.time || '—';

  const eventPerson =
    eventDetails?.person || '—';

  const eventSeverity =
    eventDetails?.severity || '—';

  const eventReason =
    eventDetails?.reason || '—';

  const eventReviewUrl =
    eventDetails?.reviewUrl || '';

  /*
   * ============================================================
   * تنظيف رقم الهاتف
   * ============================================================
   */

  const normalizePhoneNumber = (
    value: string
  ) => {
    return value.replace(
      /[^\d]/g,
      ''
    );
  };

  /*
   * ============================================================
   * إنشاء / تحديث QR
   * ============================================================
   */

  const loadQr = async () => {
    const cleanInstanceName =
      instanceName.trim();

    if (!cleanInstanceName) {
      setWaState(
        'أدخل اسم جلسة WhatsApp أولاً'
      );

      return;
    }

    setQrLoading(true);
    setQrImage(null);

    try {
      /*
       * إنشاء Instance
       */

      const createResponse =
        await fetch(
          '/api/whatsapp/instance/create',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              instanceName:
                cleanInstanceName
            })
          }
        );

      let createData: any = null;

      try {
        createData =
          await createResponse.json();
      } catch {
        throw new Error(
          'استجابة إنشاء جلسة WhatsApp غير صالحة'
        );
      }

      if (!createResponse.ok) {
        throw new Error(
          createData?.error ||
          createData?.message ||
          `فشل إنشاء الجلسة HTTP ${createResponse.status}`
        );
      }

      /*
       * إذا أعاد Backend QR مباشرة
       */

      if (createData?.base64) {
        setQrImage(
          createData.base64
        );
      }

      /*
       * حالة الجلسة
       */

      const statusResponse =
        await fetch(
          `/api/whatsapp/status/${encodeURIComponent(
            cleanInstanceName
          )}`
        );

      let statusData: any = null;

      try {
        statusData =
          await statusResponse.json();
      } catch {
        statusData = null;
      }

      if (
        statusResponse.ok &&
        statusData?.state
      ) {
        setWaState(
          statusData.state
        );
      }

      /*
       * إذا لم يصل QR من إنشاء Instance
       * نطلبه من endpoint QR.
       */

      if (
        !createData?.base64
      ) {
        const qrResponse =
          await fetch(
            `/api/whatsapp/qr/${encodeURIComponent(
              cleanInstanceName
            )}`
          );

        let qrData: any = null;

        try {
          qrData =
            await qrResponse.json();
        } catch {
          qrData = null;
        }

        if (!qrResponse.ok) {
          throw new Error(
            qrData?.error ||
            qrData?.message ||
            `فشل الحصول على QR. HTTP ${qrResponse.status}`
          );
        }

        if (qrData?.base64) {
          setQrImage(
            qrData.base64
          );
        } else {
          setWaState(
            qrData?.state ||
            'لم يتم إرجاع QR من Evolution API'
          );
        }
      }

    } catch (error: any) {
      console.error(
        '[WhatsApp QR] Error:',
        error
      );

      setWaState(
        error?.message ||
        'حدث خطأ أثناء الاتصال بـ WhatsApp'
      );

    } finally {
      setQrLoading(false);
    }
  };

  /*
   * ============================================================
   * حفظ إعدادات العميل
   * ============================================================
   */

  const handleSaveSettings =
    async (
      e?: React.FormEvent
    ) => {
      e?.preventDefault();

      const cleanPhone =
        normalizePhoneNumber(
          phoneNumber
        );

      const cleanInstance =
        instanceName.trim();

      /*
       * لا نحفظ رقم فارغ إذا كانت الخدمة مفعلة
       */

      if (
        enabled &&
        !cleanPhone
      ) {
        setMessageSentFeedback(
          t(
            'أدخل رقم واتساب العميل أولاً',
            'Enter the customer WhatsApp number first'
          )
        );

        return;
      }

      /*
       * لا نحفظ Instance فارغ
       */

      if (
        enabled &&
        !cleanInstance
      ) {
        setMessageSentFeedback(
          t(
            'أدخل اسم جلسة WhatsApp أولاً',
            'Enter the WhatsApp instance name first'
          )
        );

        return;
      }

      await updateCustomerWhatsAppSettings({
        phoneNumber:
          cleanPhone,

        customerName:
          customerName.trim(),

        enabled,

        instanceName:
          cleanInstance,

        alertMode,

        minSeverity,

        callRingtoneEnabled
      });

      setPhoneNumber(
        cleanPhone
      );

      setInstanceName(
        cleanInstance
      );

      setSavedSuccess(true);

      setTimeout(
        () => {
          setSavedSuccess(false);
        },
        3000
      );
    };

  /*
   * ============================================================
   * اختبار إرسال رسالة
   *
   * لن يظهر نجاح إلا إذا Backend أكد نجاح الإرسال.
   * ============================================================
   */

  const handleTestSendMessage =
    async () => {

      setIsSendingMessage(true);
      setMessageSentFeedback(null);

      try {
        const cleanPhone =
          normalizePhoneNumber(
            phoneNumber
          );

        if (!cleanPhone) {
          throw new Error(
            t(
              'أدخل رقم واتساب صحيحًا أولاً',
              'Enter a valid WhatsApp number first'
            )
          );
        }

        if (
          !customerWhatsAppSettings.enabled
        ) {
          throw new Error(
            t(
              'تنبيهات واتساب غير مفعلة',
              'WhatsApp alerts are disabled'
            )
          );
        }

        /*
         * إرسال الطلب إلى Backend.
         *
         * الرسالة نفسها يتم تكوينها في Backend
         * حتى لا نضع بيانات وهمية في الواجهة.
         */

        const result =
          await dispatchWhatsAppAlert({
            action:
              'MESSAGE',

            incidentTitle:
              t(
                'رسالة اختبار من نظام أمان',
                'Test message from Aman'
              ),

            reason:
              t(
                'اختبار اتصال واتساب والتحقق من وصول الرسائل',
                'WhatsApp connection and message delivery test'
              ),

            cameraName:
              eventCameraName,

            severity:
              'HIGH'
          });

        /*
         * لا نعتبر العملية ناجحة إلا إذا
         * dispatchWhatsAppAlert أكد النجاح.
         */

        if (
          !result?.success
        ) {
          throw new Error(
            t(
              'لم يؤكد الخادم نجاح إرسال الرسالة',
              'The server did not confirm message delivery'
            )
          );
        }

        setMessageSentFeedback(
          t(
            `تم إرسال الرسالة بنجاح إلى ${cleanPhone}`,
            `Message successfully sent to ${cleanPhone}`
          )
        );

      } catch (error: any) {

        console.error(
          '[WhatsApp Test Message] Failed:',
          error
        );

        setMessageSentFeedback(
          error?.message ||
          t(
            'تعذر إرسال الرسالة',
            'Message sending failed'
          )
        );

      } finally {

        setIsSendingMessage(false);

        setTimeout(
          () => {
            setMessageSentFeedback(null);
          },
          5000
        );
      }
    };

  /*
   * ============================================================
   * اختبار المكالمة
   *
   * هذا اختبار للواجهة الحالية وليس مكالمة WhatsApp
   * حقيقية عبر Evolution API.
   * ============================================================
   */

  const handleTestCall = () => {

    if (!phoneNumber.trim()) {
      setMessageSentFeedback(
        t(
          'أدخل رقم العميل أولاً',
          'Enter the customer number first'
        )
      );

      return;
    }

    triggerWhatsAppCall({
      title:
        t(
          'مكالمة اختبار',
          'Test Call'
        ),

      reason:
        t(
          'اختبار واجهة تنبيه المكالمة',
          'Call alert interface test'
        ),

      cameraName:
        eventCameraName,

      severity:
        'CRITICAL'
    });

    onClose();
  };

  /*
   * ============================================================
   * Render
   * ============================================================
   */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">

      <div
        id="whatsapp-preview-modal-dialog"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8"
      >

        {/* =====================================================
            Header
        ====================================================== */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">

          <div className="flex items-center gap-3">

            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-base font-bold text-slate-100">
                  {t(
                    'إدارة تنبيهات WhatsApp للعميل',
                    'Customer WhatsApp Alerts'
                  )}
                </h2>

                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  EVOLUTION API
                </span>

              </div>

              <p className="text-xs text-slate-400">
                {t(
                  'ربط رقم العميل وإرسال التنبيهات الأمنية من النظام',
                  'Connect the customer number and send security alerts from the system'
                )}
              </p>

            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* =====================================================
            Navigation
        ====================================================== */}

        <div className="flex border-b border-slate-800 bg-slate-950 px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto">

          <button
            type="button"
            onClick={() =>
              setActiveTab('CONFIG')
            }
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'CONFIG'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />

            <span>
              {t(
                'الإعدادات',
                'Settings'
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('CONNECT')
            }
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'CONNECT'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />

            <span>
              {t(
                'ربط الهاتف',
                'Connect Phone'
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('PREVIEW')
            }
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'PREVIEW'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />

            <span>
              {t(
                'معاينة',
                'Preview'
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('HISTORY')
            }
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'HISTORY'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />

            <span>
              {t(
                'السجل',
                'History'
              )}
            </span>

            {whatsappDispatchLogs.length >
              0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {
                  whatsappDispatchLogs.length
                }
              </span>
            )}
          </button>

        </div>

        {/* =====================================================
            Content
        ====================================================== */}

        <div className="p-6">

          {/* ===================================================
              CONFIG
          ==================================================== */}

          {activeTab === 'CONFIG' && (
            <form
              onSubmit={
                handleSaveSettings
              }
              className="space-y-5"
            >

              {/* Enable */}

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">

                <div className="space-y-0.5">

                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">

                    <Sparkles className="w-4 h-4 text-emerald-400" />

                    {t(
                      'تفعيل التنبيه التلقائي',
                      'Enable Automatic Alerts'
                    )}

                  </span>

                  <p className="text-[11px] text-slate-400">
                    {t(
                      'تفعيل أو إيقاف إرسال تنبيهات WhatsApp للعميل',
                      'Enable or disable WhatsApp alerts for the customer'
                    )}
                  </p>

                </div>

                <label className="relative inline-flex items-center cursor-pointer">

                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e =>
                      setEnabled(
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />

                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />

                </label>

              </div>

              {/* Customer phone/name */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-1.5">

                  <label className="text-xs font-bold text-slate-300">
                    {t(
                      'رقم واتساب العميل',
                      'Customer WhatsApp Number'
                    )}
                  </label>

                  <div className="relative">

                    <input
                      type="text"
                      dir="ltr"
                      value={phoneNumber}
                      onChange={e =>
                        setPhoneNumber(
                          e.target.value
                        )
                      }
                      placeholder="+رمز الدولة ثم الرقم"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                      required={
                        enabled
                      }
                    />

                    <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                      📱
                    </span>

                  </div>

                  <span className="text-[10px] text-slate-500">
                    {t(
                      'اكتب الرقم بالرمز الدولي بدون بيانات تجريبية',
                      'Enter the number with its international country code'
                    )}
                  </span>

                </div>

                <div className="space-y-1.5">

                  <label className="text-xs font-bold text-slate-300">
                    {t(
                      'اسم العميل',
                      'Customer Name'
                    )}
                  </label>

                  <input
                    type="text"
                    value={customerName}
                    onChange={e =>
                      setCustomerName(
                        e.target.value
                      )
                    }
                    placeholder={t(
                      'أدخل اسم العميل',
                      'Enter customer name'
                    )}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                  />

                </div>

              </div>

              {/* Instance */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-300">
                  {t(
                    'اسم جلسة WhatsApp',
                    'WhatsApp Instance Name'
                  )}
                </label>

                <input
                  type="text"
                  dir="ltr"
                  value={instanceName}
                  onChange={e =>
                    setInstanceName(
                      e.target.value
                    )
                  }
                  placeholder={t(
                    'اسم الجلسة الذي تم إنشاؤه في النظام',
                    'The WhatsApp instance name'
                  )}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                  required={enabled}
                />

              </div>

              {/* Alert mode */}

              <div className="space-y-2">

                <label className="text-xs font-bold text-slate-300 block">
                  {t(
                    'إجراء التنبيه',
                    'Alert Action'
                  )}
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {/* Message */}

                  <button
                    type="button"
                    onClick={() =>
                      setAlertMode(
                        'MESSAGE_ONLY'
                      )
                    }
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                      alertMode ===
                      'MESSAGE_ONLY'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >

                    <div className="space-y-1.5">

                      <div className="flex items-center justify-between">

                        <MessageSquare className="w-4 h-4 text-emerald-400" />

                        <span className="text-[10px] font-bold">
                          {t(
                            'رسالة فقط',
                            'Message Only'
                          )}
                        </span>

                      </div>

                      <p className="text-xs font-bold text-slate-200">
                        {t(
                          'إرسال رسالة',
                          'Send Message'
                        )}
                      </p>

                    </div>

                  </button>

                  {/* Call */}

                  <button
                    type="button"
                    onClick={() =>
                      setAlertMode(
                        'CALL_ONLY'
                      )
                    }
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                      alertMode ===
                      'CALL_ONLY'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >

                    <div className="space-y-1.5">

                      <div className="flex items-center justify-between">

                        <PhoneCall className="w-4 h-4 text-cyan-400" />

                        <span className="text-[10px] font-bold">
                          {t(
                            'مكالمة فقط',
                            'Call Only'
                          )}
                        </span>

                      </div>

                      <p className="text-xs font-bold text-slate-200">
                        {t(
                          'اتصال',
                          'Call'
                        )}
                      </p>

                    </div>

                  </button>

                  {/* Both */}

                  <button
                    type="button"
                    onClick={() =>
                      setAlertMode(
                        'MESSAGE_AND_CALL'
                      )
                    }
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                      alertMode ===
                      'MESSAGE_AND_CALL'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >

                    <div className="space-y-1.5">

                      <div className="flex items-center justify-between">

                        <div className="flex items-center gap-1">

                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />

                          <Phone className="w-3.5 h-3.5 text-cyan-400" />

                        </div>

                        <span className="text-[10px] font-bold text-amber-300">
                          {t(
                            'موصى به',
                            'Recommended'
                          )}
                        </span>

                      </div>

                      <p className="text-xs font-bold text-slate-200">
                        {t(
                          'رسالة + اتصال',
                          'Message + Call'
                        )}
                      </p>

                    </div>

                  </button>

                </div>

              </div>

              {/* Severity */}

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">

                <div>

                  <span className="text-slate-300 font-bold block">
                    {t(
                      'الحد الأدنى للخطورة',
                      'Minimum Severity'
                    )}
                  </span>

                  <span className="text-[11px] text-slate-500">
                    {t(
                      'لن يتم إرسال التنبيهات الأقل من المستوى المحدد',
                      'Alerts below this level will not be dispatched'
                    )}
                  </span>

                </div>

                <select
                  value={minSeverity}
                  onChange={e =>
                    setMinSeverity(
                      e.target.value as SeverityLevel
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >

                  <option value="MEDIUM">
                    {t(
                      'متوسط فأعلى',
                      'Medium+'
                    )}
                  </option>

                  <option value="HIGH">
                    {t(
                      'عالي فأعلى',
                      'High+'
                    )}
                  </option>

                  <option value="CRITICAL">
                    {t(
                      'حرج فقط',
                      'Critical Only'
                    )}
                  </option>

                </select>

              </div>

              {/* Save / Test */}

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >

                  <Save className="w-4 h-4" />

                  <span>
                    {t(
                      'حفظ الإعدادات',
                      'Save Settings'
                    )}
                  </span>

                </button>

                <button
                  type="button"
                  onClick={
                    handleTestSendMessage
                  }
                  disabled={
                    isSendingMessage
                  }
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >

                  <Send className="w-3.5 h-3.5" />

                  <span>
                    {isSendingMessage
                      ? t(
                          'جارٍ الإرسال...',
                          'Sending...'
                        )
                      : t(
                          'اختبار الرسالة',
                          'Test Message'
                        )}
                  </span>

                </button>

                <button
                  type="button"
                  onClick={
                    handleTestCall
                  }
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                >

                  <PhoneCall className="w-3.5 h-3.5" />

                  <span>
                    {t(
                      'اختبار واجهة المكالمة',
                      'Test Call UI'
                    )}
                  </span>

                </button>

              </div>

              {/* Saved */}

              {savedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs text-center font-medium flex items-center justify-center gap-2">

                  <CheckCircle2 className="w-4 h-4" />

                  <span>
                    {t(
                      'تم حفظ الإعدادات بنجاح',
                      'Settings saved successfully'
                    )}
                  </span>

                </div>
              )}

              {/* Feedback */}

              {messageSentFeedback && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-600/60 text-emerald-300 text-xs text-center font-medium">

                  {messageSentFeedback}

                </div>
              )}

            </form>
          )}

          {/* ===================================================
              CONNECT
          ==================================================== */}

          {activeTab === 'CONNECT' && (
            <div className="space-y-5">

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">

                <h3 className="font-bold text-slate-100 flex items-center gap-2">

                  <Wifi className="w-4 h-4 text-emerald-400" />

                  {t(
                    'ربط WhatsApp عبر Evolution API',
                    'Connect WhatsApp via Evolution API'
                  )}

                </h3>

                <p className="text-[11px] text-slate-400 mt-1">
                  {t(
                    'أنشئ جلسة ثم امسح رمز QR من الهاتف عبر الأجهزة المرتبطة.',
                    'Create a session and scan the QR code from WhatsApp Linked Devices.'
                  )}
                </p>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                <input
                  value={instanceName}
                  onChange={e =>
                    setInstanceName(
                      e.target.value
                    )
                  }
                  placeholder={t(
                    'اسم جلسة WhatsApp',
                    'WhatsApp instance name'
                  )}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                />

                <button
                  type="button"
                  onClick={
                    loadQr
                  }
                  disabled={
                    qrLoading
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >

                  <RefreshCw
                    className={`w-4 h-4 ${
                      qrLoading
                        ? 'animate-spin'
                        : ''
                    }`}
                  />

                  {qrLoading
                    ? t(
                        'جارٍ التحميل...',
                        'Loading...'
                      )
                    : t(
                        'إنشاء / تحديث QR',
                        'Create / Refresh QR'
                      )}

                </button>

              </div>

              <div className="text-center text-xs text-slate-400">

                {t(
                  'حالة الجلسة:',
                  'Session status:'
                )}

                <span className="font-mono text-emerald-300 mr-2 ml-2">
                  {waState}
                </span>

              </div>

              <div className="min-h-64 rounded-2xl bg-white flex items-center justify-center p-6">

                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="WhatsApp QR"
                    className="w-64 h-64 object-contain"
                  />
                ) : (
                  <div className="text-slate-500 text-xs text-center">

                    <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />

                    {t(
                      'لم يتم توليد رمز QR بعد',
                      'QR has not been generated yet'
                    )}

                  </div>
                )}

              </div>

              <p className="text-[10px] text-amber-300/80">

                {t(
                  'مفتاح Evolution API لا يظهر في المتصفح ويجب أن يبقى محفوظًا في Backend / Render.',
                  'The Evolution API key must never be exposed in the browser and must remain in the Backend / Render secrets.'
                )}

              </p>

            </div>
          )}

          {/* ===================================================
              PREVIEW
          ==================================================== */}

          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">

              <div className="flex items-center justify-between text-xs text-slate-400">

                <span>

                  {t(
                    'المستلم:',
                    'Recipient:'
                  )}

                  <strong className="text-slate-200 font-mono mr-2 ml-2">

                    {phoneNumber ||
                      t(
                        'غير محدد',
                        'Not configured'
                      )}

                  </strong>

                </span>

                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">

                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

                  Evolution API

                </span>

              </div>

              {/* Smartphone */}

              <div className="rounded-3xl border-4 border-slate-700 bg-[#0b141a] overflow-hidden shadow-2xl flex flex-col max-w-md mx-auto">

                <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-slate-800">

                  <div className="flex items-center gap-2.5">

                    <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>

                    <div>

                      <h4 className="text-xs font-bold text-slate-100">
                        Aman AI CCTV Agent
                      </h4>

                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">

                        <CheckCircle2 className="w-3 h-3" />

                        Evolution API

                      </span>

                    </div>

                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {eventTime}
                  </span>

                </div>

                <div className="p-4 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">

                  <div className="max-w-[95%] bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md space-y-2 text-xs leading-relaxed">

                    <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs pb-1 border-b border-emerald-700/50">

                      <ShieldAlert className="w-4 h-4" />

                      <span>
                        {t(
                          '🚨 تنبيه أمني',
                          '🚨 Security Alert'
                        )}
                      </span>

                    </div>

                    <div className="space-y-1 text-slate-100 text-[11px]">

                      <p>
                        <strong className="text-emerald-200">
                          {t(
                            'الكاميرا:',
                            'Camera:'
                          )}
                        </strong>{' '}
                        {eventCameraName}
                      </p>

                      <p>
                        <strong className="text-emerald-200">
                          {t(
                            'الوقت:',
                            'Time:'
                          )}
                        </strong>{' '}
                        {eventTime}
                      </p>

                      <p>
                        <strong className="text-emerald-200">
                          {t(
                            'الشخص:',
                            'Person:'
                          )}
                        </strong>{' '}
                        {eventPerson}
                      </p>

                      <p>
                        <strong className="text-emerald-200">
                          {t(
                            'الخطورة:',
                            'Severity:'
                          )}
                        </strong>{' '}
                        <span className="text-rose-300 font-bold">
                          {eventSeverity}
                        </span>
                      </p>

                      <p>
                        <strong className="text-emerald-200">
                          {t(
                            'السبب:',
                            'Reason:'
                          )}
                        </strong>{' '}
                        {eventReason}
                      </p>

                    </div>

                    {eventReviewUrl && (
                      <div className="pt-2 border-t border-emerald-700/60">

                        <a
                          href={
                            eventReviewUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-[#025144] border border-emerald-600/40 text-[11px] text-cyan-200 flex items-center justify-between hover:bg-[#036353]"
                        >

                          <span>
                            {t(
                              'مشاهدة تفاصيل الحادث',
                              'View Incident Details'
                            )}
                          </span>

                          <ExternalLink className="w-3.5 h-3.5" />

                        </a>

                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/80 pt-1">

                      <span>
                        {eventTime}
                      </span>

                      <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />

                    </div>

                  </div>

                </div>

              </div>

              {/* Test buttons */}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">

                <button
                  type="button"
                  onClick={
                    handleTestSendMessage
                  }
                  disabled={
                    isSendingMessage
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >

                  <Send className="w-3.5 h-3.5" />

                  <span>
                    {isSendingMessage
                      ? t(
                          'جارٍ الإرسال...',
                          'Sending...'
                        )
                      : t(
                          'إرسال اختبار',
                          'Send Test'
                        )}
                  </span>

                </button>

                <button
                  type="button"
                  onClick={
                    handleTestCall
                  }
                  className="px-4 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >

                  <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />

                  <span>
                    {t(
                      'اختبار واجهة المكالمة',
                      'Test Call UI'
                    )}
                  </span>

                </button>

              </div>

              {messageSentFeedback && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-600/60 text-emerald-300 text-xs text-center font-medium">

                  {messageSentFeedback}

                </div>
              )}

            </div>
          )}

          {/* ===================================================
              HISTORY
          ==================================================== */}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3">

              <div className="flex items-center justify-between text-xs text-slate-400">

                <span>
                  {t(
                    'سجل عمليات WhatsApp',
                    'WhatsApp Dispatch History'
                  )}
                </span>

                <span className="text-[11px] font-mono text-slate-500">

                  {
                    whatsappDispatchLogs.length
                  }

                </span>

              </div>

              {whatsappDispatchLogs.length ===
              0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">

                  {t(
                    'لا توجد عمليات إرسال مسجلة',
                    'No dispatch records'
                  )}

                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">

                  {whatsappDispatchLogs.map(
                    log => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                      >

                        <div className="flex items-center gap-3">

                          <div
                            className={`p-2 rounded-xl ${
                              log.action ===
                                'CALL' ||
                              log.action ===
                                'BOTH'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >

                            {log.action ===
                            'CALL' ? (
                              <Phone className="w-4 h-4" />
                            ) : log.action ===
                              'BOTH' ? (
                              <PhoneCall className="w-4 h-4" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}

                          </div>

                          <div>

                            <div className="flex items-center gap-2">

                              <span className="font-bold text-slate-200">
                                {
                                  log.incidentTitle
                                }
                              </span>

                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-900">
                                {
                                  log.severity
                                }
                              </span>

                            </div>

                            <p className="text-[11px] text-slate-400 font-mono">

                              {log.recipient}

                              {' • '}

                              {log.timestamp}

                            </p>

                            {log.notes && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {log.notes}
                              </p>
                            )}

                          </div>

                        </div>

                        <div className="text-left">

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {
                              log.status
                            }
                          </span>

                          <span className="block text-[10px] text-slate-500 font-mono mt-1">
                            {
                              log.provider
                            }
                          </span>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
