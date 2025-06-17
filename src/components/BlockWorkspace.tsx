import React, { useState, useRef, useEffect } from 'react';
import { useBlockContext } from '../contexts/BlockContext';
import { Block } from './Block';
import { FlowConnection } from '../types/blocks';

interface BlockWorkspaceProps {
  spriteId?: string;
  isStage?: boolean;
}

const GRID_SIZE = 20;

export const BlockWorkspace: React.FC<BlockWorkspaceProps> = ({ spriteId, isStage = false }) => {
  const { 
    workspaceBlocks, 
    connections,
    addBlockToWorkspace, 
    removeBlockFromWorkspace, 
    updateBlockPosition,
    addConnection,
    removeConnection,
    updateConnectionWaitTime,
    getConnectionsFromBlock
  } = useBlockContext();
  
  // Create unique workspace key for each sprite/stage
  const workspaceKey = isStage ? 'stage' : `sprite_${spriteId}`;
  
  // Store workspace transforms per sprite/stage
  const [workspaceTransforms, setWorkspaceTransforms] = useState<Record<string, {x: number, y: number, scale: number}>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [frozenConnectionData, setFrozenConnectionData] = useState<{
    connections: Array<{connection: FlowConnection, startPos: {x: number, y: number}, endPos: {x: number, y: number}}>,
    handles: Array<{block: any, hasInput: boolean, hasOutput: boolean, leftPos: {x: number, y: number} | null, topPos: {x: number, y: number} | null, rightPos: {x: number, y: number} | null, bottomPos: {x: number, y: number} | null}>,
    scale: number
  } | null>(null);
  const [connectionStart, setConnectionStart] = useState<{blockId: string, handle: 'output' | 'bottom'} | null>(null);
  const [tempConnection, setTempConnection] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  
  const workspaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panningRef = useRef(false);

  // Get current workspace transform (default to origin)
  const workspaceTransform = workspaceTransforms[workspaceKey] || { x: 0, y: 0, scale: 1 };
  
  // Update workspace transform for this specific workspace
  const updateWorkspaceTransform = (newTransform: {x: number, y: number, scale: number}) => {
    const oldTransform = workspaceTransforms[workspaceKey] || { x: 0, y: 0, scale: 1 };
    const isZoomChange = Math.abs(oldTransform.scale - newTransform.scale) > 0.001;
    
    // Capture frozen data BEFORE state update (using current transform for calculations)
    if (isZoomChange && !isPanning) {
      // Freeze current connection data using OLD transform state
      const currentConnectionData = workspaceSpecificConnections.map(connection => {
        const startPos = getOutputPosition(connection.sourceBlockId);
        const endPos = getInputPosition(connection.targetBlockId);
        return { connection, startPos, endPos };
      });

      const currentHandleData = workspaceSpecificBlocks.map(block => {
        const hasOutput = block.type === 'event' || block.type === 'action' || block.type === 'control';
        const hasInput = block.type === 'action' || block.type === 'control';
        const leftPos = hasInput ? getInputPosition(block.instanceId, 'input') : null;
        const topPos = hasInput ? getInputPosition(block.instanceId, 'top') : null;
        const rightPos = hasOutput ? getOutputPosition(block.instanceId, 'output') : null;
        const bottomPos = hasOutput ? getOutputPosition(block.instanceId, 'bottom') : null;
        return { block, hasInput, hasOutput, leftPos, topPos, rightPos, bottomPos };
      });

      setFrozenConnectionData({ 
        connections: currentConnectionData, 
        handles: currentHandleData,
        scale: oldTransform.scale // Store the OLD scale
      });
      setIsTransitioning(true);
      
      // Clear transition state and frozen data after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setFrozenConnectionData(null);
      }, 100); // Match CSS transition duration
    }
    
    // Now update the transform state
    setWorkspaceTransforms(prev => ({
      ...prev,
      [workspaceKey]: newTransform
    }));
  };

  // Filter blocks for this workspace
  const workspaceSpecificBlocks = workspaceBlocks.filter(block => {
    if (isStage) return block.workspaceType === 'stage';
    return block.workspaceType === 'sprite' && block.spriteId === spriteId;
  });

  // Filter connections for this workspace
  const workspaceSpecificConnections = connections.filter(conn => {
    const sourceBlock = workspaceBlocks.find(b => b.instanceId === conn.sourceBlockId);
    if (!sourceBlock) return false;
    if (isStage) return sourceBlock.workspaceType === 'stage';
    return sourceBlock.workspaceType === 'sprite' && sourceBlock.spriteId === spriteId;
  });

  const snapToGrid = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Cached block dimensions with invalidation
  const [blockDimensionsCache, setBlockDimensionsCache] = useState<Map<string, {width: number, height: number, timestamp: number}>>(new Map());
  const [dimensionsCacheKey, setDimensionsCacheKey] = useState(0);
    
  // Invalidate cache when blocks change (prevent infinite loop)
  useEffect(() => {
    setBlockDimensionsCache(new Map());
    setDimensionsCacheKey(prev => prev + 1);
  }, [workspaceSpecificBlocks.length]);

  // Force refresh when tab becomes visible (fixes tab switching issues)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh dimensions after a short delay
        setTimeout(() => {
          setBlockDimensionsCache(new Map());
          setDimensionsCacheKey(prev => prev + 1);
        }, 50);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Manual refresh function for user-triggered fixes
  const forceRefreshConnections = () => {
    setBlockDimensionsCache(new Map());
    setDimensionsCacheKey(prev => prev + 1);
    // Force a re-render of all connections
    setTimeout(() => {
      if (svgRef.current) {
        const svgElement = svgRef.current;
        const display = svgElement.style.display;
        svgElement.style.display = 'none';
        svgElement.getBoundingClientRect(); // Trigger reflow
        svgElement.style.display = display;
      }
    }, 10);
  };

  // Get actual block dimensions with simple caching
  const getBlockDimensions = (blockId: string) => {
    const cacheKey = `${blockId}_${workspaceTransform.scale.toFixed(4)}`;
    const cached = blockDimensionsCache.get(cacheKey);
    const now = Date.now();
    
    // Use cache if recent (within 50ms for immediate calculations)
    if (cached && (now - cached.timestamp) < 50) {
      return { width: cached.width, height: cached.height };
    }

    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    if (blockElement) {
      const rect = blockElement.getBoundingClientRect();
      
      // Only trust measurements if element is actually visible and positioned correctly
      if (rect.width > 0 && rect.height > 0 && 
          rect.left > -10000 && rect.top > -10000 && // Not hidden off-screen
          getComputedStyle(blockElement).visibility !== 'hidden' &&
          getComputedStyle(blockElement).display !== 'none') {
        
        // Convert viewport dimensions back to workspace coordinates
        const width = rect.width / workspaceTransform.scale;
        const height = rect.height / workspaceTransform.scale;
        
        // Sanity check the resulting dimensions
        if (width > 0 && width < 1000 && height > 0 && height < 500) {
          // Cache the result
          const newCache = new Map(blockDimensionsCache);
          newCache.set(cacheKey, { width, height, timestamp: now });
          setBlockDimensionsCache(newCache);
          
          return { width, height };
        }
      }
    }
    
    // Fallback dimensions with intelligent sizing based on block complexity
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
    if (!block) {
      return { width: 120, height: 36 };
    }
    
    // Calculate base dimensions based on block type and complexity
    let baseWidth = 120;
    let baseHeight = 36;
    
    // Adjust height based on block's height property
    if (block.height === 'tall') {
      baseHeight = 80;
      baseWidth = 160; // Make tall blocks wider too
    } else if (block.height === 'medium') {
      baseHeight = 60;
      baseWidth = 140; // Make medium blocks wider
    }
    
    // Further adjust for blocks with multiple labeled connections
    if (block.labeledConnections) {
      const inputCount = block.labeledConnections.inputs?.length || 0;
      const outputCount = block.labeledConnections.outputs?.length || 0;
      const totalConnections = inputCount + outputCount;
      
      // Scale width based on number of connections
      if (totalConnections >= 3) {
        baseWidth = Math.max(baseWidth, 180); // Very wide for complex blocks
      } else if (totalConnections === 2) {
        baseWidth = Math.max(baseWidth, 150); // Wider for dual-connection blocks
      }
      
      // Scale height if many connections
      if (totalConnections >= 4) {
        baseHeight = Math.max(baseHeight, 80);
      } else if (totalConnections === 3) {
        baseHeight = Math.max(baseHeight, 60);
      }
    }
    
    // Additional width for blocks with traditional inputs
    const traditionalInputs = block.inputs?.length || 0;
    if (traditionalInputs > 0) {
      baseHeight = Math.max(baseHeight, 44); // Ensure space for inputs
      baseWidth = Math.max(baseWidth, baseWidth + (traditionalInputs * 10)); // Add width for inputs
    }
    
    return { width: baseWidth, height: baseHeight };
  };

  // Get connection positions - all blocks support all handle types
  const getOutputPosition = (blockId: string, handle: 'output' | 'bottom' | string = 'output') => {
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
    if (!block?.position) return { x: 0, y: 0 };
    
    const { width, height } = getBlockDimensions(blockId);
    
    // For labeled connections, calculate position based on the handle
    if (block.labeledConnections && handle !== 'output' && handle !== 'bottom') {
      // Handle format is like "output-0", "output-1", etc.
      const handleMatch = handle.match(/^output-(\d+)$/);
      if (handleMatch && block.labeledConnections.outputs) {
        const outputIndex = parseInt(handleMatch[1], 10);
        const output = block.labeledConnections.outputs[outputIndex];
        
        // Special positioning for control blocks like if/while  
        if (block.category === 'Control' || block.type === 'control') {
          // Position outputs on the right side, evenly spaced
          const rightOutputs = block.labeledConnections.outputs.filter(out => out.side === 'right');
          const rightIndex = rightOutputs.findIndex(out => out === output);
          const totalRightOutputs = rightOutputs.length;
          
          // For if blocks, evenly space then/else with condition (which is at 25%)
          let yOffset;
          if (block.id === 'if_condition' && totalRightOutputs === 2) {
            yOffset = rightIndex === 0 ? height * 0.5 : height * 0.75; // then at 50%, else at 75%
          } else {
            yOffset = height * (rightIndex + 1) / (totalRightOutputs + 1);
          }
          
          return {
            x: block.position.x + width, // Right edge
            y: block.position.y + yOffset
          };
        } else {
          // Standard positioning for value blocks
          const totalOutputs = block.labeledConnections.outputs.length;
          const yPosition = block.position.y + (height * (outputIndex + 1) / (totalOutputs + 1));
          
          if (output.side === 'left') {
            return {
              x: block.position.x, // Left edge
              y: yPosition
            };
          } else {
            return {
              x: block.position.x + width, // Right edge
              y: yPosition
            };
          }
        }
      }
    }
    
    if (handle === 'bottom') {
      return {
        x: block.position.x + (width / 2), // Horizontal center
        y: block.position.y + height // Bottom edge
      };
    } else { // 'output' (right)
      return {
        x: block.position.x + width, // Right edge
        y: block.position.y + (height / 2) // Vertical center
      };
    }
  };

  const getInputPosition = (blockId: string, handle: 'input' | 'top' | string = 'input') => {
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
    if (!block?.position) return { x: 0, y: 0 };
    
    const { width, height } = getBlockDimensions(blockId);
    
    // For labeled connections, calculate position based on the handle
    if (block.labeledConnections && handle !== 'input' && handle !== 'top') {
      // Handle format is like "input-0", "input-1", etc.
      const handleMatch = handle.match(/^input-(\d+)$/);
      if (handleMatch && block.labeledConnections.inputs) {
        const inputIndex = parseInt(handleMatch[1], 10);
        const input = block.labeledConnections.inputs[inputIndex];
        
        // Standard left-side positioning for all inputs
        const leftInputs = block.labeledConnections.inputs.filter(inp => inp.side === 'left');
        const leftIndex = leftInputs.findIndex(inp => inp === input);
        const totalLeftInputs = leftInputs.length;
        
        // For control blocks, position condition near the top for logical flow
        if ((block.category === 'Control' || block.type === 'control') && input.type === 'boolean') {
          return {
            x: block.position.x, // Left edge
            y: block.position.y + (height * 0.25) // Near the top (25% down)
          };
        } else {
          // Standard spacing for data inputs
          const yPosition = block.position.y + (height * (leftIndex + 1) / (totalLeftInputs + 1));
          return {
            x: block.position.x, // Left edge
            y: yPosition
          };
        }
      }
    }
    
    if (handle === 'top') {
      return {
        x: block.position.x + (width / 2), // Horizontal center
        y: block.position.y // Top edge
      };
    } else { // 'input' (left)
      return {
        x: block.position.x, // Left edge
        y: block.position.y + (height / 2) // Vertical center
      };
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const blockData = JSON.parse(e.dataTransfer.getData('application/json'));
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Get the actual drop position relative to the workspace, accounting for transform
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      
      // Adjust for workspace transform
      const x = (rawX - workspaceTransform.x) / workspaceTransform.scale;
      const y = (rawY - workspaceTransform.y) / workspaceTransform.scale;
      
      const snappedPosition = { x: snapToGrid(x), y: snapToGrid(y) };
      
      const newBlock = {
        ...blockData,
        instanceId: `${blockData.id}_${Date.now()}`,
        position: snappedPosition,
        workspaceType: isStage ? 'stage' : 'sprite',
        spriteId: spriteId,
        values: {}
      };

      if (blockData.inputs) {
        blockData.inputs.forEach((input: any) => {
          newBlock.values[input.name] = input.defaultValue;
        });
      }
      
      addBlockToWorkspace(newBlock);
    } catch (error) {
      console.error('Error dropping block:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBlockMouseDown = (instanceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const block = workspaceSpecificBlocks.find(b => b.instanceId === instanceId);
    
    if (!block || !block.position) return;
    
    const startBlockX = block.position.x;
    const startBlockY = block.position.y;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - startX) / workspaceTransform.scale;
      const deltaY = (e.clientY - startY) / workspaceTransform.scale;
      
      const newX = snapToGrid(startBlockX + deltaX);
      const newY = snapToGrid(startBlockY + deltaY);
      
      updateBlockPosition(instanceId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle connection creation (optimized)
  const handleOutputMouseDown = (blockId: string, handle: 'output' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsConnecting(true);
    setConnectionStart({ blockId, handle });
    
    // Start from the specified handle position in workspace coordinates
    const outputPos = getOutputPosition(blockId, handle);
    setTempConnection({ x1: outputPos.x, y1: outputPos.y, x2: outputPos.x, y2: outputPos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isConnecting && tempConnection && connectionStart) {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Convert mouse position to workspace coordinates
      const viewportX = e.clientX - rect.left;
      const viewportY = e.clientY - rect.top;
      const workspaceX = (viewportX - workspaceTransform.x) / workspaceTransform.scale;
      const workspaceY = (viewportY - workspaceTransform.y) / workspaceTransform.scale;
      
      // Keep start position in workspace coordinates
      const startPos = getOutputPosition(connectionStart.blockId, connectionStart.handle);
      setTempConnection({ x1: startPos.x, y1: startPos.y, x2: workspaceX, y2: workspaceY });
    }
  };

  const handleInputMouseUp = (targetBlockId: string, handle: 'input' | 'top', e: React.MouseEvent) => {
    if (isConnecting && connectionStart) {
      e.preventDefault();
      e.stopPropagation();
      
      // Enforce directional rules: down→top, right→left
      const sourceHandle = connectionStart.handle;
      const targetHandle = handle;
      
      // Check if connection direction is valid
      // Handle both traditional handles and labeled handles
      const isVerticalConnection = sourceHandle === 'bottom' && targetHandle === 'top';
      const isHorizontalConnection = 
        (sourceHandle === 'output' && targetHandle === 'input') ||
        (sourceHandle.startsWith('output-') && targetHandle.startsWith('input-')) ||
        (sourceHandle === 'output' && targetHandle.startsWith('input-')) ||
        (sourceHandle.startsWith('output-') && targetHandle === 'input');
      
      const isValidConnection = isVerticalConnection || isHorizontalConnection;
      
      if (!isValidConnection) {
        console.warn(`Invalid connection: ${sourceHandle} cannot connect to ${targetHandle}. Use down→top or right→left.`);
        setIsConnecting(false);
        setConnectionStart(null);
        setTempConnection(null);
        return;
      }
      
      // Determine connection type based on handles
      const connectionType = isVerticalConnection ? 'vertical' : 'horizontal';
      
      // Create new connection
      const newConnection: FlowConnection = {
        id: `conn_${Date.now()}`,
        sourceBlockId: connectionStart.blockId,
        targetBlockId: targetBlockId,
        waitFrames: 0, // Default to immediate execution
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        connectionType: connectionType
      };
      
      addConnection(newConnection);
    }
    
    // Reset connection state
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnection(null);
  };

  const handleWorkspaceMouseUp = () => {
    if (isConnecting) {
      // Cancel connection if not dropped on a valid target
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
    }
  };

  // Handle workspace panning (optimized for performance)
  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    // Blur any focused inputs when clicking outside blocks
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT';
    const isInsideBlock = target.closest('[data-block-id]');
    
    if (!isInput && !isInsideBlock) {
      // Click is outside any block, blur all focused inputs
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'SELECT')) {
        focusedElement.blur();
      }
    }
    
    // Only start panning if clicking on empty space (not on blocks)
    const isEmptySpace = target === e.currentTarget || 
                        target.classList.contains('workspace-background') ||
                        target.closest('.workspace-background') === target;
    
    if (isEmptySpace && !target.closest('[data-block-id]')) {
      e.preventDefault();
      e.stopPropagation();
      
      setIsPanning(true);
      panningRef.current = true;
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startTransform = { ...workspaceTransform };
      
      let animationFrame: number;

      const handleMouseMove = (e: MouseEvent) => {
        if (!panningRef.current) return;
        
        if (animationFrame) cancelAnimationFrame(animationFrame);
        
        animationFrame = requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        updateWorkspaceTransform({
          ...startTransform,
          x: startTransform.x + deltaX,
            y: startTransform.y + deltaY,
            scale: startTransform.scale
          });
        });
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        panningRef.current = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Handle zoom with mouse wheel (linear additive steps for precision)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Linear zoom steps for consistent behavior and precision
    const zoomStep = 0.1; // Fixed 0.1 scale units per scroll
    const scaleChange = e.deltaY > 0 ? -zoomStep : zoomStep;
    const newScale = Math.max(0.2, Math.min(3, workspaceTransform.scale + scaleChange));
    
    // Only apply zoom if scale actually changed (prevents precision issues at limits)
    if (Math.abs(newScale - workspaceTransform.scale) > 0.001) {
      // Zoom towards mouse position for better UX
      const scaleRatio = newScale / workspaceTransform.scale;
      const newX = mouseX - (mouseX - workspaceTransform.x) * scaleRatio;
      const newY = mouseY - (mouseY - workspaceTransform.y) * scaleRatio;
    
    updateWorkspaceTransform({
      x: newX,
      y: newY,
      scale: newScale
    });
    }
  };

  // Reset workspace view
  const resetWorkspaceView = () => {
    updateWorkspaceTransform({ x: 0, y: 0, scale: 1 });
  };

  // Calculate infinite dots pattern positioning
  const getInfiniteDotsStyle = () => {
    const { x, y, scale } = workspaceTransform;
    
    const baseGridSize = GRID_SIZE;
    const scaledGridSize = baseGridSize * scale;
    
    const offsetX = ((x % scaledGridSize) + scaledGridSize) % scaledGridSize;
    const offsetY = ((y % scaledGridSize) + scaledGridSize) % scaledGridSize;
    
    return {
      backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  };



  // Generate SVG path for bezier curve (precise and smooth)
  const generateBezierPath = (x1: number, y1: number, x2: number, y2: number, connectionType?: 'horizontal' | 'vertical') => {
    // Consistent control offset that scales well at all zoom levels
    const baseOffset = 80; // Fixed base offset in workspace units
    
    let cp1x, cp1y, cp2x, cp2y;
    
    if (connectionType === 'vertical') {
      // Vertical connections (bottom→top): use vertical control points
      const dy = y2 - y1;
      const distance = Math.abs(dy);
      const controlOffset = Math.max(baseOffset, distance * 0.4);
      
      cp1x = x1;
      cp1y = y1 + controlOffset;
      cp2x = x2;
      cp2y = y2 - controlOffset;
    } else {
      // Horizontal connections (right→left) or default: use horizontal control points
      const dx = x2 - x1;
      const distance = Math.abs(dx);
      const controlOffset = Math.max(baseOffset, distance * 0.4);
      
      cp1x = x1 + controlOffset;
      cp1y = y1;
      cp2x = x2 - controlOffset;
      cp2y = y2;
    }
    
    // Use precise coordinates (no rounding for smooth curves)
    return `M${x1.toFixed(1)},${y1.toFixed(1)} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };

  // Handle connection wait time editing
  const handleConnectionDoubleClick = (connectionId: string) => {
    const connection = workspaceSpecificConnections.find(c => c.id === connectionId);
    if (!connection) return;
    
    const newWaitTime = prompt(`Enter wait time in frames (0 = immediate, >0 = wait):`, connection.waitFrames.toString());
    if (newWaitTime !== null) {
      const waitFrames = Math.max(0, parseInt(newWaitTime) || 0);
      updateConnectionWaitTime(connectionId, waitFrames);
    }
  };

  return (
    <div 
      ref={workspaceRef}
      className={`flex-1 bg-white overflow-hidden relative min-h-96 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleWorkspaceMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleWorkspaceMouseUp}
      onWheel={handleWheel}
    >
      {/* Workspace controls */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
        <div className="bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs flex items-center gap-2">
          <span className="text-yellow-300">
            {isStage ? '🎭 Stage' : `🎮 ${spriteId}`}
          </span>
          <span className="text-gray-300">•</span>
          <span>{Math.round(workspaceTransform.scale * 100)}%</span>
        </div>
        <button
          onClick={forceRefreshConnections}
          className="bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded text-xs"
          title="Refresh connections"
        >
          🔗
        </button>
        <button
          onClick={resetWorkspaceView}
          className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-xs"
          title="Reset view"
        >
          🔄
        </button>
      </div>

      {/* Placeholder overlay - only shown when no blocks exist */}
      {workspaceSpecificBlocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🔗</div>
            <p className="font-medium">Drag blocks here to create a flowchart</p>
            <p className="text-xs mt-1">
              {isStage ? 'Stage workspace - affects background and global elements' : `Sprite ${spriteId} workspace - affects this sprite only`}
            </p>
            <p className="text-xs mt-2 text-gray-500">
                💡 Drag from blue ○ to green ○ to connect • Double-click for wait times • Smooth infinite workspace with precision scaling
            </p>
          </div>
        </div>
      )}

      {/* Infinite dots background layer */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={getInfiniteDotsStyle()}
      />

      {/* SVG layer for connections - workspace coordinate system */}
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible'
        }}
      >
        <g
          transform={`translate(${workspaceTransform.x.toFixed(2)}, ${workspaceTransform.y.toFixed(2)}) scale(${workspaceTransform.scale.toFixed(4)})`}
          style={{
            transition: (isPanning || isConnecting) ? 'none' : 'transform 0.1s ease-out'
          }}
        >
                {/* Connection handles and curves - use frozen data during transitions */}
         {(() => {
           // Use frozen data during transitions, live data otherwise
           let connectionData, handleData;
           
           if (isTransitioning && frozenConnectionData) {
             // During transitions, use frozen pre-calculated positions
             connectionData = frozenConnectionData.connections;
             handleData = frozenConnectionData.handles;
           } else {
             // Normal rendering - calculate positions live
             connectionData = workspaceSpecificConnections.map(connection => {
               const startPos = getOutputPosition(connection.sourceBlockId, connection.sourceHandle);
               const endPos = getInputPosition(connection.targetBlockId, connection.targetHandle);
               return { connection, startPos, endPos };
             });

             handleData = workspaceSpecificBlocks.map(block => {
               const hasOutput = block.type === 'event' || block.type === 'action' || block.type === 'control';
               const hasInput = block.type === 'action' || block.type === 'control';
               
               // All blocks get all 4 handles
               const leftPos = hasInput ? getInputPosition(block.instanceId, 'input') : null;
               const topPos = hasInput ? getInputPosition(block.instanceId, 'top') : null;
               const rightPos = hasOutput ? getOutputPosition(block.instanceId, 'output') : null;
               const bottomPos = hasOutput ? getOutputPosition(block.instanceId, 'bottom') : null;
               
               return { block, hasInput, hasOutput, leftPos, topPos, rightPos, bottomPos };
             });
           }

           return (
             <>
               {/* Render connections */}
               {connectionData.map(({ connection, startPos, endPos }) => {
                 // Skip rendering if positions are invalid
                 if (!startPos.x && !startPos.y && !endPos.x && !endPos.y) return null;
                 
                 const pathData = generateBezierPath(startPos.x, startPos.y, endPos.x, endPos.y, connection.connectionType);
                 const strokeColor = connection.waitFrames === 0 ? "#3b82f6" : "#f59e0b";
                 const strokeWidth = 2;
                 
                 return (
                   <g key={connection.id}>
                     {/* Connection line */}
                     <path
                       d={pathData}
                       stroke={strokeColor}
                       strokeWidth={strokeWidth}
                       fill="none"
                       className="pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
                       onDoubleClick={() => handleConnectionDoubleClick(connection.id)}
                       onClick={() => setSelectedConnection(connection.id)}
                     />
                     
                     {/* Wait time label */}
                     {connection.waitFrames > 0 && (
                       <text
                         x={(startPos.x + endPos.x) / 2}
                         y={(startPos.y + endPos.y) / 2 - 15}
                         textAnchor="middle"
                         className="fill-amber-600 font-bold select-none"
                         style={{ 
                           pointerEvents: 'none',
                           fontSize: '14px'
                         }}
                       >
                         {connection.waitFrames}f
                       </text>
                     )}
                     
                     {/* Arrow head */}
                     <polygon
                       points={(() => {
                         // Generate arrow points based on connection direction
                         if (connection.connectionType === 'vertical') {
                           // Vertical arrow pointing down (for bottom→top flow, arrow points at target)
                           return `${endPos.x-5},${endPos.y-10} ${endPos.x},${endPos.y} ${endPos.x+5},${endPos.y-10}`;
                         } else {
                           // Horizontal arrow pointing left (for right→left flow, arrow points at target)  
                           return `${endPos.x-10},${endPos.y-5} ${endPos.x},${endPos.y} ${endPos.x-10},${endPos.y+5}`;
                         }
                       })()}
                       fill={strokeColor}
                     />
                   </g>
                 );
               })}

               {/* Render handles using appropriate scale */}
               {handleData.map(({ block, hasInput, hasOutput, leftPos, topPos, rightPos, bottomPos }) => {
                 // Use frozen scale during transitions, current scale otherwise
                 const effectiveScale = (isTransitioning && frozenConnectionData) 
                   ? frozenConnectionData.scale 
                   : workspaceTransform.scale;
                 const handleRadius = Math.max(4, 6 / effectiveScale);
                 const labelFontSize = Math.max(8, 10 / effectiveScale);
                 
                 // Check if block has labeled connections
                 if (block.labeledConnections) {
                   // Render labeled connection handles
                   return (
                     <g key={`handles-${block.instanceId}`}>
                                               {/* Labeled input handles */}
                        {block.labeledConnections.inputs?.map((input: {label: string, side: 'left' | 'right', type: 'boolean' | 'number' | 'flow'}, index: number) => {
                          const handleId = `input-${index}`;
                          const pos = getInputPosition(block.instanceId, handleId);
                          
                          // Color based on type
                          const handleColor = input.type === 'flow' ? "#9333ea" : 
                                            input.type === 'boolean' ? "#ef4444" : "#10b981";
                          
                          return (
                            <g key={`input-${index}`}>
                              <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={handleRadius}
                                fill={handleColor}
                                stroke="white"
                                strokeWidth={Math.max(0.5, 1.5 / effectiveScale)}
                                className="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                                style={{ pointerEvents: 'auto' }}
                                onMouseUp={(e) => handleInputMouseUp(block.instanceId, handleId as any, e as any)}
                              />
                              {/* Input label - position based on side */}
                              <text
                                x={input.side === 'right' ? pos.x + handleRadius + 5 : pos.x - handleRadius - 5}
                                y={pos.y + 2}
                                textAnchor={input.side === 'right' ? "start" : "end"}
                                fill={handleColor}
                                fontSize={labelFontSize}
                                fontWeight="bold"
                                className="select-none pointer-events-none"
                              >
                                {input.label}
                              </text>
                            </g>
                          );
                        })}
                        
                        {/* Labeled output handles */}
                        {block.labeledConnections.outputs?.map((output: {label: string, side: 'left' | 'right', type: 'boolean' | 'number' | 'flow'}, index: number) => {
                          const handleId = `output-${index}`;
                          const pos = getOutputPosition(block.instanceId, handleId);
                          
                          // Color based on type
                          const handleColor = output.type === 'flow' ? "#9333ea" : 
                                            output.type === 'boolean' ? "#ef4444" : "#3b82f6";
                          
                          return (
                            <g key={`output-${index}`}>
                              <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={handleRadius}
                                fill={handleColor}
                                stroke="white"
                                strokeWidth={Math.max(0.5, 1.5 / effectiveScale)}
                                className="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                                style={{ pointerEvents: 'auto' }}
                                onMouseDown={(e) => handleOutputMouseDown(block.instanceId, handleId as any, e as any)}
                              />
                              {/* Output label - position based on side */}
                              <text
                                x={output.side === 'left' ? pos.x - handleRadius - 5 : pos.x + handleRadius + 5}
                                y={pos.y + 2}
                                textAnchor={output.side === 'left' ? "end" : "start"}
                                fill={handleColor}
                                fontSize={labelFontSize}
                                fontWeight="bold"
                                className="select-none pointer-events-none"
                              >
                                {output.label}
                              </text>
                            </g>
                          );
                        })}
                       
                       {/* Always add top and bottom for vertical flow */}
                       {topPos && (
                         <circle
                           cx={topPos.x}
                           cy={topPos.y}
                           r={handleRadius * 0.8}
                           fill="#9333ea"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-purple-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseUp={(e) => handleInputMouseUp(block.instanceId, 'top', e as any)}
                         >
                           <title>Control Flow Input</title>
                         </circle>
                       )}
                       {bottomPos && (
                         <circle
                           cx={bottomPos.x}
                           cy={bottomPos.y}
                           r={handleRadius * 0.8}
                           fill="#9333ea"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-purple-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseDown={(e) => handleOutputMouseDown(block.instanceId, 'bottom', e as any)}
                         >
                           <title>Control Flow Output</title>
                         </circle>
                       )}
                     </g>
                   );
                 } else {
                   // Fallback to traditional 4-point handles for blocks without labeled connections
                   return (
                     <g key={`handles-${block.instanceId}`}>
                       {/* Left input handle */}
                       {hasInput && leftPos && (
                         <circle
                           cx={leftPos.x}
                           cy={leftPos.y}
                           r={handleRadius}
                           fill="#10b981"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-emerald-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseUp={(e) => handleInputMouseUp(block.instanceId, 'input', e as any)}
                         >
                           <title>Left Input • Right connects here</title>
                         </circle>
                       )}
                       
                       {/* Top input handle */}
                       {hasInput && topPos && (
                         <circle
                           cx={topPos.x}
                           cy={topPos.y}
                           r={handleRadius}
                           fill="#10b981"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-emerald-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseUp={(e) => handleInputMouseUp(block.instanceId, 'top', e as any)}
                         >
                           <title>Top Input • Bottom connects here</title>
                         </circle>
                       )}
                       
                       {/* Right output handle */}
                       {hasOutput && rightPos && (
                         <circle
                           cx={rightPos.x}
                           cy={rightPos.y}
                           r={handleRadius}
                           fill="#3b82f6"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-blue-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseDown={(e) => handleOutputMouseDown(block.instanceId, 'output', e as any)}
                         >
                           <title>Right Output • Drag to left input</title>
                         </circle>
                       )}
                       
                       {/* Bottom output handle */}
                       {hasOutput && bottomPos && (
                         <circle
                           cx={bottomPos.x}
                           cy={bottomPos.y}
                           r={handleRadius}
                           fill="#3b82f6"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:fill-blue-600 transition-colors duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseDown={(e) => handleOutputMouseDown(block.instanceId, 'bottom', e as any)}
                         >
                           <title>Bottom Output • Drag to top input</title>
                         </circle>
                       )}
                     </g>
                   );
                 }
               })}
             </>
           );
         })()}
        
         {/* Temporary connection while dragging */}
         {tempConnection && connectionStart && (
           <path
             d={generateBezierPath(
               tempConnection.x1, 
               tempConnection.y1, 
               tempConnection.x2, 
               tempConnection.y2, 
               connectionStart.handle === 'bottom' ? 'vertical' : 'horizontal'
             )}
             stroke="#6b7280"
             strokeWidth="2"
             strokeDasharray="6,4"
             fill="none"
             opacity="0.7"
           />
         )}
        </g>
       </svg>

      {/* Workspace content with smooth transform */}
      <div 
        className="workspace-background min-h-full relative"
        style={{
          transform: `translate(${workspaceTransform.x.toFixed(2)}px, ${workspaceTransform.y.toFixed(2)}px) scale(${workspaceTransform.scale.toFixed(4)})`,
          transformOrigin: '0 0',
          width: '200%',
          height: '200%',
          transition: (isPanning || isConnecting) ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <div className="relative z-10">
          {workspaceSpecificBlocks.map((block) => {
            const outgoingConnections = getConnectionsFromBlock(block.instanceId);
            const hasOutput = block.type === 'event' || block.type === 'action' || block.type === 'control';
            const hasInput = block.type === 'action' || block.type === 'control';
            
            return (
              <div
                key={block.instanceId}
                className="absolute"
                style={{
                  left: block.position?.x || 0,
                  top: block.position?.y || 0,
                }}
                data-block-id={block.instanceId}
              >
                                 {/* Connection handles are now rendered in SVG layer for perfect sync */}
                
                {/* Block component */}
                      <div 
                  className="cursor-move hover:shadow-lg transition-shadow"
                  onMouseDown={(e) => handleBlockMouseDown(block.instanceId, e)}
                >
                  <Block
                    block={block}
                    isDraggable={false}
                    isInWorkspace={true}
                    onDelete={() => removeBlockFromWorkspace(block.instanceId)}
                    nestingLevel={0} // No nesting in flowchart mode
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Connection info panel */}
      {selectedConnection && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-50 border">
          <div className="text-sm">
            <div className="font-semibold text-gray-700 mb-1">Connection Settings</div>
            <div className="text-xs text-gray-500 mb-2">
              Wait Time: {workspaceSpecificConnections.find(c => c.id === selectedConnection)?.waitFrames || 0} frames
              {(workspaceSpecificConnections.find(c => c.id === selectedConnection)?.waitFrames || 0) === 0 ? 
                ' (Immediate)' : ' (Wait)'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConnectionDoubleClick(selectedConnection)}
                className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
              >
                Edit Wait Time
              </button>
              <button
                onClick={() => {
                  removeConnection(selectedConnection);
                  setSelectedConnection(null);
                }}
                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedConnection(null)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};