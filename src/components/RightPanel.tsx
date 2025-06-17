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
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <Canvas 
          onDebugLogsChange={onDebugLogsChange}
          onRunningStateChange={onRunningStateChange}
        />
      </div>
      
      <div className="border-t border-gray-300">
        <SpritePanel />
      </div>
    </div>
  );
};