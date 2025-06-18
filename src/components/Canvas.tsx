import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useBlockContext } from '../contexts/BlockContext';
import { useSpriteContext } from '../contexts/SpriteContext';

// Import Q5 normally - it doesn't depend on other libraries
import Q5 from 'q5';

// We'll dynamically import planck and p5play to ensure proper loading order
console.log('📦 Starting dynamic library loading...');

// Function to ensure libraries are loaded in correct order
const ensureLibrariesLoaded = async (): Promise<void> => {
  // First, dynamically import planck and wait for it to be available
  console.log('🔧 Loading planck...');
  const planckModule = await import('planck');
  
  // Planck exports both directly and via default - p5play expects it on window.planck
  // Use the full module (not just default) to ensure all classes are available
  (window as any).planck = planckModule;
  
  // Also add the default export for compatibility
  if (planckModule.default) {
    (window as any).pl = planckModule.default;
  }
  
  console.log('✅ planck ES module imported and exposed globally');
  console.log('Available planck classes:', {
    World: !!(window as any).planck.World,
    Vec2: !!(window as any).planck.Vec2,
    Body: !!(window as any).planck.Body
  });
  
  // Verify planck is properly available
  if (!(window as any).planck || !(window as any).planck.World) {
    console.error('planck World class not found:', (window as any).planck);
    throw new Error('planck World class not available - p5play will fail');
  }
  
  console.log('✅ planck loaded and available globally for p5play');
  
  // Now load p5play after planck is confirmed available
  console.log('🎮 Loading p5play...');
  await import('p5play');
  
  // Wait a bit more to ensure p5play fully initializes
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('✅ p5play loaded successfully');
  console.log('📦 All libraries loaded in correct order:', {
    q5: '3.1.4',
    planck: '1.4.2 (loaded first)',
    p5play: '3.30.1 (loaded after planck)'
  });
};

