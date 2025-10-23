import { ArrowLeft, Bell, MessageSquare, Route, MapPin, AlertTriangle, User } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigateToRoute?: (routeId: string) => void;
  onNavigateToCheckpoint?: (checkpointId: string) => void;
}

interface Notification {
  id: string;
  type: 'route_update' | 'checkpoint_added' | 'checkpoint_removed' | 'visit_update' | 'dispatcher_message' | 'driver_message';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  routeId?: string;
  checkpointId?: string;
  avatar?: string;
}

const NotificationsScreen = ({ onBack, onNavigateToRoute, onNavigateToCheckpoint }: NotificationsScreenProps) => {
  const { toast } = useToast();
  
  // Mock notifications data - in real app this would come from API/state
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'dispatcher_message',
      title: 'Message from Dispatch',
      description: 'Route 2024-001 has been updated with new priority stops',
      timestamp: '2 min ago',
      isRead: false,
      routeId: 'route-1'
    },
    {
      id: '2',
      type: 'checkpoint_added',
      title: 'New Stop Added',
      description: 'Emergency pickup at Memorial Hospital - Lab Wing',
      timestamp: '15 min ago',
      isRead: false,
      checkpointId: 'checkpoint-5',
      routeId: 'route-1'
    },
    {
      id: '3',
      type: 'visit_update',
      title: 'Visit Instructions Updated',
      description: 'Special handling required for samples at Valley Medical Center',
      timestamp: '1 hour ago',
      isRead: false,
      checkpointId: 'checkpoint-3',
      routeId: 'route-1'
    },
    {
      id: '4',
      type: 'driver_message',
      title: 'Sarah M. (Driver)',
      description: 'Heavy traffic on I-95, consider alternate route',
      timestamp: '2 hours ago',
      isRead: true,
      avatar: 'SM'
    },
    {
      id: '5',
      type: 'route_update',
      title: 'Route Optimized',
      description: 'Your route has been automatically optimized to save 20 minutes',
      timestamp: '3 hours ago',
      isRead: true,
      routeId: 'route-1'
    },
    {
      id: '6',
      type: 'checkpoint_removed',
      title: 'Stop Cancelled',
      description: 'Downtown Clinic pickup has been cancelled - samples not ready',
      timestamp: '4 hours ago',
      isRead: true
    }
  ]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'route_update':
        return Route;
      case 'checkpoint_added':
      case 'checkpoint_removed':
        return MapPin;
      case 'visit_update':
        return AlertTriangle;
      case 'dispatcher_message':
        return Bell;
      case 'driver_message':
        return User;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'route_update':
        return 'text-primary';
      case 'checkpoint_added':
        return 'text-primary';
      case 'checkpoint_removed':
        return 'text-muted-foreground';
      case 'visit_update':
        return 'text-warning';
      case 'dispatcher_message':
        return 'text-primary';
      case 'driver_message':
        return 'text-secondary-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.routeId && onNavigateToRoute) {
      onNavigateToRoute(notification.routeId);
    } else if (notification.checkpointId && onNavigateToCheckpoint) {
      onNavigateToCheckpoint(notification.checkpointId);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="banking-header sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-title text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-caption text-muted-foreground">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setNotifications([]);
            toast({
              title: "Notifications cleared",
              description: "All notifications have been removed.",
            });
          }}
        >
          Clear all
        </Button>
      </div>

      {/* Notifications List */}
      <div className="px-6 pt-4 pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-subtitle text-foreground mb-2">No notifications</h3>
            <p className="text-body text-muted-foreground">
              You're all caught up! New notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const iconColor = getNotificationColor(notification.type);
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`banking-card ${notification.isRead ? 'opacity-75' : ''} cursor-pointer hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon or Avatar */}
                    <div className="flex-shrink-0 mt-1">
                      {notification.avatar ? (
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {notification.avatar}
                          </span>
                        </div>
                      ) : (
                        <div className={`w-10 h-10 bg-muted rounded-full flex items-center justify-center`}>
                          <Icon size={20} className={iconColor} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`text-body font-medium ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.title}
                        </h3>
                        <span className="text-caption text-muted-foreground flex-shrink-0">
                          {notification.timestamp}
                        </span>
                      </div>
                      <p className="text-label text-muted-foreground leading-relaxed">
                        {notification.description}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;