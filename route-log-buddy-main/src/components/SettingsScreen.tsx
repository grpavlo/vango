import { useState } from 'react';
import { ChevronRight, Car } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import ThemeSelector from './ThemeSelector';
import BankingHeader from './BankingHeader';

interface SettingsScreenProps {
  onChangePassword: () => void;
  onBack?: () => void;
}

const SettingsScreen = ({ onChangePassword, onBack }: SettingsScreenProps) => {
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);

  // Default vehicle data
  const defaultVehicle = {
    id: 'default-1',
    make: 'Ford',
    model: 'Transit Connect',
    registration: 'ABC-123',
    available: true,
    year: '2023',
    color: 'White',
    vin: 'WF0EXXGB••••••5678',
    odometer: '24,580 mi',
    status: 'Available'
  };

  return (
    <div className="px-4 pt-4 pb-20 animate-fade-in-up">
      <h1 className="text-xl font-semibold text-foreground mb-4">
        Settings
      </h1>
      
      <div className="space-y-3">
        {/* Profile Section */}
        <div className="banking-card">
          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16 bg-primary">
              <AvatarFallback className="bg-primary text-primary-foreground text-title font-semibold">
                AC
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-title text-card-foreground">Alex Cordoso</h2>
              <p className="text-label text-muted-foreground">Driver</p>
            </div>
          </div>
          
          {/* Contact Information */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <p className="text-caption text-muted-foreground uppercase tracking-wide mb-1">Email</p>
              <p className="text-body text-card-foreground">AlexCordoso@accurereference.com</p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
              <p className="text-body text-card-foreground">+1 347 276 5708</p>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="banking-card">
          <button 
            className="banking-list-item w-full text-left relative group"
            onClick={onChangePassword}
          >
            <span className="text-body text-foreground">Change password</span>
            <ChevronRight size={20} className="text-muted-foreground ml-auto" />
          </button>
          
          <button 
            className="banking-list-item w-full text-left relative group"
            onClick={() => setShowVehicleInfo(true)}
          >
            <span className="text-body text-foreground">Default Vehicle Info</span>
            <ChevronRight size={20} className="text-muted-foreground ml-auto" />
          </button>
          
          <ThemeSelector />
          
          <div className="banking-list-item opacity-50 pointer-events-none">
            <span className="text-body text-muted-foreground">GPS</span>
            <Switch
              checked={gpsEnabled}
              disabled={true}
              className="ml-auto data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Info Modal */}
      <Dialog open={showVehicleInfo} onOpenChange={setShowVehicleInfo}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Default Vehicle Information
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">Make/Model/Year</span>
                <span className="text-sm text-textPrimary font-medium">
                  {defaultVehicle.make} {defaultVehicle.model} {defaultVehicle.year}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">License Plate</span>
                <span className="text-sm text-textPrimary font-medium">{defaultVehicle.registration}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">Color</span>
                <span className="text-sm text-textPrimary font-medium">{defaultVehicle.color}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">VIN</span>
                <span className="text-sm text-textPrimary font-medium font-mono">{defaultVehicle.vin}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">Odometer</span>
                <span className="text-sm text-textPrimary font-medium">{defaultVehicle.odometer}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-textSecondary">Status</span>
                <span className={`text-sm font-medium ${
                  defaultVehicle.status === 'Available' ? 'text-primary' : 'text-warning'
                }`}>
                  {defaultVehicle.status}
                </span>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowVehicleInfo(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsScreen;