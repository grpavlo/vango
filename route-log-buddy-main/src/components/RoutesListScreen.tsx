import { useState } from 'react';
import { Package } from 'lucide-react';
import RouteCard from './RouteCard';
import { Button } from './ui/button';

interface Route {
  id: string;
  title: string;
  startTime: string;
  duration: string;
  stops: number;
  completedStops: number;
  distance: string;
  notificationCount?: number;
}

interface RoutesListScreenProps {
  onNavigateToRoute: (routeId: string) => void;
  onNavigateToSamples: () => void;
  onNavigateToCollectedSamples?: () => void;
}

const RoutesListScreen = ({ onNavigateToRoute, onNavigateToSamples, onNavigateToCollectedSamples }: RoutesListScreenProps) => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const routes: Route[] = [
    {
      id: '1',
      title: 'Downtown Medical District',
      startTime: '08:00 AM',
      duration: '4h 30m',
      stops: 8,
      completedStops: 1,
      distance: '24.5 mi',
      notificationCount: 2
    },
    {
      id: '2',
      title: 'North Suburbs Collection',
      startTime: '01:00 PM',
      duration: '3h 15m',
      stops: 6,
      completedStops: 0,
      distance: '18.2 mi'
    },
    {
      id: '3',
      title: 'University Campus Route',
      startTime: '04:30 PM',
      duration: '2h 45m',
      stops: 4,
      completedStops: 0,
      distance: '12.8 mi'
    }
  ];

  const handleRouteSelect = (routeId: string) => {
    setSelectedRoute(routeId);
    onNavigateToRoute(routeId);
  };

  return (
    <div className="px-4 pt-4 pb-20 animate-fade-in-up">
      <h1 className="text-xl font-semibold text-foreground mb-4">
        Your routes for today
      </h1>
      
      
      <p className="text-sm text-muted-foreground mb-4">
        Tap a route to view details, or use quick actions to start immediately
      </p>
      
      <div className="space-y-3">
        {routes.map((route) => (
          <RouteCard
            key={route.id}
            {...route}
            isSelected={selectedRoute === route.id}
            onClick={() => handleRouteSelect(route.id)}
            onQuickStart={() => {
              setSelectedRoute(route.id);
              // Navigate directly to route navigation
              onNavigateToRoute(route.id);
            }}
            onResume={() => {
              setSelectedRoute(route.id);
              // Navigate directly to continue route
              onNavigateToRoute(route.id);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default RoutesListScreen;