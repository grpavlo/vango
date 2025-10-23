import { ChevronLeft, ChevronRight, Phone, MessageSquare, Users, UserCheck } from 'lucide-react';
import { Button } from './ui/button';

interface GetHelpScreenProps {
  onBack: () => void;
  onNavigateToCallFuneral: () => void;
  onNavigateToCallDispatcher: () => void;
  onNavigateToSendHelpRequest: () => void;
  onNavigateToFindCourier: () => void;
}

const GetHelpScreen = ({ 
  onBack, 
  onNavigateToCallFuneral,
  onNavigateToCallDispatcher,
  onNavigateToSendHelpRequest,
  onNavigateToFindCourier
}: GetHelpScreenProps) => {
  const helpOptions = [
    {
      title: "Emergency Call",
      icon: Phone,
      onClick: onNavigateToCallFuneral
    },
    {
      title: "Call Dispatcher", 
      icon: Phone,
      onClick: onNavigateToCallDispatcher
    },
    {
      title: "Help Request to Dispatch",
      icon: MessageSquare,
      onClick: onNavigateToSendHelpRequest
    },
    {
      title: "Find Courier & Transfer",
      icon: UserCheck,
      onClick: onNavigateToFindCourier
    }
  ];

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
            Get Help
          </h1>
        </div>
        
        <div className="space-y-2">
          {helpOptions.map((option, index) => (
            <Button
              key={index}
              onClick={option.onClick}
              variant="ghost"
              className="w-full h-14 bg-card hover:bg-card/80 flex items-center justify-between px-4 text-left"
            >
              <div className="flex items-center gap-3">
                <option.icon size={20} className="text-primary" />
                <span className="text-base font-medium text-foreground overflow-wrap-anywhere line-clamp-2">{option.title}</span>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GetHelpScreen;