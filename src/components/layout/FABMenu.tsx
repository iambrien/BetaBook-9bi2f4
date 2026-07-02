import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABMenuProps {
  cashInOpen: boolean;
  cashOutOpen: boolean;
  onCashIn: () => void;
  onCashOut: () => void;
  onCashInClose: () => void;
  onCashOutClose: () => void;
  desktop?: boolean;
}

export default function FABMenu({
  cashInOpen, cashOutOpen, onCashIn, onCashOut,
  onCashInClose, onCashOutClose, desktop
}: FABMenuProps) {
  const [fabOpen, setFabOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    if (fabOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fabOpen]);

  // Close fab when a modal opens
  useEffect(() => {
    if (cashInOpen || cashOutOpen) setFabOpen(false);
  }, [cashInOpen, cashOutOpen]);

  const handleCashIn = () => { setFabOpen(false); onCashIn(); };
  const handleCashOut = () => { setFabOpen(false); onCashOut(); };

  if (desktop) {
    return (
      <div ref={menuRef} className="flex flex-col items-center gap-3">
        {fabOpen && (
          <>
            <button onClick={handleCashIn}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-white text-sm bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all animate-[pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards] whitespace-nowrap">
              <TrendingUp className="w-4 h-4" />
              Cash In
            </button>
            <button onClick={handleCashOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-white text-sm bg-red-500 hover:bg-red-600 active:scale-95 transition-all animate-[pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards] whitespace-nowrap">
              <TrendingDown className="w-4 h-4" />
              Cash Out
            </button>
          </>
        )}
        <button onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95',
            fabOpen ? 'rotate-45 bg-red-500 shadow-red-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
          )}>
          <Plus className="w-7 h-7 text-white transition-transform duration-300" />
        </button>
      </div>
    );
  }

  // ── Mobile FAB: centered above glass nav ─────────────────────────────────
  return (
    <div ref={menuRef} className="flex flex-col items-center gap-2">
      {/* Pop-out buttons appear above the FAB */}
      {fabOpen && (
        <div className="flex gap-3 mb-1 animate-[pop-in_0.22s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <button onClick={handleCashIn}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-white text-xs bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all whitespace-nowrap">
            <TrendingUp className="w-3.5 h-3.5" />
            Cash In
          </button>
          <button onClick={handleCashOut}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-white text-xs bg-red-500 hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap">
            <TrendingDown className="w-3.5 h-3.5" />
            Cash Out
          </button>
        </div>
      )}

      {/* Main FAB button */}
      <button onClick={() => setFabOpen(!fabOpen)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95',
          fabOpen ? 'rotate-45 bg-red-500 shadow-red-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
        )}>
        <Plus className="w-7 h-7 text-white transition-transform duration-300" />
      </button>
    </div>
  );
}