// Extend Window interface for global mouse coordinates
declare global {
  interface Window {
    globalMouseX: number;
    globalMouseY: number;
  }
}

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
  const q5Instance = useRef<any>(null);
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
  const [isWebGPU, setIsWebGPU] = useState<boolean>(false);
  const [librariesLoaded, setLibrariesLoaded] = useState<boolean>(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const canvasSize = { width: 480, height: 360 }; // Fixed size as intended
  
  // p5play specific refs
  const p5playSpritesRef = useRef<Map<string, any>>(new Map());
  const worldRef = useRef<any>(null);
  const currentGeneratedCodeRef = useRef<string>(generatedCode);
  const globalFrameCountRef = useRef<number>(0);
  const codeExecutionScopeRef = useRef<any>({});
  
  // Drawing buffer for async-to-sync coordination
  const drawingBufferRef = useRef<Array<{command: string, args: any[]}>>([]);
  
  // Drawing buffer functions
  const addDrawCommand = (command: string, ...args: any[]) => {
    drawingBufferRef.current.push({ command, args });
  };
  
  const executeDrawBuffer = (q: any) => {
    drawingBufferRef.current.forEach(({ command, args }) => {
      try {
        switch (command) {
          case 'fill':
            q.fill(...args);
            break;
          case 'background':
            q.background(...args);
            break;
          case 'rect':
            q.rect(...args);
            break;
          case 'circle':
            q.circle(...args);
            break;
          case 'ellipse':
            q.ellipse(...args);
            break;
          case 'stroke':
            q.stroke(...args);
            break;
          case 'strokeWeight':
            q.strokeWeight(...args);
            break;
          case 'noStroke':
            q.noStroke();
            break;
          default:
            console.warn(`Unknown drawing command: ${command}`);
        }
      } catch (error) {
        console.warn(`Failed to execute drawing command: ${command}`, error);
      }
    });
    drawingBufferRef.current = []; // Clear buffer after execution
  };

  // Load libraries on component mount
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        setLoadingError(null);
        await ensureLibrariesLoaded();
        setLibrariesLoaded(true);
      } catch (error: any) {
        console.error('❌ Failed to load libraries:', error);
        setLoadingError(error.message || 'Failed to load required libraries');
      }
    };
    
    loadLibraries();
  }, []);

  // Update code reference when it changes (without recreating sketch)
  useEffect(() => {
    currentGeneratedCodeRef.current = generatedCode;
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
    
    // Update ref immediately for draw loop access
    isRunningRef.current = newRunningState;
    
    // Immediately control sprite movement based on new state
    if (p5playSpritesRef.current) {
      p5playSpritesRef.current.forEach((p5playSprite, spriteId) => {
        if (newRunningState) {
          // When resuming, restore stored velocity if it exists
          if (p5playSprite.storedVel) {
            p5playSprite.vel.x = p5playSprite.storedVel.x;
            p5playSprite.vel.y = p5playSprite.storedVel.y;
            delete p5playSprite.storedVel;
          }
        } else {
          // When pausing, immediately store velocity and stop movement
          if (p5playSprite.vel && (p5playSprite.vel.x !== 0 || p5playSprite.vel.y !== 0)) {
            p5playSprite.storedVel = { x: p5playSprite.vel.x, y: p5playSprite.vel.y };
            p5playSprite.vel.x = 0;
            p5playSprite.vel.y = 0;
          }
        }
      });
    }
    
    // Notify parent component of running state change
    if (onRunningStateChange) {
      onRunningStateChange(newRunningState);
    }
    
    // Log start/stop
    if (newRunningState) {
      addDebugLog(debugFrameCount, 'Canvas started', 'info');
    } else {
             addDebugLog(debugFrameCount, 'Canvas paused', 'info');
    }
    
    // When pausing, sync sprite positions from p5play sprites to React state
    if (!newRunningState && p5playSpritesRef.current) {
      p5playSpritesRef.current.forEach((p5playSprite, spriteId) => {
        updateSpriteRef.current(spriteId, {
          x: Math.round(p5playSprite.x),
          y: Math.round(p5playSprite.y)
        });
      });
      
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
    
    // Reset p5play sprites to initial positions
    if (p5playSpritesRef.current) {
      p5playSpritesRef.current.forEach((p5playSprite, spriteId) => {
        const initialSprite = initialSprites.find(s => s.id === spriteId);
        if (initialSprite) {
          p5playSprite.x = initialSprite.x;
          p5playSprite.y = initialSprite.y;
          p5playSprite.vel.x = 0;
          p5playSprite.vel.y = 0;
          // Clear any stored velocity from pause state
          if (p5playSprite.storedVel) {
            delete p5playSprite.storedVel;
          }
        }
      });
    }
    
    // Reset the debug frame counter
    setDebugFrameCount(0);
    
    // Clear debug info and logs
    setDebugInfo({});
    setDebugLogs([]);
    
    // Clear code execution scope to avoid variable redeclaration
    codeExecutionScopeRef.current = {};
    
    // Add reset log after clearing (will be the first log)
    setTimeout(() => {
      addDebugLog(0, 'Canvas reset - Frame counter cleared', 'info');
    }, 10);
    
    // Clear any wait states that might be stuck
    sprites.forEach(sprite => {
      if ((sprite as any).waitUntilFrame && (sprite as any).waitUntilFrame > 0) {
        updateSpriteRef.current(sprite.id, { 
          ...(sprite as any),
          waitUntilFrame: 0
        } as any);
      }
    });
    
    // Increment reset counter to force useEffect to re-run
    setResetCounter(prev => prev + 1);
  };

  // Helper function to extract function contents safely
  const extractDrawLogic = (code: string) => {
    // Extract just the content inside the draw function
    const drawMatch = code.match(/function\s+draw\s*\(\s*\)\s*\{([\s\S]*)\}/);
    if (drawMatch) {
      return drawMatch[1].trim();
    }
    
    // If no draw function found, look for updateSprites calls or similar
    const lines = code.split('\n');
    const drawLogic = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') && 
             !trimmed.includes('function ') &&
             !trimmed.startsWith('let ') &&
             !trimmed.startsWith('const ') &&
             !trimmed.startsWith('var ') &&
             trimmed.length > 0;
    });
    
    return drawLogic.join('\n');
  };

  useEffect(() => {
    // Don't create the sketch until libraries are loaded
    if (!librariesLoaded || !canvasRef.current) return;

    if (q5Instance.current) {
      q5Instance.current.remove();
    }

    // Verify npm packages are now available after dynamic loading
    console.log('📦 Using dynamically loaded packages:', {
      q5: !!Q5,
      q5Version: '3.1.4',
      p5playAvailable: !!(window as any).Sprite,
      planckAvailable: !!(window as any).planck || !!(window as any).pl,
      p5playVersion: '3.30.1',
      planckVersion: '1.4.2'
    });

    // Parse the generated code to extract different function parts
    const parseGeneratedCode = (code: string) => {
      
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
      
      return { setup, draw, mousePressed };
    };

    const sketch = (q: any) => {
      // q5.js + p5play setup
      q.setup = () => {
        console.log(`✅ Creating canvas with npm packages: ${canvasSize.width} x ${canvasSize.height}`);
        
        // Verify planck is available before proceeding (critical for p5play)
        const planckCheck = !!(window as any).planck || !!(window as any).pl;
        if (!planckCheck) {
          console.error('❌ CRITICAL: planck not available during setup - p5play will fail!');
          addDebugLog(0, 'planck not found - p5play initialization will fail', 'info');
          return; // Abort setup if planck is not available
        }
        console.log('✅ planck verified available for p5play initialization');
        
        q.createCanvas(canvasSize.width, canvasSize.height);
        
        // Set white background immediately
        q.background(255);
        
        // 🎯 CRITICAL: Translate coordinate system to center origin
        // Move (0,0) from top-left to center of canvas
        q.translate(canvasSize.width / 2, canvasSize.height / 2);
        
        // Now we have Center-Origin Coordinate System (480x360 canvas)
        // (0,0) = center of canvas
        // Top-left corner = (-240, -180)
        // Bottom-right corner = (240, 180)  
        // Positive X = right, Negative X = left
        // Positive Y = down, Negative Y = up
        
        console.log('✅ Applied translation for center-origin coordinate system');
        
        // Initialize p5play world with gravity disabled for 2D programming
        try {
          (q as any).world.gravity.y = 0;
          worldRef.current = (q as any).world;
          console.log('✅ p5play world initialized with zero gravity');
        } catch (p5playError) {
          console.error('❌ p5play world initialization failed:', p5playError);
          addDebugLog(0, `p5play initialization failed: ${p5playError}`, 'info');
          return;
        }
        
        // Clear existing p5play sprites map
        p5playSpritesRef.current.clear();
        
        // Clear code execution scope for fresh start
        codeExecutionScopeRef.current = {};
        
        // Clear drawing buffer for fresh start
        drawingBufferRef.current = [];
        
        // Let generated code handle all sprite creation - no duplicate sprites!
        
        // Execute all generated code once during setup to establish variables and functions
        try {
          const executeAllCode = new Function(
            'q', 'world', 'p5playSprites', 'addDebugLog', 'codeScope', 'Sprite',
                'createCanvas', 'background', 'fill', 'stroke', 'noStroke', 'strokeWeight', 
            'circle', 'ellipse', 'rect', 'mouseX', 'mouseY', 'width', 'height', 'kb',
            'cos', 'sin', 'atan2', 'PI', 'dist', 'executeDrawBuffer', 'addDrawCommand',
            `
            // Execute all generated code and manually assign variables to persistent scope
            with (codeScope) {
              // Execute the entire generated code 
              ${currentGeneratedCodeRef.current}
              
                              // Manually assign variables to codeScope for persistence
               try {
                 addDebugLog(0, 'Checking variables: globalFrameCount=' + (typeof globalFrameCount) + ', sprites=' + (typeof sprites), 'info');
                 
                 if (typeof globalFrameCount !== 'undefined') {
                   codeScope.globalFrameCount = globalFrameCount;
                   addDebugLog(0, 'Stored globalFrameCount: ' + globalFrameCount, 'info');
                 } else {
                   // Initialize if not found
                   codeScope.globalFrameCount = 0;
                   addDebugLog(0, 'Initialized globalFrameCount to 0', 'info');
                 }
                 
                 if (typeof sprites !== 'undefined') codeScope.sprites = sprites;
                 if (typeof getSpriteById !== 'undefined') codeScope.getSpriteById = getSpriteById;
                 if (typeof updateSprite !== 'undefined') codeScope.updateSprite = updateSprite;
                 if (typeof updateSprites !== 'undefined') codeScope.updateSprites = updateSprites;
                 if (typeof setup !== 'undefined') codeScope.setup = setup;
                 if (typeof draw !== 'undefined') codeScope.draw = draw;
                 if (typeof mousePressed !== 'undefined') codeScope.mousePressed = mousePressed;
                 if (typeof executeDrawBuffer !== 'undefined') codeScope.executeDrawBuffer = executeDrawBuffer;
                 if (typeof addDrawCommand !== 'undefined') codeScope.addDrawCommand = addDrawCommand;
                 
                 addDebugLog(0, 'Variables stored. codeScope has: ' + Object.keys(codeScope).join(', '), 'info');
               } catch (e) {
                 addDebugLog(0, 'Variable assignment error: ' + e.message, 'info');
               }
              
              // Run setup if it exists
                if (typeof setup === 'function') {
                  setup();
                addDebugLog(0, 'Setup completed', 'info');
              } else {
                addDebugLog(0, 'No setup function found', 'info');
              }
            }
            `
          );
          const SpriteClass = (window as any).Sprite || (q as any).Sprite;
          executeAllCode(
            q, worldRef.current, p5playSpritesRef.current, addDebugLog, codeExecutionScopeRef.current, SpriteClass,
            q.createCanvas.bind(q), q.background.bind(q), q.fill.bind(q), 
            q.stroke.bind(q), q.noStroke.bind(q), q.strokeWeight.bind(q),
            q.circle.bind(q), q.ellipse.bind(q), q.rect.bind(q), q.mouseX, q.mouseY, canvasSize.width, canvasSize.height, q.kb,
            Math.cos, Math.sin, Math.atan2, Math.PI, q.dist,
            () => executeDrawBuffer(q), addDrawCommand
          );
          } catch (error: any) {
          addDebugLog(0, `Setup execution error: ${error.message}`, 'info');
          }
      };

      q.draw = () => {
        q.background(255);
        
        // Control p5play sprite movement based on running state
        if (p5playSpritesRef.current) {
          p5playSpritesRef.current.forEach((p5playSprite, spriteId) => {
            if (isRunningRef.current) {
              // When running, restore stored velocity if it exists
              if (p5playSprite.storedVel) {
                p5playSprite.vel.x = p5playSprite.storedVel.x;
                p5playSprite.vel.y = p5playSprite.storedVel.y;
                delete p5playSprite.storedVel;
              }
            } else {
              // When paused, store velocity and stop movement
              if (p5playSprite.vel && (p5playSprite.vel.x !== 0 || p5playSprite.vel.y !== 0)) {
                p5playSprite.storedVel = { x: p5playSprite.vel.x, y: p5playSprite.vel.y };
                p5playSprite.vel.x = 0;
                p5playSprite.vel.y = 0;
              }
            }
          });
        }
        
        // Only execute generated code if running
        if (isRunningRef.current) {
          // Update debug frame counter for display
          setDebugFrameCount(prev => prev + 1);

          try {
            // Execute the draw logic from the persistent scope
          const executeCode = new Function(
              'q', 'world', 'p5playSprites', 'mouseX', 'mouseY', 'addDebugLog', 'codeScope', 'Sprite',
            'createCanvas', 'background', 'fill', 'stroke', 'noStroke', 'strokeWeight', 
            'circle', 'ellipse', 'rect', 'width', 'height', 'kb',
            'cos', 'sin', 'atan2', 'PI', 'dist', 'executeDrawBuffer', 'addDrawCommand',
            `
              // Execute within the persistent scope that contains our variables
              with (codeScope) {
                // Update global mouse coordinates for async functions
                window.globalMouseX = q.mouseX;
                window.globalMouseY = q.mouseY;
            
                // Execute draw function if it exists in persistent scope
              if (typeof draw === 'function') {
                draw();
              }
            
              // Execute drawing buffer to render any buffered drawing commands
              if (typeof executeDrawBuffer === 'function') {
                executeDrawBuffer(q);
              }
            }
            `
          );

          const SpriteClass = (window as any).Sprite || (q as any).Sprite;
          executeCode(
              q, worldRef.current, p5playSpritesRef.current, q.mouseX, q.mouseY, 
              addDebugLog, codeExecutionScopeRef.current, SpriteClass,
              q.createCanvas.bind(q), q.background.bind(q), q.fill.bind(q), 
              q.stroke.bind(q), q.noStroke.bind(q), q.strokeWeight.bind(q),
              q.circle.bind(q), q.ellipse.bind(q), q.rect.bind(q), canvasSize.width, canvasSize.height, q.kb,
              Math.cos, Math.sin, Math.atan2, Math.PI, q.dist,
              () => executeDrawBuffer(q), addDrawCommand
          );

          } catch (error: any) {
            addDebugLog(0, `Execution error: ${error.message}`, 'info');
          }
        }
              
        // p5play automatically draws all sprites with q5.js - no need for manual drawSprites()
      };

      // Add required event handlers for q5.js compatibility
      q.keyPressed = () => {
        // Handle key press events - placeholder for future use
      };
      
      q.keyReleased = () => {
        // Handle key release events - placeholder for future use
      };
      
      q.mouseClicked = () => {
        // Handle mouse click events - placeholder for future use
      };
      
      q.mouseMoved = () => {
        // Handle mouse move events - placeholder for future use
      };

      // Mouse handling for sprite interaction
      q.mousePressed = () => {
        if (!isRunningRef.current) {
          // Check if mouse is over any p5play sprite for dragging
          p5playSpritesRef.current.forEach((p5playSprite, spriteId) => {
            if (p5playSprite.mouse.pressing()) {
              persistentDragState.isDragging = true;
              persistentDragState.spriteId = spriteId;
              persistentDragState.offsetX = q.mouseX - p5playSprite.x;
              persistentDragState.offsetY = q.mouseY - p5playSprite.y;
              persistentDragState.startX = p5playSprite.x;
              persistentDragState.startY = p5playSprite.y;
              persistentDragState.hasMoved = false;
              
              selectSpriteRef.current(spriteId as any);
          }
          });
        }

        // Execute mousePressed code from generated code
        try {
            const executeMousePressed = new Function(
            'q', 'world', 'p5playSprites', 'mouseX', 'mouseY', 'codeScope', 'Sprite', 'kb',
            'cos', 'sin', 'atan2', 'PI', 'dist',
            `
            with (codeScope) {
              const sprites = Array.from(p5playSprites.values());
              // Execute mousePressed function if it exists in persistent scope
                if (typeof codeScope.mousePressed === 'function') {
                  codeScope.mousePressed();
              }
            }
            `
          );
          const SpriteClass = (window as any).Sprite || (q as any).Sprite;
          executeMousePressed(q, worldRef.current, p5playSpritesRef.current, q.mouseX, q.mouseY, codeExecutionScopeRef.current, SpriteClass, q.kb, Math.cos, Math.sin, Math.atan2, Math.PI, q.dist);
          } catch (error: any) {
          addDebugLog(0, `MousePressed error: ${error.message}`, 'info');
              }
      };

      q.mouseDragged = () => {
        if (persistentDragState.isDragging && persistentDragState.spriteId && !isRunningRef.current) {
          const newX = q.mouseX - persistentDragState.offsetX;
          const newY = q.mouseY - persistentDragState.offsetY;
          
          // Update p5play sprite position
          const p5playSprite = p5playSpritesRef.current.get(persistentDragState.spriteId);
          if (p5playSprite) {
            p5playSprite.x = newX;
            p5playSprite.y = newY;
            
            // Also update React state immediately for responsive UI
            updateSpriteRef.current(persistentDragState.spriteId, { x: Math.round(newX), y: Math.round(newY) });
            persistentDragState.hasMoved = true;
          }
        }
      };

      q.mouseReleased = () => {
        if (persistentDragState.isDragging && persistentDragState.spriteId) {
          const p5playSprite = p5playSpritesRef.current.get(persistentDragState.spriteId);
          if (p5playSprite && persistentDragState.hasMoved) {
            // Final position sync
            updateSpriteRef.current(persistentDragState.spriteId, {
              x: Math.round(p5playSprite.x),
              y: Math.round(p5playSprite.y)
            });
          }
          
          // Reset drag state
          persistentDragState.isDragging = false;
          persistentDragState.spriteId = null;
          persistentDragState.hasMoved = false;
        }
      };
    };

    // Create new q5.js instance with WebGPU support when available
    const initializeQ5 = async () => {
      try {
        // First try WebGPU for better performance (2-10x faster)
        console.log('🚀 Attempting WebGPU initialization with npm Q5...');
        if ((Q5 as any).WebGPU) {
          q5Instance.current = await (Q5 as any).WebGPU(sketch, canvasRef.current);
          console.log('✅ WebGPU initialized successfully with npm packages');
          setIsWebGPU(true);
            } else {
          throw new Error('Q5.WebGPU not available');
        }
      } catch (error) {
        // Fallback to regular Q5 if WebGPU is not supported
        console.warn('⚠️ WebGPU not supported, falling back to regular Q5:', error);
        try {
          console.log('🔄 Initializing regular Q5 with npm package...');
          q5Instance.current = new (Q5 as any)(sketch, canvasRef.current);
          console.log('✅ Regular Q5 initialized successfully with npm packages');
          setIsWebGPU(false);
        } catch (fallbackError) {
          console.error('❌ Failed to initialize Q5 with npm packages:', fallbackError);
          addDebugLog(0, `Canvas initialization failed: ${fallbackError}`, 'info');
        }
      }
    };
    
    initializeQ5();

    return () => {
      if (q5Instance.current) {
        q5Instance.current.remove();
        q5Instance.current = null;
      }
    };
  }, [resetCounter, librariesLoaded]);

  // Show loading state while libraries are loading
  if (loadingError) {
  return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-3 bg-red-50 border-b border-red-200">
          <div className="text-sm text-red-600">❌ Library Loading Error</div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">⚠️ Failed to Load Libraries</div>
            <p className="text-gray-600 mb-4">{loadingError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!librariesLoaded) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
          <div className="text-sm text-gray-600">Loading planck + p5play...</div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading physics engine and game framework...</p>
            <p className="mt-1 text-sm text-gray-500">Ensuring proper loading order...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
          <button
            onClick={toggleRunning}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isRunning 
              ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
          {isRunning ? 'Pause' : 'Run'}
          </button>
        
          <button
            onClick={resetCanvas}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded text-sm font-medium hover:bg-gray-600 transition-colors"
          >
          <RotateCcw size={16} />
          Reset
          </button>
        
        <div className="flex items-center gap-3 text-xs text-gray-600 ml-2">
          <div className="w-12 text-center">
            <span className="font-mono">{Math.round(q5Instance.current?.frameRate?.() || 0)}</span>
            <div className="text-gray-400">FPS</div>
        </div>
          <div className="w-16 text-center">
            <span className="font-mono">{debugFrameCount}</span>
            <div className="text-gray-400">Frame</div>
      </div>
          <div className="w-20 text-center">
            <span className="font-mono">({Math.round((window as any).globalMouseX || 0)},{Math.round((window as any).globalMouseY || 0)})</span>
            <div className="text-gray-400">Mouse</div>
            </div>
          <div className="w-16 text-center">
            <span className={`text-xs px-1 py-0.5 rounded ${isWebGPU ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {isWebGPU ? 'WebGPU' : 'Canvas'}
            </span>
            <div className="text-gray-400">Render</div>
          </div>
        </div>
        
        {debugInfo.currentAction && (
          <div className="text-sm text-blue-600 ml-4">
            Action: {debugInfo.currentAction} 
            {debugInfo.actionIndex !== undefined && ` (${debugInfo.actionIndex + 1})`}
            {debugInfo.isWaiting && debugInfo.waitUntilFrame && 
              ` - Waiting until frame ${debugInfo.waitUntilFrame}`
            }
          </div>
        )}
      </div>
      
      {/* Canvas and Debug Log */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center p-4 relative">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-full max-h-full">
            <div className="text-xs text-gray-500 text-center mb-2">
              {canvasSize.width}×{canvasSize.height} | Center (0,0)
            </div>
        <div 
          ref={canvasRef}
              className="block overflow-hidden"
              style={{ 
                width: canvasSize.width + 'px', 
                height: canvasSize.height + 'px',
                maxWidth: '100%',
                maxHeight: '100%',
                border: '1px solid #e5e7eb'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};