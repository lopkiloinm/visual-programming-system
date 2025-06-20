import React, { useState, useRef, useEffect } from 'react';
import { useBlockContext } from '../contexts/BlockContext';
import { Block } from './Block';
import { FlowConnection } from '../types/blocks';
import { blockCategories } from '../utils/blockDefinitions';

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

  // Filter data connections (connections with targetInputName) for this workspace
  const workspaceSpecificDataConnections = connections.filter(conn => {
    const sourceBlock = workspaceBlocks.find(b => b.instanceId === conn.sourceBlockId);
    if (!sourceBlock || !conn.targetInputName) return false;
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
          if (output.side === 'bottom') {
            // Position flow control outputs on the bottom, side by side
            const bottomOutputs = block.labeledConnections.outputs.filter(out => out.side === 'bottom');
            const bottomIndex = bottomOutputs.findIndex(out => out === output);
            const totalBottomOutputs = bottomOutputs.length;
            
            // For if blocks with then/else, position them side by side at bottom
            let xOffset;
            if (block.id === 'if_condition' && totalBottomOutputs === 2) {
              xOffset = bottomIndex === 0 ? width * 0.33 : width * 0.67; // then at 33%, else at 67%
            } else {
              xOffset = width * (bottomIndex + 1) / (totalBottomOutputs + 1);
            }
            
            return {
              x: block.position.x + xOffset,
              y: block.position.y + height // Bottom edge
            };
          } else {
            // Position other outputs on the right side, evenly spaced
            const rightOutputs = block.labeledConnections.outputs.filter(out => out.side === 'right');
            const rightIndex = rightOutputs.findIndex(out => out === output);
            const totalRightOutputs = rightOutputs.length;
            
            const yOffset = height * (rightIndex + 1) / (totalRightOutputs + 1);
            
            return {
              x: block.position.x + width, // Right edge
              y: block.position.y + yOffset
            };
          }
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
    if (handle !== 'input' && handle !== 'top') {
      // Handle format is like "input-0", "input-1", etc.
      const handleMatch = handle.match(/^input-(\d+)$/);
      if (handleMatch) {
        // Get all blocks from categories to find labeledConnections
        const allBlocks = blockCategories.flatMap(category => category.blocks);
        const blockDefinition = allBlocks.find((b: any) => b.id === block.id);
        
        if (blockDefinition?.labeledConnections?.inputs) {
          const inputIndex = parseInt(handleMatch[1], 10);
          const input = blockDefinition.labeledConnections.inputs[inputIndex];
          
          if (input) {
            // Handle different sides for labeled inputs
            if (input.side === 'left') {
              // Standard left-side positioning for all inputs
              const leftInputs = blockDefinition.labeledConnections.inputs.filter((inp: any) => inp.side === 'left');
              const leftIndex = leftInputs.findIndex((inp: any) => inp === input);
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
            } else if (input.side === 'right') {
              // Right-side inputs
              const rightInputs = blockDefinition.labeledConnections.inputs.filter((inp: any) => inp.side === 'right');
              const rightIndex = rightInputs.findIndex((inp: any) => inp === input);
              const totalRightInputs = rightInputs.length;
              
              const yPosition = block.position.y + (height * (rightIndex + 1) / (totalRightInputs + 1));
              return {
                x: block.position.x + width, // Right edge
                y: yPosition
              };
            } else if (input.side === 'top') {
              // Top-side inputs
              const topInputs = blockDefinition.labeledConnections.inputs.filter((inp: any) => inp.side === 'top');
              const topIndex = topInputs.findIndex((inp: any) => inp === input);
              const totalTopInputs = topInputs.length;
              
              const xPosition = block.position.x + (width * (topIndex + 1) / (totalTopInputs + 1));
              return {
                x: xPosition,
                y: block.position.y // Top edge
              };
            } else if (input.side === 'bottom') {
              // Bottom-side inputs
              const bottomInputs = blockDefinition.labeledConnections.inputs.filter((inp: any) => inp.side === 'bottom');
              const bottomIndex = bottomInputs.findIndex((inp: any) => inp === input);
              const totalBottomInputs = bottomInputs.length;
              
              const xPosition = block.position.x + (width * (bottomIndex + 1) / (totalBottomInputs + 1));
              return {
                x: xPosition,
                y: block.position.y + height // Bottom edge
              };
            }
          }
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
      
      // Force immediate automatic endpoint calculation on drop
      setTimeout(() => {
        forceRefreshConnections();
      }, 0);
      
      // Additional forced measurements with different timing strategies for robustness
      setTimeout(() => forceRefreshConnections(), 1);
      setTimeout(() => forceRefreshConnections(), 5);
      setTimeout(() => forceRefreshConnections(), 16);
      
      // Request animation frame for post-paint measurement
      requestAnimationFrame(() => {
        forceRefreshConnections();
        setTimeout(() => forceRefreshConnections(), 0);
      });
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
    
    console.log(`Starting connection from ${blockId} handle ${handle}`);
    setIsConnecting(true);
    setConnectionStart({ blockId, handle });
    
    // Make connection state globally available for orange input dots
    if (typeof window !== 'undefined') {
      (window as any).isConnecting = true;
      console.log(`Set global isConnecting = true`);
    }
    
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

  const handleInputMouseUp = (targetBlockId: string, handle: 'input' | 'top' | string, e: React.MouseEvent) => {
    if (isConnecting && connectionStart) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log(`handleInputMouseUp called: source=${connectionStart.blockId}:${connectionStart.handle} → target=${targetBlockId}:${handle}`);
      
      // STRICT RULES - NO AMBIGUITY:
      // 1. bottom → top ONLY (vertical flow connections)
      // 2. right → left ONLY (horizontal data connections)
      
      const sourceHandle = connectionStart.handle;
      const targetHandle = handle;
      
      // VERTICAL CONNECTIONS: bottom → top (flow control)
      const isVerticalFlow = sourceHandle === 'bottom' && targetHandle === 'top';
      
      // HORIZONTAL CONNECTIONS: right → left (data passing)  
      const isHorizontalData = sourceHandle === 'output' && targetHandle === 'input';
      
      // LABELED CONNECTIONS: Check if both source and target are labeled handles
      const isLabeledConnection = sourceHandle.startsWith('output-') && targetHandle.startsWith('input-');
      
      // For labeled connections, check the actual connection types
      let isValidLabeledConnection = false;
      if (isLabeledConnection) {
        // Get source and target block definitions to check connection types
        const allBlocks = blockCategories.flatMap(category => category.blocks);
        const sourceBlockInstance = workspaceSpecificBlocks.find(b => b.instanceId === connectionStart.blockId);
        const targetBlockInstance = workspaceSpecificBlocks.find(b => b.instanceId === targetBlockId);
        
        if (sourceBlockInstance && targetBlockInstance) {
          const sourceBlockDef = allBlocks.find((b: any) => b.id === sourceBlockInstance.id);
          const targetBlockDef = allBlocks.find((b: any) => b.id === targetBlockInstance.id);
          
          if (sourceBlockDef?.labeledConnections?.outputs && targetBlockDef?.labeledConnections?.inputs) {
            const outputIndex = parseInt(sourceHandle.replace('output-', ''), 10);
            const inputIndex = parseInt(targetHandle.replace('input-', ''), 10);
            
            const sourceOutput = sourceBlockDef.labeledConnections.outputs[outputIndex];
            const targetInput = targetBlockDef.labeledConnections.inputs[inputIndex];
            
            if (sourceOutput && targetInput) {
              // Check type compatibility
              const isTypeMatch = sourceOutput.type === targetInput.type || 
                                  sourceOutput.type === 'any' || targetInput.type === 'any';
              
              // Check directional compatibility (flow vs data)
              const isFlowConnection = sourceOutput.type === 'flow' && targetInput.type === 'flow';
              const isDataConnection = sourceOutput.type !== 'flow' && targetInput.type !== 'flow';
              
              isValidLabeledConnection = isTypeMatch && (isFlowConnection || isDataConnection);
              
              console.log(`🔍 Labeled connection: ${sourceOutput.type} → ${targetInput.type}, valid: ${isValidLabeledConnection}`);
            }
          }
        }
      }
      
      // DATA CONNECTIONS TO ORANGE DOTS: validate by input type (number/string/boolean)
      const getTargetInputType = (blockId: string, inputName: string): string | null => {
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
        if (!block?.inputs) return null;
        const input = block.inputs.find(inp => inp.name === inputName);
        return input?.type || null;
      };

      // Get source output type for validation
      const getSourceOutputType = (blockId: string, outputHandle: string): string | null => {
        const blockInstance = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
        if (!blockInstance) {
          console.log(`❌ Block instance not found: ${blockId}`);
          return null;
        }
        
        // Get all blocks from categories
        const allBlocks = blockCategories.flatMap(category => category.blocks);
        
        // Get the original block definition which has the labeledConnections
        const blockDefinition = allBlocks.find((b: any) => b.id === blockInstance.id);
        console.log(`🔍 Looking for block ${blockInstance.id}, found:`, blockDefinition ? 'YES' : 'NO');
        console.log(`🔍 Output handle: "${outputHandle}"`);
        console.log(`🔍 Block has labeledConnections?`, !!blockDefinition?.labeledConnections);
        console.log(`🔍 Block outputs:`, blockDefinition?.labeledConnections?.outputs);
        
        if (!blockDefinition?.labeledConnections?.outputs) {
          console.log(`❌ No output definitions found for block ${blockInstance.id}`);
          return null;
        }
        
        if (outputHandle === 'output') {
          // For basic 'output' handle, find the first non-flow output
          const output = blockDefinition.labeledConnections.outputs.find((out: any) => out.type !== 'flow');
          console.log(`✅ Found output type for ${blockInstance.id}.output: ${output?.type}`);
          return output?.type || null;
        } else if (outputHandle.startsWith('output-')) {
          // For labeled outputs like 'output-0', find by index
          const outputIndexStr = outputHandle.replace('output-', '');
          const outputIndex = parseInt(outputIndexStr, 10);
          console.log(`🔍 Looking for output at index: ${outputIndex}`);
          const output = blockDefinition.labeledConnections.outputs[outputIndex];
          console.log(`✅ Found output type for ${blockInstance.id}.${outputHandle}: ${output?.type}`);
          return output?.type || null;
        }
        
        console.log(`❌ No matching output found for ${blockInstance.id}.${outputHandle}`);
        console.log(`📋 Available outputs:`, blockDefinition.labeledConnections.outputs.map((out: any) => out.label));
        return null;
      };

      // Check type compatibility
      const isTypeCompatible = (sourceType: string | null, targetType: string | null): boolean => {
        if (!sourceType || !targetType) return false;
        
        // 'any' type is compatible with everything
        if (sourceType === 'any' || targetType === 'any') return true;
        
        // Exact type match
        if (sourceType === targetType) return true;
        
        // No other compatibility rules for now
        return false;
      };
      
      const targetInputType = getTargetInputType(targetBlockId, targetHandle);
      const sourceOutputType = getSourceOutputType(connectionStart.blockId, sourceHandle);
      
      const isDataToOrangeDot = (sourceHandle === 'output' || sourceHandle.startsWith('output-')) && 
                                targetInputType && 
                                ['number', 'text', 'boolean'].includes(targetInputType);
      
      if (isDataToOrangeDot) {
        // Validate type compatibility for data connections
        if (!isTypeCompatible(sourceOutputType, targetInputType)) {
          console.warn(`❌ TYPE MISMATCH: Cannot connect ${sourceOutputType} output to ${targetInputType} input`);
          setIsConnecting(false);
          setConnectionStart(null);
          setTempConnection(null);
          return;
        }
        console.log(`✅ Valid data connection: ${sourceHandle} (${sourceOutputType}) → ${targetHandle} (${targetInputType})`);
      }
      
      const isValidVertical = isVerticalFlow;
      const isValidHorizontal = isHorizontalData || isDataToOrangeDot;
      const isValidLabeled = isValidLabeledConnection;
      
      // Check for mixed labeled/traditional flow connections
      let isMixedFlowConnection = false;
      
      // Case 1: Labeled flow output → traditional flow input (e.g., output-0 → top)
      if (sourceHandle.startsWith('output-') && targetHandle === 'top') {
        const allBlocks = blockCategories.flatMap(category => category.blocks);
        const sourceBlockInstance = workspaceSpecificBlocks.find(b => b.instanceId === connectionStart.blockId);
        if (sourceBlockInstance) {
          const sourceBlockDef = allBlocks.find((b: any) => b.id === sourceBlockInstance.id);
          if (sourceBlockDef?.labeledConnections?.outputs) {
            const outputIndex = parseInt(sourceHandle.replace('output-', ''), 10);
            const sourceOutput = sourceBlockDef.labeledConnections.outputs[outputIndex];
            if (sourceOutput?.type === 'flow') {
              isMixedFlowConnection = true;
              console.log(`✅ Mixed flow connection: labeled output (${sourceOutput.label}) → traditional top input`);
            }
          }
        }
      }
      
      // Case 2: Traditional flow output → labeled flow input (e.g., bottom → input-0)
      if (sourceHandle === 'bottom' && targetHandle.startsWith('input-')) {
        const allBlocks = blockCategories.flatMap(category => category.blocks);
        const targetBlockInstance = workspaceSpecificBlocks.find(b => b.instanceId === targetBlockId);
        if (targetBlockInstance) {
          const targetBlockDef = allBlocks.find((b: any) => b.id === targetBlockInstance.id);
          if (targetBlockDef?.labeledConnections?.inputs) {
            const inputIndex = parseInt(targetHandle.replace('input-', ''), 10);
            const targetInput = targetBlockDef.labeledConnections.inputs[inputIndex];
            if (targetInput?.type === 'flow') {
              isMixedFlowConnection = true;
              console.log(`✅ Mixed flow connection: traditional bottom output → labeled input (${targetInput.label})`);
            }
          }
        }
      }
      
      if (!isValidVertical && !isValidHorizontal && !isValidLabeled && !isMixedFlowConnection) {
        console.warn(`❌ INVALID CONNECTION: ${sourceHandle} → ${targetHandle}`);
        console.warn(`  Vertical: ${isValidVertical}, Horizontal: ${isValidHorizontal}, Labeled: ${isValidLabeled}, Mixed: ${isMixedFlowConnection}`);
        setIsConnecting(false);
        setConnectionStart(null);
        setTempConnection(null);
        return;
      }
      
      // Determine connection type - STRICT
      const connectionType = (isValidVertical || isMixedFlowConnection) ? 'vertical' : 'horizontal';
      
      // Create new connection
      const newConnection: FlowConnection = {
        id: `conn_${Date.now()}`,
        sourceBlockId: connectionStart.blockId,
        targetBlockId: targetBlockId,
        waitFrames: 0, // Default to immediate execution
        sourceHandle: sourceHandle,
        targetHandle: isDataToOrangeDot ? 'input' : targetHandle, // Use 'input' as target handle for orange dots
        connectionType: connectionType,
        // Add targetInputName for data connections to orange dots only
        ...(isDataToOrangeDot ? { targetInputName: handle } : {})
      };
      
      console.log(`Creating connection:`, newConnection);
      
      addConnection(newConnection);
    }
    
    // Reset connection state
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnection(null);
    
    // Clear global connection state
    if (typeof window !== 'undefined') {
      (window as any).isConnecting = false;
      console.log(`Connection completed - cleared global isConnecting = false`);
    }
  };

  const handleWorkspaceMouseUp = () => {
    if (isConnecting) {
      console.log(`Canceling connection - dropped on empty space`);
      // Cancel connection if not dropped on a valid target
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
      
      // Clear global connection state
      if (typeof window !== 'undefined') {
        (window as any).isConnecting = false;
        console.log(`Cleared global isConnecting = false`);
      }
    }
  };

  // Add event listener for orange input dot connections
  useEffect(() => {
    const handleInputConnectionTarget = (e: CustomEvent) => {
      console.log(`Received inputConnectionTarget event:`, e.detail);
      if (isConnecting && connectionStart) {
        console.log(`Processing connection from ${connectionStart.blockId} to ${e.detail.blockId}.${e.detail.inputName}`);
        const { blockId, inputName, originalEvent } = e.detail;
        
        // Handle this as an input connection with the specific input name
        handleInputMouseUp(blockId, inputName, originalEvent);
      } else {
        console.log(`Ignoring event: isConnecting=${isConnecting}, connectionStart=`, connectionStart);
      }
    };

    // Listen for custom events from orange input dots
    document.addEventListener('inputConnectionTarget', handleInputConnectionTarget as EventListener);
    console.log(`Added inputConnectionTarget event listener`);
    
    return () => {
      document.removeEventListener('inputConnectionTarget', handleInputConnectionTarget as EventListener);
      console.log(`Removed inputConnectionTarget event listener`);
    };
  }, [isConnecting, connectionStart]);

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

  // Calculate precise orange dot position using DOM measurements
  const getOrangeDotPosition = (blockId: string, inputName: string) => {
    // Find the orange dot element in the DOM
    const dotSelector = `[data-orange-dot="${blockId}-${inputName}"]`;
    const dotElement = document.querySelector(dotSelector) as HTMLElement;
    
    if (!dotElement) {
      console.warn(`Orange dot not found: ${dotSelector}`);
      return { x: 0, y: 0 };
    }

    // Get workspace container to calculate relative position
    const workspaceContainer = workspaceRef.current;
    if (!workspaceContainer) {
      console.warn('Workspace container not found');
      return { x: 0, y: 0 };
    }

    // Get bounding rects
    const dotRect = dotElement.getBoundingClientRect();
    const workspaceRect = workspaceContainer.getBoundingClientRect();
    
    // Calculate center of orange dot in viewport coordinates
    const dotCenterViewportX = dotRect.left + dotRect.width / 2;
    const dotCenterViewportY = dotRect.top + dotRect.height / 2;
    
    // Convert to workspace coordinates (accounting for pan and zoom)
    const dotCenterWorkspaceX = (dotCenterViewportX - workspaceRect.left - workspaceTransform.x) / workspaceTransform.scale;
    const dotCenterWorkspaceY = (dotCenterViewportY - workspaceRect.top - workspaceTransform.y) / workspaceTransform.scale;
    
    console.log(`DOM-measured orange dot position for ${blockId}.${inputName}: (${dotCenterWorkspaceX.toFixed(1)}, ${dotCenterWorkspaceY.toFixed(1)})`);
    
    return {
      x: dotCenterWorkspaceX,
      y: dotCenterWorkspaceY
    };
  };

  // Generate SVG path for straight line (clean and doesn't obscure text)
  const generateStraightPath = (x1: number, y1: number, x2: number, y2: number) => {
    // Simple straight line from start to end
    return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
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
      className={`flex-1 overflow-hidden relative h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
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
               {/* Render flow connections (exclude data connections with targetInputName) */}
               {connectionData.map(({ connection, startPos, endPos }) => {
                 // Skip data connections - they're rendered separately
                 if (connection.targetInputName) return null;
                 
                 // Skip rendering if positions are invalid
                 if (!startPos.x && !startPos.y && !endPos.x && !endPos.y) return null;
                 
                 const pathData = generateStraightPath(startPos.x, startPos.y, endPos.x, endPos.y);
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
                     
                     {/* Arrow head - calculated based on actual line angle */}
                     <polygon
                       points={(() => {
                         // Calculate the angle of the line
                         const dx = endPos.x - startPos.x;
                         const dy = endPos.y - startPos.y;
                         const angle = Math.atan2(dy, dx);
                         
                         // Arrow size
                         const arrowLength = 10;
                         const arrowWidth = 5;
                         
                         // Calculate arrow points relative to line direction
                         const tipX = endPos.x;
                         const tipY = endPos.y;
                         
                         // Back points of arrow (perpendicular to line direction)
                         const backX = tipX - arrowLength * Math.cos(angle);
                         const backY = tipY - arrowLength * Math.sin(angle);
                         
                         // Wings of arrow (perpendicular to line)
                         const wing1X = backX - arrowWidth * Math.cos(angle + Math.PI/2);
                         const wing1Y = backY - arrowWidth * Math.sin(angle + Math.PI/2);
                         const wing2X = backX - arrowWidth * Math.cos(angle - Math.PI/2);
                         const wing2Y = backY - arrowWidth * Math.sin(angle - Math.PI/2);
                         
                         return `${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`;
                       })()}
                       fill={strokeColor}
                     />
                   </g>
                 );
               })}

               {/* Render data connections (connections with targetInputName) */}
               {connectionData.filter(({ connection }) => connection.targetInputName).map(({ connection: dataConnection }) => {
                 const sourceBlock = workspaceSpecificBlocks.find(b => b.instanceId === dataConnection.sourceBlockId);
                 const targetBlock = workspaceSpecificBlocks.find(b => b.instanceId === dataConnection.targetBlockId);
                 
                 if (!sourceBlock || !targetBlock) return null;
                 
                 // Get source output position  
                 const dataStartPos = getOutputPosition(dataConnection.sourceBlockId, dataConnection.sourceHandle);
                 
                 // Get precise orange dot position for the target input
                 const endPos = getOrangeDotPosition(dataConnection.targetBlockId, dataConnection.targetInputName!);
                 
                 // Skip if invalid positions
                 if (!dataStartPos.x && !dataStartPos.y && !endPos.x && !endPos.y) return null;
                 
                 // Always straight line for data connections (right to left)
                 const pathData = generateStraightPath(dataStartPos.x, dataStartPos.y, endPos.x, endPos.y);
                 
                 return (
                   <g key={dataConnection.id}>
                     {/* Data connection line - orange */}
                     <path
                       d={pathData}
                       stroke="#f97316"
                       strokeWidth={2}
                       fill="none"
                       className="pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
                       onClick={() => removeConnection(dataConnection.id)}
                     />
                     
                     {/* Arrow head - calculated based on actual line angle */}
                     <polygon
                       points={(() => {
                         // Calculate the angle of the data connection line
                         const dx = endPos.x - dataStartPos.x;
                         const dy = endPos.y - dataStartPos.y;
                         const angle = Math.atan2(dy, dx);
                         
                         // Arrow size
                         const arrowLength = 8;
                         const arrowWidth = 4;
                         
                         // Calculate arrow points relative to line direction
                         const tipX = endPos.x;
                         const tipY = endPos.y;
                         
                         // Back points of arrow (perpendicular to line direction)
                         const backX = tipX - arrowLength * Math.cos(angle);
                         const backY = tipY - arrowLength * Math.sin(angle);
                         
                         // Wings of arrow (perpendicular to line)
                         const wing1X = backX - arrowWidth * Math.cos(angle + Math.PI/2);
                         const wing1Y = backY - arrowWidth * Math.sin(angle + Math.PI/2);
                         const wing2X = backX - arrowWidth * Math.cos(angle - Math.PI/2);
                         const wing2Y = backY - arrowWidth * Math.sin(angle - Math.PI/2);
                         
                         return `${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`;
                       })()}
                       fill="#f97316"
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
                        {block.labeledConnections.inputs?.map((input: {label: string, side: 'left' | 'right' | 'top' | 'bottom', type: 'boolean' | 'number' | 'flow'}, index: number) => {
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
                                x={input.side === 'left' ? pos.x - handleRadius - 5 : 
                                   input.side === 'right' ? pos.x + handleRadius + 5 : 
                                   pos.x}
                                y={input.side === 'bottom' ? pos.y + handleRadius + 15 : 
                                   input.side === 'top' ? pos.y - handleRadius - 5 : 
                                   pos.y + 2}
                                textAnchor={input.side === 'left' ? "end" : 
                                           input.side === 'right' ? "start" : 
                                           "middle"}
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
                        {block.labeledConnections.outputs?.map((output: {label: string, side: 'left' | 'right' | 'top' | 'bottom', type: 'boolean' | 'number' | 'flow'}, index: number) => {
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
                                x={output.side === 'left' ? pos.x - handleRadius - 5 : 
                                   output.side === 'right' ? pos.x + handleRadius + 5 : 
                                   pos.x}
                                y={output.side === 'bottom' ? pos.y + handleRadius + 15 : 
                                   output.side === 'top' ? pos.y - handleRadius - 5 : 
                                   pos.y + 2}
                                textAnchor={output.side === 'left' ? "end" : 
                                           output.side === 'right' ? "start" : 
                                           "middle"}
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
                       
                       {/* Always add top and bottom for vertical flow (bottom → top) */}
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
                   // STRICT TRADITIONAL HANDLES - NO AMBIGUITY
                   // ONLY bottom → top for flow control
                   // Data connections use orange dots on Block component
                   return (
                     <g key={`handles-${block.instanceId}`}>
                       {/* Top input handle - ONLY for flow (bottom → top) */}
                       {hasInput && topPos && (
                         <circle
                           cx={topPos.x}
                           cy={topPos.y}
                           r={handleRadius}
                           fill="#9333ea"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseUp={(e) => handleInputMouseUp(block.instanceId, 'top', e as any)}
                         >
                           <title>Flow Input • Bottom connects here</title>
                         </circle>
                       )}
                       
                       {/* Bottom output handle - ONLY for flow (bottom → top) */}
                       {hasOutput && bottomPos && (
                         <circle
                           cx={bottomPos.x}
                           cy={bottomPos.y}
                           r={handleRadius}
                           fill="#9333ea"
                           stroke="white"
                           strokeWidth={Math.max(0.5, 1 / effectiveScale)}
                           className="cursor-pointer hover:opacity-80 transition-opacity duration-150"
                           style={{ pointerEvents: 'auto' }}
                           onMouseDown={(e) => handleOutputMouseDown(block.instanceId, 'bottom', e as any)}
                         >
                           <title>Flow Output • Drag to top input</title>
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
             d={generateStraightPath(
               tempConnection.x1, 
               tempConnection.y1, 
               tempConnection.x2, 
               tempConnection.y2
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
                    zoomLevel={workspaceTransform.scale}
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