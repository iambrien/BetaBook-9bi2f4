import { useState } from 'react';
import { InlineCalculator } from '@/components/features/ToolsPanel';
import CashInModal from '@/components/features/CashInModal';
import CashOutModal from '@/components/features/CashOutModal';
import { Calculator } from 'lucide-react';

export default function CalculatorPage() {
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [prefillIn, setPrefillIn] = useState<number | undefined>();
  const [prefillOut, setPrefillOut] = useState<number | undefined>();

  const handleCashIn = (amount: number) => {
    setPrefillIn(amount);
    setPrefillOut(undefined);
    setCashInOpen(true);
  };

  const handleCashOut = (amount: number) => {
    setPrefillOut(amount);
    setPrefillIn(undefined);
    setCashOutOpen(true);
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-gray-900 font-heading font-bold text-base leading-none">Calculator</h2>
            <p className="text-gray-400 text-xs mt-0.5">Tap Cash In or Cash Out to record</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <InlineCalculator onUseCashIn={handleCashIn} onUseCashOut={handleCashOut} />
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
