import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatNaira, formatDate } from '@/lib/utils';
import CashInModal from '@/components/features/CashInModal';
import CashOutModal from '@/components/features/CashOutModal';
import { InlineCalculator } from '@/components/features/ToolsPanel';
import {
  TrendingUp, TrendingDown, BookOpen, Building2, Clock,
  Calculator, Home, List, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Transaction } from '@/types';
import { cn } from '@/lib/utils';

type AttendantTab = 'home' | 'history' | 'calculator';

const CHART_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
];

export default function AttendantView() {
  const { attendantSession, activeBusinessId } = useApp();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<AttendantTab>('home');
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [calcPrefillIn, setCalcPrefillIn] = useState<number | undefined>();
  const [calcPrefillOut, setCalcPrefillOut] = useState<number | undefined>();

  const { data: business } = useQuery({
    queryKey: ['business-single', activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return null;
      const { data } = await supabase
        .from('businesses')
        .select('name, sector')
        .eq('id', activeBusinessId)
        .single();
      return data;
    },
    enabled: !!activeBusinessId,
  });

  const { data: recentTxns = [] } = useQuery<Transaction[]>({
    queryKey: ['attendant-recent', user?.id, activeBusinessId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let q = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user!.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 8000,
  });

  const todayInflow = recentTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayOutflow = recentTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    recentTxns.forEach(tx => {
      const label = tx.type === 'income'
        ? (tx.item_name?.trim() || 'Sales')
        : (tx.category?.trim() || 'Other');
      map[label] = (map[label] || 0) + tx.amount;
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [recentTxns]);

  const handleModalClose = (key: 'in' | 'out') => {
    qc.invalidateQueries({ queryKey: ['attendant-recent'] });
    qc.invalidateQueries({ queryKey: ['attendant-notifications'] });
    if (key === 'in') { setCashInOpen(false); setCalcPrefillIn(undefined); }
    else { setCashOutOpen(false); setCalcPrefillOut(undefined); }
  };

  const handleCalcUseCashIn = (amount: number) => {
    setCalcPrefillIn(amount);
    setCalcPrefillOut(undefined);
    setCashInOpen(true);
  };

  const handleCalcUseCashOut = (amount: number) => {
    setCalcPrefillOut(amount);
    setCalcPrefillIn(undefined);
    setCashOutOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm px-4">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-gray-900 font-bold text-base leading-none">BetaBook</h1>
              {business ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  <p className="text-gray-400 text-xs">{business.name}</p>
                </div>
              ) : (
                <p className="text-blue-500 text-xs font-medium mt-0.5">Staff Mode</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">
                {attendantSession?.name?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
            <span className="text-blue-700 font-semibold text-xs truncate max-w-[80px]">
              {attendantSession?.name || 'Attendant'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto pb-28">

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="px-4 pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-4">
                <p className="text-emerald-600 text-xs font-semibold mb-1">Today's Inflow</p>
                <p className="text-emerald-700 font-bold text-xl leading-none">{formatNaira(todayInflow)}</p>
                <p className="text-emerald-500 text-xs mt-1">
                  {recentTxns.filter(t => t.type === 'income').length} entries
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-4">
                <p className="text-red-500 text-xs font-semibold mb-1">Today's Outflow</p>
                <p className="text-red-600 font-bold text-xl leading-none">{formatNaira(todayOutflow)}</p>
                <p className="text-red-400 text-xs mt-1">
                  {recentTxns.filter(t => t.type === 'expense').length} entries
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { setCalcPrefillIn(undefined); setCashInOpen(true); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-bold text-lg leading-none">+ Cash In</p>
                  <p className="text-white/75 text-sm mt-1">Record a sale or income</p>
                </div>
              </button>

              <button
                onClick={() => { setCalcPrefillOut(undefined); setCashOutOpen(true); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-bold text-lg leading-none">− Cash Out</p>
                  <p className="text-white/75 text-sm mt-1">Record an expense</p>
                </div>
              </button>
            </div>

            {recentTxns.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-800 text-sm">Latest Entries</h3>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="ml-auto text-blue-500 text-xs font-semibold hover:text-blue-700 transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentTxns.slice(0, 3).map(tx => (
                    <AttendantTxRow key={tx.id} tx={tx} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="px-4 pt-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-heading font-bold text-gray-900">Today's Entries</h2>
              <span className="text-xs text-gray-400 bg-white border border-gray-100 px-2.5 py-1 rounded-full">
                {recentTxns.length} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <p className="text-emerald-600 text-xs font-medium">Inflow</p>
                <p className="text-emerald-700 font-bold text-base">{formatNaira(todayInflow)}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <p className="text-red-500 text-xs font-medium">Outflow</p>
                <p className="text-red-600 font-bold text-base">{formatNaira(todayOutflow)}</p>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <PieChartIcon className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-800 text-sm">Category Breakdown</h3>
                  <span className="ml-auto text-xs text-gray-400">Today</span>
                </div>
                <div className="px-2 py-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%" cy="50%"
                        innerRadius={52} outerRadius={80}
                        paddingAngle={3}
                        dataKey="amount"
                        strokeWidth={2}
                        stroke="#fff"
                      >
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => [formatNaira(val), 'Amount']}
                        contentStyle={{
                          background: '#fff', border: '1px solid #e5e7eb',
                          borderRadius: 12, fontSize: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                      />
                      <Legend
                        iconType="circle" iconSize={8}
                        formatter={(value) => (
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-center text-xs text-gray-400 -mt-2 mb-1">
                    {chartData.length} {chartData.length === 1 ? 'category' : 'categories'}
                  </p>
                </div>
              </div>
            )}

            {chartData.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <PieChartIcon className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-gray-400 text-xs">Chart will appear once entries are recorded</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {recentTxns.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-5 h-5 text-blue-200" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No entries today yet</p>
                  <p className="text-gray-400 text-xs mt-1">Switch to Home and record your first entry</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentTxns.map(tx => (
                    <AttendantTxRow key={tx.id} tx={tx} showTime />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CALCULATOR TAB */}
        {activeTab === 'calculator' && (
          <div className="px-4 pt-5 pb-4">
            <div className="mb-4">
              <h2 className="font-heading font-bold text-gray-900">Calculator</h2>
              <p className="text-gray-400 text-xs mt-0.5">Tap Cash In / Cash Out to prefill amount</p>
            </div>
            <InlineCalculator
              onUseCashIn={handleCalcUseCashIn}
              onUseCashOut={handleCalcUseCashOut}
            />
          </div>
        )}
      </div>

      {/* Liquid Glass Bottom Nav */}
      <div className="h-24" />
      <nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[380px] rounded-[28px] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.18),0_1px_0_rgba(255,255,255,0.4)_inset]"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center h-[60px] px-2">
          <AttendantNavTab id="home" label="Home" icon={Home} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <AttendantNavTab id="history" label="History" icon={List} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <AttendantNavTab id="calculator" label="Calculator" icon={Calculator} active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
        </div>
      </nav>

      {cashInOpen && (
        <CashInModal initialAmount={calcPrefillIn} onClose={() => handleModalClose('in')} />
      )}
      {cashOutOpen && (
        <CashOutModal initialAmount={calcPrefillOut} onClose={() => handleModalClose('out')} />
      )}
    </div>
  );
}

function AttendantTxRow({ tx, showTime }: { tx: Transaction; showTime?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        tx.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
      }`}>
        {tx.type === 'income'
          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-800 text-sm font-medium truncate">
          {tx.item_name || tx.category || (tx.type === 'income' ? 'Income' : 'Expense')}
        </p>
        {tx.customer_name && <p className="text-gray-400 text-xs truncate">{tx.customer_name}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`font-semibold text-sm ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
          {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amount)}
        </p>
        {showTime && <p className="text-gray-400 text-xs">{formatDate(tx.created_at)}</p>}
      </div>
    </div>
  );
}

interface NavTabProps {
  id: AttendantTab;
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick: () => void;
}
function AttendantNavTab({ label, icon: Icon, active, onClick }: NavTabProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={cn(
        'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] rounded-[20px] select-none outline-none transition-colors',
        active ? 'bg-blue-500/10' : ''
      )}
      style={{
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Icon style={{
        width: 20, height: 20,
        transform: active ? 'scale(1.18)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), color 0.2s',
        color: active ? '#3b82f6' : '#9ca3af',
        strokeWidth: active ? 2.5 : 1.8,
      }} />
      <span className="text-[9.5px] font-semibold tracking-wide transition-colors duration-200"
        style={{ color: active ? '#3b82f6' : '#9ca3af' }}>
        {label}
      </span>
    </button>
  );
}
