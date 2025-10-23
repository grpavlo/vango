import { useState } from 'react';
import { ChevronLeft, Phone, PhoneCall } from 'lucide-react';
import { Button } from './ui/button';

interface CallDispatcherScreenProps {
  onBack: () => void;
}

const CallDispatcherScreen = ({ onBack }: CallDispatcherScreenProps) => {
  const [isCalling, setIsCalling] = useState(false);
  const dispatcherNumber = "+1 (555) 987-6543";

  const handleCall = () => {
    setIsCalling(true);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    onBack();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-muted"
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            Call Dispatcher
          </h1>
        </div>
        
        {!isCalling ? (
          <div className="flex flex-col items-center justify-center space-y-6 mt-16">
            <div className="text-center space-y-2">
              <p className="text-lg text-muted-foreground">Contact dispatcher</p>
              <p className="text-xl font-mono text-foreground">{dispatcherNumber}</p>
            </div>
            
            <Button
              onClick={handleCall}
              className="w-full max-w-xs h-14 bg-primary hover:bg-primary/90 text-white text-lg font-medium flex items-center gap-3"
            >
              <Phone size={24} />
              Call Now
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-8 mt-16">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center animate-pulse">
                <PhoneCall size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Calling Dispatcher...</h2>
              <p className="text-muted-foreground">{dispatcherNumber}</p>
            </div>
            
            <Button
              onClick={handleEndCall}
              className="w-full max-w-xs h-14 bg-red-600 hover:bg-red-700 text-white text-lg font-medium flex items-center gap-3"
            >
              End Call
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallDispatcherScreen;