import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface BankingCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  withChevron?: boolean;
}

const BankingCard = ({ 
  children, 
  className, 
  onClick, 
  hoverable = true,
  withChevron = false
}: BankingCardProps) => {
  const isInteractive = onClick || hoverable;
  
  return (
    <div
      className={cn(
        "banking-card",
        isInteractive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {children}
        </div>
        {withChevron && (
          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 ml-2" />
        )}
      </div>
    </div>
  );
};

interface BankingListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const BankingListItem = ({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  className
}: BankingListItemProps) => {
  return (
    <div
      className={cn("banking-list-item", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {icon && (
        <div className="banking-icon-container">
          {icon}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-body font-medium text-foreground truncate">
          {title}
        </p>
        {subtitle && (
          <p className="text-caption text-muted-foreground truncate">
            {subtitle}
          </p>
        )}
      </div>
      
      {trailing && (
        <div className="flex-shrink-0 ml-2">
          {trailing}
        </div>
      )}
    </div>
  );
};

export { BankingCard, BankingListItem };