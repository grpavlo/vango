import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Flag, MessageCircle, Zap } from 'lucide-react';
import CheckpointCard from './CheckpointCard';
import StartRouteDialog from './StartRouteDialog';
import { toast } from '@/hooks/use-toast';
interface Checkpoint {
  id: string;
  name: string;
  address: string;
  hours: string;
  isCompleted: boolean;
  type: 'pickup' | 'dropoff';
  specialFlag?: 'yellow' | 'green';
  isSTAT?: boolean;
}
interface RouteDetailScreenProps {
  routeId: string;
  onNavigateToCheckpoint: (checkpointId: string) => void;
  onNavigateToDescription: () => void;
  onStartRoute: () => void;
  onBack: () => void;
  completedCheckpointId?: string; // New prop to handle checkpoint completion from visit screen
}
const RouteDetailScreen = ({
  routeId,
  onNavigateToCheckpoint,
  onNavigateToDescription,
  onStartRoute,
  onBack,
  completedCheckpointId
}: RouteDetailScreenProps) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState('road');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [routeStarted, setRouteStarted] = useState(false);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<string[]>(['3']);
  const [isSmartRouteLoading, setIsSmartRouteLoading] = useState(false);

  // Mock data - in real app this would come from props or API
  const routeData = {
    name: 'Downtown Medical District',
    status: 'In Progress',
    startDate: 'Today, 8:00 AM',
    endDate: 'Today, 12:30 PM',
    duration: '4h 30m'
  };
  const baseCheckpoints: Checkpoint[] = [{
    id: '1',
    name: 'STAT Central Hospital Lab',
    address: '123 Medical Center Dr, Downtown',
    hours: '8:00 AM - 5:00 PM',
    isCompleted: false,
    type: 'pickup',
    specialFlag: 'yellow',
    isSTAT: true
  }, {
    id: '2',
    name: 'Community Health Clinic',
    address: '456 Health St, Medical District',
    hours: '9:00 AM - 4:00 PM',
    isCompleted: false,
    type: 'pickup',
    specialFlag: 'green'
  }, {
    id: '3',
    name: 'Downtown Urgent Care',
    address: '789 Care Ave, Downtown',
    hours: '7:00 AM - 7:00 PM',
    isCompleted: true,
    type: 'dropoff'
  }];

  // Update checkpoint completion status dynamically
  const checkpoints = baseCheckpoints.map(checkpoint => ({
    ...checkpoint,
    isCompleted: completedCheckpoints.includes(checkpoint.id)
  }));

  // Sort checkpoints - STAT first, then others
  const sortedCheckpoints = [...checkpoints].sort((a, b) => {
    if (a.isSTAT && !b.isSTAT) return -1;
    if (!a.isSTAT && b.isSTAT) return 1;
    return 0;
  });
  const pendingCheckpoints = sortedCheckpoints.filter(c => !c.isCompleted);
  const completedCheckpointsList = sortedCheckpoints.filter(c => c.isCompleted);
  const handleCheckpointCompletion = (checkpointId: string) => {
    setCompletedCheckpoints(prev => {
      if (!prev.includes(checkpointId)) {
        return [...prev, checkpointId];
      }
      return prev;
    });
  };

  const handleSmartRoute = async () => {
    setIsSmartRouteLoading(true);
    
    try {
      // Get current GPS location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      // Simulate route optimization based on current location and remaining checkpoints
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        description: `Route optimized! Recalculated ${pendingCheckpoints.length} remaining checkpoints based on your current location.`,
        duration: 3000
      });
      
    } catch (error) {
      toast({
        description: "Unable to get your location. Please enable GPS and try again.",
        duration: 3000
      });
    } finally {
      setIsSmartRouteLoading(false);
    }
  };

  // Handle checkpoint completion from visit screen
  useEffect(() => {
    if (completedCheckpointId && !completedCheckpoints.includes(completedCheckpointId)) {
      setCompletedCheckpoints(prev => [...prev, completedCheckpointId]);
      toast({
        description: "Checkpoint completed",
        duration: 2000
      });
    }
  }, [completedCheckpointId, completedCheckpoints]);
  return <div className="min-h-screen bg-background pb-16">
      <div className="px-4 pt-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="touch-target p-1 -ml-1">
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                {routeData.name}
              </h1>
              {/* Message notification indicator */}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Start</p>
            <p className="text-sm text-foreground">{routeData.startDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End</p>
            <p className="text-sm text-foreground">{routeData.endDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm text-foreground">{routeData.duration}</p>
          </div>
        </div>
        
        <div className="flex gap-2 mb-4">
          <button onClick={() => setShowStartDialog(true)} disabled={routeStarted} className={`flex-1 font-medium py-2.5 px-4 rounded-lg transition-colors touch-target ${routeStarted ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}>
            {routeStarted ? 'Route Started' : 'Start Route'}
          </button>
          
        </div>
        
        {/* Pending checkpoints section */}
        <div className="space-y-1.5">
          <div className="space-y-1.5">
            {pendingCheckpoints.map((checkpoint, index) => <div key={checkpoint.id} className="animate-fade-in transition-all duration-300">
                <CheckpointCard {...checkpoint} number={index + 1} onClick={() => onNavigateToCheckpoint(checkpoint.id)} />
              </div>)}
          </div>
        </div>
        
        {/* Completed checkpoints section */}
        {completedCheckpointsList.length > 0 && <div className="mt-4 space-y-1.5">
            <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 w-full py-1.5 text-base text-foreground" aria-expanded={showCompleted} aria-controls="completed-checkpoints">
              {showCompleted ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <h2 className="text-base font-semibold">Completed</h2>
              <span className="bg-muted text-foreground px-2 py-1 rounded text-sm ml-1">
                {completedCheckpointsList.length}
              </span>
            </button>
            
            {showCompleted && <div id="completed-checkpoints" className="space-y-1.5 mt-1.5 animate-fade-in">
                {completedCheckpointsList.map((checkpoint, index) => <div key={checkpoint.id} className="transition-all duration-300">
                    <CheckpointCard {...checkpoint} number={pendingCheckpoints.length + index + 1} onClick={() => onNavigateToCheckpoint(checkpoint.id)} />
                  </div>)}
              </div>}
          </div>}
      </div>
      <StartRouteDialog isOpen={showStartDialog} onClose={() => setShowStartDialog(false)} onConfirm={() => {
      setShowStartDialog(false);
      setRouteStarted(true);
      onStartRoute();
    }} />
    </div>;
};
export default RouteDetailScreen;