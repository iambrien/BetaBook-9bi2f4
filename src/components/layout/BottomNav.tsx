
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { TabView } from '@/types';
import { Home, BarChart2, List, MessageCircle, Settings, Calculator } from 'lucide-react';
import React from 'react';

interface BottomNavProps {
  onOpenTools?: () => void;
}

// Nav tabs — Chat gets its own slot now; Tools triggers slide-up panel
const LEFT_TABS: { id: TabView; icon: typeof Home; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'analytics', icon: BarChart2, label: 'Analytics' },
];

const RIGHT_TABS: { id: TabView; icon: typeof Home; label: string }[] = [
  { id: 'transactions', icon: List, label: 'History' },
  { id: 'chat', icon: MessageCircle, label: 'AI Chat' },
];

interface PillState { left: number; width: number }

export default function BottomNav({ onOpenTools }: BottomNavProps) {
  const { activeTab, setActiveTab } = useApp();
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<PillState | null>(null);

  const allTabs = [...LEFT_TABS, ...RIGHT_TABS];

  const updatePill = () => {
    const activeIndex = allTabs.findIndex(t => t.id === activeTab);
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
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [activeTab]);

  const handleTabClick = (tab: TabView, index: number) => {
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

  return (
    <>
      <div className="h-24 md:hidden" />

      <nav
        className="
          fixed bottom-6 left-1/2 -translate-x-1/2 z-50
          md:hidden
          w-[calc(100%-32px)] max-w-[440px]
          rounded-[28px]
          border border-white/60
          shadow-[0_8px_32px_rgba(0,0,0,0.18),0_1px_0_rgba(255,255,255,0.4)_inset]
          overflow-visible
        "
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div ref={navRef} className="relative flex items-center h-[60px] px-2">
          {/* Sliding pill */}
          {pill && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[44px] rounded-[20px] bg-blue-500/10 pointer-events-none"
              style={{
                left: pill.left,
                width: pill.width,
                transition: 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), width 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            />
          )}

          {/* Left two tabs */}
          {LEFT_TABS.map((tab, i) => (
            <NavTab
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              ref={el => { tabRefs.current[i] = el; }}
              onClick={() => handleTabClick(tab.id, i)}
            />
          ))}

          {/* Center: Tools button (calculator) + FAB spacer */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-16">
            <button
              onClick={onOpenTools}
              className="w-8 h-8 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center hover:bg-blue-100 transition-all active:scale-90"
              title="Tools · Calculator"
              aria-label="Open Tools"
            >
              <Calculator className="w-4 h-4 text-blue-500" strokeWidth={2} />
            </button>
          </div>

          {/* Right two tabs */}
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
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
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
