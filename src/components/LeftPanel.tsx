import React, { useState, useEffect } from 'react';
import { Shapes, Code, Bug } from 'lucide-react';
import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { CodeEditor } from './CodeEditor';
import { useSpriteContext } from '../contexts/SpriteContext';

interface LeftPanelProps {
  debugLogs?: Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>;
  isRunning?: boolean;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ debugLogs = [], isRunning = false }) => {
  const [activeWorkspace, setActiveWorkspace] = useState<'stage' | string>('stage');
  const [viewMode, setViewMode] = useState<'blocks' | 'code' | 'debug'>('blocks');
  const { sprites, selectedSprite } = useSpriteContext();
  const debugLogScrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll debug log to bottom when new logs are added
  useEffect(() => {
    if (debugLogScrollRef.current && viewMode === 'debug') {
      debugLogScrollRef.current.scrollTop = debugLogScrollRef.current.scrollHeight;
    }
  }, [debugLogs, viewMode]);

  useEffect(() => {
    if (selectedSprite) {
      setActiveWorkspace(selectedSprite.id);
    }
  }, [selectedSprite]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Shapes size={18} className="text-blue-600" />
            <span className="font-semibold text-gray-800">Programming</span>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'blocks'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('blocks')}
            >
              <Shapes size={14} />
              <span className="text-xs font-medium">Blocks</span>
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('code')}
            >
              <Code size={14} />
              <span className="text-xs font-medium">Code</span>
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'debug'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('debug')}
            >
              <Bug size={14} />
              <span className="text-xs font-medium">Debug</span>
              {debugLogs.length > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-1">
                  {debugLogs.length > 9 ? '9+' : debugLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {viewMode === 'blocks' && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Workspace</div>
            <div className="flex flex-wrap gap-1">
              <button
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeWorkspace === 'stage'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => setActiveWorkspace('stage')}
              >
                🎭 Stage
              </button>
              {sprites.map(sprite => (
                <button
                  key={sprite.id}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    activeWorkspace === sprite.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setActiveWorkspace(sprite.id)}
                >
                  <div 
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: sprite.color }}
                  />
                  {sprite.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'blocks' ? (
          <>
            <BlockPalette />
            <BlockWorkspace 
              spriteId={activeWorkspace === 'stage' ? undefined : activeWorkspace}
              isStage={activeWorkspace === 'stage'}
            />
          </>
        ) : viewMode === 'code' ? (
          <div className="flex-1">
            <CodeEditor />
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Action Queue Debug Log</h3>
              <p className="text-xs text-gray-600">
                Real-time execution trace for sprite action sequences
              </p>
              <div className="mt-2 text-xs text-gray-500">
                {debugLogs.length} logs {debugLogs.length >= 50 && "(showing last 50)"} •{" "}
                <span className="text-green-600">Actions</span> •{" "}
                <span className="text-red-600">Wait states</span> •{" "}
                <span className="text-gray-600">Info</span>
              </div>
            </div>
            
            <div ref={debugLogScrollRef} className="flex-1 overflow-y-auto p-4">
              {debugLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                  <Bug size={32} className="mx-auto mb-3 text-gray-400" />
                  <p className="font-medium mb-1">No debug logs yet</p>
                  <p className="text-xs">
                    {isRunning ? "Waiting for actions to execute..." : "Press Run on the canvas to see action execution logs"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {debugLogs.map((log, index) => (
                    <div
                      key={`${log.timestamp}-${index}`}
                      className={`flex gap-3 p-2 rounded transition-colors ${
                        log.type === 'action' ? 'bg-green-50 border-l-2 border-green-300' :
                        log.type === 'wait' ? 'bg-red-50 border-l-2 border-red-300' :
                        'bg-gray-50 border-l-2 border-gray-300'
                      }`}
                    >
                      <span className={`w-12 flex-shrink-0 font-semibold ${
                        log.type === 'action' ? 'text-green-700' :
                        log.type === 'wait' ? 'text-red-700' :
                        'text-gray-700'
                      }`}>
                        F{log.frame}
                      </span>
                      <span className={`flex-1 ${
                        log.type === 'action' ? 'text-green-800' :
                        log.type === 'wait' ? 'text-red-800' :
                        'text-gray-800'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};