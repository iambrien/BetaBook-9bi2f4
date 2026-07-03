import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { TabView } from '@/types';
import { Home, BarChart2, List, MessageCircle, Plus, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

// Left 2 tabs
const LEFT_TABS: { id: TabView; icon: typeof Home; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'analytics', icon: BarChart2, label: 'Analytics' },
];

// Right 2 tabs
const RIGHT_TABS: { id: TabView; icon: typeof Home; label: string }[] = [
  { id: 'transactions', icon: List, label: 'History' },
  { id: 'chat', icon: MessageCircle, label: 'AI Chat' },
];

const ALL_TABS = [...LEFT_TABS, ...RIGHT_TABS];

interface PillState { left: number; width: number }

interface BottomNavProps {
  onCashIn: () => void;
  onCashOut: () => void;
  onOpenCalculator: () => void;
  fabOpen: boolean;
  setFabOpen: (v: boolean) => void;
}

export default function BottomNav({ onCashIn, onCashOut, onOpenCalculator, fabOpen, setFabOpen }: BottomNavProps) {
  const { activeTab, setActiveTab } = useApp();
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<PillState | null>(null);

  const updatePill = () => {
    const activeIndex = ALL_TABS.findIndex(t => t.id === activeTab);
    if (activeIndex === -1) return;
    const el = tabRefs.current[activeIndex];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPill({ left: elRect.left - navRect.left, width: elRect.width });
  };

  useEffect(() => {
    const raf = requestAnimationFrame(updatePill);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const handler = () => updatePill();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleTabClick = (tab: TabView, index: number) => {
    setFabOpen(false);
    setActiveTab(tab);
    if ('vibrate' in navigator) navigator.vibrate(10);
    const el = tabRefs.current[index];
    const nav = navRef.current;
    if (el && nav) {
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setPill({ left: elRect.left - navRect.left, width: elRect.width });
    }
  };

  const handleCashIn = () => { setFabOpen(false); onCashIn(); };
  const handleCashOut = () => { setFabOpen(false); onCashOut(); };
  const handleCalc = () => { setFabOpen(false); onOpenCalculator(); };
  const toggleFab = () => {
    setFabOpen(!fabOpen);
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  return (
    <>
      {/* Spacer so content doesn't hide behind nav */}
      <div className="h-28 md:hidden" />

      {/* Backdrop to close FAB when tapping outside */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-[45] md:hidden"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB pop-out buttons — render above the nav, centered */}
      {fabOpen && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[55] md:hidden flex flex-col items-center gap-2 animate-[pop-in_0.22s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <button
            onClick={handleCashIn}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-white text-sm bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all whitespace-nowrap"
          >
            <TrendingUp className="w-4 h-4" /> Cash In
          </button>
          <button
            onClick={handleCalc}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-white text-sm bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all whitespace-nowrap"
          >
            <Calculator className="w-4 h-4" /> Calculator
          </button>
          <button
            onClick={handleCashOut}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-white text-sm bg-red-500 hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap"
          >
            <TrendingDown className="w-4 h-4" /> Cash Out
          </button>
        </div>
      )}

      {/* Glass Nav Bar */}
      <nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[calc(100%-32px)] max-w-[440px] rounded-[28px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.18),0_1px_0_rgba(255,255,255,0.4)_inset] overflow-visible"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div ref={navRef} className="relative flex items-center h-[62px] px-1">
          {/* Sliding pill highlight */}
          {pill && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[44px] rounded-[20px] bg-blue-500/10 pointer-events-none transition-all duration-300"
              style={{
                left: pill.left,
                width: pill.width,
                transition: 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), width 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            />
          )}

          {/* Left tabs */}
          {LEFT_TABS.map((tab, i) => (
            <NavTab
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              ref={el => { tabRefs.current[i] = el; }}
              onClick={() => handleTabClick(tab.id, i)}
            />
          ))}

          {/* Center FAB — embedded in nav */}
          <div className="flex-shrink-0 flex items-center justify-center w-16 mx-1">
            <button
              onClick={toggleFab}
              className={cn(
                'w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90',
                fabOpen
                  ? 'bg-red-500 shadow-red-300/50 rotate-45'
                  : 'bg-blue-500 shadow-blue-300/50 hover:bg-blue-600'
              )}
              style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s' }}
            >
              <Plus
                className="text-white transition-transform duration-300"
                style={{ width: 26, height: 26, strokeWidth: 2.5 }}
              />
            </button>
          </div>

          {/* Right tabs */}
          {RIGHT_TABS.map((tab, i) => (
            <NavTab
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              ref={el => { tabRefs.current[i + 2] = el; }}
              onClick={() => handleTabClick(tab.id, i + 2)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

interface NavTabProps {
  tab: { id: TabView; icon: typeof Home; label: string };
  active: boolean;
  onClick: () => void;
}

const NavTab = React.forwardRef<HTMLButtonElement, NavTabProps>(({ tab, active, onClick }, ref) => {
  const [pressed, setPressed] = useState(false);
  const Icon = tab.icon;

  return (
    <button
      ref={ref}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] select-none outline-none"
      style={{
        transform: pressed ? 'scale(0.90)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Icon
        style={{
          width: 20, height: 20,
          transform: active ? 'scale(1.18)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), color 0.2s',
          color: active ? '#3b82f6' : '#9ca3af',
          strokeWidth: active ? 2.5 : 1.8,
        }}
      />
      <span
        className="text-[9.5px] font-semibold tracking-wide transition-colors duration-200"
        style={{ color: active ? '#3b82f6' : '#9ca3af' }}
      >
        {tab.label}
      </span>
    </button>
  );
});

NavTab.displayName = 'NavTab';
