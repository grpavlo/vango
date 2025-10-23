import { useMemo, useState } from 'react';
import { MapPin, Phone, Clock, ChevronDown, ChevronUp, Navigation,
         CheckCircle, Circle, ArrowUp, ArrowDown, Flag } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '@/hooks/use-toast';
import OSMMap from './OSMMap';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

interface Checkpoint {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  type: 'pickup' | 'dropoff';
  isCompleted: boolean;
  lat: number;
  lng: number;
  specialFlag?: 'yellow' | 'green';
  isSTAT?: boolean;
}

interface MapScreenProps {
  routeId?: string;
  onNavigateToCheckpoint?: (checkpointId: string) => void;
}

const MapScreen = ({ routeId, onNavigateToCheckpoint }: MapScreenProps) => {
  const [showCheckpointsList, setShowCheckpointsList] = useState(false);
  const [routeStarted, setRouteStarted] = useState(false);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<string[]>(['1', '2']);
  const { actualTheme } = useTheme();

  // Mock route data
  const routeData = {
    name: 'Downtown Medical District',
    status: 'In Progress',
    startTime: '8:00 AM',
    duration: '4h 30m',
    distance: '24.5 mi'
  };

  // Mock checkpoints data with enhanced details
  const baseCheckpoints: Checkpoint[] = [
    {
      id: '1',
      name: 'STAT Central Hospital Lab',
      address: '123 Medical Center Dr, Downtown',
      phone: '+1 (555) 123-4567',
      hours: '7:00 AM - 8:00 PM',
      type: 'pickup',
      isCompleted: true,
      lat: 40.7128,
      lng: -74.0060,
      specialFlag: 'yellow',
      isSTAT: true
    },
    {
      id: '2',
      name: 'Community Health Clinic',
      address: '456 Health St, Medical District',
      phone: '+1 (555) 234-5678',
      hours: '8:00 AM - 6:00 PM',
      type: 'pickup',
      isCompleted: true,
      lat: 40.7580,
      lng: -73.9855,
      specialFlag: 'green'
    },
    {
      id: '3',
      name: 'Downtown Urgent Care',
      address: '789 Care Ave, Downtown',
      phone: '+1 (555) 345-6789',
      hours: '24/7',
      type: 'dropoff',
      isCompleted: false,
      lat: 40.7505,
      lng: -73.9934
    },
    {
      id: '4',
      name: 'Metro General Hospital',
      address: '321 Metro Blvd, Midtown',
      phone: '+1 (555) 456-7890',
      hours: '6:00 AM - 10:00 PM',
      type: 'pickup',
      isCompleted: false,
      lat: 40.7440,
      lng: -74.0020
    },
    {
      id: '5',
      name: 'Westside Medical Center',
      address: '555 West End Ave, Upper West',
      phone: '+1 (555) 567-8901',
      hours: '7:30 AM - 9:00 PM',
      type: 'dropoff',
      isCompleted: false,
      lat: 40.7750,
      lng: -73.9820
    }
  ];

  // Update checkpoints based on completion state
  const checkpoints = baseCheckpoints.map(checkpoint => ({
    ...checkpoint,
    isCompleted: completedCheckpoints.includes(checkpoint.id)
  }));

  // Find first non-completed checkpoint
  const firstNonCompletedCheckpoint = checkpoints.find(checkpoint => !checkpoint.isCompleted) || checkpoints[0];
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(firstNonCompletedCheckpoint);

  const selectedCheckpointIndex = useMemo(() => {
    if (!selectedCheckpoint) return -1;
    return checkpoints.findIndex((checkpoint) => checkpoint.id === selectedCheckpoint.id);
  }, [checkpoints, selectedCheckpoint]);

  // Derived data
  const pendingCheckpoints = checkpoints.filter(c => !c.isCompleted);
  const completedCheckpointsList = checkpoints.filter(c => c.isCompleted);
  const nextCheckpoint = pendingCheckpoints[0];

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const handleNavigate = (checkpoint: Checkpoint) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(checkpoint.address)}`;
    window.open(url, '_blank');
  };

  const handleCheckpointSelect = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
  };

  const handleStartRoute = () => {
    setRouteStarted(true);
    toast({
      description: "Route started! Navigate to your first checkpoint.",
      duration: 3000
    });
  };

  const handleSmartRoute = () => {
    toast({
      description: `Route optimized! Recalculated ${pendingCheckpoints.length} remaining checkpoints.`,
      duration: 3000
    });
  };

  const handleCheckpointCompletion = (checkpointId: string) => {
    setCompletedCheckpoints(prev => [...prev, checkpointId]);
    toast({
      description: "Checkpoint completed!",
      duration: 2000
    });
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Route Header - Fixed at top */}
      <div className="bg-card border-b border-border p-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary text-primary-foreground px-1.5 py-0 rounded text-xs font-medium">
                {routeData.status}
              </span>
              <h1 className="text-lg font-semibold text-foreground">
                {routeData.name}
              </h1>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{routeData.startTime} • {routeData.duration}</span>
                <span>{completedCheckpointsList.length}/{checkpoints.length} stops</span>
                <span>{routeData.distance}</span>
              </div>
              <Button
                onClick={() => setShowCheckpointsList(!showCheckpointsList)}
                size="sm"
                className="flex-shrink-0 h-6 px-2 text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 border border-orange-400 font-semibold"
              >
                {showCheckpointsList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span className="ml-1">Stops</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Route Controls */}
        <div className="flex gap-2">
          {nextCheckpoint ? (
            <div className="flex-1"></div>
          ) : (
            <Button disabled className="flex-1">
              Route Complete
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Checkpoints List */}
      {showCheckpointsList && (
        <div className="bg-card border-b border-border max-h-64 overflow-y-auto z-10">
          <div className="p-2 space-y-1">
            {checkpoints.map((checkpoint, index) => (
              <div
                key={checkpoint.id}
                onClick={() => {
                  setSelectedCheckpoint(checkpoint);
                  setShowCheckpointsList(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCheckpoint?.id === checkpoint.id 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* Type Icon */}
                <div className="flex-shrink-0">
                  {checkpoint.type === 'pickup' ? (
                    <ArrowUp size={16} className="text-blue-500" />
                  ) : (
                    <ArrowDown size={16} className="text-green-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {index + 1}. {checkpoint.isSTAT ? checkpoint.name.replace('STAT ', '') : checkpoint.name}
                    </span>
                    {checkpoint.isSTAT && (
                      <span className="bg-warning text-warning-foreground px-1.5 py-0.5 rounded text-xs font-medium">
                        STAT
                      </span>
                    )}
                    {checkpoint.specialFlag && (
                      <Flag 
                        size={12} 
                        className={checkpoint.specialFlag === 'yellow' ? 'text-yellow-500' : 'text-green-500'} 
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {checkpoint.address}
                  </p>
                </div>
                
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {checkpoint.isCompleted ? (
                    <CheckCircle size={20} className="text-primary" />
                  ) : (
                    <Circle size={20} className="text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Area - Reduced by 50px */}
      <div className="relative flex-1">
        <OSMMap
          checkpoints={checkpoints}
          height="h-full"
          className="h-full"
          mapTheme={actualTheme}
          showControls={true}
          selectedCheckpointId={selectedCheckpoint?.id}
          onCheckpointSelect={handleCheckpointSelect}
        />
      </div>

      {/* Enhanced Bottom Detail Panel */}
      {selectedCheckpoint && (
        <div className="relative mt-auto">
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--nav-height)+var(--nav-safe-area))] h-24 bg-gradient-to-t from-background via-background/95 to-background/10" />
          <div className="relative px-4 pb-[calc(var(--nav-height)+var(--nav-safe-area)+1rem)]">
            <div className="bg-card/95 border border-border/80 rounded-2xl p-4 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'rounded-xl p-3 shrink-0 transition-colors border border-transparent',
                      selectedCheckpoint.type === 'pickup'
                        ? 'text-[hsl(var(--brand-secondary))]'
                        : 'text-[hsl(var(--brand-success))]'
                    )}
                    style={{
                      backgroundColor: selectedCheckpoint.type === 'pickup'
                        ? 'hsl(var(--brand-secondary) / 0.12)'
                        : 'hsl(var(--brand-success) / 0.12)',
                      borderColor: selectedCheckpoint.isCompleted ? 'hsl(var(--brand-success) / 0.5)' : undefined
                    }}
                  >
                    {selectedCheckpoint.type === 'pickup' ? (
                      <ArrowUp size={20} />
                    ) : (
                      <ArrowDown size={20} />
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {selectedCheckpoint.isSTAT
                          ? selectedCheckpoint.name.replace('STAT ', '')
                          : selectedCheckpoint.name}
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                        {selectedCheckpoint.type === 'pickup' ? 'Pickup' : 'Drop-off'}
                      </span>
                      {selectedCheckpoint.isSTAT && (
                        <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                          STAT
                        </span>
                      )}
                      {selectedCheckpoint.specialFlag && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                            selectedCheckpoint.specialFlag === 'yellow'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                          )}
                        >
                          <Flag size={12} /> Priority
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                      <MapPin size={16} className="shrink-0" />
                      <span className="truncate">{selectedCheckpoint.address}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1">
                        <Clock size={14} className="shrink-0" />
                        <span>{selectedCheckpoint.hours}</span>
                      </div>
                      {selectedCheckpoint.phone && (
                        <button
                          onClick={() => handleCall(selectedCheckpoint.phone)}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-[hsl(var(--brand-secondary))] hover:text-[hsl(var(--brand-secondary))]"
                        >
                          <Phone size={14} />
                          Call Site
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-right text-xs text-muted-foreground">
                  {selectedCheckpointIndex >= 0 && (
                    <span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
                      Stop {selectedCheckpointIndex + 1} of {checkpoints.length}
                    </span>
                  )}
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 font-medium',
                      selectedCheckpoint.isCompleted
                        ? 'text-[hsl(var(--brand-success))]'
                        : 'bg-muted text-muted-foreground'
                    )}
                    style={selectedCheckpoint.isCompleted ? { backgroundColor: 'hsl(var(--brand-success) / 0.15)' } : undefined}
                  >
                    {selectedCheckpoint.isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleNavigate(selectedCheckpoint)}
                  size="lg"
                  className="h-12 rounded-xl bg-[hsl(var(--brand-success))] text-white shadow-lg hover:opacity-95"
                >
                  <Navigation size={18} />
                  Navigate
                </Button>

                {selectedCheckpoint.isCompleted ? (
                  <Button disabled size="lg" variant="outline" className="h-12 rounded-xl">
                    <CheckCircle size={18} />
                    Visit Complete
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (onNavigateToCheckpoint) {
                        onNavigateToCheckpoint(selectedCheckpoint.id);
                      }
                    }}
                    variant="outline"
                    size="lg"
                    className="h-12 rounded-xl border-[hsl(var(--brand-success))] text-[hsl(var(--brand-success))] hover:bg-[hsl(var(--brand-success))] hover:text-white"
                  >
                    <CheckCircle size={18} />
                    Start Visit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapScreen;