import React, { useState, useMemo } from 'react';
import { Video, AlertCircle, Smartphone, Monitor, Clapperboard, Zap } from 'lucide-react';
import { Button } from '../components/Button';
import { ModelSelector, ModelOption } from '../components/ModelSelector';
import { triggerHaptic } from '../utils/haptics';

interface CreateVideoViewProps {
  userCredits: number;
}

const MODELS: ModelOption[] = [
    {
        id: 'motion-v2-fast',
        name: 'NanoMotion v2.0 Fast',
        provider: 'NanoAI',
        mode: 'Text → Video',
        priceDescription: 'от 5 CR',
        description: 'Оптимизирован для скорости. Идеально для соцсетей и мемов.',
        icon: Zap
    },
    {
        id: 'motion-v2-cinema',
        name: 'NanoMotion v2.0 Cinema',
        provider: 'NanoAI',
        mode: 'Text → Video',
        priceDescription: 'от 12 CR',
        description: 'Кинематографичное качество. Высокая плавность и детализация.',
        isPremium: true,
        icon: Clapperboard
    }
];

export const CreateVideoView: React.FC<CreateVideoViewProps> = ({ userCredits }) => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<'5s' | '10s'>('5s');
  const [quality, setQuality] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedModel = useMemo(() => MODELS.find(m => m.id === selectedModelId) || MODELS[0], [selectedModelId]);

  const totalCost = useMemo(() => {
    let base = selectedModelId === 'motion-v2-cinema' ? 12 : 5;
    
    // Multipliers
    if (duration === '10s') base *= 2;
    if (quality === '1080p') base = Math.ceil(base * 1.5);
    
    return base;
  }, [selectedModelId, duration, quality]);

  const canAfford = userCredits >= totalCost;
  const isValid = prompt.trim().length > 0;

  const handleSubmit = () => {
    if (!canAfford || !isValid) return;

    setIsSubmitting(true);
    triggerHaptic('medium');
    
    setTimeout(() => {
        const payload = {
            type: 'video_gen',
            payload: {
                model: selectedModelId,
                prompt,
                duration,
                quality,
                ratio: aspectRatio,
                type: selectedModelId === 'motion-v2-cinema' ? 'cinema' : 'fast'
            }
        };
        window.Telegram.WebApp.sendData(JSON.stringify(payload));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
      <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
        <div>
            <h1 className="font-bold text-lg text-white leading-none">Video Gen</h1>
            <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block">
                {selectedModel.name}
            </span>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold transition-colors ${canAfford ? 'bg-[#15151A] border-[#24242A] text-[#FFD400]' : 'bg-[#2A1515] border-[#FF4D4D] text-[#FF4D4D]'}`}>
            {userCredits} CR
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
         <div className="bg-[#15151A] border border-[#24242A] p-4 rounded-xl flex gap-3 items-start">
            <AlertCircle className="text-[#FFD400] min-w-[20px]" size={20} />
            <div className="text-xs text-[#A0A0A0]">
                <span className="font-bold block mb-1 text-white">Асинхронная генерация</span>
                Бот пришлет готовое видео через 2-5 минут.
            </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Модель</label>
            <ModelSelector 
                models={MODELS} 
                selectedId={selectedModelId} 
                onSelect={setSelectedModelId} 
            />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Сценарий</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите движение и атмосферу..."
            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-xl p-4 text-white focus:border-[#FFD400] focus:outline-none transition-all resize-none"
          />
        </div>

        <div className="space-y-2">
            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Параметры</label>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDuration('5s')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${duration === '5s' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    5 сек
                </button>
                <button onClick={() => setDuration('10s')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${duration === '10s' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    10 сек (x2)
                </button>
                <button onClick={() => setQuality('720p')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${quality === '720p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    720p
                </button>
                 <button onClick={() => setQuality('1080p')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${quality === '1080p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    1080p (x1.5)
                </button>
            </div>
        </div>
        
         <div className="space-y-2">
            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Формат</label>
            <div className="flex gap-3">
                 <button onClick={() => setAspectRatio('9:16')} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '9:16' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    <Smartphone size={16} /> 9:16
                </button>
                <button onClick={() => setAspectRatio('16:9')} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '16:9' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>
                    <Monitor size={16} /> 16:9
                </button>
            </div>
        </div>
      </div>

      <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
        {!canAfford && (
            <div className="mb-3 flex items-center gap-2 text-[#FF4D4D] text-xs font-bold justify-center bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                <AlertCircle size={14} />
                <span>Недостаточно кредитов</span>
            </div>
        )}
        <Button 
            fullWidth 
            onClick={handleSubmit} 
            disabled={!isValid || !canAfford}
            loading={isSubmitting}
        >
             {isSubmitting ? (
                 <span>Starting {selectedModel.name}...</span>
             ) : (
                 <div className="flex items-center gap-2 justify-center">
                     <Video size={18} />
                     <span>{canAfford ? 'Создать' : 'Пополнить баланс'}</span>
                     {canAfford && <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold">{totalCost} CR</span>}
                 </div>
             )}
        </Button>
      </div>
    </div>
  );
};