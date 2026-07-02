import { useApp } from '@/contexts/AppContext';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import FABMenu from './FABMenu';
import HomePage from '@/pages/HomePage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import TransactionsPage from '@/pages/TransactionsPage';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';
import AttendantView from '@/pages/AttendantView';
import CalculatorPage from '@/pages/CalculatorPage';
import AttendantPinModal from '@/components/features/AttendantPinModal';
import CashInModal from '@/components/features/CashInModal';
import CashOutModal from '@/components/features/CashOutModal';
import { useState } from 'react';
import { useAttendantNotifications } from '@/hooks/useAttendantNotifications';

export default function AppLayout() {
  const { activeTab, isAttendantMode } = useApp();
  const [showPinModal, setShowPinModal] = useState(false);
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);

  // Owner-side: listen for attendant activity → toast notifications
  useAttendantNotifications();

  // ── Attendant Mode: completely locked UI ──────────────────────────────────
  if (isAttendantMode) {
    return (
      <div className="h-full bg-slate-50 overflow-y-auto">
        <AttendantView />
      </div>
    );
  }

  // ── Owner Mode: full layout ───────────────────────────────────────────────
  const renderPage = () => {
    switch (activeTab) {
      case 'home':          return <HomePage />;
      case 'analytics':    return <AnalyticsPage />;
      case 'transactions': return <TransactionsPage />;
      case 'chat':         return <ChatPage />;
      case 'calculator':   return <CalculatorPage />;
      case 'settings':     return <SettingsPage onOpenPinModal={() => setShowPinModal(true)} />;
      default:             return <HomePage />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar onOpenPinModal={() => setShowPinModal(true)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto scrollbar-hide pb-32 md:pb-6">
          {renderPage()}
        </main>
      </div>

      {/* Mobile: Liquid Glass Bottom Nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>

      {/* Mobile FAB — stacks upward above glass nav */}
      <div className="md:hidden fixed bottom-[80px] left-1/2 -translate-x-1/2 z-[60]">
        <FABMenu
          cashInOpen={cashInOpen}
          cashOutOpen={cashOutOpen}
          onCashIn={() => setCashInOpen(true)}
          onCashOut={() => setCashOutOpen(true)}
          onCashInClose={() => setCashInOpen(false)}
          onCashOutClose={() => setCashOutOpen(false)}
        />
      </div>

      {/* Desktop FAB */}
      <div className="hidden md:block fixed bottom-8 right-8 z-40">
        <FABMenu
          cashInOpen={cashInOpen}
          cashOutOpen={cashOutOpen}
          onCashIn={() => setCashInOpen(true)}
          onCashOut={() => setCashOutOpen(true)}
          onCashInClose={() => setCashInOpen(false)}
          onCashOutClose={() => setCashOutOpen(false)}
          desktop
        />
      </div>

      {/* Cash modals */}
      {cashInOpen && (
        <CashInModal onClose={() => setCashInOpen(false)} />
      )}
      {cashOutOpen && (
        <CashOutModal onClose={() => setCashOutOpen(false)} />
      )}

      {/* Attendant PIN Modal */}
      {showPinModal && (
        <AttendantPinModal onClose={() => setShowPinModal(false)} />
      )}
    </div>
  );
}
