import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABMenuProps {
  onCashIn: () => void;
  onCashOut: () => void;
  onOpenCalculator: () => void;
}

/**
 * Desktop-only FAB — fixed bottom-right corner.
 * The mobile FAB is embedded directly inside BottomNav.
 */
export default function FABMenu({ onCashIn, onCashOut, onOpenCalculator }: FABMenuProps) {
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

  const handleCashIn = () => { setFabOpen(false); onCashIn(); };
  const handleCashOut = () => { setFabOpen(false); onCashOut(); };
  const handleCalc = () => { setFabOpen(false); onOpenCalculator(); };

  return (
    <div ref={menuRef} className="flex flex-col items-center gap-3">
      {fabOpen && (
        <>
          <button onClick={handleCashIn}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-white text-sm bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards] whitespace-nowrap">
            <TrendingUp className="w-4 h-4" /> Cash In
          </button>
          <button onClick={handleCalc}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-white text-sm bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards] whitespace-nowrap">
            <Calculator className="w-4 h-4" /> Calculator
          </button>
          <button onClick={handleCashOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-white text-sm bg-red-500 hover:bg-red-600 active:scale-95 transition-all animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards] whitespace-nowrap">
            <TrendingDown className="w-4 h-4" /> Cash Out
          </button>
        </>
      )}
      <button
        onClick={() => setFabOpen(!fabOpen)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95',
          fabOpen ? 'bg-red-500 shadow-red-200/60 rotate-45' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200/60'
        )}
        style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s' }}
      >
        <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
