import { ChevronLeft, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface BankingHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const BankingHeader = ({ 
  title, 
  subtitle, 
  onBack, 
  onMenu, 
  actions,
  className 
}: BankingHeaderProps) => {
  return (
    <header className={cn("banking-header sticky top-0 z-50", className)}>
      <div className="flex items-center gap-3 w-full">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="flex-shrink-0"
          >
            <ChevronLeft size={20} />
          </Button>
        )}
        
        <div className="flex-1 min-w-0">
          <h1 className="text-title font-semibold text-foreground truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-caption text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        {actions || (onMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenu}
            className="flex-shrink-0"
          >
            <MoreVertical size={20} />
          </Button>
        ))}
      </div>
    </header>
  );
};

export default BankingHeader;