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
    
    // Calculate tight width with just a tiny bit extra
    const charWidth = 0.5;
    const padding = 1; 
    const minWidth = 1.5;
    const tinyExtraSpace = 0.1; // Just a tiny constant to prevent cutoff
    
    return Math.max(minWidth, valueStr.length * charWidth + padding + tinyExtraSpace);
  };

  const handleDoubleClick = () => {
    if (isInWorkspace && onDelete) {
      onDelete();
    }
  };

  // Calculate indentation based on nesting level
  const indentWidth = nestingLevel * 20;
  
  // Calculate block dimensions based on height property and complexity
  const getBlockHeight = () => {
    // In palette, use more compact heights for better space usage
    if (isInPalette) {
      if (block.height === 'tall') return '48px';
      if (block.height === 'medium') return '40px';
      return '36px';
    }
    
    // In workspace, use full calculated heights for proper connection positioning
    if (block.height === 'tall') return '80px';
    if (block.height === 'medium') return '60px';
    return '36px';
  };

  const getBlockMinWidth = () => {
    // In palette, use natural content width for better preview
    if (isInPalette) {
      return 'auto';
    }
    
    // In workspace, use calculated dimensions for proper connection positioning
    let minWidth = 120;
    
    // Adjust width based on block height
    if (block.height === 'tall') {
      minWidth = 160;
    } else if (block.height === 'medium') {
      minWidth = 140;
    }
    
    // Further adjust for blocks with multiple labeled connections
    if (block.labeledConnections) {
      const inputCount = block.labeledConnections.inputs?.length || 0;
      const outputCount = block.labeledConnections.outputs?.length || 0;
      const totalConnections = inputCount + outputCount;
      
      if (totalConnections >= 3) {
        minWidth = Math.max(minWidth, 180);
      } else if (totalConnections === 2) {
        minWidth = Math.max(minWidth, 150);
      }
    }
    
    // Add width for traditional inputs
    const traditionalInputs = block.inputs?.length || 0;
    if (traditionalInputs > 0) {
      minWidth = Math.max(minWidth, minWidth + (traditionalInputs * 10));
    }
    
    return `${minWidth}px`;
  };

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
          inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium
          transition-all duration-200 select-none shadow-sm relative
          ${isDraggable && isInPalette ? 'cursor-grab hover:scale-105 hover:shadow-lg active:cursor-grabbing' : ''}
          ${isInWorkspace ? 'cursor-move hover:shadow-lg' : ''}
        `}
        style={{
          backgroundColor: block.color,
          padding: '8px 12px',
          marginLeft: isInWorkspace ? `${indentWidth}px` : '0',
          height: getBlockHeight(),
          minWidth: getBlockMinWidth(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: isInPalette ? 'flex-start' : 'center',
          width: isInPalette ? 'fit-content' : 'auto'
        }}
        draggable={isDraggable && isInPalette}
        onDragStart={handleDragStart}
        onDoubleClick={handleDoubleClick}
        title={isInWorkspace ? "Double-click to delete" : ""}
        data-block-id={'instanceId' in block ? block.instanceId : block.id}
      >
        {/* Block label */}
        <span className="font-bold">
          {block.label}
        </span>

        {/* Traditional inputs for blocks that need them */}
        {block.inputs && block.inputs.map((input, index) => (
          <div key={index} className="flex items-center">
            {input.type === 'boolean' && (
              <select
                defaultValue={String(getInputValue(input))}
                onChange={(e) => {
                  const value = e.target.value === 'true';
                  handleInputChange(input.name, value);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="px-2 py-1 mx-1 text-xs text-black rounded border bg-white focus:outline-blue-500"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            )}
            {input.type === 'number' && (
              <input
                type="number"
                defaultValue={getInputValue(input)}
                onChange={(e) => {
                  const parsedValue = parseFloat(e.target.value) || 0;
                  handleInputChange(input.name, parsedValue);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="px-2 py-1 mx-1 text-xs text-black rounded border bg-white focus:outline-blue-500"
                style={{ width: `${getInputWidth(input)}rem` }}
              />
            )}
            {input.type === 'text' && (
              <input
                type="text"
                defaultValue={getInputValue(input)}
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="px-2 py-1 mx-1 text-xs text-black rounded border bg-white focus:outline-blue-500"
                style={{ width: `${getInputWidth(input)}rem` }}
              />
            )}
          </div>
        ))}

        {/* Nesting level indicator */}
        {isInWorkspace && nestingLevel > 0 && (
          <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
            <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
          </div>
        )}
      </div>
    </div>
  );
};