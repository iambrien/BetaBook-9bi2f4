import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { formatNaira, formatDate, formatFullDate, buildWhatsAppLink } from '@/lib/utils';
import { Transaction } from '@/types';
import {
  CreditCard, MessageCircle, AlertTriangle, CheckCircle,
  ChevronRight, X, Phone, Calendar, Package, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DebtTracker() {
  const { user } = useAuth();
  const { activeBusinessId } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const { data: debts = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['debts', user?.id, activeBusinessId],
    queryFn: async () => {
      let q = supabase.from('transactions').select('*')
        .eq('user_id', user!.id)
        .eq('type', 'income')
        .eq('payment_status', 'credit')
        .order('created_at', { ascending: false });
      if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 20000,
  });

  const totalOwed = debts.reduce((s, d) => s + Number(d.amount), 0);

  const filtered = search.trim()
    ? debts.filter(d =>
        (d.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.item_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.customer_phone || '').includes(search)
      )
    : debts;

  const preview = filtered.slice(0, 3);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Debtors Book</h3>
            {debts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-xs font-semibold">
                {debts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalOwed > 0 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {formatNaira(totalOwed)}
              </span>
            )}
            {debts.length > 3 && (
              <button
                onClick={() => setShowAll(true)}
                className="flex items-center gap-0.5 text-blue-500 hover:text-blue-700 text-xs font-semibold transition-colors"
              >
                All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : debts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-gray-600 text-sm font-medium">All clear!</p>
            <p className="text-gray-400 text-xs mt-1">No outstanding customer debts</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {preview.map((debt) => (
              <DebtRow key={debt.id} debt={debt} userId={user!.id} businessId={activeBusinessId} />
            ))}
            {debts.length > 3 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-blue-500 hover:bg-blue-50 text-xs font-semibold transition-colors"
              >
                View all {debts.length} debtors <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full Debtors Book Modal */}
      {showAll && (
        <DebtorsBook
          debts={debts}
          filtered={filtered}
          search={search}
          setSearch={setSearch}
          totalOwed={totalOwed}
          userId={user!.id}
          businessId={activeBusinessId}
          onClose={() => { setShowAll(false); setSearch(''); }}
        />
      )}
    </>
  );
}

// ── Full Debtors Book ─────────────────────────────────────────────────────────
function DebtorsBook({
  debts, filtered, search, setSearch, totalOwed, userId, businessId, onClose
}: {
  debts: Transaction[];
  filtered: Transaction[];
  search: string;
  setSearch: (s: string) => void;
  totalOwed: number;
  userId: string;
  businessId: string | null;
  onClose: () => void;
}) {
  const handleWhatsAppAll = () => {
    const withPhone = debts.filter(d => d.customer_phone);
    if (withPhone.length === 0) { toast.error('No phone numbers saved'); return; }
    withPhone.forEach((d, i) => {
      setTimeout(() => {
        const link = buildWhatsAppLink(d.customer_phone!, d.customer_name || 'Customer', d.amount, d.item_name || 'goods', d.created_at);
        window.open(link, '_blank');
      }, i * 600);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92dvh', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-gray-900 text-base">Debtors Book</h3>
              <p className="text-amber-600 text-xs font-semibold">
                {debts.length} {debts.length === 1 ? 'debtor' : 'debtors'} · {formatNaira(totalOwed)} owed
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-50 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, item, or phone..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        {/* Debt list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-400 text-sm">No results found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(debt => (
                <DebtRow key={debt.id} debt={debt} userId={userId} businessId={businessId} expanded />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {debts.some(d => d.customer_phone) && (
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleWhatsAppAll}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white font-semibold text-sm transition-all active:scale-[0.98]"
            >
              <MessageCircle className="w-4 h-4" />
              Send WhatsApp Reminder to All ({debts.filter(d => d.customer_phone).length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Debt Row ──────────────────────────────────────────────────────────────────
function DebtRow({
  debt, userId, businessId, expanded
}: {
  debt: Transaction;
  userId: string;
  businessId: string | null;
  expanded?: boolean;
}) {
  const qc = useQueryClient();
  const hasPhone = !!debt.customer_phone;

  const { mutate: markPaid, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('transactions')
        .update({ payment_status: 'paid' })
        .eq('id', debt.id)
        .eq('payment_status', 'credit');
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all relevant queries with prefix matching
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions-recent'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`${debt.customer_name || 'Customer'} marked as paid! 🎉`);
      if (hasPhone) {
        const msg = `Hello ${debt.customer_name}! 🙏\n\nThank you for your payment of *₦${Number(debt.amount).toLocaleString()}* for *${debt.item_name || 'goods'}*.\n\nYour account is now cleared. We appreciate your business!\n\n_BetaBook_`;
        const cleanPhone = debt.customer_phone!.replace(/\D/g, '');
        const intlPhone = cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone;
        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  });

  const handleWhatsApp = () => {
    if (!hasPhone) return;
    const link = buildWhatsAppLink(
      debt.customer_phone!, debt.customer_name || 'Customer',
      debt.amount, debt.item_name || 'goods', debt.created_at
    );
    window.open(link, '_blank');
  };

  const daysSince = Math.floor((Date.now() - new Date(debt.created_at).getTime()) / 86400000);
  const isOverdue = daysSince >= 7;

  return (
    <div className={cn(
      'px-4 py-3.5 hover:bg-amber-50/30 transition-colors',
      isOverdue && 'bg-red-50/20'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
          isOverdue ? 'bg-red-100' : 'bg-amber-100'
        )}>
          <AlertTriangle className={cn('w-4 h-4', isOverdue ? 'text-red-500' : 'text-amber-500')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-gray-800 text-sm font-semibold truncate">
              {debt.customer_name || 'Unknown Customer'}
            </p>
            <p className={cn(
              'font-bold text-sm flex-shrink-0',
              isOverdue ? 'text-red-600' : 'text-amber-600'
            )}>
              {formatNaira(debt.amount)}
            </p>
          </div>

          {/* Item + date */}
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {debt.item_name && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <Package className="w-3 h-3" /> {debt.item_name}
              </span>
            )}
            <span className="flex items-center gap-1 text-gray-400 text-xs">
              <Calendar className="w-3 h-3" /> {formatDate(debt.created_at)}
            </span>
            {isOverdue && (
              <span className="text-red-400 text-xs font-medium">{daysSince}d overdue</span>
            )}
          </div>

          {/* Phone */}
          {debt.customer_phone && (
            <div className="flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500 text-xs font-medium">{debt.customer_phone}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className={cn('flex items-center gap-2 mt-2.5', expanded ? 'flex-wrap' : '')}>
            <button
              onClick={() => markPaid()}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="w-3 h-3" />
              {isPending ? 'Saving...' : 'Mark Paid'}
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={!hasPhone}
              title={!hasPhone ? 'No phone number saved' : 'Send WhatsApp reminder'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-40 bg-[#25D366] hover:bg-[#1ebe5b]"
            >
              <MessageCircle className="w-3 h-3" />
              {hasPhone ? 'WhatsApp' : 'No Phone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
