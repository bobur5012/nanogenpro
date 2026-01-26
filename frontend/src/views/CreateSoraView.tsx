import React, { useState, useEffect } from 'react';
import { Video, Coins, AlertTriangle, Monitor, Smartphone, Sparkles, Film } from 'lucide-react';
import { Button } from '../components/Button';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { BalanceDisplay } from '../components/BalanceDisplay';

interface CreateSoraViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

const PRICE_PER_SEC = 0.315;
const CREDITS_PER_DOLLAR = 100;

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
];

export const CreateSoraView: React.FC<CreateSoraViewProps> = ({ userCredits, onOpenProfile }) => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      console.log("MODEL_SELECTED: Sora 2 Pro");
  }, []);

  const costUSD = duration * PRICE_PER_SEC;
  const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
  const remainingCredits = userCredits - costCredits;
  const canAfford = userCredits >= costCredits;
  const isValid = prompt.trim().length > 0;

  const handleDurationChange = (d: 5 | 10) => {
    if (duration !== d) {
        triggerSelection();
        setDuration(d);
    }
  };

  const handleResolutionChange = (r: '720p' | '1080p') => {
      if (resolution !== r) {
          triggerSelection();
          setResolution(r);
      }
  };

  const handleSubmit = () => {
    if (!canAfford || !isValid) {
        triggerNotification('error');
        return;
    }

    setIsSubmitting(true);
    triggerHaptic('medium');
    
    setTimeout(() => {
        const payload = {
            type: 'video_gen',
            payload: {
                model: 'sora-2-pro',
                prompt,
                duration: `${duration}s`,
                resolution,
                ratio: aspectRatio,
                cost: costCredits
            }
        };
        window.Telegram.WebApp.sendData(JSON.stringify(payload));
    }, 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
        <div>
            <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                Sora 2 Pro <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-lg shadow-indigo-500/20">PREMIUM</span>
            </h1>
            <div className="flex flex-col mt-1">
                <span className="text-[10px] text-[#A0A0A0] font-mono flex items-center gap-1.5">
                    <Sparkles size={10} className="text-purple-400" /> Cinematic Text to Video
                </span>
            </div>
        </div>
        <div className="flex flex-col items-end gap-1">
             <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
             <span className="text-[9px] text-[#505055] font-mono font-bold">
                 ${PRICE_PER_SEC}/s
             </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 pb-20">
        
        {/* Generation Settings */}
        <div className="space-y-5">
            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
            
            {/* Duration */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Длительность</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                       onClick={() => handleDurationChange(5)} 
                       className={`rounded-xl text-xs font-bold py-3 transition-all border ${duration === 5 ? 'bg-[#24242A] text-white border-white/10' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}
                    >
                        5 секунд
                    </button>
                    <button 
                       onClick={() => handleDurationChange(10)} 
                       className={`rounded-xl text-xs font-bold py-3 transition-all border ${duration === 10 ? 'bg-[#24242A] text-white border-white/10' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}
                    >
                        10 секунд
                    </button>
                </div>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Качество</label>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleResolutionChange('720p')} className={`py-3 rounded-xl border text-xs font-bold transition-all ${resolution === '720p' ? 'bg-[#24242A] text-white border-white/10' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                        720p
                    </button>
                    <button onClick={() => handleResolutionChange('1080p')} className={`py-3 rounded-xl border text-xs font-bold transition-all ${resolution === '1080p' ? 'bg-[#24242A] text-white border-white/10' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                        1080p (HD)
                    </button>
                 </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Формат</label>
                 <div className="grid grid-cols-2 gap-3">
                     {RATIOS.map((r) => {
                         const Icon = r.icon;
                         const isSelected = aspectRatio === r.id;
                         return (
                             <button
                                key={r.id}
                                onClick={() => { triggerSelection(); setAspectRatio(r.id); }}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                    isSelected 
                                    ? 'bg-[#FFD400] border-[#FFD400] text-black' 
                                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                }`}
                             >
                                 <Icon size={16} />
                                 <span className="text-xs font-bold">{r.label}</span>
                             </button>
                         );
                     })}
                 </div>
            </div>
        </div>

        {/* Prompt Section */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Кинематографичный промпт</label>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={5000}
                placeholder="Опишите сцену детально. Используйте кинематографические термины, опишите освещение и движение камеры..."
                className="w-full h-40 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
            />
            <div className="flex justify-between px-1">
                <span className="text-[10px] text-[#505055] flex items-center gap-1">
                    <Sparkles size={10} className="text-[#FFD400]" />
                    AI Enhanced
                </span>
                <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/5000</span>
            </div>
        </div>

        {/* Cost Preview Section */}
        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-4">
             <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Premium model — higher cost</span>
             </div>
             
             <div className="space-y-3">
                 <div className="flex justify-between items-center text-xs">
                     <span className="text-[#A0A0A0]">Тариф</span>
                     <span className="font-mono text-[#A0A0A0]">${PRICE_PER_SEC} / сек</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                     <span className="text-[#A0A0A0]">Длительность</span>
                     <span className="font-mono text-[#A0A0A0]">{duration}с</span>
                 </div>
                 <div className="h-px bg-[#24242A]" />
                 <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                         <Coins size={16} className={canAfford ? 'text-[#FFD400]' : 'text-[#FF4D4D]'} />
                         <span className="text-sm font-bold text-white">Итого</span>
                     </div>
                     <div className="flex flex-col items-end">
                         <span className="text-lg font-bold text-white">{costCredits} CR</span>
                         <span className="text-[10px] text-[#505055] font-mono">(${costUSD.toFixed(3)})</span>
                     </div>
                 </div>
             </div>
             
             {!canAfford && (
                 <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                    <AlertTriangle size={12} />
                    <span>Недостаточно средств</span>
                </div>
             )}
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
        <Button 
            fullWidth 
            onClick={handleSubmit} 
            disabled={!isValid || !canAfford}
            loading={isSubmitting}
        >
             {isSubmitting ? (
                 <span className="flex items-center gap-2">
                     Генерация с Sora...
                 </span>
             ) : (
                 <div className="flex items-center gap-2 justify-center">
                     <Film size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                     <span>{canAfford ? (isValid ? 'Сгенерировать видео' : 'Введите промпт') : 'Пополнить баланс'}</span>
                 </div>
             )}
        </Button>
      </div>
    </div>
  );
};