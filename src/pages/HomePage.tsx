import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import StatsBanner from '@/components/features/StatsBanner';
import TransactionList from '@/components/features/TransactionList';
import DebtTracker from '@/components/features/DebtTracker';
import BusinessSwitcher from '@/components/features/BusinessSwitcher';
import { Settings } from 'lucide-react';
import NotificationBell from '@/components/features/NotificationBell';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Business } from '@/types';

export default function HomePage() {
  const { user } = useAuth();
  const { setActiveTab, activeBusinessId } = useApp();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const { data: businesses = [] } = useQuery<Business[]>({
    queryKey: ['businesses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const activeBusiness = businesses.find(b => b.id === activeBusinessId);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 shadow-sm">
        <div className="flex items-center justify-between h-[60px] gap-2">
          {/* Left: Greeting */}
          <div className="min-w-0 flex-1">
            <p className="text-gray-400 text-[11px] leading-none">{greeting}</p>
            <h2 className="text-gray-900 font-heading font-bold text-[16px] leading-tight truncate mt-0.5">
              {user?.full_name
                ? `Hi, ${user.full_name.split(' ')[0]} 👋`
                : user?.email
                ? `Hi, ${user.email.split('@')[0]} 👋`
                : 'Hi there 👋'}
            </h2>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Business Switcher */}
            <BusinessSwitcher
              compact
              onAddBusiness={() => setActiveTab('settings')}
            />

            {/* Notification Bell */}
            <NotificationBell />

            {/* Settings — mobile only (gear icon) */}
            <button
              onClick={() => setActiveTab('settings')}
              className="md:hidden w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-100 flex-shrink-0"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Active business sub-header strip */}
        {activeBusiness && (
          <div className="flex items-center gap-2 pb-2.5 -mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <p className="text-gray-400 text-xs truncate">
              <span className="font-semibold text-gray-600">{activeBusiness.name}</span>
              {activeBusiness.sector && (
                <span className="text-gray-400"> · {activeBusiness.sector}</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4">
        <StatsBanner />
        <TransactionList />
        <DebtTracker />
        <div className="h-4" />
      </div>
    </div>
  );
}
