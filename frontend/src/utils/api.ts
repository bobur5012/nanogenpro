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
    throw new Error(error.detail || `HTTP ${response.status}`);
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
    model_id: string;
    prompt: string;
    negative_prompt?: string;
    parameters?: Record<string, any>;
  }) => fetchAPI<{ generation_id: number; status: string }>('/api/generation/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getStatus: (id: number) => fetchAPI<{
    status: string;
    result_url?: string;
    error_message?: string;
  }>(`/api/generation/status/${id}`),
  
  getHistory: (userId: number) => fetchAPI<any[]>(`/api/generation/history/${userId}`),
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

export default { userAPI, generationAPI, paymentAPI };
