import React, { useState } from 'react';
import { OnboardingStep } from '../types';
import { Button } from './Button';
import { ChevronRight, Sparkles, Video, Coins } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "Творите шедевры в один клик",
    description: "Больше не нужно быть художником. Опишите идею словами или выберите готовый стиль — Art, Реализм или Аниме.",
    image: "https://picsum.photos/seed/art/600/800", // Placeholder for AI Art
    buttonText: "Далее"
  },
  {
    id: 2,
    title: "Оживите идеи с помощью видео",
    description: "Превращайте текст или картинки в захватывающие видеоролики. Мы отправим готовый результат прямо в бот.",
    image: "https://picsum.photos/seed/video/600/800", // Placeholder for Video preview
    buttonText: "Далее"
  },
  {
    id: 3,
    title: "Платите только за результат",
    description: "Никаких подписок. Используйте кредиты для генерации. Мы дарим 10 кредитов для старта!",
    image: "https://picsum.photos/seed/tech/600/800", // Placeholder for Credits/Coin visual
    buttonText: "Начать бесплатно"
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderIcon = (id: number) => {
    switch (id) {
      case 1: return <Sparkles className="w-12 h-12 text-indigo-400 mb-4" />;
      case 2: return <Video className="w-12 h-12 text-indigo-400 mb-4" />;
      case 3: return <Coins className="w-12 h-12 text-indigo-400 mb-4" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[50%] bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-purple-600/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <div className="flex justify-end p-4 z-10">
        {!isLastStep && (
          <Button variant="ghost" onClick={handleSkip} className="text-sm">
            Пропустить
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10">
        {/* Dynamic Image Area */}
        <div className="w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/10 mb-8 relative border border-gray-800">
           <img 
            src={currentStep.image} 
            alt={currentStep.title} 
            className="w-full h-full object-cover animate-fade-in"
            key={currentStep.id} // Forces re-render for animation
           />
           {/* Overlay Gradient */}
           <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
           
           {/* Icon Badge */}
           <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-md p-3 rounded-xl border border-gray-700">
              {renderIcon(currentStep.id)}
           </div>
        </div>

        {/* Text Content */}
        <div className="w-full text-left space-y-4 animate-slide-up">
          <h1 className="text-3xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            {currentStep.title}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            {currentStep.description}
          </p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 w-full z-10 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent pt-12">
        
        {/* Step Indicators */}
        <div className="flex space-x-2 mb-6 justify-center">
          {STEPS.map((step, index) => (
            <div 
              key={step.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentStepIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <Button 
          fullWidth 
          onClick={handleNext}
          className="flex items-center justify-center gap-2"
        >
          {currentStep.buttonText}
          {!isLastStep && <ChevronRight size={20} />}
        </Button>
      </div>
    </div>
  );
};
