import React, { useState, useRef, useEffect } from 'react';
import { BlockDefinition, BlockInstance } from '../types/blocks';
import { useBlockContext } from '../contexts/BlockContext';
import { VariableSelector } from './VariableSelector';

interface BlockProps {
  block: BlockDefinition | BlockInstance;
  isDraggable?: boolean;
  isInPalette?: boolean;
  isInWorkspace?: boolean;
  onDelete?: () => void;
  nestingLevel?: number;
  zoomLevel?: number;
}

export const Block: React.FC<BlockProps> = ({ 
  block, 
  isDraggable = false,
  isInPalette = false,
  isInWorkspace = false,
  onDelete,
  nestingLevel = 0,
  zoomLevel = 1
}) => {
  const { updateBlockValue, isInputConnected, addConnection } = useBlockContext();

  const blockRef = useRef<HTMLDivElement>(null);
  const [needsRemeasure, setNeedsRemeasure] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Force initial measurement after DOM stabilizes
  useEffect(() => {
    if (!blockRef.current) return;

    // Multiple strategies to ensure initial measurement is accurate
    const forceInitialMeasurement = () => {
      setNeedsRemeasure(prev => !prev);
      setIsInitialRender(false);
    };

    // Strategy 1: Immediate measurement after mount
    const immediate = setTimeout(forceInitialMeasurement, 0);

    // Strategy 2: After next animation frame (ensures DOM is painted)
    const rafId = requestAnimationFrame(() => {
      setTimeout(forceInitialMeasurement, 0);
    });

    // Strategy 3: After a small delay (ensures all styles are applied)
    const delayed = setTimeout(forceInitialMeasurement, 16); // One frame at 60fps

    return () => {
      clearTimeout(immediate);
      clearTimeout(delayed);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Enhanced measurement system that triggers on layout changes
  useEffect(() => {
    if (!blockRef.current) return;

    // Force remeasurement when block position/size changes
    const observer = new ResizeObserver(() => {
      setNeedsRemeasure(prev => !prev); // Toggle to force re-measurement
    });

    const mutationObserver = new MutationObserver(() => {
      setNeedsRemeasure(prev => !prev); // Toggle to force re-measurement
    });

    observer.observe(blockRef.current);
    mutationObserver.observe(blockRef.current, { 
      attributes: true, 
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Enhanced drag event handlers for proper endpoint calculation
  const handleDragEnd = (e: React.DragEvent) => {
    // Force immediate remeasurement when block is placed down
    forceImmediateRemeasurement();
  };

  const handleMouseUp = () => {
    // Force immediate remeasurement after any positioning changes
    forceImmediateRemeasurement();
  };

  const handleDrop = (e: React.DragEvent) => {
    // Force immediate remeasurement when block is dropped
    forceImmediateRemeasurement();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't interfere with input interactions
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input' || 
        (e.target as HTMLElement).tagName.toLowerCase() === 'select') {
      return;
    }
    
    // Don't interfere with connection point interactions
    const target = e.target as HTMLElement;
    if (target.closest('.connection-point') || 
        target.classList.contains('connection-point') ||
        target.style.backgroundColor?.includes('orange') ||
        target.style.backgroundColor?.includes('green')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  const handleTouchEnd = () => {
    // Force immediate remeasurement after touch interactions (mobile)
    forceImmediateRemeasurement();
  };

  // Comprehensive immediate remeasurement function
  const forceImmediateRemeasurement = () => {
    // Multiple immediate triggers to ensure measurement happens ASAP
    setNeedsRemeasure(prev => !prev); // Immediate state change
    
    // Force DOM reflow immediately
    if (blockRef.current) {
      blockRef.current.offsetHeight; // Trigger immediate reflow
      blockRef.current.offsetWidth;  // Trigger additional reflow
    }
    
    // Additional measurements with different timing strategies
    setTimeout(() => setNeedsRemeasure(prev => !prev), 0);   // Next tick
    setTimeout(() => setNeedsRemeasure(prev => !prev), 1);   // Minimal delay
    setTimeout(() => setNeedsRemeasure(prev => !prev), 5);   // Quick follow-up
    setTimeout(() => setNeedsRemeasure(prev => !prev), 16);  // One frame
    
    // Request animation frame for post-paint measurement
    requestAnimationFrame(() => {
      setNeedsRemeasure(prev => !prev);
      setTimeout(() => setNeedsRemeasure(prev => !prev), 0);
    });
  };

  // Detect when block is placed in workspace and force immediate remeasurement
  useEffect(() => {
    if (isInWorkspace && !isInitialRender) {
      // Block has been placed in workspace - force immediate remeasurement
      forceImmediateRemeasurement();
    }
  }, [isInWorkspace, isInitialRender]); // Note: forceImmediateRemeasurement is stable within render

  // Notify parent components when measurements are stable
  useEffect(() => {
    if (!isInitialRender && blockRef.current) {
      // Dispatch a custom event to notify that this block is ready for accurate measurements
      const event = new CustomEvent('blockMeasurementReady', {
        detail: {
          blockId: 'instanceId' in block ? block.instanceId : block.id,
          element: blockRef.current
        },
        bubbles: true
      });
      blockRef.current.dispatchEvent(event);
    }
  }, [isInitialRender, needsRemeasure, block]);

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

  const getInputValue = (inputDef: any) => {
    if ('instanceId' in block && block.values) {
      return block.values[inputDef.name] ?? inputDef.defaultValue;
    }
    return inputDef.defaultValue;
  };

  // Check if input value is a variable reference
  const isVariableReference = (value: any) => {
    return typeof value === 'string' && value.startsWith('$');
  };

  // Check if an input is connected to a data source (using context)
  const isInputDataConnected = (inputName: string) => {
    // Check if there's a data connection to this specific input
    if (!('instanceId' in block)) return false;
    return isInputConnected(block.instanceId, inputName);
  };

  // Generate dynamic inputs for customizable blocks
  const getDynamicInputs = () => {
    if (!block.dynamicInputs || !('instanceId' in block)) return [];
    
    const argCount = getInputValue({ name: 'argCount', defaultValue: 0 });
    const dynamicInputs = [];
    
    for (let i = 0; i < argCount; i++) {
      dynamicInputs.push({
        type: 'text',
        name: `arg${i}`,
        defaultValue: `arg${i}`,
        acceptsVariables: true
      });
    }
    
    return dynamicInputs;
  };

  // Enhanced function to measure text content width (no chevron like VariableSelector)
  const measureTextWidth = (text: string): number => {
    // Create temporary span to measure just the text content
    const tempSpan = document.createElement('span');
    
    // Apply same font styling as inputs
    tempSpan.style.fontSize = '12px'; // text-xs
    tempSpan.style.fontFamily = 'inherit';
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.top = '-9999px';
    tempSpan.style.left = '-9999px';
    tempSpan.style.whiteSpace = 'pre';
    
    tempSpan.textContent = text || '';
    
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    
    // Add comfortable padding for the input (16px total: 8px left + 8px right)
    // Smaller than VariableSelector since no chevron needed, but comfortable
    return textWidth > 0 ? textWidth + 16 : (text?.length || 1) * 8;
  };

  const getInputWidth = (inputDef: any) => {
    // If this input is connected to a data source, it should be much smaller
    if (isInputDataConnected(inputDef.name)) {
      return 30; // Smaller width for connected inputs - just enough for colored box
    }
    
    const currentValue = getInputValue(inputDef);
    let textToMeasure = String(currentValue);
    
    // If empty and has placeholder, use placeholder for width calculation
    if (!textToMeasure && inputDef.type === 'number' && inputDef.acceptsVariables) {
      textToMeasure = "number or $varName";
    } else if (!textToMeasure && inputDef.type === 'text' && inputDef.acceptsVariables) {
      textToMeasure = "text or $varName";
    } else if (!textToMeasure && inputDef.type === 'number') {
      textToMeasure = "0000"; // Reasonable width for number inputs
    } else if (!textToMeasure && inputDef.type === 'text') {
      textToMeasure = "text"; // Reasonable width for text inputs
    }
    
    // For variable inputs, use a smaller fixed width (not used since VariableSelector handles its own width)
    if (inputDef.type === 'variable') {
      return 60; // Smaller fixed width
    }
    
    // Measure at natural size and let CSS transform handle proportional scaling
    return measureTextWidth(textToMeasure);
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

  // Check if an input definition should get a data connection point
  const shouldShowConnectionPoint = (inputDef: any) => {
    const blockId = ('instanceId' in block) ? block.id : block.id;
    
    // HARDCODED LIST: Only these exact block.input combinations get connection points
    // Everything else returns false
    
    return (
      // Control blocks
      (blockId === 'repeat_times' && inputDef.name === 'times') ||
      (blockId === 'wait_frames' && inputDef.name === 'frames') ||
      
      // Drawing blocks
      (blockId === 'set_fill' && inputDef.name === 'color') ||
      (blockId === 'set_background' && inputDef.name === 'color') ||
      (blockId === 'draw_rect' && (inputDef.name === 'x' || inputDef.name === 'y' || inputDef.name === 'w' || inputDef.name === 'h')) ||
      (blockId === 'draw_circle_at' && (inputDef.name === 'x' || inputDef.name === 'y' || inputDef.name === 'size')) ||
      (blockId === 'draw_sprite_circle' && inputDef.name === 'size') ||
      (blockId === 'draw_trail' && (inputDef.name === 'color' || inputDef.name === 'size')) ||
      
      // Motion blocks
      (blockId === 'move_sprite' && (inputDef.name === 'x' || inputDef.name === 'y')) ||
      (blockId === 'set_sprite_position' && (inputDef.name === 'x' || inputDef.name === 'y')) ||
      (blockId === 'glide_to_position' && (inputDef.name === 'x' || inputDef.name === 'y' || inputDef.name === 'speed')) ||
      (blockId === 'glide_to_mouse' && inputDef.name === 'speed') ||
      (blockId === 'set_velocity' && (inputDef.name === 'vx' || inputDef.name === 'vy')) ||
      (blockId === 'change_sprite_color' && inputDef.name === 'color') ||
      (blockId === 'change_sprite_size' && inputDef.name === 'size') ||
      (blockId === 'rotate_sprite' && inputDef.name === 'angle') ||
      (blockId === 'set_sprite_rotation' && inputDef.name === 'angle') ||
      (blockId === 'move_forward' && inputDef.name === 'distance') ||
      
      // Physics blocks
      (blockId === 'apply_force' && (inputDef.name === 'fx' || inputDef.name === 'fy')) ||
      (blockId === 'set_gravity' && inputDef.name === 'gravity') ||
      (blockId === 'bounce_sprite' && inputDef.name === 'bounciness') ||
      (blockId === 'set_friction' && inputDef.name === 'friction') ||
      
      // Sensing blocks
      (blockId === 'key_pressed' && inputDef.name === 'key') ||
      
      // Effects blocks
      (blockId === 'fade_sprite' && inputDef.name === 'opacity') ||
      (blockId === 'scale_sprite' && inputDef.name === 'scale') ||
      (blockId === 'tint_sprite' && inputDef.name === 'color') ||
      
      // Math blocks
      (blockId === 'number_value' && inputDef.name === 'value') ||
      
      // Variable blocks (ONLY the value inputs)
      (blockId === 'set_variable' && inputDef.name === 'value') ||
      (blockId === 'change_variable' && inputDef.name === 'value')
    );
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
        ref={blockRef}
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
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        title={isInWorkspace ? "Double-click to delete" : ""}
        data-block-id={'instanceId' in block ? block.instanceId : block.id}
      >
        {/* Block label */}
        <span className="font-bold">
          {block.label}
        </span>

        {/* Traditional inputs for blocks that need them */}
        {block.inputs && block.inputs.map((inputDef, index) => {
          const inputValue = getInputValue(inputDef);
          const isVarRef = isVariableReference(inputValue);
          
          return (
            <React.Fragment key={index}>
              {inputDef.type === 'boolean' && (
                <div className="flex items-center">
                  {/* Data connection point - only show if appropriate */}
                  {shouldShowConnectionPoint(inputDef) && (
                    <div
                      className={`w-2 h-2 border border-white cursor-pointer mr-1 flex-shrink-0 rounded-full connection-point ${
                        isInputDataConnected(inputDef.name) 
                          ? 'bg-green-400 hover:bg-green-500' 
                          : 'bg-orange-400 hover:bg-orange-500'
                      }`}
                      title={`${isInputDataConnected(inputDef.name) ? 'Disconnect' : 'Connect'} data to ${inputDef.name}`}
                      data-orange-dot={`${'instanceId' in block ? block.instanceId : block.id}-${inputDef.name}`}
                      onMouseUp={(e) => {
                        // If there's an active connection being created, this acts as an input handle
                        const isCurrentlyConnecting = typeof window !== 'undefined' && (window as any).isConnecting;
                        console.log(`Orange dot clicked: ${inputDef.name}, isConnecting: ${isCurrentlyConnecting}`);
                        
                        if (isCurrentlyConnecting) {
                          // Call the workspace's input handler with this input name as the handle
                          const event = new CustomEvent('inputConnectionTarget', {
                            detail: {
                              blockId: ('instanceId' in block) ? block.instanceId : block.id,
                              inputName: inputDef.name,
                              originalEvent: e
                            },
                            bubbles: true
                          });
                          console.log(`Dispatching inputConnectionTarget event for ${inputDef.name}`);
                          e.target?.dispatchEvent(event);
                        } else {
                          console.log(`Data input clicked for ${inputDef.name} - no active connection`);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />
                  )}
                  <select
                    defaultValue={String(inputValue)}
                    onChange={(e) => {
                      const value = e.target.value === 'true';
                      handleInputChange(inputDef.name, value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className={`py-1 text-xs rounded border focus:outline-blue-500 ${
                      isInputDataConnected(inputDef.name)
                        ? 'text-white border-white'
                        : 'text-black bg-white'
                    }`}
                    style={{ 
                      marginLeft: '1px', marginRight: '1px', 
                      paddingLeft: '4px', paddingRight: '4px',
                      backgroundColor: isInputDataConnected(inputDef.name) ? block.color : undefined
                    }}
                    disabled={isInputDataConnected(inputDef.name)}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </div>
              )}
              {inputDef.type === 'number' && (
                <div className="flex items-center">
                  {/* Data connection point - only show if appropriate */}
                  {shouldShowConnectionPoint(inputDef) && (
                    <div
                      className={`w-2 h-2 border border-white cursor-pointer mr-1 flex-shrink-0 rounded-full connection-point ${
                        isInputDataConnected(inputDef.name) 
                          ? 'bg-green-400 hover:bg-green-500' 
                          : 'bg-orange-400 hover:bg-orange-500'
                      }`}
                      title={`${isInputDataConnected(inputDef.name) ? 'Disconnect' : 'Connect'} data to ${inputDef.name}`}
                      data-orange-dot={`${'instanceId' in block ? block.instanceId : block.id}-${inputDef.name}`}
                      onMouseUp={(e) => {
                        // If there's an active connection being created, this acts as an input handle
                        const isCurrentlyConnecting = typeof window !== 'undefined' && (window as any).isConnecting;
                        console.log(`Orange dot clicked: ${inputDef.name}, isConnecting: ${isCurrentlyConnecting}`);
                        
                        if (isCurrentlyConnecting) {
                          // Call the workspace's input handler with this input name as the handle
                          const event = new CustomEvent('inputConnectionTarget', {
                            detail: {
                              blockId: ('instanceId' in block) ? block.instanceId : block.id,
                              inputName: inputDef.name,
                              originalEvent: e
                            },
                            bubbles: true
                          });
                          console.log(`Dispatching inputConnectionTarget event for ${inputDef.name}`);
                          e.target?.dispatchEvent(event);
                        } else {
                          console.log(`Data input clicked for ${inputDef.name} - no active connection`);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />
                  )}
                  <input
                    type={inputDef.acceptsVariables ? "text" : "number"}
                    value={isInputDataConnected(inputDef.name) ? "" : inputValue}
                    onChange={(e) => {
                      const value = inputDef.acceptsVariables ? e.target.value : (parseFloat(e.target.value) || 0);
                      handleInputChange(inputDef.name, value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className={`py-1 text-xs rounded border focus:outline-blue-500 text-center ${
                      isInputDataConnected(inputDef.name)
                        ? `text-white border-white`
                        : isVarRef 
                          ? 'text-purple-700 bg-purple-100 border-purple-300' 
                          : 'text-black bg-white'
                    }`}
                    style={{ 
                      width: `${getInputWidth(inputDef)}px`, 
                      marginLeft: '1px', marginRight: '1px', 
                      paddingLeft: '4px', paddingRight: '4px',
                      backgroundColor: isInputDataConnected(inputDef.name) ? block.color : undefined
                    }}
                    placeholder={isInputDataConnected(inputDef.name) ? "" : (inputDef.acceptsVariables ? "number or $varName" : "")}
                    disabled={isInputDataConnected(inputDef.name)}
                  />
                </div>
              )}
              {inputDef.type === 'text' && (
                <div className="flex items-center">
                  {/* Data connection point - only show if appropriate */}
                  {shouldShowConnectionPoint(inputDef) && (
                    <div
                      className={`w-2 h-2 border border-white cursor-pointer mr-1 flex-shrink-0 rounded-full connection-point ${
                        isInputDataConnected(inputDef.name) 
                          ? 'bg-green-400 hover:bg-green-500' 
                          : 'bg-orange-400 hover:bg-orange-500'
                      }`}
                      title={`${isInputDataConnected(inputDef.name) ? 'Disconnect' : 'Connect'} data to ${inputDef.name}`}
                      data-orange-dot={`${'instanceId' in block ? block.instanceId : block.id}-${inputDef.name}`}
                      onMouseUp={(e) => {
                        // If there's an active connection being created, this acts as an input handle
                        const isCurrentlyConnecting = typeof window !== 'undefined' && (window as any).isConnecting;
                        console.log(`Orange dot clicked: ${inputDef.name}, isConnecting: ${isCurrentlyConnecting}`);
                        
                        if (isCurrentlyConnecting) {
                          // Call the workspace's input handler with this input name as the handle
                          const event = new CustomEvent('inputConnectionTarget', {
                            detail: {
                              blockId: ('instanceId' in block) ? block.instanceId : block.id,
                              inputName: inputDef.name,
                              originalEvent: e
                            },
                            bubbles: true
                          });
                          console.log(`Dispatching inputConnectionTarget event for ${inputDef.name}`);
                          e.target?.dispatchEvent(event);
                        } else {
                          console.log(`Data input clicked for ${inputDef.name} - no active connection`);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />
                  )}
                  <input
                    type="text"
                    value={isInputDataConnected(inputDef.name) ? "" : inputValue}
                    onChange={(e) => handleInputChange(inputDef.name, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className={`py-1 text-xs rounded border focus:outline-blue-500 text-center ${
                      isInputDataConnected(inputDef.name)
                        ? `text-white border-white`
                        : isVarRef 
                          ? 'text-purple-700 bg-purple-100 border-purple-300' 
                          : 'text-black bg-white'
                    }`}
                    style={{ 
                      width: `${getInputWidth(inputDef)}px`, 
                      marginLeft: '1px', marginRight: '1px', 
                      paddingLeft: '4px', paddingRight: '4px',
                      backgroundColor: isInputDataConnected(inputDef.name) ? block.color : undefined
                    }}
                    placeholder={isInputDataConnected(inputDef.name) ? "" : (inputDef.acceptsVariables ? "text or $varName" : "")}
                    disabled={isInputDataConnected(inputDef.name)}
                  />
                </div>
              )}
              {inputDef.type === 'dropdown' && (
                <div className="flex items-center">
                  {/* Data connection point - only show if appropriate */}
                  {shouldShowConnectionPoint(inputDef) && (
                    <div
                      className={`w-2 h-2 border border-white cursor-pointer mr-1 flex-shrink-0 rounded-full connection-point ${
                        isInputDataConnected(inputDef.name) 
                          ? 'bg-green-400 hover:bg-green-500' 
                          : 'bg-orange-400 hover:bg-orange-500'
                      }`}
                      title={`${isInputDataConnected(inputDef.name) ? 'Disconnect' : 'Connect'} data to ${inputDef.name}`}
                      data-orange-dot={`${'instanceId' in block ? block.instanceId : block.id}-${inputDef.name}`}
                      onMouseUp={(e) => {
                        // If there's an active connection being created, this acts as an input handle
                        const isCurrentlyConnecting = typeof window !== 'undefined' && (window as any).isConnecting;
                        console.log(`Orange dot clicked: ${inputDef.name}, isConnecting: ${isCurrentlyConnecting}`);
                        
                        if (isCurrentlyConnecting) {
                          // Call the workspace's input handler with this input name as the handle
                          const event = new CustomEvent('inputConnectionTarget', {
                            detail: {
                              blockId: ('instanceId' in block) ? block.instanceId : block.id,
                              inputName: inputDef.name,
                              originalEvent: e
                            },
                            bubbles: true
                          });
                          console.log(`Dispatching inputConnectionTarget event for ${inputDef.name}`);
                          e.target?.dispatchEvent(event);
                        } else {
                          console.log(`Data input clicked for ${inputDef.name} - no active connection`);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />
                  )}
                  <select
                    defaultValue={String(inputValue)}
                    onChange={(e) => handleInputChange(inputDef.name, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className={`py-1 text-xs rounded border focus:outline-blue-500 ${
                      isInputDataConnected(inputDef.name)
                        ? 'text-white border-white'
                        : 'text-black bg-white'
                    }`}
                    style={{ 
                      marginLeft: '1px', marginRight: '1px', 
                      paddingLeft: '4px', paddingRight: '4px',
                      backgroundColor: isInputDataConnected(inputDef.name) ? block.color : undefined
                    }}
                    disabled={isInputDataConnected(inputDef.name)}
                  >
                    {inputDef.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {inputDef.type === 'variable' && (
                <div onMouseDown={(e) => e.stopPropagation()} style={{ marginLeft: '1px', marginRight: '1px' }}>
                  <VariableSelector
                    value={inputValue}
                    onChange={(value) => handleInputChange(inputDef.name, value)}
                    allowedTypes={inputDef.variableTypes || ['number', 'text', 'boolean']}
                    allowedScopes={inputDef.variableScope || ['global', 'instance']}
                    placeholder="$var"
                    currentSpriteId={('instanceId' in block && block.spriteId) ? block.spriteId : undefined}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Dynamic inputs for customizable blocks */}
        {block.dynamicInputs && getDynamicInputs().map((dynamicInputDef, index) => {
          const inputValue = getInputValue(dynamicInputDef);
          const isVarRef = isVariableReference(inputValue);
          
          return (
            <div key={`dynamic-${index}`} className="flex items-center">
              {/* Data connection point - only show if appropriate */}
              {shouldShowConnectionPoint(dynamicInputDef) && (
                <div
                  className={`w-2 h-2 border border-white cursor-pointer mr-1 flex-shrink-0 rounded-full connection-point ${
                    isInputDataConnected(dynamicInputDef.name) 
                      ? 'bg-green-400 hover:bg-green-500' 
                      : 'bg-orange-400 hover:bg-orange-500'
                  }`}
                  title={`${isInputDataConnected(dynamicInputDef.name) ? 'Disconnect' : 'Connect'} data to ${dynamicInputDef.name}`}
                  data-orange-dot={`${'instanceId' in block ? block.instanceId : block.id}-${dynamicInputDef.name}`}
                  onMouseUp={(e) => {
                    // If there's an active connection being created, this acts as an input handle
                    const isCurrentlyConnecting = typeof window !== 'undefined' && (window as any).isConnecting;
                    console.log(`Orange dot clicked: ${dynamicInputDef.name}, isConnecting: ${isCurrentlyConnecting}`);
                    
                    if (isCurrentlyConnecting) {
                      // Call the workspace's input handler with this input name as the handle
                      const event = new CustomEvent('inputConnectionTarget', {
                        detail: {
                          blockId: ('instanceId' in block) ? block.instanceId : block.id,
                          inputName: dynamicInputDef.name,
                          originalEvent: e
                        },
                        bubbles: true
                      });
                      console.log(`Dispatching inputConnectionTarget event for ${dynamicInputDef.name}`);
                      e.target?.dispatchEvent(event);
                    } else {
                      console.log(`Data input clicked for ${dynamicInputDef.name} - no active connection`);
                    }
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              )}
              <input
                type="text"
                value={isInputDataConnected(dynamicInputDef.name) ? "" : inputValue}
                onChange={(e) => handleInputChange(dynamicInputDef.name, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className={`py-1 text-xs rounded border focus:outline-blue-500 text-center ${
                  isInputDataConnected(dynamicInputDef.name)
                    ? `text-white border-white`
                    : isVarRef 
                      ? 'text-purple-700 bg-purple-100 border-purple-300' 
                      : 'text-black bg-white'
                }`}
                style={{ 
                  width: `${getInputWidth(dynamicInputDef)}px`, 
                  marginLeft: '1px', marginRight: '1px', 
                  paddingLeft: '4px', paddingRight: '4px',
                  backgroundColor: isInputDataConnected(dynamicInputDef.name) ? block.color : undefined
                }}
                placeholder={isInputDataConnected(dynamicInputDef.name) ? "" : "value or $varName"}
                disabled={isInputDataConnected(dynamicInputDef.name)}
              />
            </div>
          );
        })}

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