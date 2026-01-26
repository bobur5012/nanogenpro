import React from 'react';
import { Star, Lock, Box } from 'lucide-react';
import { triggerSelection } from '../utils/haptics';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  mode: string;
  priceDescription: string;
  description: string;
  isPremium?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  icon?: React.ElementType;
}

interface ModelSelectorProps {
  models: ModelOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedId, onSelect, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {models.map((model) => {
        const isSelected = selectedId === model.id;
        const Icon = model.icon || Box;
        
        return (
            <button
                key={model.id}
                onClick={() => {
                    if (!model.disabled) {
                        triggerSelection();
                        onSelect(model.id);
                    }
                }}
                disabled={model.disabled}
                className={`w-full text-left relative p-3 rounded-2xl border transition-all duration-200 group
                    ${isSelected 
                        ? 'bg-[#FFD400]/5 border-[#FFD400] shadow-[0_0_15px_-3px_rgba(255,212,0,0.1)]' 
                        : 'bg-[#15151A] border-[#24242A] hover:border-[#FFD400]/30'}
                    ${model.disabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98]'}
                `}
            >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors
                             ${isSelected ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-[#FFD400]/20' : 'bg-[#1A1A1F] border-[#2A2A30] text-[#505055]'}
                         `}>
                             <Icon size={20} strokeWidth={2.5} />
                         </div>
                         <div>
                             <div className="flex items-center gap-2">
                                 <span className={`font-bold text-sm leading-none ${isSelected ? 'text-white' : 'text-[#E0E0E0]'}`}>
                                     {model.name}
                                 </span>
                                 {model.isPremium && (
                                     <span className="bg-[#FFD400] text-black text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                         <Star size={8} fill="black" /> PRO
                                     </span>
                                 )}
                             </div>
                             <div className="text-[10px] text-[#A0A0A0] font-mono mt-1.5 flex items-center gap-1.5">
                                <span className="uppercase tracking-wider opacity-70">{model.provider}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-[#505055]" />
                                <span>{model.mode}</span>
                             </div>
                        </div>
                    </div>
                    
                    {/* Price Badge */}
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${isSelected ? 'bg-[#FFD400]/10 border-[#FFD400]/30 text-[#FFD400]' : 'bg-[#1A1A1F] border-[#2A2A30] text-[#A0A0A0]'}`}>
                        {model.priceDescription}
                    </div>
                </div>
                
                {/* Description Footer */}
                 <div className="pl-[52px]">
                    {(model.disabled && model.disabledReason) ? (
                        <div className="flex items-center gap-1.5 text-[#FF4D4D] text-[10px] bg-[#2A1515] px-2 py-1 rounded-lg inline-block border border-[#441111]">
                            <Lock size={10} /> {model.disabledReason}
                        </div>
                    ) : (
                        <p className={`text-[11px] leading-snug transition-colors ${isSelected ? 'text-white/70' : 'text-[#505055]'}`}>
                            {model.description}
                        </p>
                    )}
                 </div>
            </button>
        );
      })}
    </div>
  );
};
