import React, { useState } from 'react';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { BlockProvider } from './contexts/BlockContext';
import { SpriteProvider } from './contexts/SpriteContext';
import { VariableProvider } from './contexts/VariableContext';

function App() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(60); // percentage
  const [debugLogs, setDebugLogs] = useState<Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>>([]);
  const [isCanvasRunning, setIsCanvasRunning] = useState(false);

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + (deltaX / window.innerWidth) * 100;
      setLeftPanelWidth(Math.max(30, Math.min(80, newWidth)));
    };

    const handleMouseUp = () => {
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <VariableProvider>
      <SpriteProvider>
        <BlockProvider>
          <div className="h-screen flex flex-col bg-gray-50">
            <Header />
            <div className="flex-1 flex overflow-hidden">
              <div 
                className="bg-white border-r border-gray-200 flex flex-col"
                style={{ width: `${leftPanelWidth}%` }}
              >
                <LeftPanel debugLogs={debugLogs} isRunning={isCanvasRunning} />
              </div>
              
              <div 
                className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors duration-200 flex items-center justify-center group select-none"
                onMouseDown={handleResize}
              >
                <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-white transition-colors duration-200 select-none"></div>
              </div>
              
              <div 
                className="bg-gray-100 flex flex-col overflow-hidden"
                style={{ width: `${100 - leftPanelWidth}%` }}
              >
                <RightPanel 
                  onDebugLogsChange={setDebugLogs}
                  onRunningStateChange={setIsCanvasRunning}
                />
              </div>
            </div>
          </div>
        </BlockProvider>
      </SpriteProvider>
    </VariableProvider>
  );
}

export default App;