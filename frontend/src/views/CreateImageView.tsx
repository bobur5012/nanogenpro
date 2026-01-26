import React, { useState, useMemo } from 'react';
import { Square, Smartphone, Monitor, Wand2, Sparkles, AlertCircle, Zap, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { ModelSelector, ModelOption } from '../components/ModelSelector';
import { triggerHaptic } from '../utils/haptics';

interface CreateImageViewProps {
  userCredits: number;
}

const RATIOS = [
  { id: '1:1', label: '1:1', name: 'Квадрат', icon: Square },
  { id: '9:16', label: '9:16', name: 'Story', icon: Smartphone },
  { id: '16:9', label: '16:9', name: 'Cinema', icon: Monitor },
];

const MODELS: ModelOption[] = [
    {
        id: 'nano-v3-turbo',
        name: 'NanoGen v3.5 Turbo',
        provider: 'NanoAI',
        mode: 'Text → Image',
        priceDescription: '1 CR',
        description: 'Быстрая генерация, отлично подходит для экспериментов и драфтов.',
        icon: Zap
    },
    {
        id: 'nano-v4-pro',
        name: 'NanoGen v4.0 Pro',
        provider: 'NanoAI',
        mode: 'Text → Image',
        priceDescription: '4 CR',
        description: 'Максимальная детализация, фотореализм и сложное освещение.',
        isPremium: true,
        icon: ImageIcon
    },
    {
        id: 'nano-flux-alpha',
        name: 'Flux Alpha',
        provider: 'External',
        mode: 'Text → Image',
        priceDescription: '8 CR',
        description: 'Экспериментальная модель с высочайшим разрешением.',
        isPremium: true,
        disabled: true,
        disabledReason: 'Тех. обслуживание',
        icon: Sparkles
    }
];

export const CreateImageView: React.FC<CreateImageViewProps> = ({ userCredits }) => {
  const [prompt, setPrompt] = useState('');
  const [magicPrompt, setMagicPrompt] = useState(true);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[0].id);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const selectedModel = useMemo(() => MODELS.find(m => m.id === selectedModelId) || MODELS[0], [selectedModelId]);
  
  // Dynamic Cost Calculation
  const cost = useMemo(() => {
      if (selectedModelId === 'nano-v4-pro') return 4;
      if (selectedModelId === 'nano-flux-alpha') return 8;
      return 1;
  }, [selectedModelId]);

  const canAfford = userCredits >= cost;
  const isValid = prompt.trim().length > 0;

  const handleSubmit = () => {
    if (!canAfford) return;
    if (!isValid) return;

    setIsSubmitting(true);
    triggerHaptic('medium');
    
    // Simulate short network delay for better UX
    setTimeout(() => {
        const payload = {
            type: 'image_gen',
            payload: {
                model: selectedModelId,
                prompt,
                ratio: selectedRatio,
                magic: magicPrompt
            }
        };
        window.Telegram.WebApp.sendData(JSON.stringify(payload));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
        <div>
            <h1 className="font-bold text-lg text-white leading-none">Image Gen</h1>
            <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block">
                {selectedModel.name}
            </span>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold transition-colors ${canAfford ? 'bg-[#15151A] border-[#24242A] text-[#FFD400]' : 'bg-[#2A1515] border-[#FF4D4D] text-[#FF4D4D]'}`}>
            {userCredits} CR
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Model Selector */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Модель</label>
            <ModelSelector 
                models={MODELS} 
                selectedId={selectedModelId} 
                onSelect={setSelectedModelId} 
            />
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-1">
             <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider">Ваш запрос</label>
             <button 
                onClick={() => setMagicPrompt(!magicPrompt)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    magicPrompt 
                    ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' 
                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                }`}
             >
                <Wand2 size={10} />
                Magic {magicPrompt ? 'ON' : 'OFF'}
             </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите, что хотите увидеть..."
            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-base"
          />
        </div>

        {/* Ratios */}
        <div className="space-y-2">
           <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Формат</label>
           <div className="grid grid-cols-3 gap-3">
             {RATIOS.map((ratio) => {
                 const Icon = ratio.icon;
                 return (
                     <button
                        key={ratio.id}
                        onClick={() => setSelectedRatio(ratio.id)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                            selectedRatio === ratio.id
                                ? 'bg-[#FFD400] border-[#FFD400] text-black' 
                                : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                        }`}
                     >
                         <Icon size={20} className="mb-2" />
                         <span className="text-xs font-bold">{ratio.name}</span>
                     </button>
                 )
             })}
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
                <span>Sending to {selectedModel.name}...</span>
             ) : (
                 <div className="flex items-center gap-2 justify-center">
                     <Sparkles size={18} />
                     <span>{canAfford ? 'Создать' : 'Пополнить баланс'}</span>
                     {canAfford && (
                        <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            {cost} CR
                        </span>
                     )}
                 </div>
             )}
        </Button>
      </div>
    </div>
  );
};