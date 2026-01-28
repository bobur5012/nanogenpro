import React, { useState, useEffect } from 'react';
import { User, ArrowUpCircle, Code, ChevronRight, Clapperboard, Film, Layers, Sparkles, Zap, Video, Brain, LayoutTemplate, Image as ImageIcon, Shield, CreditCard, Users } from 'lucide-react';
import { adminAPI } from '../utils/api';
import { getTelegramUserData } from '../utils/generationHelpers';

interface DebugHubProps {
  onNavigate: (screen: string) => void;
}

export const DebugHub: React.FC<DebugHubProps> = ({ onNavigate }) => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const userData = getTelegramUserData();
    if (!userData) return;

    try {
      await adminAPI.getStats(userData.userId);
      setIsAdmin(true);
    } catch {
      setIsAdmin(false);
    }
  };

  const screens = [
    { id: 'kling', label: 'Kling 2.6 Pro (Text)', icon: Clapperboard, desc: '/kling', color: 'text-rose-500' },
    { id: 'kling_img2vid', label: 'Kling 2.6 Pro (Image)', icon: Film, desc: '/kling-i2v', color: 'text-orange-400' },
    { id: 'kling_o1', label: 'Kling Video O1', icon: Layers, desc: '/kling-o1', color: 'text-purple-400' },
    { id: 'kling_turbo', label: 'Kling v2.5 Turbo Pro', icon: Zap, desc: '/kling-turbo', color: 'text-yellow-400' },
    { id: 'seedance', label: 'Seedance 1.0', icon: Video, desc: '/seedance', color: 'text-emerald-400' },
    { id: 'wan', label: 'Wan 2.5', icon: Film, desc: '/wan', color: 'text-indigo-400' },
    { id: 'wan_2_6', label: 'Wan 2.6', icon: Film, desc: '/wan-2-6', color: 'text-blue-400' },
    { id: 'runway_gen4', label: 'Runway Gen-4 Turbo', icon: Zap, desc: '/runway-gen4', color: 'text-yellow-400' },
    { id: 'gpt_image', label: 'GPT Image 1.5', icon: Brain, desc: '/gpt-image', color: 'text-green-400' },
    { id: 'imagen_4', label: 'Imagen 4.0', icon: LayoutTemplate, desc: '/imagen-4', color: 'text-blue-400' },
    { id: 'nano_banana', label: 'Nano Banana', icon: ImageIcon, desc: '/nano-banana', color: 'text-yellow-500' },
    { id: 'sora', label: 'Sora 2 Pro', icon: Sparkles, desc: '/sora', color: 'text-blue-500' },
    { id: 'veo', label: 'Veo 3.1', icon: Film, desc: '/veo', color: 'text-cyan-400' },

    { id: 'profile', label: 'Профиль', icon: User, desc: '/profile', color: 'text-blue-400' },
    { id: 'payment', label: 'Пополнение (Тест)', icon: CreditCard, desc: '/payment', color: 'text-[#FFD400]' },
    { id: 'referral', label: 'Партнёрка (Тест)', icon: Users, desc: '/referral', color: 'text-[#FFD400]' },
    { id: 'admin', label: 'Админ панель', icon: Shield, desc: '/admin', color: 'text-red-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0E] p-5 flex flex-col pt-10">
      <div className="mb-8 text-center space-y-3">
        <div className="w-20 h-20 bg-[#15151A] rounded-2xl border border-[#24242A] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/10">
          <Code size={40} className="text-[#FFD400]" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">AI Studio</h1>
        <p className="text-[#A0A0A0] text-sm font-medium">Панель управления моделями</p>
      </div>

      <div className="space-y-3">
        {screens.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className="w-full bg-[#15151A] border border-[#24242A] hover:border-[#FFD400] active:scale-[0.98] transition-all p-4 rounded-2xl flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1A1A22] flex items-center justify-center group-hover:bg-[#FFD400] transition-colors border border-[#24242A] group-hover:border-[#FFD400]">
                  <Icon size={24} className={`${s.color} group-hover:text-black transition-colors`} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-lg leading-none mb-1">{s.label}</h3>
                  <p className="text-xs text-[#505055] font-mono">{s.desc}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#24242A] group-hover:text-[#FFD400] transition-colors" />
            </button>
          )
        })}
      </div>
    </div>
  );
};
