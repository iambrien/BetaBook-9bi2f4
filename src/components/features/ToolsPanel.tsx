/**
 * ToolsPanel — slide-up sheet containing the Calculator + quick utilities.
 * Replaces the floating calculator button.
 */
import { useState, useCallback, useEffect } from 'react';
import { X, Delete, Copy, TrendingUp, TrendingDown, Calculator, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ToolsPanelProps {
  onClose: () => void;
  onUseCashIn?: (amount: number) => void;
  onUseCashOut?: (amount: number) => void;
}

type CalcOp = '+' | '-' | '×' | '÷' | null;

export default function ToolsPanel({ onClose, onUseCashIn, onUseCashOut }: ToolsPanelProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-[slide-up_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-500 flex items-center justify-center">
              <Calculator className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-heading font-bold text-gray-900 text-base">Tools · Calculator</span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Calculator */}
        <div className="px-4 pb-6 pt-4 overflow-y-auto max-h-[85vh]">
          <InlineCalculator
            onUseCashIn={(v) => { if (onUseCashIn) { onUseCashIn(v); onClose(); } }}
            onUseCashOut={(v) => { if (onUseCashOut) { onUseCashOut(v); onClose(); } }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Inline Calculator ──────────────────────────────────────────────────────
export function InlineCalculator({
  onUseCashIn,
  onUseCashOut,
}: {
  onUseCashIn?: (n: number) => void;
  onUseCashOut?: (n: number) => void;
}) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<CalcOp>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [resultShown, setResultShown] = useState(false);

  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit); setWaitingForOperand(false); setResultShown(false);
    } else {
      if (display === '0' && digit !== '.') setDisplay(digit);
      else if (digit === '.' && display.includes('.')) return;
      else if (display.replace(/[^0-9]/g, '').length >= 14) return;
      else setDisplay(p => p + digit);
      setResultShown(false);
    }
  }, [display, waitingForOperand]);

  const inputOperator = useCallback((op: CalcOp) => {
    const cur = parseFloat(display.replace(/,/g, ''));
    if (prevValue !== null && !waitingForOperand) {
      const res = calcCompute(prevValue, cur, operator);
      setDisplay(fmtD(res)); setPrevValue(res); setExpression(`${fmtD(res)} ${op}`);
    } else {
      setPrevValue(cur); setExpression(`${fmtD(cur)} ${op}`);
    }
    setOperator(op); setWaitingForOperand(true); setResultShown(false);
  }, [display, operator, prevValue, waitingForOperand]);

  const calculate = useCallback(() => {
    const cur = parseFloat(display.replace(/,/g, ''));
    if (prevValue === null || operator === null) return;
    const res = calcCompute(prevValue, cur, operator);
    setExpression(`${expression} ${fmtD(cur)} =`);
    setDisplay(fmtD(res)); setPrevValue(null); setOperator(null);
    setWaitingForOperand(false); setResultShown(true);
  }, [display, expression, operator, prevValue]);

  const clear = useCallback(() => {
    setDisplay('0'); setPrevValue(null); setOperator(null);
    setWaitingForOperand(false); setExpression(''); setResultShown(false);
  }, []);

  const backspace = useCallback(() => {
    if (resultShown) { clear(); return; }
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) setDisplay('0');
    else setDisplay(p => p.slice(0, -1));
  }, [display, resultShown, clear]);

  const toggleSign = useCallback(() => {
    if (display === '0') return;
    setDisplay(p => p.startsWith('-') ? p.slice(1) : '-' + p);
  }, [display]);

  const percentage = useCallback(() => {
    const v = parseFloat(display.replace(/,/g, ''));
    setDisplay(fmtD(prevValue !== null ? prevValue * v / 100 : v / 100));
    setResultShown(false);
  }, [display, prevValue]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDigit('.');
      else if (e.key === '+') inputOperator('+');
      else if (e.key === '-') inputOperator('-');
      else if (e.key === '*') inputOperator('×');
      else if (e.key === '/') { e.preventDefault(); inputOperator('÷'); }
      else if (e.key === 'Enter' || e.key === '=') calculate();
      else if (e.key === 'Backspace') backspace();
      else if (e.key.toLowerCase() === 'c') clear();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputDigit, inputOperator, calculate, backspace, clear]);

  const numVal = parseFloat(display.replace(/,/g, ''));
  const isValid = !isNaN(numVal) && numVal > 0;

  return (
    <div className="bg-slate-50 rounded-3xl overflow-hidden border border-gray-100">
      {/* Display */}
      <div className="px-5 py-4 bg-white border-b border-gray-100 min-h-[88px] flex flex-col justify-end items-end">
        <p className="text-gray-400 text-xs font-medium min-h-[16px] truncate w-full text-right">
          {expression || '\u00A0'}
        </p>
        <p className={cn(
          'font-heading font-bold text-gray-900 mt-1 leading-none text-right w-full overflow-hidden',
          display.length > 10 ? 'text-2xl' : display.length > 7 ? 'text-3xl' : 'text-4xl'
        )}>
          ₦{addCommasInline(display)}
        </p>
        {operator && !resultShown && (
          <div className="mt-1.5">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">{operator}</span>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="p-4 grid grid-cols-4 gap-2.5">
        <ICalcBtn label="AC" onClick={clear} variant="utility" />
        <ICalcBtn label="+/-" onClick={toggleSign} variant="utility" />
        <ICalcBtn label="%" onClick={percentage} variant="utility" icon={<Percent className="w-4 h-4" />} />
        <ICalcBtn label="÷" onClick={() => inputOperator('÷')} variant="operator" active={operator === '÷'} />

        <ICalcBtn label="7" onClick={() => inputDigit('7')} />
        <ICalcBtn label="8" onClick={() => inputDigit('8')} />
        <ICalcBtn label="9" onClick={() => inputDigit('9')} />
        <ICalcBtn label="×" onClick={() => inputOperator('×')} variant="operator" active={operator === '×'} />

        <ICalcBtn label="4" onClick={() => inputDigit('4')} />
        <ICalcBtn label="5" onClick={() => inputDigit('5')} />
        <ICalcBtn label="6" onClick={() => inputDigit('6')} />
        <ICalcBtn label="−" onClick={() => inputOperator('-')} variant="operator" active={operator === '-'} />

        <ICalcBtn label="1" onClick={() => inputDigit('1')} />
        <ICalcBtn label="2" onClick={() => inputDigit('2')} />
        <ICalcBtn label="3" onClick={() => inputDigit('3')} />
        <ICalcBtn label="+" onClick={() => inputOperator('+')} variant="operator" active={operator === '+'} />

        <ICalcBtn label="0" onClick={() => inputDigit('0')} wide />
        <ICalcBtn label="." onClick={() => inputDigit('.')} />
        <ICalcBtn label="⌫" onClick={backspace} icon={<Delete className="w-4 h-4" />} />
        <ICalcBtn label="=" onClick={calculate} variant="equals" />
      </div>

      {/* Actions */}
      <div className="px-4 pb-5 grid grid-cols-3 gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(display.replace(/,/g, ''))
              .then(() => toast.success('Copied!'))
              .catch(() => toast.error('Copy failed'));
          }}
          disabled={!isValid}
          className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
        <button
          onClick={() => isValid && onUseCashIn?.(numVal)}
          disabled={!isValid}
          className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm shadow-emerald-200 transition-all active:scale-95 disabled:opacity-40"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Cash In
        </button>
        <button
          onClick={() => isValid && onUseCashOut?.(numVal)}
          disabled={!isValid}
          className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-sm shadow-red-200 transition-all active:scale-95 disabled:opacity-40"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Cash Out
        </button>
      </div>
    </div>
  );
}

function calcCompute(a: number, b: number, op: CalcOp): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}
function fmtD(val: number): string {
  if (isNaN(val) || !isFinite(val)) return '0';
  return String(parseFloat(val.toPrecision(10)));
}
function addCommasInline(raw: string): string {
  const isNeg = raw.startsWith('-');
  const str = isNeg ? raw.slice(1) : raw;
  const [int, dec] = str.split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (isNeg ? '-' : '') + formatted + (dec !== undefined ? '.' + dec : '');
}

interface ICalcBtnProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'utility' | 'operator' | 'equals';
  active?: boolean;
  wide?: boolean;
  icon?: React.ReactNode;
}
function ICalcBtn({ label, onClick, variant = 'default', active = false, wide = false, icon }: ICalcBtnProps) {
  const [pressed, setPressed] = useState(false);
  const base = 'flex items-center justify-center rounded-2xl font-semibold text-lg h-[54px] select-none transition-all duration-100';
  const styles: Record<string, string> = {
    default: 'bg-white border border-gray-100 text-gray-800 hover:bg-gray-50 shadow-sm',
    utility: 'bg-slate-200/70 text-gray-600 hover:bg-slate-300/70',
    operator: active ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    equals: 'bg-blue-500 text-white shadow-md shadow-blue-200 hover:bg-blue-600',
  };
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={cn(base, styles[variant], wide && 'col-span-2')}
      style={{ transform: pressed ? 'scale(0.91)' : 'scale(1)' }}
    >
      {icon || label}
    </button>
  );
}
