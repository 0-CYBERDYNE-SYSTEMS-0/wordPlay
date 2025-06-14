import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BookOpen, Search, Zap, ArrowRight, ArrowLeft } from "lucide-react";
import { useSettings } from "@/providers/SettingsProvider";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (userType: 'simple' | 'advanced') => void;
}

export default function WelcomeModal({ isOpen, onClose, onComplete }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<'simple' | 'advanced' | null>(null);
  const { updateSettings } = useSettings();

  const steps = [
    {
      title: "Welcome to WordPlay",
      subtitle: "Your AI-powered writing companion",
      content: (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Transform your writing with intelligent AI assistance that helps you write better, faster, and more effectively.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 border rounded-lg dark:border-gray-700">
              <BookOpen className="h-6 w-6 text-primary mb-2" />
              <h4 className="font-medium">Smart Writing</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI suggestions as you write</p>
            </div>
            <div className="p-4 border rounded-lg dark:border-gray-700">
              <Search className="h-6 w-6 text-primary mb-2" />
              <h4 className="font-medium">Research Assistant</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Find and cite sources automatically</p>
            </div>
            <div className="p-4 border rounded-lg dark:border-gray-700">
              <Zap className="h-6 w-6 text-primary mb-2" />
              <h4 className="font-medium">Quick Commands</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Type "/" for instant AI help</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Choose Your Experience",
      subtitle: "We'll customize WordPlay to match your needs",
      content: (
        <div className="space-y-4">
          <div 
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
              selectedUserType === 'simple' 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => setSelectedUserType('simple')}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold">Simple Mode</h3>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Perfect for writers who want clean, focused AI assistance without complexity.
                </p>
                <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  <div>✓ Essential slash commands (/continue, /improve, /fix)</div>
                  <div>✓ Smart writing suggestions</div>
                  <div>✓ Clean, distraction-free interface</div>
                  <div>✓ Can upgrade to Advanced mode anytime</div>
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
              selectedUserType === 'advanced' 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => setSelectedUserType('advanced')}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Advanced Mode</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Full-featured experience with AI agent, research tools, and all capabilities.
                </p>
                <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  <div>✓ All 17 slash commands</div>
                  <div>✓ Autonomous AI agent with 19 tools</div>
                  <div>✓ Research integration and source management</div>
                  <div>✓ Advanced text analysis and style metrics</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Let's Get Started!",
      subtitle: "Here's how to make the most of WordPlay",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {selectedUserType === 'simple' ? 'Simple Mode Activated' : 'Advanced Mode Activated'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {selectedUserType === 'simple' 
                ? "You'll see a clean, focused writing interface with essential AI features."
                : "You have access to all WordPlay features including the AI agent and research tools."
              }
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium mb-3">Quick Start Tips:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs">1</span>
                <span>Start typing in the editor - AI suggestions will appear automatically</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs">2</span>
                <span>Type "/" anywhere to open the command menu</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs">3</span>
                <span>
                  {selectedUserType === 'simple' 
                    ? "Try /continue to extend your writing or /improve to enhance it"
                    : "Explore the Research tab for AI-powered research capabilities"
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            You can always change your mode in Settings → User Experience
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    if (selectedUserType) {
      // Save user preference
      updateSettings({ 
        userExperienceMode: selectedUserType,
        hasCompletedOnboarding: true 
      });
      onComplete(selectedUserType);
      onClose();
    }
  };

  const canProceed = step === 0 || (step === 1 && selectedUserType) || step === 2;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Welcome to WordPlay</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center mb-8">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= step 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    index < step ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">{steps[step].title}</h2>
            <p className="text-gray-600 dark:text-gray-300">{steps[step].subtitle}</p>
          </div>

          <div className="mb-8">
            {steps[step].content}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>

            <div className="flex space-x-2">
              {step < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={!selectedUserType}
                  className="flex items-center space-x-2"
                >
                  <span>Start Writing</span>
                  <Sparkles className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}