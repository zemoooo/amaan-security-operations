import React, { createContext, useContext, useState } from 'react';
import { User, Tenant, UserRole, AuditLog } from '../types';
import * as db from '../lib/supabaseServices';

const DEFAULT_TENANT: Tenant = {
  id: 'default-tenant',
  name: 'مساحة العمل (غير متصل)',
  nameEn: 'Workspace (Offline)',
  planId: 'FREE',
  status: 'ACTIVE',
  trialEndsAt: new Date().toISOString(),
  subscriptionEndsAt: new Date().toISOString(),
  cameraLimit: 0,
  deviceLimit: 0,
  employeeLimit: 0,
  retentionDays: 0,
  modules: {
    inventoryVision: false,
    attendanceTracking: false,
    theftDetection: false,
    behaviorAnalytics: false,
    whatsappAlerts: false,
    windowsAgent: false
  }
};

const DEFAULT_USER: User = {
  id: 'guest',
  tenantId: 'default-tenant',
  name: 'زائر',
  email: '',
  role: 'OWNER', // Provide necessary role to prevent UI lockouts if DB is empty
  permissions: [],
  isActive: true,
  createdAt: new Date().toISOString()
};

interface AuthContextType {
  currentUser: User;
  currentTenant: Tenant;
  availableTenants: Tenant[];
  availableUsers: User[];
  auditLogs: AuditLog[];
  switchUser: (userId: string) => void;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permission: string) => boolean;
  addAuditLog: (action: AuditLog['action'], entity: string, details: string, entityId?: string) => void;
  registerUser: (data: {
    email: string;
    password?: string;
    name: string;
    phone?: string;
    companyName?: string;
    machineId?: string;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  loginUser: (email: string, password?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logoutUser: () => void;
  isOwner: boolean;
  isSupervisor: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<User[]>([DEFAULT_USER]);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    // Try to restore saved user from localStorage
    try {
      const saved = localStorage.getItem('aman_auth_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_USER;
  });
  const [currentTenant, setCurrentTenant] = useState<Tenant>(DEFAULT_TENANT);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([DEFAULT_TENANT]);

  React.useEffect(() => {
    async function loadAuthData() {
      const fetchedUsers = await db.fetchUsers();
      if (fetchedUsers.length > 0) {
        setUsersList(fetchedUsers);
      }
      
      const fetchedTenants = await db.fetchTenants();
      if (fetchedTenants.length > 0) {
        setAvailableTenants(fetchedTenants);
        if (currentTenant.id === DEFAULT_TENANT.id) {
          setCurrentTenant(fetchedTenants[0]);
        }
      }
      
      setAuditLogs(await db.fetchAuditLogs());
    }
    
    loadAuthData();
  }, []);

  const isOwner = currentUser.role === 'OWNER';
  const isSupervisor = currentUser.role === 'SUPERVISOR';
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const registerUser = async (data: {
    email: string;
    password?: string;
    name: string;
    phone?: string;
    companyName?: string;
    machineId?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success && result.user) {
        const newUser: User = {
          id: result.user.id,
          tenantId: 'tenant-aman-logistics',
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          phone: result.user.phone,
          permissions: [
            'manage_subscription',
            'manage_devices',
            'manage_cameras',
            'view_all_reports',
            'view_audit_logs',
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        setUsersList(prev => [newUser, ...prev.filter(u => u.email !== newUser.email)]);
        setCurrentUser(newUser);
        try {
          localStorage.setItem('aman_auth_user', JSON.stringify(newUser));
        } catch {
          // ignore
        }

        // Add audit log
        addAuditLog('LOGIN', 'UserRegistration', `تسجيل حساب جديد بالبريد: ${newUser.email} (${newUser.name})`);
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || 'فشل التسجيل' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في الاتصال بالخادم' };
    }
  };

  const loginUser = async (email: string, password?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (result.success && result.user) {
        const loggedUser: User = {
          id: result.user.id,
          tenantId: result.user.role === 'SUPER_ADMIN' ? 'system-central' : 'tenant-aman-logistics',
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          phone: result.user.phone,
          permissions: result.user.role === 'SUPER_ADMIN' ? ['all_superadmin_rights'] : ['manage_cameras', 'view_all_reports'],
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        setUsersList(prev => [loggedUser, ...prev.filter(u => u.email !== loggedUser.email)]);
        setCurrentUser(loggedUser);
        try {
          localStorage.setItem('aman_auth_user', JSON.stringify(loggedUser));
        } catch {
          // ignore
        }

        addAuditLog('LOGIN', 'UserLogin', `تسجيل دخول ناجح للمستخدم: ${loggedUser.email}`);
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || 'بيانات الدخول غير صحيحة' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ في تسجيل الدخول' };
    }
  };

  const logoutUser = () => {
    try {
      localStorage.removeItem('aman_auth_user');
    } catch {
      // ignore
    }
    // Switch to first default or guest
    setCurrentUser(DEFAULT_USER);
    addAuditLog('LOGOUT', 'UserSession', `تسجيل خروج المستخدم: ${currentUser.email}`);
  };

  const addAuditLog = (
    action: AuditLog['action'],
    entity: string,
    details: string,
    entityId?: string
  ) => {
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);
    
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: currentTenant.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entity,
      entityId,
      timestamp: formattedDate,
      ipAddress: '197.12.44.89 (Current Session)',
      userAgent: navigator.userAgent.includes('Windows') ? 'Chrome / Windows 11' : navigator.userAgent.slice(0, 30),
      details,
    };

    // Append to audit log state (never mutated or deleted!)
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const switchUser = (userId: string) => {
    const user = usersList.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      try {
        localStorage.setItem('aman_auth_user', JSON.stringify(user));
      } catch {
        // ignore
      }
      if (user.role === 'SUPER_ADMIN') {
        // Super admin views system
      } else {
        const matchingTenant = availableTenants.find(t => t.id === user.tenantId);
        if (matchingTenant) {
          setCurrentTenant(matchingTenant);
        }
      }
      addAuditLog('LOGIN', 'UserSession', `تم التبديل إلى المستخدم: ${user.name} (${user.role})`);
    }
  };

  const switchTenant = (tenantId: string) => {
    const tenant = availableTenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      addAuditLog('LOGIN', 'TenantContext', `تم التبديل إلى مساحة المستأجر: ${tenant.name}`);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (isSuperAdmin) return true;
    if (isOwner) return true;
    return currentUser.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTenant,
        availableTenants,
        availableUsers: usersList,
        auditLogs,
        switchUser,
        switchTenant,
        hasPermission,
        addAuditLog,
        registerUser,
        loginUser,
        logoutUser,
        isOwner,
        isSupervisor,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
