import { Package2, HelpCircle, Package, Bell } from 'lucide-react';
import { Button } from './ui/button';

interface ActionsScreenProps {
  onNavigateToPickUpSamples: () => void;
  onNavigateToDropOffToLab: () => void;
  onNavigateToShip: () => void;
  onNavigateToGetHelp: () => void;
  onNavigateToNotifications: () => void;
}

const ActionsScreen = ({ onNavigateToPickUpSamples, onNavigateToDropOffToLab, onNavigateToShip, onNavigateToGetHelp, onNavigateToNotifications }: ActionsScreenProps) => {
  return (
    <div className="px-4 pt-4 pb-20 animate-fade-in-up">
      <h1 className="text-xl font-semibold text-foreground mb-4">
        Notifications
      </h1>

      {/* Notifications Section */}
      <div className="mb-6">
        <Button
          onClick={onNavigateToNotifications}
          variant="outline"
          className="w-full h-14 flex items-center justify-between px-4 rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={24} className="text-primary" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                3
              </div>
            </div>
            <span className="text-base font-medium text-foreground">Notifications</span>
          </div>
          <span className="text-sm text-muted-foreground">3 unread</span>
        </Button>
        <p className="text-xs text-muted-foreground mt-2 px-2">View important updates and messages from dispatch.</p>
      </div>
      
      
    

    </div>
  );
};

export default ActionsScreen;