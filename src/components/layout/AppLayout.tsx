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
  const { activeTab, setActiveTab, isAttendantMode } = useApp();
  const [showPinModal, setShowPinModal] = useState(false);
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Owner-side: listen for attendant activity → toast notifications
  useAttendantNotifications();

  // Close FAB when a modal opens
  const openCashIn = () => { setFabOpen(false); setCashInOpen(true); };
  const openCashOut = () => { setFabOpen(false); setCashOutOpen(true); };
  const openCalculator = () => { setFabOpen(false); setActiveTab('calculator'); };

  const closeCashIn = () => setCashInOpen(false);
  const closeCashOut = () => setCashOutOpen(false);

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
        <main className="flex-1 overflow-y-auto scrollbar-hide md:pb-6">
          {renderPage()}
        </main>
      </div>

      {/* Mobile: Liquid Glass Bottom Nav with embedded FAB */}
      <div className="md:hidden">
        <BottomNav
          onCashIn={openCashIn}
          onCashOut={openCashOut}
          onOpenCalculator={openCalculator}
          fabOpen={fabOpen}
          setFabOpen={setFabOpen}
        />
      </div>

      {/* Desktop FAB — bottom right */}
      <div className="hidden md:block fixed bottom-8 right-8 z-40">
        <FABMenu
          onCashIn={openCashIn}
          onCashOut={openCashOut}
          onOpenCalculator={openCalculator}
        />
      </div>

      {/* Cash modals */}
      {cashInOpen && <CashInModal onClose={closeCashIn} />}
      {cashOutOpen && <CashOutModal onClose={closeCashOut} />}

      {/* Attendant PIN Modal */}
      {showPinModal && <AttendantPinModal onClose={() => setShowPinModal(false)} />}
    </div>
  );
}
