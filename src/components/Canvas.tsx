import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import p5 from 'p5';
import { useBlockContext } from '../contexts/BlockContext';
import { useSpriteContext } from '../contexts/SpriteContext';

// Move drag state OUTSIDE the component so it persists across re-renders
let persistentDragState = {
  isDragging: false,
  spriteId: null as string | null,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
  hasMoved: false
};

interface CanvasProps {
  onDebugLogsChange?: (logs: Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>) => void;
  onRunningStateChange?: (isRunning: boolean) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  onDebugLogsChange, 
  onRunningStateChange 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const p5Instance = useRef<p5 | null>(null);
  const { generatedCode } = useBlockContext();
  const { sprites, updateSprite, selectSprite, resetSpritesToInitial } = useSpriteContext();
  const [isRunning, setIsRunning] = useState(false);
  const [initialSprites, setInitialSprites] = useState<any[]>([]);
  const [resetCounter, setResetCounter] = useState(0);
  const [debugFrameCount, setDebugFrameCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<{
    currentAction?: string;
    actionIndex?: number;
    waitUntilFrame?: number;
    actionCode?: string;
    isWaiting?: boolean;
  }>({});
  const [debugLogs, setDebugLogs] = useState<Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>>([]);
  const persistentSpritesRef = useRef<any[]>([]);
  const animatedPositionsRef = useRef<Map<string, {x: number, y: number}>>(new Map());
  const currentGeneratedCodeRef = useRef<string>(generatedCode);
  const globalFrameCountRef = useRef<number>(0);

  // Update code reference when it changes (without recreating sketch)
  useEffect(() => {
    currentGeneratedCodeRef.current = generatedCode;
    console.log('📝 Code updated in existing sketch (no recreation needed)');
  }, [generatedCode]);
  const debugLogScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll debug log to bottom when new logs are added
  useEffect(() => {
    if (debugLogScrollRef.current) {
      debugLogScrollRef.current.scrollTop = debugLogScrollRef.current.scrollHeight;
    }
  }, [debugLogs]);

  // Create stable references to avoid closure issues
  const spritesRef = useRef(sprites);
  const updateSpriteRef = useRef(updateSprite);
  const selectSpriteRef = useRef(selectSprite);
  const isRunningRef = useRef(isRunning);

  // Debug log function
  const addDebugLog = (frame: number, message: string, type: 'action' | 'wait' | 'info') => {
    try {
      setDebugLogs(prev => {
        const newLog = {
          frame,
          message,
          type,
          timestamp: Date.now()
        };
        // Keep only last 50 logs to prevent memory issues
        const updated = [...prev, newLog].slice(-50);
        
        // Also pass to parent component
        if (onDebugLogsChange) {
          onDebugLogsChange(updated);
        }
        
        return updated;
      });
    } catch (error) {
      console.error('Debug log error:', error);
    }
  };

  // Update refs when dependencies change
  useEffect(() => {
    spritesRef.current = sprites;
    updateSpriteRef.current = updateSprite;
    selectSpriteRef.current = selectSprite;
    isRunningRef.current = isRunning;
  }, [sprites, updateSprite, selectSprite, isRunning]);

  // Store initial sprite positions when sprites change
  useEffect(() => {
    if (sprites.length > 0 && initialSprites.length === 0) {
      setInitialSprites(sprites.map(sprite => ({ ...sprite })));
    }
  }, [sprites, initialSprites.length]);

  const toggleRunning = () => {
    const newRunningState = !isRunning;
    setIsRunning(newRunningState);
    
    // Notify parent component of running state change
    if (onRunningStateChange) {
      onRunningStateChange(newRunningState);
    }
    
    // Log start/stop
    if (newRunningState) {
      addDebugLog(globalFrameCountRef.current, '🚀 Canvas started - Action queue beginning', 'info');
    } else {
      addDebugLog(globalFrameCountRef.current, '⏸️ Canvas paused', 'info');
    }
    
    // When pausing, sync sprite positions from animated positions to React state, then clear animated positions
    if (!newRunningState) {
      console.log('Animation paused - syncing animated positions to React state');
      animatedPositionsRef.current.forEach((pos, spriteId) => {
        updateSpriteRef.current(spriteId, {
          x: Math.round(pos.x),
          y: Math.round(pos.y)
        });
        console.log(`Synced sprite ${spriteId} to position (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
      });
      
      // Clear animated positions so dragging works from React state
      animatedPositionsRef.current.clear();
      console.log('Cleared animated positions - ready for manual control');
      
      // Clear debug info when paused
      setDebugInfo({});
      setDebugLogs([]);
    }
  };

  const resetCanvas = () => {
    // First, reset all sprites to their original drag-drop positions
    if (typeof resetSpritesToInitial === 'function') {
      resetSpritesToInitial();
    } else {
      // Fallback: reset to stored initial positions
      initialSprites.forEach(initialSprite => {
        updateSpriteRef.current(initialSprite.id, {
          x: initialSprite.x,
          y: initialSprite.y,
          size: initialSprite.size,
          color: initialSprite.color
        });
      });
    }
    
    // Reset the debug frame counter and global frame count
    setDebugFrameCount(0);
    globalFrameCountRef.current = 0;
    
    // Clear debug info and logs
    setDebugInfo({});
    setDebugLogs([]);
    
    // Add reset log after clearing (will be the first log)
    setTimeout(() => {
      addDebugLog(0, '🔄 Canvas reset - Frame counter and action queues cleared', 'info');
    }, 10);
    
    // Clear animated positions so sprites reset to their original positions
    animatedPositionsRef.current.clear();
    console.log('Cleared animated positions on reset');
    
    // Clear any wait states that might be stuck
    sprites.forEach(sprite => {
      if ((sprite as any).waitUntilFrame && (sprite as any).waitUntilFrame > 0) {
        console.log(`🧹 Clearing wait state for sprite ${sprite.id}: was waiting until frame ${(sprite as any).waitUntilFrame}`);
        updateSpriteRef.current(sprite.id, { 
          ...(sprite as any),
          waitUntilFrame: 0,
          currentActionIndex: 0,
          actionState: 'ready'
        } as any);
      }
    });
    
    // Reset keeps current run/pause state - user controls when to start
    
    // Increment reset counter to force useEffect to re-run
    setResetCounter(prev => prev + 1);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    if (p5Instance.current) {
      p5Instance.current.remove();
    }
    
    console.log('🎯 Creating p5 sketch (should only happen once or on reset)');
    console.log('Reset counter:', resetCounter);
    console.log('Creating new p5 sketch - animated positions:', Array.from(animatedPositionsRef.current.entries()));

    // Parse the generated code to extract different function parts
    const parseGeneratedCode = (code: string) => {
      console.log('Parsing generated code:', code);
      
      // Simple function to extract content between braces
      const extractFunctionContent = (functionName: string) => {
        const startPattern = `function ${functionName}()`;
        const startIndex = code.indexOf(startPattern);
        if (startIndex === -1) return '';
        
        const braceStart = code.indexOf('{', startIndex);
        if (braceStart === -1) return '';
        
        let braceCount = 1;
        let contentStart = braceStart + 1;
        let i = contentStart;
        
        // Find matching closing brace
        while (i < code.length && braceCount > 0) {
          if (code[i] === '{') braceCount++;
          else if (code[i] === '}') braceCount--;
          i++;
        }
        
        if (braceCount === 0) {
          return code.substring(contentStart, i - 1).trim();
        }
        return '';
      };
      
      const setup = extractFunctionContent('setup');
      const draw = extractFunctionContent('draw');
      const mousePressed = extractFunctionContent('mousePressed');
      
      console.log('Extracted setup:', setup);
      console.log('Extracted draw:', draw);
      console.log('Extracted mousePressed:', mousePressed);
      
      return { setup, draw, mousePressed };
    };

    const sketch = (p: p5) => {
      // Persistent sprite state that accumulates changes across frames
      let persistentSprites: any[] = [];
      // Universal frame clock for the entire program (using persistent ref)
      console.log('📅 Initializing sketch with persistent frame count:', globalFrameCountRef.current);
      
      p.setup = () => {
        p.createCanvas(480, 360);
        
        // Initialize persistent sprites from React state or animated positions
        // CRITICAL: Use animated positions if they exist to prevent position reset
        persistentSprites = spritesRef.current.map(sprite => {
          // ALWAYS prefer animated positions if they exist, regardless of running state
          // This prevents position reset when sketch is recreated during animation
          const animatedPos = animatedPositionsRef.current.get(sprite.id);
          const shouldUseAnimatedPos = animatedPos && animatedPos.x !== undefined && animatedPos.y !== undefined;
          
          // Fix impossible wait states when sketch is recreated
          let waitUntilFrame = sprite.waitUntilFrame || 0;
          if (waitUntilFrame > 0 && waitUntilFrame > globalFrameCountRef.current + 1000) {
            console.log(`🚨 Clearing impossible wait state for sprite ${sprite.id}: waitUntilFrame=${waitUntilFrame}, currentFrame=${globalFrameCountRef.current}`);
            waitUntilFrame = 0; // Clear impossible wait state
          }
          
          console.log(`Initializing sprite ${sprite.id}:`, {
            reactState: {x: sprite.x, y: sprite.y},
            animatedPos: animatedPos,
            willUseAnimated: shouldUseAnimatedPos,
            waitUntilFrame: waitUntilFrame,
            originalWaitUntilFrame: sprite.waitUntilFrame,
            currentFrame: globalFrameCountRef.current,
            isRunning: isRunningRef.current
          });
          
          return {
            id: sprite.id,
            name: sprite.name,
            x: shouldUseAnimatedPos ? animatedPos.x : sprite.x,
            y: shouldUseAnimatedPos ? animatedPos.y : sprite.y,
            size: sprite.size || 30,
            color: sprite.color || '#ff6b6b',
            visible: sprite.visible !== false,
            waitUntilFrame: waitUntilFrame,
            actionQueue: (sprite as any).actionQueue || [],
            currentActionIndex: (sprite as any).currentActionIndex || 0,
            actionState: (sprite as any).actionState || 'ready'
          };
        });
        
        if (isRunningRef.current) {
          console.log('Using animated positions for persistent sprites');
        } else {
          console.log('Using React state positions for persistent sprites');
        }
        
        // Store persistent sprites in ref for access from toggle function
        persistentSpritesRef.current = persistentSprites;
        
        // Execute setup code from generated code (ALWAYS, regardless of running state)
        try {
          const { setup } = parseGeneratedCode(currentGeneratedCodeRef.current);
          if (setup) {
              // Create sprite context that tracks changes
              const spriteContext = {
                originalSprites: persistentSprites.map(s => ({ ...s })),
                spriteUpdates: new Map()
              };

              const executeSetup = new Function(
                'p', 'context', 'animatedPositionsRef',
                'createCanvas', 'background', 'fill', 'stroke', 'noStroke', 'strokeWeight', 
                'circle', 'ellipse', 'rect',
                `
                console.log('Executing setup code');
                const persistentSpritesData = context.originalSprites;
                
                // Store original values to detect changes (before generated code runs)
                const originalSprites = persistentSpritesData.map(s => ({ ...s }));
                
                // Execute ALL the generated code first (includes sprite declarations)
                ` + currentGeneratedCodeRef.current + `
                
                // After generated code runs, update the sprites array with persistent data
                if (typeof sprites !== 'undefined' && sprites.length > 0) {
                  // Update the generated sprites array with our persistent data
                  persistentSpritesData.forEach((persistentSprite, index) => {
                    if (sprites[index]) {
                      sprites[index].x = persistentSprite.x;
                      sprites[index].y = persistentSprite.y;
                      sprites[index].size = persistentSprite.size;
                      sprites[index].color = persistentSprite.color;
                    }
                  });
                }
                
                // Now execute the setup function if it exists
                if (typeof setup === 'function') {
                  setup();
                }
                
                // Check for sprite changes and record them
                if (typeof sprites !== 'undefined') {
                  sprites.forEach((sprite, index) => {
                    const original = originalSprites[index];
                    if (original && (sprite.x !== original.x || sprite.y !== original.y || sprite.size !== original.size || sprite.color !== original.color)) {
                      context.spriteUpdates.set(sprite.id, {
                        x: Math.round(sprite.x),
                        y: Math.round(sprite.y),
                        size: sprite.size,
                        color: sprite.color
                      });
                    }
                  });
                }
                `
              );
              executeSetup(
                p, spriteContext, animatedPositionsRef,
                p.createCanvas.bind(p), p.background.bind(p), p.fill.bind(p), 
                p.stroke.bind(p), p.noStroke.bind(p), p.strokeWeight.bind(p),
                p.circle.bind(p), p.ellipse.bind(p), p.rect.bind(p)
              );

              // Apply any sprite updates that were recorded
              spriteContext.spriteUpdates.forEach((updates, spriteId) => {
                console.log('Applying sprite update to React state:', spriteId, updates);
                updateSpriteRef.current(spriteId, updates);
                
                // Also update persistent sprites
                const spriteIndex = persistentSprites.findIndex(s => s.id === spriteId);
                if (spriteIndex !== -1) {
                  Object.assign(persistentSprites[spriteIndex], updates);
                  // Update ref so toggle function can access current positions
                  persistentSpritesRef.current = [...persistentSprites];
                }
              });
            }
          } catch (error) {
            console.warn('Setup code execution error:', error);
          }
      };

      p.draw = () => {
        p.background(255);
        
        // Only execute generated code if running
        if (isRunningRef.current) {
          // Increment global frame counter only when running
          globalFrameCountRef.current++;
          
          // Update React state for debug display
          setDebugFrameCount(globalFrameCountRef.current);
          try {
            const { draw } = parseGeneratedCode(currentGeneratedCodeRef.current);
            
          // Create sprite context that tracks changes
          const spriteContext = {
              originalSprites: persistentSprites.map(s => ({ ...s })),
            spriteUpdates: new Map()
          };

            // Execute draw code if it exists, otherwise execute the whole code
            const codeToExecute = draw || (currentGeneratedCodeRef.current.includes('function') ? '' : currentGeneratedCodeRef.current);

            // Create a safe execution environment that includes ALL generated code
          const executeCode = new Function(
              'p', 'mouseX', 'mouseY', 'context', 'globalFrameCount', 'animatedPositionsRef', 'addDebugLog',
            'createCanvas', 'background', 'fill', 'stroke', 'noStroke', 'strokeWeight', 
            'circle', 'ellipse', 'rect',
            `
              // Use persistent sprites that accumulates changes
              const persistentSpritesData = context.originalSprites;
            
              // Store original values to detect changes (before generated code runs)
              const originalSprites = persistentSpritesData.map(s => ({ ...s }));
              
              // Debug: Log initial sprite positions
              console.log('Before execution - sprites positions:', persistentSpritesData.map(s => ({id: s.id, x: s.x, y: s.y})));
              
              // Execute ALL the generated code, including functions
              ` + currentGeneratedCodeRef.current + `
              
              // DON'T reset sprite positions here - let the generated code control movement
              // Only sync non-position properties and initialize on first run
              if (typeof sprites !== 'undefined' && sprites.length > 0) {
                sprites.forEach((sprite, index) => {
                  const persistentSprite = persistentSpritesData[index];
                  if (persistentSprite) {
                    // Always sync non-position properties
                    sprite.size = persistentSprite.size;
                    sprite.color = persistentSprite.color;
                    sprite.visible = persistentSprite.visible;
                    sprite.waitUntilFrame = persistentSprite.waitUntilFrame || 0;
                    sprite.actionQueue = persistentSprite.actionQueue || [];
                    sprite.currentActionIndex = persistentSprite.currentActionIndex || 0;
                    sprite.actionState = persistentSprite.actionState || 'ready';
                    sprite.id = persistentSprite.id;
                    sprite.name = persistentSprite.name;
                    
                    // Only sync positions on first frame - after that, let animation code control positions
                    if (globalFrameCount <= 1) {
                      sprite.x = persistentSprite.x;
                      sprite.y = persistentSprite.y;
                      console.log('Initial sprite position set: ' + sprite.id + ' at (' + sprite.x + ', ' + sprite.y + ')');
                    }
                  }
                });
            
                // Note: Wait frame timing is now handled by the action queue system
                // The action queue manages its own wait states to avoid race conditions
              }
              
              // Now call draw() which will execute drawSprites() with the updated sprites
              if (typeof draw === 'function') {
                draw();
              }
            
              // Debug: Log sprite positions after execution
              if (typeof sprites !== 'undefined') {
                console.log('After execution - sprites positions:', sprites.map(s => ({id: s.id, x: s.x, y: s.y})));
                
                // Check for sprite changes and record them (including wait states)
                sprites.forEach((sprite, index) => {
                  const original = originalSprites[index];
                  if (original && (
                    sprite.x !== original.x || 
                    sprite.y !== original.y || 
                    sprite.size !== original.size || 
                    sprite.color !== original.color ||
                    sprite.waitUntilFrame !== (original.waitUntilFrame || 0) ||
                    sprite.currentActionIndex !== (original.currentActionIndex || 0) ||
                    sprite.actionState !== (original.actionState || 'ready')
                  )) {
                    console.log('Detected sprite change:', {
                      id: sprite.id,
                      from: {x: original.x, y: original.y, actionIndex: original.currentActionIndex || 0, state: original.actionState || 'ready'},
                      to: {x: sprite.x, y: sprite.y, actionIndex: sprite.currentActionIndex || 0, state: sprite.actionState || 'ready'}
                    });
                    // Store animated positions in ref to persist across sketch recreations
                    animatedPositionsRef.current.set(sprite.id, {
                      x: Math.round(sprite.x),
                      y: Math.round(sprite.y)
                    });
                    
                    context.spriteUpdates.set(sprite.id, {
                      x: Math.round(sprite.x),
                      y: Math.round(sprite.y),
                      size: sprite.size,
                      color: sprite.color,
                      waitUntilFrame: sprite.waitUntilFrame || 0,
                      actionQueue: sprite.actionQueue || [],
                      currentActionIndex: sprite.currentActionIndex || 0,
                      actionState: sprite.actionState || 'ready'
                    });
                  }
              });
            }
            `
          );

          executeCode(
              p, p.mouseX, p.mouseY, spriteContext, globalFrameCountRef.current, animatedPositionsRef, addDebugLog,
            p.createCanvas.bind(p), p.background.bind(p), p.fill.bind(p), 
            p.stroke.bind(p), p.noStroke.bind(p), p.strokeWeight.bind(p),
            p.circle.bind(p), p.ellipse.bind(p), p.rect.bind(p)
          );

          // Apply any sprite updates that were recorded
          spriteContext.spriteUpdates.forEach((updates, spriteId) => {
              console.log('🔄 Applying sprite update:', spriteId, updates);
              console.log('🔄 Current persistent sprite before update:', persistentSprites.find(s => s.id === spriteId));
              console.log('🔄 Current animated position before update:', animatedPositionsRef.current.get(spriteId));
              
              // Update persistent sprites first
              const spriteIndex = persistentSprites.findIndex(s => s.id === spriteId);
              if (spriteIndex !== -1) {
                Object.assign(persistentSprites[spriteIndex], updates);
                // Update ref so toggle function can access current positions
                persistentSpritesRef.current = [...persistentSprites];
                console.log('🔄 Updated persistent sprite:', persistentSprites[spriteIndex]);
              }
              
              // Always update React state to keep coordinates in sync, even while dragging
              // This ensures the UI shows real-time coordinates and dragging uses current positions
              if (persistentDragState.isDragging && persistentDragState.spriteId === spriteId) {
                console.log('🔄 Updating React state for dragged sprite (maintaining animation sync):', spriteId);
                // Update React state but don't interfere with drag visuals
                updateSpriteRef.current(spriteId, updates);
              } else {
                // Normal update for non-dragged sprites
                console.log('🔄 Updating React state for sprite:', spriteId, updates);
                updateSpriteRef.current(spriteId, updates);
              }
          });

        } catch (error) {
          console.warn('Generated code execution error:', error);
        }
        }
        
        // Only draw sprites manually when paused OR when generated code doesn't handle sprite drawing
        // This prevents duplicate sprites when both systems are drawing
        const shouldDrawSpritesManually = !isRunningRef.current || !currentGeneratedCodeRef.current.includes('drawSprites()');
        
        if (shouldDrawSpritesManually) {
          // Draw all sprites with real-time drag feedback (when paused or no generated drawing)
          spritesRef.current.forEach(sprite => {
          if (sprite.visible === false) return;
          
          let drawX = sprite.x;
          let drawY = sprite.y;
          
          // Show real-time drag position if we're dragging this sprite
          if (persistentDragState.isDragging && persistentDragState.spriteId === sprite.id) {
            drawX = p.mouseX - persistentDragState.offsetX;
            drawY = p.mouseY - persistentDragState.offsetY;
            
              // Constrain to canvas (using same relaxed constraints as final position)
              const minBorder = 5;
              drawX = Math.max(minBorder, Math.min(480 - minBorder, drawX));
              drawY = Math.max(minBorder, Math.min(360 - minBorder, drawY));
            
            // Track movement
            const moveDistance = Math.sqrt(
              Math.pow(drawX - persistentDragState.startX, 2) + 
              Math.pow(drawY - persistentDragState.startY, 2)
            );
            persistentDragState.hasMoved = moveDistance > 3;
          }
          
          p.push();
          
          // Enhanced shadow for dragged sprite
          if (persistentDragState.isDragging && persistentDragState.spriteId === sprite.id && persistentDragState.hasMoved) {
            p.fill(0, 0, 0, 60);
            p.noStroke();
            p.ellipse(drawX + 4, drawY + 4, sprite.size || 30, sprite.size || 30);
          }
          
          // Main sprite
          p.fill(sprite.color || '#ff6b6b');
          p.stroke(255);
          p.strokeWeight(2);
          p.ellipse(drawX, drawY, sprite.size || 30, sprite.size || 30);
          
          // Highlight
          p.fill(255, 255, 255, 120);
          p.noStroke();
          const size = sprite.size || 30;
          p.ellipse(drawX - size * 0.15, drawY - size * 0.15, size * 0.3, size * 0.3);
          
          p.pop();
        });
        } else {
          // When generated code is handling sprite drawing, we still need to show drag feedback
          // Draw only the currently dragged sprite as an overlay
          if (persistentDragState.isDragging && persistentDragState.spriteId) {
            const draggedSprite = spritesRef.current.find(s => s.id === persistentDragState.spriteId);
            if (draggedSprite) {
              const drawX = p.mouseX - persistentDragState.offsetX;
              const drawY = p.mouseY - persistentDragState.offsetY;
              
              // Constrain to canvas (using same relaxed constraints)
              const size = draggedSprite.size || 30;
              const minBorder = 5;
              const constrainedX = Math.max(minBorder, Math.min(480 - minBorder, drawX));
              const constrainedY = Math.max(minBorder, Math.min(360 - minBorder, drawY));
              
              // Track movement
              const moveDistance = Math.sqrt(
                Math.pow(constrainedX - persistentDragState.startX, 2) + 
                Math.pow(constrainedY - persistentDragState.startY, 2)
              );
              persistentDragState.hasMoved = moveDistance > 3;
              
              if (persistentDragState.hasMoved) {
                p.push();
                
                // Semi-transparent drag preview
                p.fill(draggedSprite.color || '#ff6b6b');
                p.stroke(255);
                p.strokeWeight(2);
                p.ellipse(constrainedX, constrainedY, size, size);
                
                // Add the highlight/glare to match original sprite appearance
                p.fill(255, 255, 255, 120);
                p.noStroke();
                p.ellipse(constrainedX - size * 0.15, constrainedY - size * 0.15, size * 0.3, size * 0.3);
                
                // Drag shadow
                p.fill(0, 0, 0, 60);
                p.noStroke();
                p.ellipse(constrainedX + 4, constrainedY + 4, size, size);
                
                p.pop();
              }
            }
          }
        }
      };

      p.mousePressed = () => {
        console.log('Raw p5 mouse coords:', p.mouseX, p.mouseY);
        
        // Check canvas bounds
        if (p.mouseX < 0 || p.mouseX > 480 || p.mouseY < 0 || p.mouseY > 360) {
          console.log('Click outside canvas bounds');
          return;
        }
        
        let spriteClicked = false;
        
        // Allow sprite dragging regardless of pause/run state
        // Check sprites from top to bottom using current sprite state
        const currentSprites = spritesRef.current;
        for (let i = currentSprites.length - 1; i >= 0; i--) {
          const sprite = currentSprites[i];
          if (sprite.visible === false) continue;
          
          const distance = Math.sqrt((p.mouseX - sprite.x) ** 2 + (p.mouseY - sprite.y) ** 2);
          
          if (distance <= (sprite.size || 30) / 2) {
            console.log('Sprite clicked:', sprite.id, 'at position:', sprite.x, sprite.y);
            console.log('Mouse at:', p.mouseX, p.mouseY, 'Distance:', distance);
            
            // Use current animated position if available, otherwise use React state
            const animatedPos = animatedPositionsRef.current.get(sprite.id);
            const currentX = animatedPos && isRunningRef.current ? animatedPos.x : sprite.x;
            const currentY = animatedPos && isRunningRef.current ? animatedPos.y : sprite.y;
            
            console.log('Using position for drag:', currentX, currentY, animatedPos ? '(animated)' : '(react state)');
            
            // Set up persistent drag state with current animated coordinates
            persistentDragState = {
              isDragging: true,
              spriteId: sprite.id,
              offsetX: p.mouseX - currentX,
              offsetY: p.mouseY - currentY,
              startX: currentX,
              startY: currentY,
              hasMoved: false
            };
            
            console.log('Drag state set - Offset:', persistentDragState.offsetX, persistentDragState.offsetY);
            
            // Select sprite immediately
            selectSpriteRef.current(sprite);
            spriteClicked = true;
            break;
          }
        }

        // Execute generated mousePressed code only if no sprite was clicked AND canvas is running
        if (!spriteClicked && isRunningRef.current) {
          console.log('No sprite clicked, checking for mousePressed code');
          
          try {
            const { mousePressed } = parseGeneratedCode(currentGeneratedCodeRef.current);
          
            if (mousePressed) {
              console.log('Found mousePressed code, executing:', mousePressed);
            const spriteContext = {
                originalSprites: spritesRef.current.map(s => ({ ...s })),
              spriteUpdates: new Map()
            };

            const executeMousePressed = new Function(
                'p', 'mouseX', 'mouseY', 'context', 'animatedPositionsRef',
              'createCanvas', 'background', 'fill', 'stroke', 'noStroke', 'strokeWeight', 
              'circle', 'ellipse', 'rect',
              `
              console.log('Executing mousePressed code');
                const persistentSpritesData = context.originalSprites;
              
                // Store original values to detect changes (before generated code runs)
                const originalSprites = persistentSpritesData.map(s => ({ ...s }));
                
                // Execute ALL the generated code first (includes sprite declarations)
                ` + currentGeneratedCodeRef.current + `
                
                // After generated code runs, update the sprites array with persistent data
                if (typeof sprites !== 'undefined' && sprites.length > 0) {
                  // Update the generated sprites array with our persistent data
                  persistentSpritesData.forEach((persistentSprite, index) => {
                    if (sprites[index]) {
                      sprites[index].x = persistentSprite.x;
                      sprites[index].y = persistentSprite.y;
                      sprites[index].size = persistentSprite.size;
                      sprites[index].color = persistentSprite.color;
                    }
                  });
                }
                
                // Now execute the mousePressed function if it exists
                if (typeof mousePressed === 'function') {
                  mousePressed();
              }
              
                // Check for sprite changes and record them
                if (typeof sprites !== 'undefined') {
                  sprites.forEach((sprite, index) => {
                    const original = originalSprites[index];
                    if (original && (sprite.x !== original.x || sprite.y !== original.y || sprite.size !== original.size || sprite.color !== original.color)) {
                      console.log('Sprite position changed from', original.x, original.y, 'to', sprite.x, sprite.y);
                      context.spriteUpdates.set(sprite.id, {
                        x: Math.round(sprite.x),
                        y: Math.round(sprite.y),
                        size: sprite.size,
                        color: sprite.color
                      });
                    }
                  });
              }
              `
            );

            executeMousePressed(
                p, p.mouseX, p.mouseY, spriteContext, animatedPositionsRef,
              p.createCanvas.bind(p), p.background.bind(p), p.fill.bind(p), 
              p.stroke.bind(p), p.noStroke.bind(p), p.strokeWeight.bind(p),
              p.circle.bind(p), p.ellipse.bind(p), p.rect.bind(p)
            );

            // Apply sprite updates
            spriteContext.spriteUpdates.forEach((updates, spriteId) => {
                console.log('Applying sprite update to React state:', spriteId, updates);
                updateSpriteRef.current(spriteId, updates);
            });
            } else {
              console.log('No mousePressed function found in generated code');
            }

          } catch (error) {
            console.error('Mouse press execution error:', error);
          }
        } else if (!spriteClicked && !isRunningRef.current) {
          console.log('Canvas is paused, not executing mousePressed code');
        }
      };

      p.mouseReleased = () => {
        console.log('Canvas mouseReleased called', 'isDragging:', persistentDragState.isDragging);
        
        // Process drag completion if we were dragging
        if (persistentDragState.isDragging && persistentDragState.spriteId) {
          console.log('Completing drag for sprite:', persistentDragState.spriteId, 'hasMoved:', persistentDragState.hasMoved);
          console.log('Current mouse:', p.mouseX, p.mouseY);
          console.log('Stored offset:', persistentDragState.offsetX, persistentDragState.offsetY);
          
          if (persistentDragState.hasMoved) {
            // Calculate final position using current mouse position and proper offset
            let finalX = p.mouseX - persistentDragState.offsetX;
            let finalY = p.mouseY - persistentDragState.offsetY;
            
            console.log('Calculated final position before constraints:', finalX, finalY);
            
            // Find the sprite size for constraint calculation
            const currentSprite = spritesRef.current.find(s => s.id === persistentDragState.spriteId);
            const size = currentSprite?.size || 30;
            const radius = size / 2;
            
            // More relaxed constraints - allow sprites to be dragged closer to edges
            const minBorder = 5; // Minimum 5px from edge instead of full radius
            finalX = Math.max(minBorder, Math.min(480 - minBorder, finalX));
            finalY = Math.max(minBorder, Math.min(360 - minBorder, finalY));
            
            console.log('Final position after constraints:', finalX, finalY, 'radius:', radius);
            
            // Only update if the position is valid (using same constraints)
            if (finalX >= minBorder && finalX <= 480 - minBorder && finalY >= minBorder && finalY <= 360 - minBorder) {
              const finalPosition = {
              x: Math.round(finalX),
              y: Math.round(finalY)
              };
              
              updateSpriteRef.current(persistentDragState.spriteId, finalPosition);
              console.log('Updated sprite to:', finalPosition.x, finalPosition.y);
              
              // Update animated positions ref so animation continues from new position
              animatedPositionsRef.current.set(persistentDragState.spriteId, finalPosition);
              console.log('Updated animated position ref for sprite:', persistentDragState.spriteId, finalPosition);
              
              // Also update persistent sprites immediately
              const spriteIndex = persistentSprites.findIndex(s => s.id === persistentDragState.spriteId);
              if (spriteIndex !== -1) {
                persistentSprites[spriteIndex].x = finalPosition.x;
                persistentSprites[spriteIndex].y = finalPosition.y;
                console.log('Updated persistent sprite position:', persistentSprites[spriteIndex]);
              }
            } else {
              console.warn('Invalid final position, not updating sprite');
            }
          } else {
            console.log('Sprite did not move enough, no position update');
          }
        }
        
        // Clear persistent drag state
        persistentDragState = {
          isDragging: false,
          spriteId: null,
          offsetX: 0,
          offsetY: 0,
          startX: 0,
          startY: 0,
          hasMoved: false
        };
      };
    };

    p5Instance.current = new p5(sketch, canvasRef.current);

    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, [resetCounter]); // Only recreate on manual reset, not when code changes

  return (
    <div className="w-full h-full bg-gray-100 flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Canvas</div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isRunning 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isRunning ? (
              <>
                <Pause size={14} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Run</span>
              </>
            )}
          </button>
          <button
            onClick={resetCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-500 text-white hover:bg-blue-600"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        <div className="text-xs text-gray-500">480 × 360</div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center relative">
        <div 
          ref={canvasRef}
          className="bg-white shadow-lg border border-gray-300"
          style={{ width: '480px', height: '360px' }}
        />
        
        {/* Subtle paused indicator in corner */}
        {!isRunning && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="bg-gray-800 bg-opacity-80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <Play size={12} />
              <span>Paused</span>
            </div>
          </div>
        )}
        
        {/* Frame counter - matching existing UI style */}
        <div className="absolute top-2 right-2 pointer-events-none">
          <div className="bg-gray-800 bg-opacity-80 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <span className="text-blue-300">Frame:</span>
            <span className="font-mono">{debugFrameCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};