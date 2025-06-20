import React, { useState } from 'react';
import { blockCategories } from '../utils/blockDefinitions';
import { Block } from './Block';

export const BlockPalette: React.FC = () => {
  const [paletteWidth, setPaletteWidth] = useState(256); // Default 256px
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = paletteWidth;

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(400, startWidth + deltaX));
      setPaletteWidth(newWidth);
    };

    const handleMouseUp = () => {
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex">
      <div 
        className="bg-gray-50 border-r border-gray-200 overflow-y-auto overflow-x-auto flex flex-col"
        style={{ width: paletteWidth, minWidth: paletteWidth }}
      >
        <div className="p-3 flex-1" style={{ minWidth: 'max-content' }}>
          <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Blocks</h3>
          
          {blockCategories.map((category) => (
            <div key={category.name} className="mb-4">
              <div 
                className="flex items-center space-x-2 mb-2 p-2"
                style={{ backgroundColor: `${category.color}15` }}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                ></div>
                <h4 className="text-xs font-medium text-gray-800 whitespace-nowrap">{category.name}</h4>
              </div>
              
              <div className="space-y-1.5">
                {category.blocks.map((block) => (
                  <div key={block.id} style={{ minWidth: 'max-content' }}>
                    <Block
                      block={block}
                      isDraggable={true}
                      isInPalette={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Resize handle */}
      <div 
        className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors duration-200 flex items-center justify-center select-none ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleResizeStart}
      >
        <div className="w-0.5 h-8 bg-gray-400 hover:bg-white transition-colors duration-200 select-none"></div>
      </div>
    </div>
  );
};