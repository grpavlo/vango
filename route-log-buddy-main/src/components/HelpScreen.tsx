import { ChevronLeft, Building, Phone, MessageSquare, MapPin } from 'lucide-react';
import { Button } from './ui/button';

interface HelpScreenProps {
  onBack: () => void;
  onContactOffice: () => void;
  onCallDispatcher: () => void;
  onTextDispatch: () => void;
  onShareLocation: () => void;
}

const HelpScreen = ({
  onBack,
  onContactOffice,
  onCallDispatcher,
  onTextDispatch,
  onShareLocation
}: HelpScreenProps) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-muted"
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Help</h1>
        </div>
        
        <div className="space-y-4">
          <Button
            className="w-full h-14 bg-muted text-muted-foreground cursor-not-allowed text-left justify-start px-6"
            disabled
          >
            <Building className="w-5 h-5 mr-3" />
            CONTACT OFFICE
          </Button>
          
          <Button
            className="w-full h-14 bg-muted text-muted-foreground cursor-not-allowed text-left justify-start px-6"
            disabled
          >
            <Phone className="w-5 h-5 mr-3" />
            CALL DISPATCH
          </Button>
          
          <Button
            className="w-full h-14 bg-muted text-muted-foreground cursor-not-allowed text-left justify-start px-6"
            disabled
          >
            <MessageSquare className="w-5 h-5 mr-3" />
            TEXT DISPATCH
          </Button>
          
          <Button
            className="w-full h-14 bg-muted text-muted-foreground cursor-not-allowed text-left justify-start px-6"
            disabled
          >
            <MapPin className="w-5 h-5 mr-3" />
            SHARE MY LOCATION
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HelpScreen;