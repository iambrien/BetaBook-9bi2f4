/**
 * useDebtReminders
 * Polls the DB every 30s for due debt reminders.
 * When found: shows a browser notification + toast, then marks them as notified.
 * Works while the app tab is open. The service worker handles closed-tab delivery.
 */
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatNaira } from '@/lib/utils';
import { toast } from 'sonner';

interface ReminderRow {
  id: string;
  customer_name: string | null;
  item_name: string | null;
  amount: number;
  reminder_at: string;
}

export function useDebtReminders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const firedRef = useRef<Set<string>>(new Set());

  // Poll every 30 seconds for due reminders
  const { data: dueReminders = [] } = useQuery<ReminderRow[]>({
    queryKey: ['debt-reminders', user?.id],
    queryFn: async () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_name, item_name, amount, reminder_at')
        .eq('user_id', user!.id)
        .eq('payment_status', 'credit')
        .eq('reminder_notified', false)
        .lte('reminder_at', now.toISOString())
        .gte('reminder_at', fiveMinAgo.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!dueReminders.length) return;

    const newReminders = dueReminders.filter(r => !firedRef.current.has(r.id));
    if (!newReminders.length) return;

    newReminders.forEach(async (reminder) => {
      firedRef.current.add(reminder.id);

      const title = '⏰ Debt Reminder — BetaBook';
      const customerLabel = reminder.customer_name || 'A customer';
      const itemLabel = reminder.item_name || 'goods';
      const body = `${customerLabel} owes you ${formatNaira(reminder.amount)} for ${itemLabel}. Time to collect!`;

      // 1. In-app toast
      toast(title, {
        description: body,
        duration: 10000,
      });

      // 2. Browser notification (works even if app is backgrounded)
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          fireNotification(title, body);
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') fireNotification(title, body);
        }
      }

      // 3. Via service worker (for locked-screen delivery)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            title,
            body,
            tag: `debt-reminder-${reminder.id}`,
            data: { url: '/' },
          },
        });
      }

      // 4. Mark as notified in DB
      await supabase
        .from('transactions')
        .update({ reminder_notified: true })
        .eq('id', reminder.id);

      // Refresh debts list
      qc.invalidateQueries({ queryKey: ['debts'] });
    });
  }, [dueReminders, qc]);
}

function fireNotification(title: string, body: string) {
  try {
    const n = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 100, 300],
      tag: 'betabook-debt',
      requireInteraction: false,
    } as NotificationOptions);
    // Auto-close after 8s
    setTimeout(() => n.close(), 8000);
  } catch { /* ignore */ }
}

/**
 * Schedule a future reminder by updating reminder_at in the DB.
 * Called from CashInModal when user picks a reminder time.
 */
export async function scheduleDebtReminder(txId: string, reminderAt: Date) {
  const { error } = await supabase
    .from('transactions')
    .update({ reminder_at: reminderAt.toISOString(), reminder_notified: false })
    .eq('id', txId);
  if (error) throw error;

  // Also schedule via service worker message for offline delivery
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const delay = reminderAt.getTime() - Date.now();
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      // Only schedule SW timer for reminders within 24h
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDER',
        payload: {
          txId,
          delay,
          title: '⏰ Debt Reminder — BetaBook',
          body: 'You have a scheduled debt collection reminder.',
          tag: `debt-reminder-${txId}`,
        },
      });
    }
  }
}
