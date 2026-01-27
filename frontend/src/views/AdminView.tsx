import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, CreditCard, TrendingUp, AlertCircle, CheckCircle, XCircle,
  Ban, Unlock, Coins, Clock, Image as ImageIcon, Loader2
} from 'lucide-react';
import { adminAPI } from '../utils/api';
import { getTelegramUserData } from '../utils/generationHelpers';
import { triggerHaptic, triggerNotification } from '../utils/haptics';

interface AdminViewProps {
  onBack: () => void;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  pending_payments: number;
  pending_withdrawals: number;
  total_revenue_uzs: number;
  total_payouts_uzs: number;
}

interface PendingPayment {
  id: number;
  user_id: number;
  amount_uzs: number;
  credits: number;
  screenshot_url?: string;
  created_at: string;
}

interface PendingWithdrawal {
  id: number;
  user_id: number;
  amount_uzs: number;
  card_number: string;
  card_type?: string;
  status: string;
  created_at: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'payments' | 'withdrawals'>('stats');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    const userData = getTelegramUserData();
    if (!userData) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    try {
      // Try to fetch stats - if successful, user is admin
      const statsData = await adminAPI.getStats(userData.userId);
      setIsAuthorized(true);
      setStats(statsData);
      loadData(userData.userId);
    } catch (err: any) {
      console.error('Admin auth failed:', err);
      setIsAuthorized(false);
      setError('Доступ запрещён. Требуются права администратора.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (adminId: number) => {
    try {
      const [paymentsData, withdrawalsData] = await Promise.all([
        adminAPI.getPendingPayments(adminId),
        adminAPI.getPendingWithdrawals(adminId),
      ]);
      setPayments(paymentsData);
      setWithdrawals(withdrawalsData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError('Ошибка загрузки данных');
    }
  };

  const handlePaymentAction = async (paymentId: number, action: 'approve' | 'reject', reason?: string) => {
    const userData = getTelegramUserData();
    if (!userData) return;

    try {
      triggerHaptic('medium');
      if (action === 'approve') {
        await adminAPI.approvePayment({ payment_id: paymentId, admin_id: userData.userId });
        triggerNotification('success');
      } else {
        await adminAPI.rejectPayment({ payment_id: paymentId, admin_id: userData.userId, reason });
        triggerNotification('error');
      }
      
      // Reload data
      await loadData(userData.userId);
      const statsData = await adminAPI.getStats(userData.userId);
      setStats(statsData);
    } catch (err: any) {
      console.error('Payment action failed:', err);
      triggerNotification('error');
    }
  };

  const handleWithdrawalAction = async (withdrawalId: number, action: 'approve' | 'reject', reason?: string) => {
    const userData = getTelegramUserData();
    if (!userData) return;

    try {
      triggerHaptic('medium');
      if (action === 'approve') {
        await adminAPI.approveWithdrawal({ withdrawal_id: withdrawalId, admin_id: userData.userId });
        triggerNotification('success');
      } else {
        await adminAPI.rejectWithdrawal({ withdrawal_id: withdrawalId, admin_id: userData.userId, reason });
        triggerNotification('error');
      }
      
      // Reload data
      await loadData(userData.userId);
      const statsData = await adminAPI.getStats(userData.userId);
      setStats(statsData);
    } catch (err: any) {
      console.error('Withdrawal action failed:', err);
      triggerNotification('error');
    }
  };

  const formatUZS = (amount: number) => amount.toLocaleString('ru-RU');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFD400] animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] flex flex-col items-center justify-center p-6">
        <Shield className="w-16 h-16 text-[#FF4D4D] mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Доступ запрещён</h1>
        <p className="text-[#A0A0A0] text-center mb-6">{error || 'Требуются права администратора'}</p>
        <button
          onClick={onBack}
          className="bg-[#FFD400] text-black px-6 py-3 rounded-xl font-bold"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0E] flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#24242A] bg-[#0B0B0E] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#FFD400]" />
          <h1 className="text-xl font-bold text-white">Админ панель</h1>
        </div>
        <button
          onClick={onBack}
          className="text-[#A0A0A0] hover:text-white transition-colors"
        >
          Назад
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#24242A] bg-[#15151A]">
        {[
          { id: 'stats' as const, label: 'Статистика', icon: TrendingUp },
          { id: 'payments' as const, label: `Платежи (${payments.length})`, icon: CreditCard },
          { id: 'withdrawals' as const, label: `Выводы (${withdrawals.length})`, icon: Coins },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#FFD400] text-[#FFD400]'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span className="text-sm font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'stats' && stats && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                <div className="text-[#A0A0A0] text-xs font-bold mb-1">Всего пользователей</div>
                <div className="text-2xl font-bold text-white">{stats.total_users}</div>
              </div>
              <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                <div className="text-[#A0A0A0] text-xs font-bold mb-1">Активных</div>
                <div className="text-2xl font-bold text-white">{stats.active_users}</div>
              </div>
              <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                <div className="text-[#A0A0A0] text-xs font-bold mb-1">Ожидающих платежей</div>
                <div className="text-2xl font-bold text-[#FFD400]">{stats.pending_payments}</div>
              </div>
              <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                <div className="text-[#A0A0A0] text-xs font-bold mb-1">Ожидающих выводов</div>
                <div className="text-2xl font-bold text-[#FFD400]">{stats.pending_withdrawals}</div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-gradient-to-br from-[#1a4d3a] to-[#0d2e1f] rounded-xl p-6 border border-[#2d7a5a]">
              <div className="text-[#A0A0A0] text-xs font-bold mb-2">ОБЩИЙ ДОХОД</div>
              <div className="text-3xl font-bold text-white">{formatUZS(stats.total_revenue_uzs)} UZS</div>
            </div>

            <div className="bg-gradient-to-br from-[#1e1b4b] to-[#312e81] rounded-xl p-6 border border-[#4c1d95]">
              <div className="text-[#A0A0A0] text-xs font-bold mb-2">ОБЩИЕ ВЫПЛАТЫ</div>
              <div className="text-3xl font-bold text-white">{formatUZS(stats.total_payouts_uzs)} UZS</div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-[#A0A0A0]">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Нет ожидающих платежей</p>
              </div>
            ) : (
              payments.map(payment => (
                <div key={payment.id} className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-white font-bold">Платеж #{payment.id}</div>
                      <div className="text-[#A0A0A0] text-xs">User ID: {payment.user_id}</div>
                      <div className="text-[#A0A0A0] text-xs">
                        {new Date(payment.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{formatUZS(payment.amount_uzs)} UZS</div>
                      <div className="text-sm text-[#FFD400]">{payment.credits} 💎</div>
                    </div>
                  </div>
                  {payment.screenshot_url && (
                    <div className="mb-3">
                      <img src={payment.screenshot_url} alt="Screenshot" className="w-full rounded-lg max-h-48 object-contain" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePaymentAction(payment.id, 'approve')}
                      className="flex-1 bg-[#1A4D3A] hover:bg-[#2d7a5a] text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Одобрить
                    </button>
                    <button
                      onClick={() => handlePaymentAction(payment.id, 'reject', 'Отклонено администратором')}
                      className="flex-1 bg-[#2A1515] hover:bg-[#441111] text-[#FF4D4D] py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} />
                      Отклонить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="text-center py-12 text-[#A0A0A0]">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Нет ожидающих выводов</p>
              </div>
            ) : (
              withdrawals.map(withdrawal => (
                <div key={withdrawal.id} className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-white font-bold">Вывод #{withdrawal.id}</div>
                      <div className="text-[#A0A0A0] text-xs">User ID: {withdrawal.user_id}</div>
                      <div className="text-[#A0A0A0] text-xs mt-1">
                        {withdrawal.card_number} {withdrawal.card_type && `(${withdrawal.card_type})`}
                      </div>
                      <div className="text-[#A0A0A0] text-xs">
                        {new Date(withdrawal.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{formatUZS(withdrawal.amount_uzs)} UZS</div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        withdrawal.status === 'PENDING' ? 'bg-[#FFD400]/20 text-[#FFD400]' : 'bg-[#FF4D4D]/20 text-[#FF4D4D]'
                      }`}>
                        {withdrawal.status}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                      className="flex-1 bg-[#1A4D3A] hover:bg-[#2d7a5a] text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Одобрить
                    </button>
                    <button
                      onClick={() => handleWithdrawalAction(withdrawal.id, 'reject', 'Отклонено администратором')}
                      className="flex-1 bg-[#2A1515] hover:bg-[#441111] text-[#FF4D4D] py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} />
                      Отклонить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
