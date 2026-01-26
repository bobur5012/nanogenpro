import React from 'react';
import { triggerHaptic, triggerNotification } from '../utils/haptics';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'error';
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  fullWidth = false,
  disabled = false,
  loading = false
}) => {
  // Height ~52-56px (py-4), Radius 14-16px (rounded-2xl)
  const baseStyles = "py-4 px-6 rounded-2xl font-bold text-[16px] transition-all duration-200 flex items-center justify-center leading-none relative overflow-hidden";
  
  const variants = {
    // Primary: Yellow #FFD400, Text Black
    primary: "bg-[#FFD400] hover:bg-[#E6BF00] text-black shadow-lg shadow-yellow-500/10 active:scale-95",
    // Secondary: Card BG #1A1A1F, Border #2A2A30, Text White
    secondary: "bg-[#1A1A1F] border border-[#2A2A30] hover:bg-[#24242A] text-white active:scale-95",
    // Ghost: Transparent
    ghost: "bg-transparent text-[#A0A0A0] hover:text-white active:scale-95",
    // Error: Red for insufficient funds or errors
    error: "bg-[#2A1515] border border-[#441111] text-[#FF4D4D] cursor-not-allowed opacity-80"
  };

  const currentVariant = disabled ? (variant === 'primary' ? 'error' : 'secondary') : variant;
  
  // Override styles for disabled state
  const disabledStyles = disabled ? "opacity-70 cursor-not-allowed active:scale-100" : "";

  const handleClick = () => {
      if (disabled || loading) {
          triggerNotification('error');
          return;
      }
      if (variant === 'primary') triggerHaptic('medium');
      else triggerHaptic('light');
      
      if (onClick) onClick();
  };

  return (
    <button 
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[currentVariant]} ${disabledStyles} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? (
          <div className="flex items-center gap-2 animate-pulse">
              <Loader2 size={20} className="animate-spin" />
              <span>Processing...</span>
          </div>
      ) : children}
    </button>
  );
};
