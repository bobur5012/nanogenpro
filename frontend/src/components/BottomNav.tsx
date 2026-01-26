import React from 'react';
import { Home, Flame, Plus, History, User } from 'lucide-react';
import { Tab } from '../types';
import { triggerSelection, triggerHaptic } from '../utils/haptics';

interface BottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCentralClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, onCentralClick }) => {
  
  const handleTabClick = (tab: Tab) => {
      if (currentTab !== tab) {
          triggerSelection();
          onTabChange(tab);
      }
  };

  const handleCentral = () => {
      triggerHaptic('medium');
      onCentralClick();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0B0B0E]/95 backdrop-blur-xl border-t border-[#24242A] pb-safe pt-2 px-4 z-50">
      <div className="flex justify-between items-end max-w-md mx-auto h-16 pb-2 relative">
        
        {/* Left Side */}
        <div className="flex gap-1">
            <NavButton 
                active={currentTab === 'home'} 
                onClick={() => handleTabClick('home')} 
                icon={Home} 
                label="Главная" 
            />
            <NavButton 
                active={currentTab === 'trends'} 
                onClick={() => handleTabClick('trends')} 
                icon={Flame} 
                label="Тренды" 
            />
        </div>

        {/* Center Floating Button - Absolute positioning to pop out if needed, or just flow naturally */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
            <button
                onClick={handleCentral}
                className="w-16 h-16 bg-[#FFD400] rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20 active:scale-90 transition-transform text-black"
            >
                <Plus size={32} strokeWidth={2.5} />
            </button>
        </div>

        {/* Right Side */}
        <div className="flex gap-1">
             <NavButton 
                active={currentTab === 'history'} 
                onClick={() => handleTabClick('history')} 
                icon={History} 
                label="История" 
            />
             <NavButton 
                active={currentTab === 'profile'} 
                onClick={() => handleTabClick('profile')} 
                icon={User} 
                label="Профиль" 
            />
        </div>
      </div>
      {/* Safe area spacing for iOS home indicator */}
      <div className="h-4 w-full" /> 
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1.5 p-2 w-16 transition-colors ${
        active ? 'text-[#FFD400]' : 'text-[#A0A0A0] hover:text-white'
        }`}
    >
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-medium tracking-wide">
            {label}
        </span>
    </button>
);
