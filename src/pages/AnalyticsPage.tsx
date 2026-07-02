import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { formatNaira } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart2, Calendar, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Transaction } from '@/types';

type Period = 'week' | 'month';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { activeBusinessId } = useApp();
  const [period, setPeriod] = useState<Period>('week');

  // ── Current period transactions ─────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['analytics-txns', user?.id, activeBusinessId, period],
    queryFn: async () => {
      const days = period === 'week' ? 7 : 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      let q = supabase.from('transactions').select('*')
        .eq('user_id', user!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Month-over-Month comparison ─────────────────────────────────────────
  const { data: momData } = useQuery({
    queryKey: ['analytics-mom', user?.id, activeBusinessId],
    queryFn: async () => {
      const now = new Date();
      // This month: 1st of current month → now
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      // Last month: 1st → last day of previous month
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const fetchMonth = async (from: string, to: string) => {
        let q = supabase.from('transactions').select('type, amount')
          .eq('user_id', user!.id)
          .gte('created_at', from)
          .lte('created_at', to);
        if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
        const { data } = await q;
        return data || [];
      };

      const [thisTxns, lastTxns] = await Promise.all([
        fetchMonth(thisMonthStart, now.toISOString()),
        fetchMonth(lastMonthStart, lastMonthEnd),
      ]);

      const sum = (arr: { type: string; amount: number }[], type: string) =>
        arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

      const thisIncome = sum(thisTxns, 'income');
      const thisExpense = sum(thisTxns, 'expense');
      const lastIncome = sum(lastTxns, 'income');
      const lastExpense = sum(lastTxns, 'expense');

      const pct = (cur: number, prev: number) => {
        if (prev === 0) return cur > 0 ? 100 : 0;
        return Math.round(((cur - prev) / prev) * 100);
      };

      return {
        thisIncome, thisExpense,
        thisNet: thisIncome - thisExpense,
        lastIncome, lastExpense,
        lastNet: lastIncome - lastExpense,
        incomeChange: pct(thisIncome, lastIncome),
        expenseChange: pct(thisExpense, lastExpense),
        netChange: pct(thisIncome - thisExpense, lastIncome - lastExpense),
      };
    },
    enabled: !!user,
  });

  // ── Bar chart data ───────────────────────────────────────────────────────
  const barData = (() => {
    const days = period === 'week' ? 7 : 30;
    const map: Record<string, { label: string; income: number; expense: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = period === 'week'
        ? d.toLocaleDateString('en-NG', { weekday: 'short' })
        : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
      map[key] = { label, income: 0, expense: 0 };
    }
    transactions.forEach(tx => {
      const key = tx.created_at.slice(0, 10);
      if (map[key]) {
        if (tx.type === 'income') map[key].income += Number(tx.amount);
        else map[key].expense += Number(tx.amount);
      }
    });
    return Object.values(map);
  })();

  // ── Pie chart data ───────────────────────────────────────────────────────
  const pieData = (() => {
    const catMap: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(tx => {
      const cat = tx.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + Number(tx.amount);
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  // ── Best-selling items ───────────────────────────────────────────────────
  const topItems = (() => {
    const itemMap: Record<string, { count: number; total: number }> = {};
    transactions.filter(t => t.type === 'income' && t.item_name).forEach(tx => {
      const name = tx.item_name!;
      if (!itemMap[name]) itemMap[name] = { count: 0, total: 0 };
      itemMap[name].count += 1;
      itemMap[name].total += Number(tx.amount);
    });
    return Object.entries(itemMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  })();

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const now = new Date();
  const thisMonthName = now.toLocaleDateString('en-NG', { month: 'long' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleDateString('en-NG', { month: 'long' });

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h2 className="text-gray-900 font-heading font-bold text-lg">Analytics</h2>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}>
                {p === 'week' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Month vs Last Month ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">This Month vs Last Month</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                {thisMonthName} vs {lastMonthName}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-50">
            <MomCard
              label="Income"
              thisVal={momData?.thisIncome ?? 0}
              lastVal={momData?.lastIncome ?? 0}
              change={momData?.incomeChange ?? 0}
              positiveIsGood={true}
            />
            <MomCard
              label="Expenses"
              thisVal={momData?.thisExpense ?? 0}
              lastVal={momData?.lastExpense ?? 0}
              change={momData?.expenseChange ?? 0}
              positiveIsGood={false}
            />
            <MomCard
              label="Net Profit"
              thisVal={momData?.thisNet ?? 0}
              lastVal={momData?.lastNet ?? 0}
              change={momData?.netChange ?? 0}
              positiveIsGood={true}
              isNet
            />
          </div>
        </div>

        {/* ── Summary row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-gray-500 text-xs">Income</span>
            </div>
            <p className="text-emerald-600 font-heading font-bold text-lg">{formatNaira(totalIncome)}</p>
            <p className="text-gray-400 text-xs mt-0.5">{period === 'week' ? 'Past 7 days' : 'Past 30 days'}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
              </div>
              <span className="text-gray-500 text-xs">Expenses</span>
            </div>
            <p className="text-red-500 font-heading font-bold text-lg">{formatNaira(totalExpense)}</p>
            <p className="text-gray-400 text-xs mt-0.5">{period === 'week' ? 'Past 7 days' : 'Past 30 days'}</p>
          </div>
        </div>

        {/* ── Bar Chart ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Income vs Expenses</h3>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : transactions.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip
                  formatter={(value: number) => [formatNaira(value)]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Expense Category Pie ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Expense Breakdown</h3>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : pieData.length === 0 ? (
            <EmptyChart label="No expense data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} innerRadius={35}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatNaira(value)]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: '#475569' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Best-Selling Items ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-50">
            <Package className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-gray-800 text-sm">Best-Selling Items</h3>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : topItems.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No item sales recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {topItems.map((item, i) => {
                const maxTotal = topItems[0].total;
                const pct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-amber-100 text-amber-600' :
                          i === 1 ? 'bg-gray-100 text-gray-500' :
                          i === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {i + 1}
                        </span>
                        <p className="text-gray-800 text-sm font-medium truncate">{item.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-emerald-600 text-sm font-bold">{formatNaira(item.total)}</p>
                        <p className="text-gray-400 text-xs">{item.count} sale{item.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Month-over-Month Card ────────────────────────────────────────────────────
function MomCard({
  label, thisVal, lastVal, change, positiveIsGood, isNet,
}: {
  label: string;
  thisVal: number;
  lastVal: number;
  change: number;
  positiveIsGood: boolean;
  isNet?: boolean;
}) {
  const isUp = change > 0;
  const isDown = change < 0;
  const neutral = change === 0;

  // For income/net: up = green, down = red
  // For expenses: up = red (bad), down = green (good)
  const isGood = positiveIsGood ? isUp : isDown;
  const isBad = positiveIsGood ? isDown : isUp;

  const changeColor = neutral
    ? 'text-gray-400'
    : isGood ? 'text-emerald-500' : 'text-red-500';

  const changeBg = neutral
    ? 'bg-gray-50 border-gray-100'
    : isGood ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100';

  const valueColor = isNet
    ? (thisVal >= 0 ? 'text-emerald-600' : 'text-red-500')
    : label === 'Income' ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="px-3 py-4 flex flex-col gap-1.5">
      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className={`font-heading font-bold text-sm leading-tight ${valueColor}`}>
        {formatNaira(Math.abs(thisVal))}
        {isNet && thisVal < 0 && <span className="text-xs font-normal"> loss</span>}
      </p>
      <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-bold w-fit ${changeBg} ${changeColor}`}>
        {neutral
          ? <Minus className="w-2.5 h-2.5" />
          : isUp
          ? <TrendingUp className="w-2.5 h-2.5" />
          : <TrendingDown className="w-2.5 h-2.5" />}
        {neutral ? '—' : `${Math.abs(change)}%`}
      </div>
      <p className="text-gray-300 text-[9px] truncate">
        vs {formatNaira(Math.abs(lastVal))}
      </p>
    </div>
  );
}

function EmptyChart({ label = 'No data for this period' }: { label?: string }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center text-gray-300">
      <BarChart2 className="w-10 h-10 mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
