import React from 'react';
import { blockCategories } from '../utils/blockDefinitions';
import { Block } from './Block';

export const BlockPalette: React.FC = () => {
  return (
    <div className="min-w-64 w-auto bg-gray-50 border-r border-gray-200 overflow-y-auto overflow-x-auto">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Blocks</h3>
        
        {blockCategories.map((category) => (
          <div key={category.name} className="mb-4">
            <div 
              className="flex items-center space-x-2 mb-2 p-2 rounded"
              style={{ backgroundColor: `${category.color}15` }}
            >
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              ></div>
              <h4 className="text-xs font-medium text-gray-800">{category.name}</h4>
            </div>
            
            <div className="space-y-1.5">
              {category.blocks.map((block) => (
                <Block
                  key={block.id}
                  block={block}
                  isDraggable={true}
                  isInPalette={true}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};