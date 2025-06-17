import React from 'react';
import { useBlockContext } from '../contexts/BlockContext';
import { Block } from './Block';

interface BlockWorkspaceProps {
  spriteId?: string;
  isStage?: boolean;
}

const SNAP_DISTANCE = 3;
const GRID_SIZE = 20;
const BASE_BLOCK_HEIGHT = 36; // Base height for blocks without inputs
const INPUT_HEIGHT_ADDITION = 4; // Additional height when block has inputs (40px total)
const BLOCK_GAP = 4; // Gap between connected blocks for visual separation

export const BlockWorkspace: React.FC<BlockWorkspaceProps> = ({ spriteId, isStage = false }) => {
  const { workspaceBlocks, addBlockToWorkspace, removeBlockFromWorkspace, updateBlockPosition } = useBlockContext();
  
  // Create unique workspace key for each sprite/stage
  const workspaceKey = isStage ? 'stage' : `sprite_${spriteId}`;
  
  // Store workspace transforms per sprite/stage
  const [workspaceTransforms, setWorkspaceTransforms] = React.useState<Record<string, {x: number, y: number, scale: number}>>({});
  const [isPanning, setIsPanning] = React.useState(false);
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const panningRef = React.useRef(false);

  // Get current workspace transform (default to origin)
  const workspaceTransform = workspaceTransforms[workspaceKey] || { x: 0, y: 0, scale: 1 };
  
  // Update workspace transform for this specific workspace
  const updateWorkspaceTransform = (newTransform: {x: number, y: number, scale: number}) => {
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

  // Calculate actual height of a block based on its inputs
  const getBlockHeight = (block: any) => {
    const hasInputs = block.inputs && block.inputs.length > 0;
    const height = BASE_BLOCK_HEIGHT + (hasInputs ? INPUT_HEIGHT_ADDITION : 0);
    
    // Debug logging for height calculations
    if (block.label) {
      console.log(`Block "${block.label}" height: ${height}px (hasInputs: ${hasInputs})`);
    }
    
    return height;
  };

  const snapToGrid = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const calculateNestingLevel = (block: any): number => {
    if (!block.position) return 0;
    
    // Only give nesting level if this block is actually connected in a chain
    // Find the topmost block in this connected chain
    let currentBlock = block;
    let chainStart = block;
    
    // Walk up the chain to find the start
    while (currentBlock) {
      const blockAbove = workspaceSpecificBlocks.find(otherBlock => {
        if (!otherBlock.position || !currentBlock.position) return false;
        
        const otherBlockHeight = getBlockHeight(otherBlock);
        const isDirectlyAbove = otherBlock.position.x === currentBlock.position.x && // Must be exactly aligned
                               (otherBlock.position.y + otherBlockHeight + BLOCK_GAP) === currentBlock.position.y; // Must be exactly touching
        
        return isDirectlyAbove;
      });
      
      if (blockAbove) {
        chainStart = blockAbove;
        currentBlock = blockAbove;
      } else {
        break;
      }
    }
    
    // Now check if the chain start is indented (snapped to the right of another block)
    // Only give nesting level if the entire chain is properly indented
    if (chainStart.position) {
      const containerBlock = workspaceSpecificBlocks.find(otherBlock => {
        if (!otherBlock.position || otherBlock.instanceId === chainStart.instanceId) return false;
        
        // Check if chainStart is snapped to the right of this block (indented)
        const isIndented = chainStart.position!.x === (otherBlock.position.x + 15) && // Exactly 15px indent
                          chainStart.position!.y === otherBlock.position.y && // Exact same Y level
                          (otherBlock.type === 'event' || otherBlock.type === 'control');
        
        return isIndented;
      });
      
      if (containerBlock) {
        return 1; // Only one level of nesting for now
      }
    }
    
    return 0; // No nesting if not properly snapped
  };

  const findConnectedBlocks = (blockId: string): string[] => {
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
    if (!block || !block.position) return [blockId];

    const connected = [blockId];
    const blockX = block.position.x;
    const blockY = block.position.y;
    const currentBlockHeight = getBlockHeight(block);

    // Find blocks that are snapped below this one (pixel-perfect detection)
    workspaceSpecificBlocks.forEach(otherBlock => {
      if (otherBlock.instanceId === blockId || !otherBlock.position) return;
      
      const isDirectlyBelow = otherBlock.position.x === blockX && // Must be exactly aligned
                             otherBlock.position.y === (blockY + currentBlockHeight + BLOCK_GAP); // Must be exactly touching
      
      if (isDirectlyBelow) {
        connected.push(...findConnectedBlocks(otherBlock.instanceId));
      }
    });

    return connected;
  };

  const findSnapPosition = (x: number, y: number, currentBlockId: string) => {
    let snappedX = snapToGrid(x);
    let snappedY = snapToGrid(y);

    // Check for snapping to other blocks
    workspaceSpecificBlocks.forEach(block => {
      if (block.instanceId === currentBlockId || !block.position) return;

      const blockX = block.position.x;
      const blockY = block.position.y;
      const blockHeight = getBlockHeight(block);

      // Snap below other blocks with proper gap (more forgiving for vertical chains)
      if (Math.abs(x - blockX) < SNAP_DISTANCE * 2) { // More forgiving horizontal tolerance for vertical chaining
        const snapY = blockY + blockHeight + BLOCK_GAP;
        if (Math.abs(y - snapY) < SNAP_DISTANCE) {
          snappedX = blockX; // Snap to exact X alignment
          snappedY = snapY;
        }
      }

      // Snap to the right of other blocks (for nesting) - still strict
      if (Math.abs(y - blockY) < SNAP_DISTANCE) {
        const snapX = blockX + 15; // Indent distance
        if (Math.abs(x - snapX) < 1) { // Keep nesting strict - must be very close
          snappedX = snapX;
          snappedY = blockY;
        }
      }
    });

    return { x: snappedX, y: snappedY };
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
      
      const snappedPosition = findSnapPosition(x, y, '');
      
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
    const startX = e.clientX;
    const startY = e.clientY;
    const block = workspaceSpecificBlocks.find(b => b.instanceId === instanceId);
    
    if (!block || !block.position) return;
    
    const startBlockX = block.position.x;
    const startBlockY = block.position.y;

    // Find all connected blocks that should move together
    const connectedBlockIds = findConnectedBlocks(instanceId);
    const connectedBlocks = workspaceSpecificBlocks.filter(b => 
      connectedBlockIds.includes(b.instanceId)
    );

    console.log(`🔗 Dragging block "${block.label || block.id}" - Chain includes ${connectedBlocks.length} blocks:`, 
                connectedBlocks.map(b => b.label || b.id));

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newX = Math.max(0, startBlockX + deltaX);
      const newY = Math.max(0, startBlockY + deltaY);
      
      const snappedPosition = findSnapPosition(newX, newY, instanceId);
      const actualDeltaX = snappedPosition.x - startBlockX;
      const actualDeltaY = snappedPosition.y - startBlockY;
      
      // Move all connected blocks together
      connectedBlocks.forEach(connectedBlock => {
        if (connectedBlock.position) {
          const newPos = {
            x: connectedBlock.position.x + actualDeltaX,
            y: connectedBlock.position.y + actualDeltaY
          };
          updateBlockPosition(connectedBlock.instanceId, newPos);
        }
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const isBlockConnected = (blockId: string): boolean => {
    const block = workspaceSpecificBlocks.find(b => b.instanceId === blockId);
    if (!block || !block.position) return false;

    // Check if there's a block directly above this one (pixel-perfect detection)
    const connected = workspaceSpecificBlocks.some(otherBlock => {
      if (otherBlock.instanceId === blockId || !otherBlock.position) return false;
      
      const otherBlockHeight = getBlockHeight(otherBlock);
      const expectedY = otherBlock.position.y + otherBlockHeight + BLOCK_GAP;
      const isDirectlyAbove = otherBlock.position.x === block.position!.x && // Must be exactly aligned
                             expectedY === block.position!.y; // Must be exactly touching
      
      if (isDirectlyAbove) {
        console.log(`🔗 Block "${block.label || block.id}" is connected to "${otherBlock.label || otherBlock.id}"`);
        console.log(`   Positions: above(${otherBlock.position.x}, ${otherBlock.position.y}) below(${block.position!.x}, ${block.position!.y})`);
        console.log(`   Expected Y: ${expectedY}, Actual Y: ${block.position!.y}`);
      }
      
      return isDirectlyAbove;
    });
    
    return connected;
  };

  // Handle workspace panning
  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on empty space (not on blocks)
    const target = e.target as HTMLElement;
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

      const handleMouseMove = (e: MouseEvent) => {
        if (!panningRef.current) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        updateWorkspaceTransform({
          ...startTransform,
          x: startTransform.x + deltaX,
          y: startTransform.y + deltaY
        });
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        panningRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Handle zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, workspaceTransform.scale * scaleFactor));
    
    // Keep zoom centered
    const scaleChange = newScale / workspaceTransform.scale;
    const newX = centerX - (centerX - workspaceTransform.x) * scaleChange;
    const newY = centerY - (centerY - workspaceTransform.y) * scaleChange;
    
    updateWorkspaceTransform({
      x: newX,
      y: newY,
      scale: newScale
    });
  };

  // Reset workspace view
  const resetWorkspaceView = () => {
    updateWorkspaceTransform({ x: 0, y: 0, scale: 1 });
  };

  // Calculate infinite dots pattern positioning
  const getInfiniteDotsStyle = () => {
    const { x, y, scale } = workspaceTransform;
    
    // For infinite dots, we want the pattern to appear fixed relative to the logical grid
    // Calculate the background position to simulate infinite tiling
    const baseGridSize = GRID_SIZE;
    const scaledGridSize = baseGridSize * scale;
    
    // Calculate the effective offset to create seamless infinite scrolling
    // The modulo ensures the pattern repeats seamlessly
    const offsetX = ((x % scaledGridSize) + scaledGridSize) % scaledGridSize;
    const offsetY = ((y % scaledGridSize) + scaledGridSize) % scaledGridSize;
    
    return {
      backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  };

  return (
    <div 
      ref={workspaceRef}
      className={`flex-1 bg-white overflow-hidden relative min-h-96 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleWorkspaceMouseDown}
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
            <div className="text-4xl mb-2">🧩</div>
            <p className="font-medium">Drag blocks here to start programming</p>
            <p className="text-xs mt-1">
              {isStage ? 'Stage workspace - affects background and global elements' : `Sprite ${spriteId} workspace - affects this sprite only`}
            </p>
            <p className="text-xs mt-2 text-gray-500">
              💡 Drag to pan • Scroll to zoom • Drop blocks anywhere
            </p>
          </div>
        </div>
      )}

      {/* Infinite dots background layer */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={getInfiniteDotsStyle()}
      />

      {/* Workspace content with transform */}
      <div 
        className="workspace-background min-h-full relative"
        style={{
          transform: `translate(${workspaceTransform.x}px, ${workspaceTransform.y}px) scale(${workspaceTransform.scale})`,
          transformOrigin: '0 0',
          width: '200%',
          height: '200%'
        }}
      >
        <div className="relative z-10">
          {workspaceSpecificBlocks.map((block) => {
            const nestingLevel = calculateNestingLevel(block);
            return (
              <div
                key={block.instanceId}
                style={{
                  position: 'absolute',
                  left: block.position?.x || 0,
                  top: block.position?.y || 0,
                  cursor: 'move'
                }}
                onMouseDown={(e) => handleBlockMouseDown(block.instanceId, e)}
              >
                <div className={`${isBlockConnected(block.instanceId) ? 'relative' : ''}`}>
                  {isBlockConnected(block.instanceId) && (
                    <>
                      {/* Main connection line */}
                      <div 
                        className="absolute left-4 right-4 h-1 bg-blue-500 rounded-full opacity-80"
                        style={{ 
                          zIndex: -1,
                          top: '-4px' // Positioned in the gap between blocks
                        }}
                      />
                      {/* Additional visual indicator */}
                      <div 
                        className="absolute left-2 w-2 h-2 bg-blue-500 rounded-full opacity-60"
                        style={{ 
                          zIndex: -1,
                          top: '-6px'
                        }}
                      />
                    </>
                  )}
                  <Block
                    block={block}
                    isDraggable={false}
                    isInWorkspace={true}
                    onDelete={() => removeBlockFromWorkspace(block.instanceId)}
                    nestingLevel={nestingLevel}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};