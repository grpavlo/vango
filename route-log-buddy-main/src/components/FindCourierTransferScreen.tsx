import { useState } from 'react';
import { ChevronLeft, MapPin, Users, Phone } from 'lucide-react';
import { Button } from './ui/button';

interface Courier {
  id: string;
  name: string;
  distance?: string;
  phone: string;
}

interface FindCourierTransferScreenProps {
  onBack: () => void;
}

const FindCourierTransferScreen = ({ onBack }: FindCourierTransferScreenProps) => {
  const [currentScreen, setCurrentScreen] = useState<'main' | 'nearby' | 'list'>('main');

  // Mock data for nearby couriers (sorted by distance)
  const nearbyCouriers: Courier[] = [
    { id: '1', name: 'Alex Rodriguez', distance: '0.3 mi', phone: '+1234567890' },
    { id: '2', name: 'Sarah Chen', distance: '0.6 mi', phone: '+1234567891' },
    { id: '3', name: 'Mike Johnson', distance: '0.8 mi', phone: '+1234567892' },
    { id: '4', name: 'Emma Davis', distance: '1.2 mi', phone: '+1234567893' },
    { id: '5', name: 'Carlos Martinez', distance: '1.5 mi', phone: '+1234567894' },
  ];

  // Mock data for all active couriers (sorted alphabetically)
  const allCouriers: Courier[] = [
    { id: '6', name: 'Adam Wilson', phone: '+1234567895' },
    { id: '7', name: 'Bella Thompson', phone: '+1234567896' },
    { id: '8', name: 'Chris Anderson', phone: '+1234567897' },
    { id: '9', name: 'Diana Foster', phone: '+1234567898' },
    { id: '10', name: 'Ethan Parker', phone: '+1234567899' },
    { id: '11', name: 'Fiona Clark', phone: '+1234567800' },
    { id: '12', name: 'George Lewis', phone: '+1234567801' },
    { id: '13', name: 'Hannah White', phone: '+1234567802' },
    { id: '14', name: 'Ian Scott', phone: '+1234567803' },
    { id: '15', name: 'Julia Adams', phone: '+1234567804' },
    { id: '16', name: 'Kevin Taylor', phone: '+1234567805' },
    { id: '17', name: 'Luna Garcia', phone: '+1234567806' },
    { id: '18', name: 'Mason Brown', phone: '+1234567807' },
    { id: '19', name: 'Nina Torres', phone: '+1234567808' },
    { id: '20', name: 'Oscar Kim', phone: '+1234567809' },
    { id: '21', name: 'Petra Moore', phone: '+1234567810' },
    { id: '22', name: 'Quinn Hayes', phone: '+1234567811' },
    { id: '23', name: 'Ruby Allen', phone: '+1234567812' },
    { id: '24', name: 'Sam Rivera', phone: '+1234567813' },
    { id: '25', name: 'Tara Bell', phone: '+1234567814' },
  ];

  const handleCallCourier = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Render nearby couriers screen
  if (currentScreen === 'nearby') {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <Button
              onClick={() => setCurrentScreen('main')}
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-muted"
            >
              <ChevronLeft size={24} />
            </Button>
            <h1 className="text-2xl font-semibold text-foreground">
              Nearby Couriers
            </h1>
          </div>
          
          <div className="space-y-2">
            {nearbyCouriers.map((courier) => (
              <div
                key={courier.id}
                onClick={() => handleCallCourier(courier.phone)}
                className="flex items-center justify-between bg-card p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <span className="text-foreground font-medium">{courier.name}</span>
                <span className="text-muted-foreground">{courier.distance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render all couriers list screen
  if (currentScreen === 'list') {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <Button
              onClick={() => setCurrentScreen('main')}
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-muted"
            >
              <ChevronLeft size={24} />
            </Button>
            <h1 className="text-2xl font-semibold text-foreground">
              Select Courier
            </h1>
          </div>
          
          <div className="space-y-2 pb-20">
            {allCouriers.map((courier) => (
              <div
                key={courier.id}
                onClick={() => handleCallCourier(courier.phone)}
                className="flex items-center bg-card p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <span className="text-foreground font-medium">{courier.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main transfer samples screen
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
            Transfer Samples
          </h1>
        </div>
        
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-6">
              Choose how you'd like to contact a courier to transfer your samples.
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={() => setCurrentScreen('nearby')}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-lg font-medium flex items-center gap-3 justify-start"
              >
                <MapPin size={24} />
                Find Nearby Couriers
              </Button>
              
              <Button
                onClick={() => setCurrentScreen('list')}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-lg font-medium flex items-center gap-3 justify-start"
              >
                <Users size={24} />
                Select Courier From List
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindCourierTransferScreen;