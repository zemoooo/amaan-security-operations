import React, { useState } from 'react';
import { LanguageThemeProvider, useLanguageTheme } from './context/LanguageThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LicenseProvider, useLicense } from './context/LicenseContext';
import { LiveCCTVProvider, useLiveCCTV } from './context/LiveCCTVContext';
import { Navbar } from './components/Navbar';
import { Sidebar, AppView } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { CamerasView } from './views/CamerasView';
import { SecurityView } from './views/SecurityView';
import { AttendanceView } from './views/AttendanceView';
import { InventoryView } from './views/InventoryView';
import { DevicesView } from './views/DevicesView';
import { AuditLogsView } from './views/AuditLogsView';
import { SubscriptionsView } from './views/SubscriptionsView';
import { AdminSubscribersView } from './views/AdminSubscribersView';
import { SettingsView } from './views/SettingsView';
import { EvidenceVideoModal } from './components/EvidenceVideoModal';
import { ZoneDrawerModal } from './components/ZoneDrawerModal';
import { FacePunchModal } from './components/FacePunchModal';
import { WhatsAppPreviewModal } from './components/WhatsAppPreviewModal';
import { WhatsAppIncomingCallModal } from './components/WhatsAppIncomingCallModal';
import { WindowsAgentModal } from './components/WindowsAgentModal';
import { ReportGeneratorModal } from './components/ReportGeneratorModal';
import { SoftwareLockModal } from './components/SoftwareLockModal';
import { AuthModal } from './components/AuthModal';
import { Camera } from './types';
import { PhoneCall, MessageSquare, X } from 'lucide-react';

import { OfflineIndicator } from './components/OfflineIndicator';

import { AuthView } from './views/AuthView';

function MainApp() {
  const { lang, theme } = useLanguageTheme();
  const { isLocked } = useLicense();
  const { currentUser, isSuperAdmin } = useAuth();
  const { 
    activeEvidenceIncident, 
    setActiveEvidenceIncident, 
    selectedCamera, 
    cameras,
    whatsappCallState,
    acceptWhatsAppCall,
    declineWhatsAppCall,
    lastWhatsAppToast,
    dismissWhatsAppToast,
    securityIncidents,
  } = useLiveCCTV();

  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  // Modals state
  const [zoneDrawerCamera, setZoneDrawerCamera] = useState<Camera | null>(null);
  const [showFacePunchModal, setShowFacePunchModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showWindowsAgentModal, setShowWindowsAgentModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // إدارة النظام والمشتركين متاحة حصراً للإدارة العامة (SUPER_ADMIN).
  // إذا حاول مستخدم عادي الوصول إليها مباشرةً، نعيده للوحة التحكم.
  React.useEffect(() => {
    if (currentView === 'admin_subscribers' && !isSuperAdmin) {
      setCurrentView('dashboard');
    }
  }, [currentView, isSuperAdmin]);

  const handleOpenZoneDrawer = (cam?: Camera) => {
    setZoneDrawerCamera(cam || selectedCamera || cameras[0]);
  };

  if (currentUser.id === 'guest') {
    return <AuthView />;
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white ${theme}`}>
      {/* Top Enterprise Header */}
      <Navbar
        onOpenFacePunch={() => setShowFacePunchModal(true)}
        onOpenWhatsApp={() => setShowWhatsAppModal(true)}
        onOpenWindowsAgent={() => setShowWindowsAgentModal(true)}
        onOpenReports={() => setShowReportsModal(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {/* Main Container: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
        />

        {/* Dynamic View Surface */}
        <main className="flex-1 overflow-y-auto bg-slate-950/60 pb-16">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentView}
              onOpenZoneDrawer={() => handleOpenZoneDrawer()}
            />
          )}

          {currentView === 'cameras' && (
            <CamerasView
              onOpenZoneDrawer={handleOpenZoneDrawer}
            />
          )}

          {currentView === 'security' && (
            <SecurityView 
              onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            />
          )}

          {currentView === 'attendance' && (
            <AttendanceView
              onOpenFacePunch={() => setShowFacePunchModal(true)}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView
              onOpenZoneDrawer={() => handleOpenZoneDrawer()}
            />
          )}

          {currentView === 'devices' && (
            <DevicesView
              onOpenWindowsAgentModal={() => setShowWindowsAgentModal(true)}
            />
          )}

          {currentView === 'admin_subscribers' && isSuperAdmin && (
            <AdminSubscribersView />
          )}

          {currentView === 'audit' && (
            <AuditLogsView />
          )}

          {currentView === 'subscriptions' && (
            <SubscriptionsView />
          )}

          {currentView === 'settings' && (
            <SettingsView 
              onOpenWhatsAppModal={() => setShowWhatsAppModal(true)}
            />
          )}
        </main>
      </div>

      {/* Floating WhatsApp Real-Time Toast Banner */}
      {lastWhatsAppToast?.visible && (
        <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-40 max-w-md bg-slate-900 border border-emerald-500/80 rounded-2xl shadow-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-slate-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex-shrink-0">
              {lastWhatsAppToast.type === 'CALL' ? <PhoneCall className="w-4 h-4 animate-bounce" /> : <MessageSquare className="w-4 h-4" />}
            </div>
            <p className="text-[11px] leading-snug">{lastWhatsAppToast.message}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold border border-emerald-800 transition cursor-pointer"
            >
              عرض
            </button>
            <button
              type="button"
              onClick={dismissWhatsAppToast}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-slate-950/95 border-t border-slate-800 flex items-center justify-around z-30 px-2 backdrop-blur-md">
        {[
          { id: 'dashboard' as AppView, label: 'الرئيسية' },
          { id: 'cameras' as AppView, label: 'الكاميرات' },
          ...(isSuperAdmin ? [{ id: 'admin_subscribers' as AppView, label: 'المشتركين' }] : []),
          { id: 'security' as AppView, label: 'الأمن' },
          { id: 'attendance' as AppView, label: 'الحضور' },
          { id: 'subscriptions' as AppView, label: 'الباقات' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition ${
              currentView === item.id ? 'text-cyan-400 bg-slate-900' : 'text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Fullscreen High-Security Software Lockout Screen */}
      <SoftwareLockModal onOpenAuthModal={() => setShowAuthModal(true)} />

      {/* Global Offline Indicator */}
      <OfflineIndicator />

      {/* Email Registration & Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Global Interactive Modals */}
      {activeEvidenceIncident && (
        <EvidenceVideoModal
          incident={activeEvidenceIncident}
          onClose={() => setActiveEvidenceIncident(null)}
        />
      )}

      {zoneDrawerCamera && (
        <ZoneDrawerModal
          camera={zoneDrawerCamera}
          onClose={() => setZoneDrawerCamera(null)}
        />
      )}

      {showFacePunchModal && (
        <FacePunchModal
          onClose={() => setShowFacePunchModal(false)}
        />
      )}

      {showWhatsAppModal && (
        <WhatsAppPreviewModal
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {whatsappCallState?.active && (
        <WhatsAppIncomingCallModal
          callState={whatsappCallState}
          onAccept={acceptWhatsAppCall}
          onDecline={declineWhatsAppCall}
          onOpenEvidence={(incId) => {
            const target = securityIncidents.find(i => i.id === incId) || securityIncidents[0];
            if (target) setActiveEvidenceIncident(target);
          }}
        />
      )}

      {showWindowsAgentModal && (
        <WindowsAgentModal
          onClose={() => setShowWindowsAgentModal(false)}
        />
      )}

      {showReportsModal && (
        <ReportGeneratorModal
          onClose={() => setShowReportsModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageThemeProvider>
      <AuthProvider>
        <LicenseProvider>
          <LiveCCTVProvider>
            <MainApp />
          </LiveCCTVProvider>
        </LicenseProvider>
      </AuthProvider>
    </LanguageThemeProvider>
  );
}

