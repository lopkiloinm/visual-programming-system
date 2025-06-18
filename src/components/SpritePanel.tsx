import React, { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { useSpriteContext } from '../contexts/SpriteContext';

export const SpritePanel: React.FC = () => {
  const { sprites, addSprite, selectSprite, selectedSprite, removeSprite } = useSpriteContext();
  const [panelHeight, setPanelHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);

  const generateRandomColor = (): string => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
      '#10ac84', '#ee5a24', '#0abde3', '#3867d6', '#8854d0'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAddSprite = () => {
    addSprite({
      id: `sprite_${Date.now()}`,
      name: `Sprite ${sprites.length + 1}`,
      x: 0, // Center of canvas (WebGPU coordinate system)
      y: 0, // Center of canvas (WebGPU coordinate system)
      size: 30,
      color: generateRandomColor(),
      waitUntilFrame: 0
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = panelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(400, startHeight + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className="bg-white border-t border-gray-300 flex flex-col"
      style={{ height: panelHeight }}
    >
      <div 
        className={`w-full h-1 bg-gray-300 hover:bg-blue-500 cursor-row-resize transition-colors duration-200 flex items-center justify-center ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleResizeStart}
      >
        <div className="w-8 h-0.5 bg-gray-400 hover:bg-white transition-colors duration-200"></div>
      </div>
      
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Sprites</h3>
          <button
            onClick={handleAddSprite}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors duration-200"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          {sprites.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-6">
              <div className="text-2xl mb-2">🎭</div>
              <p>No sprites yet</p>
              <p className="text-xs mt-1">Click "Add" to create a draggable sprite</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sprites.map((sprite) => (
                <div
                  key={sprite.id}
                  className={`p-2 rounded border cursor-pointer transition-all duration-200 ${
                    selectedSprite?.id === sprite.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => selectSprite(sprite)}
                  onDoubleClick={() => removeSprite(sprite.id)}
                  title="Click to select • Double-click to delete • Drag sprites on canvas"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                        style={{ backgroundColor: sprite.color }}
                      ></div>
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {sprite.name}
                      </span>
                    </div>
                    <Settings size={10} className="text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="truncate">
                      {`${Math.round(sprite.x)},${Math.round(sprite.y)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};