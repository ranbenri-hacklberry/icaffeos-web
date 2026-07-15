import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * A generic Icon component that wraps lucide-react icons.
 * Usage: <Icon name="Coffee" size={24} className="text-orange-500" />
 */
const Icon = ({ name, ...props }) => {
  const LucideIcon = LucideIcons[name];
  
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return <LucideIcons.HelpCircle {...props} />;
  }

  return <LucideIcon {...props} />;
};

export default Icon;
