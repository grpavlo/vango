import { CheckCircle, Circle, Clock, MapPin, ArrowUp, ArrowDown, Flag } from 'lucide-react';

interface CheckpointCardProps {
  id: string;
  number: number;
  name: string;
  address: string;
  hours: string;
  isCompleted: boolean;
  type: 'pickup' | 'dropoff';
  specialFlag?: 'yellow' | 'green';
  isSTAT?: boolean;
  onClick: () => void;
  disabled?: boolean;
  notificationCount?: number;
}

const CheckpointCard = ({ 
  number, 
  name, 
  address, 
  hours, 
  isCompleted,
  type,
  specialFlag,
  isSTAT,
  onClick,
  disabled = false,
  notificationCount = 0
}: CheckpointCardProps) => {
  const displayName = isSTAT ? name : name.replace('STAT ', '');
  
  return (
    <div 
      onClick={disabled ? undefined : onClick}
      className={`card-light p-4 rounded-lg flex items-start gap-3 transition-all duration-150 ${
        disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer hover:bg-surface/80 dark:hover:bg-surfaceAlt'
      }`}
    >
      {/* Arrow icon for pickup/dropoff */}
      <div className="flex-shrink-0 mt-1">
        {type === 'pickup' ? (
          <ArrowUp size={20} className="text-[#2BBBDD]" />
        ) : (
          <ArrowDown size={20} className="text-[#2BBBDD]" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-base text-foreground">
            {number}. {displayName}
          </h3>
          {notificationCount > 0 && (
            <span 
              className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-medium min-w-[20px] text-center"
              aria-label={`New updates: ${notificationCount > 9 ? '9+' : notificationCount}`}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
          {isSTAT && (
            <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-medium">
              STAT
            </span>
          )}
          {specialFlag && (
            <Flag 
              size={16} 
              className={specialFlag === 'yellow' ? 'text-yellow-500' : 'text-green-500'} 
            />
          )}
        </div>
        <div className="flex items-center gap-1 mb-1">
          <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {address}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">
            {hours}
          </span>
        </div>
      </div>
      
      <div className="flex-shrink-0 mt-1 relative">
        {isCompleted ? (
          <CheckCircle 
            size={24} 
            className="text-[#2BBBDD]" 
            aria-label="Checkpoint marked as completed"
          />
        ) : (
          <Circle size={24} className="text-muted-foreground" />
        )}
        {notificationCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center text-xs font-medium">
            {notificationCount > 9 ? '9+' : notificationCount}
          </div>
        )}
        {notificationCount === 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center text-xs font-medium">
            2
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckpointCard;