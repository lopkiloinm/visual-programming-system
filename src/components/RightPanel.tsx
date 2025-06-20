import React from 'react';
import { Canvas } from './Canvas';
import { SpritePanel } from './SpritePanel';

interface RightPanelProps {
  onDebugLogsChange?: (logs: Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>) => void;
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ 
  onDebugLogsChange, 
  onRunningStateChange 
}) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <Canvas 
          onDebugLogsChange={onDebugLogsChange}
          onRunningStateChange={onRunningStateChange}
        />
      </div>
      
      <SpritePanel />
    </div>
  );
};