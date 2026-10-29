import React from 'react';
import * as LucideIcons from 'lucide-react';

interface ToolIconProps {
  name: string;
  className?: string;
  size?: number;
}

export const ToolIcon: React.FC<ToolIconProps> = ({ name, className = 'w-6 h-6', size }) => {
  // @ts-ignore
  const IconComponent = (LucideIcons as Record<string, any>)[name] || LucideIcons.FileText;
  return <IconComponent className={className} size={size} />;
};
