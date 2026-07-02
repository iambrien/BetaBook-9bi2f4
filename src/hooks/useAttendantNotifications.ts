/**
 * useAttendantNotifications
 * Polls for new attendant transactions and fires toast notifications.
 * Used in the owner's layout to watch for staff activity in real-time.
 */
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/utils';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  item_name: string | null;
  created_at: string;
}

export function useAttendantNotifications() {
  const { user } = useAuth();
  const { activeBusinessId, isAttendantMode } = useApp();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const { data: recentTxns } = useQuery<Transaction[]>({
    queryKey: ['attendant-notifications', user?.id, activeBusinessId],
    queryFn: async () => {
      const since = new Date();
      since.setMinutes(since.getMinutes() - 30); // watch last 30 min

      let q = supabase
        .from('transactions')
        .select('id, type, amount, item_name, created_at')
        .eq('user_id', user!.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (activeBusinessId) q = q.eq('business_id', activeBusinessId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!user && !isAttendantMode, // only run for owners
    refetchInterval: 10_000, // poll every 10s
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!recentTxns) return;

    // On first load, just seed known IDs — don't notify
    if (!initializedRef.current) {
      recentTxns.forEach(t => seenIdsRef.current.add(t.id));
      initializedRef.current = true;
      return;
    }

    // Find truly new transactions
    const newTxns = recentTxns.filter(t => !seenIdsRef.current.has(t.id));
    newTxns.forEach(tx => {
      seenIdsRef.current.add(tx.id);
      const label = tx.item_name || (tx.type === 'income' ? 'Sale' : 'Expense');
      const sign = tx.type === 'income' ? '+' : '−';
      const color = tx.type === 'income' ? '🟢' : '🔴';
      toast(`${color} Attendant entry`, {
        description: `${sign}${formatNaira(tx.amount)} · ${label}`,
        duration: 5000,
      });
    });
  }, [recentTxns]);
}
