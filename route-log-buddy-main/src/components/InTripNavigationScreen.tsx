import { useState, useEffect } from 'react';
import { MapPin, Phone, Info, Clock, Edit, ChevronLeft, MessageCircle, Settings, Map } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import OSMMap from './OSMMap';
import googleMapsIcon from '@/assets/google-maps-icon.png';
import wazeIcon from '@/assets/waze-icon.png';
import appleMapsIcon from '@/assets/apple-maps-icon.png';
interface InTripNavigationScreenProps {
  checkpointId: string;
  onStartVisit: () => void;
  onBack: () => void;
  isRouteStarted: boolean;
}
type NavigationApp = 'Google Maps' | 'Waze' | 'Apple Maps' | 'Native App Navigation' | 'Always ask' | 'None';
const InTripNavigationScreen = ({
  checkpointId,
  onStartVisit,
  onBack,
  isRouteStarted
}: InTripNavigationScreenProps) => {
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [highlightVisitInfo, setHighlightVisitInfo] = useState(false);
  const [defaultNavigationApp, setDefaultNavigationApp] = useState<NavigationApp>('Always ask');
  const [rememberChoice, setRememberChoice] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  // Mock checkpoint data
  const checkpoint = {
    id: checkpointId,
    name: 'Central Hospital Lab',
    address: '123 Medical Center Dr, Downtown',
    phone: '+1 (555) 123-4567',
    type: 'pickup' as const,
    isCompleted: false,
    lat: 40.7128,
    lng: -74.0060,
    hours: '8:00 AM - 5:00 PM'
  };
  const menuItems = [{
    icon: Phone,
    label: 'Call to Dispatch',
    action: () => console.log('Call dispatch')
  }, {
    icon: Phone,
    label: 'Call Customer',
    action: () => console.log('Call customer')
  }, {
    icon: Info,
    label: 'Visit Info',
    action: () => console.log('Visit info')
  }, {
    icon: Clock,
    label: 'Visit Hours',
    action: () => console.log('Visit hours')
  }, {
    icon: Edit,
    label: 'Write to Disp',
    action: () => console.log('Write to dispatch')
  }];
  const navigationApps = [{
    name: 'Google Maps',
    icon: googleMapsIcon,
    action: () => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${checkpoint.lat},${checkpoint.lng}`;
      window.open(url, '_blank');
    }
  }, {
    name: 'Waze',
    icon: wazeIcon,
    action: () => {
      const url = `https://waze.com/ul?ll=${checkpoint.lat},${checkpoint.lng}&navigate=yes`;
      window.open(url, '_blank');
    }
  }, {
    name: 'Apple Maps',
    icon: appleMapsIcon,
    action: () => {
      const url = `http://maps.apple.com/?daddr=${checkpoint.lat},${checkpoint.lng}`;
      window.open(url, '_blank');
    }
  }];

  // Load saved navigation preference
  useEffect(() => {
    const saved = localStorage.getItem('defaultNavigationApp');
    if (saved && ['Google Maps', 'Waze', 'Apple Maps', 'Native App Navigation', 'Always ask', 'None'].includes(saved)) {
      setDefaultNavigationApp(saved as NavigationApp);
    }
  }, []);
  const handleNavigationAppSelect = (app: typeof navigationApps[0]) => {
    app.action();
    if (rememberChoice) {
      setDefaultNavigationApp(app.name as NavigationApp);
      localStorage.setItem('defaultNavigationApp', app.name);
    }
    setShowNavigationModal(false);
  };
  const handleNavigationButtonClick = () => {
    setShowNavigationModal(true);
  };
  return <div className="min-h-screen bg-background relative px-6">
      {/* Header with checkpoint info */}
      <div className="bg-muted border-b border-border px-4 py-4 relative z-30 -mx-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors">
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-semibold text-foreground">
                  {checkpoint.name}
                </h1>
              </div>
              {/* Checkpoint Info */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    {checkpoint.address}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    {checkpoint.hours}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setMapVisible(!mapVisible)} className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors ml-2" aria-label={mapVisible ? "Hide map" : "Show map"}>
            <Map size={20} className={`text-foreground transition-opacity ${mapVisible ? 'opacity-100' : 'opacity-50'}`} />
          </button>
        </div>
      </div>

      {/* Map Area with OSM - hidden when mapVisible is false */}
      {mapVisible && <div className={`relative z-10 transition-all duration-300 ${showNavigationModal ? 'h-48' : 'h-96'} -mx-6 mb-6`}>
          <OSMMap checkpoints={[checkpoint]} height="h-full" showControls={true} center={[checkpoint.lat, checkpoint.lng]} zoom={15} />
        </div>}
      
      {/* Communication Actions - organized in grid */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => console.log('Call dispatch')} className="banking-card hover:shadow-md active:scale-[0.98] transition-all duration-200 p-1.5 flex flex-col items-center gap-0.5">
            <div className="banking-icon-container shrink-0">
              <Phone size={14} />
            </div>
            <span className="text-xs font-medium text-foreground text-center">
              Call Dispatch
            </span>
          </button>
          
          <button onClick={() => console.log('Call customer')} className="banking-card hover:shadow-md active:scale-[0.98] transition-all duration-200 p-1.5 flex flex-col items-center gap-0.5">
            <div className="banking-icon-container shrink-0">
              <Phone size={14} />
            </div>
            <span className="text-xs font-medium text-foreground text-center">
              Contact Office
            </span>
          </button>
          
          <button onClick={() => console.log('Write to dispatch')} className="banking-card hover:shadow-md active:scale-[0.98] transition-all duration-200 p-1.5 flex flex-col items-center gap-0.5">
            <div className="banking-icon-container shrink-0">
              <Edit size={14} />
            </div>
            <span className="text-xs font-medium text-foreground text-center">
              Text Dispatch
            </span>
          </button>
        </div>
      </div>
      
      {/* Action Buttons and Info */}
      <div className="bg-muted p-3 rounded-lg mb-6 relative z-20 border border-border">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={isRouteStarted ? handleNavigationButtonClick : undefined} disabled={!isRouteStarted} aria-label={!isRouteStarted ? "Open Navigation App disabled — start the route first" : "Open Navigation App"} className={`flex-1 transition-all duration-150 ${isRouteStarted ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60 border border-border'}`}>
            Navigate
          </Button>
          <Button onClick={isRouteStarted ? onStartVisit : undefined} disabled={!isRouteStarted} aria-label={!isRouteStarted ? "Start Visit disabled — start the route first" : "Start Visit"} className={`flex-1 transition-all duration-150 ${isRouteStarted ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60 border border-border'}`}>
            Start Visit
          </Button>
        </div>
        
        
        {/* ETA Display */}
        
      </div>

      {/* Information Boxes */}
      <div className="space-y-6 pb-6">
        {/* Visit Information */}
        <div className={`banking-card transition-all duration-500 ${highlightVisitInfo ? 'ring-2 ring-primary shadow-lg bg-primary/5' : ''}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className="banking-icon-container shrink-0">
              <Info size={20} />
            </div>
            <h3 className="text-subtitle font-semibold text-foreground">Visit Information</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Type: Sample pickup</p>
            <p>• Priority: Standard</p>
            <p>• Special instructions: Use rear entrance after 4 PM</p>
            <p>• Contact: Lab Manager - Ext. 234</p>
            <p>• Expected samples: 15-20 vials</p>
          </div>
        </div>
        
        {/* Visit Hours & Schedule */}
        <div className="banking-card">
          <div className="flex items-start gap-3 mb-3">
            <div className="banking-icon-container shrink-0">
              <Clock size={20} />
            </div>
            <h3 className="text-subtitle font-semibold text-foreground">Visit Schedule</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Regular hours: {checkpoint.hours}</p>
            <p>• Lunch break: 12:00 PM - 1:00 PM</p>
            <p>• Best pickup time: 2:00 PM - 4:00 PM</p>
            <p>• Weekend availability: Emergency only</p>
            <p>• Last pickup: 4:30 PM on weekdays</p>
          </div>
        </div>
      </div>

      {/* Navigation Apps Modal - higher z-index than map, shrinks map when open */}
      {showNavigationModal && <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowNavigationModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 p-6 rounded-t-lg">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-center">Choose Navigation App</h3>

              <div className="space-y-3">
                {/* Native App Navigation Option */}
                <button onClick={() => {
                  console.log('Native app navigation');
                  if (rememberChoice) {
                    setDefaultNavigationApp('Native App Navigation' as NavigationApp);
                    localStorage.setItem('defaultNavigationApp', 'Native App Navigation');
                  }
                  setShowNavigationModal(false);
                }} className="w-full flex items-center gap-4 p-4 text-left bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors min-h-[68px]">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-base font-medium text-foreground">Native App Navigation</span>
                </button>
                
                {navigationApps.map((app, index) => <button key={index} onClick={() => handleNavigationAppSelect(app)} className="w-full flex items-center gap-4 p-4 text-left bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors min-h-[68px]">
                    <img src={app.icon} alt={`${app.name} icon`} className="w-12 h-12 rounded-lg object-cover" />
                    <span className="text-base font-medium text-foreground">{app.name}</span>
                  </button>)}
              </div>
              <button onClick={() => setShowNavigationModal(false)} className="w-full mt-4 p-3 text-center text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
                Cancel
              </button>
            </div>
          </div>
        </>}
    </div>;
};
export default InTripNavigationScreen;