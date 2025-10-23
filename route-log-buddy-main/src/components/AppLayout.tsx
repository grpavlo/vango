import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  bottomContent?: ReactNode;
  className?: string;
}

const AppLayout = ({ 
  children, 
  showBottomNav = true, 
  bottomContent,
  className 
}: AppLayoutProps) => {
  const paddingBottom = showBottomNav ? 'pb-[calc(var(--nav-height)+var(--nav-safe-area))]' : '';
  
  return (
    <div className={cn("min-h-screen bg-background", paddingBottom, className)}>
      {children}
      {bottomContent}
    </div>
  );
};

export default AppLayout;