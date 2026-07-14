import { useState } from 'react';
import { InlineCalculator } from '@/components/features/ToolsPanel';
import CashInModal from '@/components/features/CashInModal';
import CashOutModal from '@/components/features/CashOutModal';
import { Calculator, ArrowLeft } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useSwipeBack } from '@/hooks/useSwipeBack';

// ── Quick amount preset buttons ───────────────────────────────────────────────
const QUICK_AMOUNTS = [
  { label: '₦500', value: 500 },
  { label: '₦1K', value: 1000 },
  { label: '₦2K', value: 2000 },
  { label: '₦5K', value: 5000 },
  { label: '₦10K', value: 10000 },
  { label: '₦20K', value: 20000 },
  { label: '₦50K', value: 50000 },
  { label: '₦100K', value: 100000 },
];

interface QuickAmountBarProps {
  onSelect: (value: number) => void;
}

function QuickAmountBar({ onSelect }: QuickAmountBarProps) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
        Quick Amounts
      </p>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {QUICK_AMOUNTS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-all shadow-sm"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const { setActiveTab } = useApp();
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [prefillIn, setPrefillIn] = useState<number | undefined>();
  const [prefillOut, setPrefillOut] = useState<number | undefined>();
  const [quickValue, setQuickValue] = useState<number | undefined>();

  // Swipe right from left edge → go back
  useSwipeBack(() => setActiveTab('home'));

  const handleCashIn = (amount: number) => {
    setPrefillIn(amount);
    setPrefillOut(undefined);
    setQuickValue(undefined);
    setCashInOpen(true);
  };

  const handleCashOut = (amount: number) => {
    setPrefillOut(amount);
    setPrefillIn(undefined);
    setQuickValue(undefined);
    setCashOutOpen(true);
  };

  // Quick amount tap: set a display value in the calculator
  const handleQuickSelect = (value: number) => {
    setQuickValue(value);
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Back arrow — mobile only */}
          <button
            onClick={() => setActiveTab('home')}
            className="md:hidden w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95 flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-gray-900 font-heading font-bold text-base leading-none">Calculator</h2>
            <p className="text-gray-400 text-xs mt-0.5">Tap amount → Cash In or Cash Out</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Quick Amount Buttons */}
        <QuickAmountBar onSelect={handleQuickSelect} />

        {/* Calculator */}
        <InlineCalculator
          onUseCashIn={handleCashIn}
          onUseCashOut={handleCashOut}
          prefillValue={quickValue}
          onPrefillConsumed={() => setQuickValue(undefined)}
        />
      </div>

      {cashInOpen && (
        <CashInModal
          initialAmount={prefillIn}
          onClose={() => { setCashInOpen(false); setPrefillIn(undefined); }}
        />
      )}
      {cashOutOpen && (
        <CashOutModal
          initialAmount={prefillOut}
          onClose={() => { setCashOutOpen(false); setPrefillOut(undefined); }}
        />
      )}
    </div>
  );
}
