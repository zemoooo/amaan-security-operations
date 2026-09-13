import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  DeviceLicense, 
  LicensePeriod, 
  LicenseStatus, 
  SubscriberRecord, 
  SystemFinancialStats 
} from '../types';

interface LicenseContextType {
  machineId: string;
  currentLicense: DeviceLicense | null;
  isLocked: boolean;
  status: LicenseStatus;
  daysRemaining: number;
  hoursRemaining: number;
  loading: boolean;
  supportPhone: string;
  supportEmail: string;
  activateWithKey: (key: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  masterAdminUnlock: () => Promise<{ success: boolean; message?: string; error?: string }>;
  startFreeTrial: () => Promise<{ success: boolean; message?: string; error?: string }>;
  checkLicenseStatus: () => Promise<void>;
  copyMachineId: () => Promise<boolean>;
  getWhatsAppRequestUrl: (desiredPeriod?: string) => string;
  // Admin capabilities
  subscribers: SubscriberRecord[];
  financialStats: SystemFinancialStats;
  licensesHistory: DeviceLicense[];
  loadingAdmin: boolean;
  loadAdminSubscribers: () => Promise<void>;
  generateKeyForClient: (payload: {
    machineId: string;
    period: LicensePeriod;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    companyName?: string;
    amountPaid?: number;
    currency?: string;
    notes?: string;
  }) => Promise<{ success: boolean; activationKey?: string; whatsappUrl?: string; error?: string }>;
  simulateLock: (targetMachineId: string, lock: boolean) => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

// Generate deterministic hardware code for this machine
function getOrCreateMachineId(): string {
  try {
    const saved = localStorage.getItem('aman_cctv_hardware_code');
    if (saved && saved.startsWith('AMAN-DEV-')) {
      return saved;
    }
    // Generate unique hardware fingerprint seed
    const randPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newId = `AMAN-DEV-${randPart1}-${randPart2}`;
    localStorage.setItem('aman_cctv_hardware_code', newId);
    return newId;
  } catch {
    return 'AMAN-DEV-98A2-F41C';
  }
}

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [machineId] = useState<string>(getOrCreateMachineId);
  const [currentLicense, setCurrentLicense] = useState<DeviceLicense | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [status, setStatus] = useState<LicenseStatus>('ACTIVE');
  const [daysRemaining, setDaysRemaining] = useState<number>(30);
  const [hoursRemaining, setHoursRemaining] = useState<number>(720);
  const [loading, setLoading] = useState<boolean>(true);
  const [supportPhone] = useState<string>('+966500123456');
  const [supportEmail] = useState<string>('smarttechyeme@gmail.com');

  // Admin states
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
  const [financialStats, setFinancialStats] = useState<SystemFinancialStats>({
    totalRevenue: 1980,
    currency: 'SAR',
    activeSubscribersCount: 3,
    expiredCount: 1,
    trialCount: 1,
    totalKeysGenerated: 4,
  });
  const [licensesHistory, setLicensesHistory] = useState<DeviceLicense[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState<boolean>(false);

  // Check license status against backend
  const checkLicenseStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/license/status?machineId=${encodeURIComponent(machineId)}`);
      const data = await res.json();
      if (data.success) {
        setIsLocked(Boolean(data.isLocked));
        setStatus(data.status || 'ACTIVE');
        setCurrentLicense(data.license);
        setDaysRemaining(data.daysRemaining ?? 30);
        setHoursRemaining(data.hoursRemaining ?? 720);
      } else if (data.status === 'UNACTIVATED') {
        // If unactivated on server, check if we have an active default or register trial
        setIsLocked(true);
        setStatus('UNACTIVATED');
      }
    } catch (err) {
      console.warn('Could not contact license server, using local fallback:', err);
      // Fallback local status
      const savedLocal = localStorage.getItem(`aman_lic_${machineId}`);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          setCurrentLicense(parsed);
          setIsLocked(false);
          setStatus('ACTIVE');
        } catch {
          setIsLocked(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  // Initial check on mount
  useEffect(() => {
    checkLicenseStatus();
  }, [checkLicenseStatus]);

  // Activate program using key
  const activateWithKey = async (key: string) => {
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId,
          activationKey: key.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.unlocked) {
        setIsLocked(false);
        setStatus('ACTIVE');
        setCurrentLicense(data.license);
        try {
          localStorage.setItem(`aman_lic_${machineId}`, JSON.stringify(data.license));
        } catch {
          // ignore
        }
        await checkLicenseStatus();
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error || 'فشل تفعيل المفتاح' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في الاتصال بخادم التراخيص' };
    }
  };

  // Instant Super Admin Bypass & Unlock for smarttechyeme@gmail.com
  const masterAdminUnlock = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/master-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json();
      if (data.success && data.unlocked) {
        setIsLocked(false);
        setStatus('ACTIVE');
        setCurrentLicense(data.license);
        setDaysRemaining(365);
        setHoursRemaining(8760);
        try {
          localStorage.setItem(`aman_lic_${machineId}`, JSON.stringify(data.license));
        } catch {
          // ignore
        }
        await checkLicenseStatus();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'فشل فك قفل النظام' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في الاتصال بالخادم' };
    } finally {
      setLoading(false);
    }
  };

  // Instant 2-day free trial start & unlock
  const startFreeTrial = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      setLoading(true);
      const res = await fetch('/api/license/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json();
      if (data.success && data.unlocked) {
        setIsLocked(false);
        setStatus('ACTIVE');
        setCurrentLicense(data.license);
        setDaysRemaining(2);
        setHoursRemaining(48);
        try {
          localStorage.setItem(`aman_lic_${machineId}`, JSON.stringify(data.license));
        } catch {
          // ignore
        }
        await checkLicenseStatus();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'فشل بدء الفترة التجريبية' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في الاتصال بالخادم' };
    } finally {
      setLoading(false);
    }
  };

  // Copy Machine ID to clipboard
  const copyMachineId = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(machineId);
      return true;
    } catch {
      return false;
    }
  };

  // Generate WhatsApp contact link with pre-filled message
  const getWhatsAppRequestUrl = (desiredPeriod = 'شهر'): string => {
    const cleanPhone = supportPhone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `مرحباً إدارة نظام أمان للمراقبة والذكاء الاصطناعي (Smart Tech),\n` +
      `أرغب بتفعيل/تجديد ترخيص البرنامج على جهازي.\n` +
      `💻 كود الجهاز: ${machineId}\n` +
      `⏳ المدة المطلوبة: ${desiredPeriod}\n` +
      `يرجى تزويدي بمفتاح التفعيل المعتمد. شكراً لكم.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  // Admin: Load All Subscribers and Financial Stats
  const loadAdminSubscribers = useCallback(async () => {
    try {
      setLoadingAdmin(true);
      const res = await fetch('/api/admin/subscribers');
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.subscribers || []);
        if (data.financialStats) setFinancialStats(data.financialStats);
        if (data.licensesHistory) setLicensesHistory(data.licensesHistory);
      }
    } catch (err) {
      console.error('Failed to load admin subscribers:', err);
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  // Admin: Generate Key for Client
  const generateKeyForClient = async (payload: {
    machineId: string;
    period: LicensePeriod;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    companyName?: string;
    amountPaid?: number;
    currency?: string;
    notes?: string;
  }) => {
    try {
      const res = await fetch('/api/admin/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        await loadAdminSubscribers();
        // If the generated key was for the current device, auto-refresh status
        if (payload.machineId.trim().toUpperCase() === machineId.trim().toUpperCase()) {
          await checkLicenseStatus();
        }
        return {
          success: true,
          activationKey: data.activationKey,
          whatsappUrl: data.whatsappUrl,
        };
      }
      return { success: false, error: data.error || 'فشل توليد المفتاح' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في الاتصال بالخادم' };
    }
  };

  // Admin: Simulate Lock or Expire on a Machine
  const simulateLock = async (targetMachineId: string, lock: boolean) => {
    try {
      await fetch('/api/admin/simulate-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: targetMachineId, lock }),
      });
      if (targetMachineId.trim().toUpperCase() === machineId.trim().toUpperCase()) {
        setIsLocked(lock);
        setStatus(lock ? 'EXPIRED' : 'ACTIVE');
      }
      await loadAdminSubscribers();
    } catch (err) {
      console.error('Failed to simulate lock:', err);
    }
  };

  return (
    <LicenseContext.Provider
      value={{
        machineId,
        currentLicense,
        isLocked,
        status,
        daysRemaining,
        hoursRemaining,
        loading,
        supportPhone,
        supportEmail,
        activateWithKey,
        masterAdminUnlock,
        startFreeTrial,
        checkLicenseStatus,
        copyMachineId,
        getWhatsAppRequestUrl,
        subscribers,
        financialStats,
        licensesHistory,
        loadingAdmin,
        loadAdminSubscribers,
        generateKeyForClient,
        simulateLock,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within LicenseProvider');
  }
  return context;
};
