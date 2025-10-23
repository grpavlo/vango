import { Home, Bell, MapPin, Route, Settings, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItem {
  id: string;
  icon: LucideIcon;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

interface BottomNavigationProps {
  items?: NavigationItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  variant?: 'primary' | 'overlay' | 'transparent';
  showLabels?: boolean;
  disabled?: boolean;
  badges?: Record<string, number | string>;
  className?: string;
}

const BottomNavigation = ({ 
  items,
  activeTab, 
  onTabChange,
  variant = 'primary',
  showLabels = true,
  disabled = false,
  badges,
  className
}: BottomNavigationProps) => {
  const defaultTabs: NavigationItem[] = [
    { id: 'actions', icon: Bell, label: 'Notifs' },
    { id: 'map', icon: MapPin, label: 'Map' },
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'road', icon: Route, label: 'Routes' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];
  
  const tabs = items || defaultTabs;

  return (
    <div 
      className={cn(
        "banking-bottom-nav fixed bottom-0 left-0 right-0 z-[1001]",
        "pb-[var(--nav-safe-area)] px-4",
        className
      )}
    >
      <div className="grid grid-cols-5 gap-2 h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled = disabled || tab.disabled;
          const badge = badges?.[tab.id] || tab.badge;
          
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              className={cn(
                "banking-nav-item",
                isActive && "active",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={20} />
                {badge && (
                  <div className={cn(
                    "absolute -top-2 -right-2 min-w-[16px] h-4",
                    "bg-red-500 text-white text-xs font-medium",
                    "rounded-full flex items-center justify-center px-1",
                    "border border-background"
                  )}>
                    {badge}
                  </div>
                )}
              </div>
              {showLabels && (
                <span className="text-caption font-medium">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;