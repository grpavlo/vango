import { useState } from 'react';
import { ChevronLeft, Phone, UserCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface SendHelpRequestScreenProps {
  onBack: () => void;
}

type RequestState = 'initial' | 'waiting' | 'assigned';

const SendHelpRequestScreen = ({ onBack }: SendHelpRequestScreenProps) => {
  const [requestState, setRequestState] = useState<RequestState>('initial');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleConfirmRequest = () => {
    setShowConfirmDialog(false);
    setRequestState('waiting');
    
    // Mock delay before assigning courier
    setTimeout(() => {
      setRequestState('assigned');
    }, 3000);
  };

  const handleCallCourier = () => {
    window.location.href = 'tel:+15551234567';
  };

  if (requestState === 'initial') {
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
              Request Help
            </h1>
          </div>
          
          <div className="flex flex-col items-center justify-center space-y-6 mt-16">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Request Dispatcher Assistance</h2>
              <p className="text-muted-foreground">Do you need help to hand over samples to another courier?</p>
            </div>
            
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button className="w-full max-w-xs h-14 bg-primary hover:bg-primary/90 text-white text-lg font-medium">
                  Request Help
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[88%] rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Request Assistance</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you want to request dispatcher assistance to hand over samples?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmRequest}>Yes</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  if (requestState === 'waiting') {
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
              Help Request
            </h1>
          </div>
          
          <div className="flex flex-col items-center justify-center space-y-6 mt-16">
            <div className="w-full max-w-sm bg-card rounded-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Loader2 size={32} className="text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Request sent</h2>
              <p className="text-muted-foreground">We're finding another courier. Please wait...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Help Request
          </h1>
        </div>
        
        <div className="flex flex-col items-center justify-center space-y-6 mt-16">
          <div className="w-full max-w-sm bg-card rounded-2xl p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <UserCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Courier assigned</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <UserCircle size={20} className="text-muted-foreground" />
                <span className="font-medium text-foreground">Alex Rivera</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={20} className="text-muted-foreground" />
                <span className="font-mono text-foreground">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-muted-foreground" />
                <span className="text-foreground">ETA: 12 minutes</span>
              </div>
            </div>
            
            <Button
              onClick={handleCallCourier}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-3"
            >
              <Phone size={20} />
              Call Courier
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendHelpRequestScreen;