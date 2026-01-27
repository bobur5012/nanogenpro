// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add Telegram init data for authentication
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    defaultHeaders['X-Telegram-Init-Data'] = tg.initData;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    // Если ошибка структурированная (с code и message)
    if (error.code && error.message) {
      throw new Error(JSON.stringify({ code: error.code, message: error.message }));
    }
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// User API
export const userAPI = {
  auth: () => fetchAPI<{ user: any; credits: number }>('/api/user/auth', { method: 'POST' }),
  getBalance: (userId: number) => fetchAPI<{ credits: number }>(`/api/user/balance/${userId}`),
  getReferralStats: (userId: number) => fetchAPI<any>(`/api/user/referral/${userId}`),
};

// Generation API
export const generationAPI = {
  start: (data: {
    user_id: number;
    init_data: string;
    model_id: string;
    model_name: string;
    generation_type: 'image' | 'video';
    prompt: string;
    negative_prompt?: string;
    parameters?: Record<string, any>;
    image_url?: string;
    idempotency_key?: string;
  }) => fetchAPI<{ 
    id: number; 
    status: string; 
    message: string;
    credits_charged: number;
    estimated_time?: number;
    new_balance?: number;
  }>('/api/generation/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getStatus: (id: number) => fetchAPI<{
    id: number;
    status: string;
    result_url?: string;
    error_message?: string;
    created_at: string;
    completed_at?: string;
  }>(`/api/generation/status/${id}`),
  
  getHistory: (userId: number, limit?: number, offset?: number) => fetchAPI<{
    items: Array<{
      id: number;
      model_name: string;
      prompt: string;
      status: string;
      credits_charged: number;
      created_at: string;
      result_url?: string;
    }>;
    total: number;
  }>(`/api/generation/history/${userId}${limit ? `?limit=${limit}&offset=${offset || 0}` : ''}`),
  
  cancel: (generationId: number, userId: number) => fetchAPI<{
    id: number;
    status: string;
    credits_refunded: number;
    new_balance: number;
  }>(`/api/generation/cancel/${generationId}`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  }),
};

// Payment API
export const paymentAPI = {
  topup: (data: { amount: number; screenshot?: string }) => 
    fetchAPI<{ transaction_id: number }>('/api/user/topup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  withdraw: (data: { amount: number; card: string }) =>
    fetchAPI<{ success: boolean }>('/api/user/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Admin API
export const adminAPI = {
  getStats: (adminId: number) => fetchAPI<{
    total_users: number;
    active_users: number;
    pending_payments: number;
    pending_withdrawals: number;
    total_revenue_uzs: number;
    total_payouts_uzs: number;
  }>(`/api/admin/stats?admin_id=${adminId}`),
  
  getPendingPayments: (adminId: number) => fetchAPI<Array<{
    id: number;
    user_id: number;
    amount_uzs: number;
    credits: number;
    screenshot_url?: string;
    created_at: string;
  }>>(`/api/admin/payments/pending?admin_id=${adminId}`),
  
  getPendingWithdrawals: (adminId: number) => fetchAPI<Array<{
    id: number;
    user_id: number;
    amount_uzs: number;
    card_number: string;
    card_type?: string;
    status: string;
    created_at: string;
  }>>(`/api/admin/withdrawals/pending?admin_id=${adminId}`),
  
  approvePayment: (data: { payment_id: number; admin_id: number }) => 
    fetchAPI<{ status: string; user_id: number; credits: number }>('/api/admin/payment/action', {
      method: 'POST',
      body: JSON.stringify({ ...data, action: 'approve' }),
    }),
    
  rejectPayment: (data: { payment_id: number; admin_id: number; reason?: string }) => 
    fetchAPI<{ status: string; user_id: number; reason: string }>('/api/admin/payment/action', {
      method: 'POST',
      body: JSON.stringify({ ...data, action: 'reject' }),
    }),
    
  approveWithdrawal: (data: { withdrawal_id: number; admin_id: number }) => 
    fetchAPI<{ status: string; user_id: number; amount_uzs: number }>('/api/admin/withdrawal/action', {
      method: 'POST',
      body: JSON.stringify({ ...data, action: 'approve' }),
    }),
    
  rejectWithdrawal: (data: { withdrawal_id: number; admin_id: number; reason?: string }) => 
    fetchAPI<{ status: string; user_id: number; reason: string }>('/api/admin/withdrawal/action', {
      method: 'POST',
      body: JSON.stringify({ ...data, action: 'reject' }),
    }),
    
  adjustCredits: (userId: number, adminId: number, amount: number, reason: string) => 
    fetchAPI<{ user_id: number; old_balance: number; new_balance: number; adjustment: number }>(
      `/api/admin/user/${userId}/credits?admin_id=${adminId}&amount=${amount}&reason=${encodeURIComponent(reason)}`,
      { method: 'POST' }
    ),
    
  banUser: (userId: number, adminId: number, reason: string) => 
    fetchAPI<{ user_id: number; is_banned: boolean }>(
      `/api/admin/user/${userId}/ban?admin_id=${adminId}&reason=${encodeURIComponent(reason)}`,
      { method: 'POST' }
    ),
    
  unbanUser: (userId: number, adminId: number) => 
    fetchAPI<{ user_id: number; is_banned: boolean }>(
      `/api/admin/user/${userId}/unban?admin_id=${adminId}`,
      { method: 'POST' }
    ),
};

export default { userAPI, generationAPI, paymentAPI, adminAPI };
