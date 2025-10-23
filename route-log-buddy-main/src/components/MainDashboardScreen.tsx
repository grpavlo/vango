import { Bell, Settings, User, MapPin, Route, Menu, FileText, Package, Play, Circle, Home, HelpCircle, Upload, Download, Truck, Phone, Users, Handshake, FlaskConical, Mailbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LogoProcessor } from '@/components/LogoProcessor';

interface MainDashboardScreenProps {
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  onNavigateToRoutes: () => void;
  onNavigateToMap: () => void;
  onNavigateToActions: () => void;
  onNavigateToReports: () => void;
  onNavigateToGetHelp: () => void;
  onStartActiveRoute: () => void;
  onPickUpSamples: () => void;
  onDropOffToLab: () => void;
  onShip: () => void;
  onRequestDispatcherAssistance: () => void;
  onContactDriverTransfer: () => void;
  onCallDispatcher: () => void;
  onNavigateToActiveRoute: () => void;
  notificationCount?: number;
}

const MainDashboardScreen = ({
  onNavigateToNotifications,
  onNavigateToSettings,
  onNavigateToRoutes,
  onNavigateToMap,
  onNavigateToActions,
  onNavigateToReports,
  onNavigateToGetHelp,
  onStartActiveRoute,
  onPickUpSamples,
  onDropOffToLab,
  onShip,
  onRequestDispatcherAssistance,
  onContactDriverTransfer,
  onCallDispatcher,
  onNavigateToActiveRoute,
  notificationCount = 3
}: MainDashboardScreenProps) => {
  const isOnline = true; // This would come from app state
  const activeRoute = "Route #127 - Downtown Medical";
  const samplesCount = 24;
  const packagesCount = 8;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-divider px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-h2 font-bold text-textPrimary">
                Route Logs
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateToSettings}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Active Route & Summary */}
        <div className="space-y-4">
          <Card className="p-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-subtitle font-semibold text-textPrimary">Active Route</h3>
                <p 
                  className="text-body text-textSecondary cursor-pointer hover:text-textPrimary transition-colors"
                  onClick={onNavigateToActiveRoute}
                >
                  {activeRoute}
                </p>
              </div>
              <Button onClick={onStartActiveRoute} className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Start
              </Button>
            </div>
            
            {/* Available Routes */}
            <div className="mt-3 pt-2 border-t border-divider">
              <div className="text-xs text-textMuted space-y-1">
                <div 
                  className="cursor-pointer hover:text-textSecondary transition-colors"
                  onClick={onNavigateToRoutes}
                >
                  Route #128 - West Side Labs (8:30 AM)
                </div>
                <div 
                  className="cursor-pointer hover:text-textSecondary transition-colors"
                  onClick={onNavigateToRoutes}
                >
                  Route #129 - Central Hospital (10:00 AM)
                </div>
                <div 
                  className="cursor-pointer hover:text-textSecondary transition-colors"
                  onClick={onNavigateToRoutes}
                >
                  Route #130 - East Medical Center (1:30 PM)
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onNavigateToRoutes}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Route className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">My Routes</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onNavigateToMap}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Map</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onNavigateToReports}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">My Manifest</h3>
                </div>
              </div>
            </Card>
          </div>

          {/* Separator */}
          <div className="border-t border-divider"></div>

          <div className="grid grid-cols-3 gap-3">
            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onPickUpSamples}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Handshake className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Receive samples from drivers</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onDropOffToLab}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FlaskConical className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Drop Off to Lab</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onShip}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mailbox className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Ship</h3>
                </div>
              </div>
            </Card>
          </div>

          {/* Separator */}
          <div className="border-t border-divider"></div>

          <div className="grid grid-cols-3 gap-3">
            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onRequestDispatcherAssistance}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Request Dispatcher Assistance</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onContactDriverTransfer}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Contact another driver to transfer your samples</h3>
                </div>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer hover:bg-surfaceAlt transition-colors"
              onClick={onCallDispatcher}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-textPrimary">Call Dispatcher</h3>
                </div>
              </div>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MainDashboardScreen;