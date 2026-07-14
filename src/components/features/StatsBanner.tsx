import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { formatNaira } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, ChevronDown } from 'lucide-react';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '3 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

function getPeriodStart(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString();
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString();
    }
    case '90d': {
      const d = new Date(now); d.setDate(d.getDate() - 90); return d.toISOString();
    }
    case '1y': {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString();
    }
    case 'all':
    default:
      return null;
  }
}

export default function StatsBanner() {
  const { user } = useAuth();
  const { activeBusinessId } = useApp();
  const [period, setPeriod] = useState<Period>('30d');
  const [showPicker, setShowPicker] = useState(false);

  const periodStart = getPeriodStart(period);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', user?.id, activeBusinessId, period],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user!.id);
      if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
      if (periodStart) q = q.gte('created_at', periodStart);
      const { data, error } = await q;
      if (error) throw error;
      const inflow = (data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const outflow = (data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { inflow, outflow, profit: inflow - outflow };
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const currentPeriodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label ?? '30 Days';

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl h-36 animate-pulse bg-gray-100" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl animate-pulse bg-gray-100" />
          <div className="h-24 rounded-2xl animate-pulse bg-gray-100" />
        </div>
      </div>
    );
  }

  const profit = stats?.profit ?? 0;
  const isPositive = profit >= 0;
  const profitPct = stats?.inflow
    ? Math.round((profit / stats.inflow) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Main P&L Banner */}
      <div className={`rounded-2xl p-5 relative overflow-hidden ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 translate-x-8 -translate-y-8 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 -translate-x-4 translate-y-4 pointer-events-none" />

        {/* Period Selector */}
        <div className="relative flex items-center justify-between mb-3">
          <p className="text-white/80 text-xs font-medium uppercase tracking-wider">
            Profit / Loss
          </p>
          <div className="relative">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
            >
              {currentPeriodLabel}
              <ChevronDown className={`w-3 h-3 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            {showPicker && (
              <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[130px] animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPeriod(opt.value); setShowPicker(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      period === opt.value
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Click outside to close */}
        {showPicker && (
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
        )}

        <p className="text-white font-heading font-bold text-3xl mb-1 relative z-10">
          {isPositive ? '+' : ''}{formatNaira(profit)}
        </p>
        <div className="flex items-center gap-2 relative z-10">
          <Activity className="w-3.5 h-3.5 text-white/70" />
          <p className="text-white/80 text-xs">
            {isPositive
              ? `📈 ${profitPct}% margin · Keep it up!`
              : `📉 More expenses than income · Watch outflows`}
          </p>
        </div>
      </div>

      {/* Sub Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-gray-500 text-xs font-medium">Inflow</span>
          </div>
          <p className="text-emerald-600 font-heading font-bold text-xl leading-none">
            {formatNaira(stats?.inflow ?? 0)}
          </p>
          <p className="text-gray-400 text-[10px] mt-1">{currentPeriodLabel}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-gray-500 text-xs font-medium">Outflow</span>
          </div>
          <p className="text-red-500 font-heading font-bold text-xl leading-none">
            {formatNaira(stats?.outflow ?? 0)}
          </p>
          <p className="text-gray-400 text-[10px] mt-1">{currentPeriodLabel}</p>
        </div>
      </div>
    </div>
  );
}
