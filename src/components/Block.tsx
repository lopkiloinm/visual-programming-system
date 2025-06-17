import React from 'react';
import { BlockDefinition, BlockInstance } from '../types/blocks';
import { useBlockContext } from '../contexts/BlockContext';

interface BlockProps {
  block: BlockDefinition | BlockInstance;
  isDraggable?: boolean;
  isInPalette?: boolean;
  isInWorkspace?: boolean;
  onDelete?: () => void;
  nestingLevel?: number;
}

export const Block: React.FC<BlockProps> = ({ 
  block, 
  isDraggable = false,
  isInPalette = false,
  isInWorkspace = false,
  onDelete,
  nestingLevel = 0
}) => {
  const { updateBlockValue } = useBlockContext();

  const handleDragStart = (e: React.DragEvent) => {
    if (isDraggable && isInPalette) {
      e.dataTransfer.setData('application/json', JSON.stringify(block));
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  const handleInputChange = (inputName: string, value: any) => {
    if ('instanceId' in block && updateBlockValue) {
      updateBlockValue(block.instanceId, inputName, value);
    }
  };

  const getInputValue = (input: any) => {
    if ('instanceId' in block && block.values) {
      return block.values[input.name] ?? input.defaultValue;
    }
    return input.defaultValue;
  };

  const getInputWidth = (input: any) => {
    const value = getInputValue(input);
    const valueStr = String(value);
    
    // Calculate tight width based on character count
    // Each character is roughly 0.5rem in this font size
    const charWidth = 0.5;
    const padding = 1; // Account for px-2 padding
    const minWidth = 1.5; // Minimum usable width
    
    return Math.max(minWidth, valueStr.length * charWidth + padding);
  };

  const handleDoubleClick = () => {
    if (isInWorkspace && onDelete) {
      onDelete();
    }
  };

  // Calculate indentation based on nesting level
  const indentWidth = nestingLevel * 20;

  return (
    <div className="relative">
      {/* Nesting indicator lines */}
      {nestingLevel > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex">
          {Array.from({ length: nestingLevel }).map((_, i) => (
            <div
              key={i}
              className="w-5 border-l-2 border-gray-300"
              style={{ marginLeft: i === 0 ? '0' : '15px' }}
            >
              {i === nestingLevel - 1 && (
                <div className="w-3 h-0.5 bg-gray-300 mt-4"></div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div
        className={`
          inline-flex items-center px-3 py-2 rounded-lg text-white text-sm font-medium
          transition-all duration-200 select-none shadow-sm relative
          ${isDraggable && isInPalette ? 'cursor-grab hover:scale-105 hover:shadow-lg active:cursor-grabbing' : ''}
          ${isInWorkspace ? 'cursor-move hover:shadow-lg' : ''}
          ${block.type === 'event' ? 'rounded-t-lg rounded-b-sm' : 'rounded-lg'}
        `}
        style={{
          backgroundColor: block.color,
          minHeight: '36px',
          marginLeft: isInWorkspace ? `${indentWidth}px` : '0'
        }}
        draggable={isDraggable && isInPalette}
        onDragStart={handleDragStart}
        onDoubleClick={handleDoubleClick}
        title={isInWorkspace ? "Double-click to delete" : ""}
        data-block-id={'instanceId' in block ? block.instanceId : block.id}
      >
        {/* Nesting level indicator */}
        {isInWorkspace && nestingLevel > 0 && (
          <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
            <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white flex-shrink-0">{block.label}</span>
          {block.inputs && block.inputs.map((input, index) => (
            <div key={index} className="flex items-center">
              {input.type === 'number' && (
                <input
                  type="number"
                  defaultValue={getInputValue(input)}
                  key={`${('instanceId' in block ? block.instanceId : block.id)}-${input.name}`}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const parsedValue = parseFloat(rawValue);
                    
                    // Only update when we have a valid number (including negative numbers)
                    if (!isNaN(parsedValue)) {
                      handleInputChange(input.name, parsedValue);
                    } else if (rawValue === '') {
                      // Empty field becomes 0
                      handleInputChange(input.name, 0);
                    }
                    // Allow partial typing like "-" without immediately resetting
                  }}
                  onBlur={(e) => {
                    // On blur, ensure we have a valid number
                    const rawValue = e.target.value;
                    const parsedValue = parseFloat(rawValue);
                    if (isNaN(parsedValue) || rawValue === '' || rawValue === '-') {
                      const fallbackValue = input.defaultValue || 0;
                      handleInputChange(input.name, fallbackValue);
                      e.target.value = String(fallbackValue);
                    }
                  }}
                  className="px-2 py-1 mx-1 text-xs text-black rounded border-0 bg-white/95 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  style={{ width: `${getInputWidth(input)}rem` }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              )}
              {input.type === 'text' && (
                <input
                  type="text"
                  value={getInputValue(input)}
                  onChange={(e) => handleInputChange(input.name, e.target.value)}
                  className="px-2 py-1 mx-1 text-xs text-black rounded border-0 bg-white/95 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  style={{ width: `${getInputWidth(input)}rem` }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};