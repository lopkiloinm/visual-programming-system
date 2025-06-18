import { BlockInstance, FlowConnection } from '../types/blocks';

// Block dimensions - must match BlockWorkspace constants
const BASE_BLOCK_HEIGHT = 36;
const INPUT_HEIGHT_ADDITION = 4;
const BLOCK_GAP = 4;

// Helper function to calculate block height (same as BlockWorkspace)
const getBlockHeight = (block: BlockInstance) => {
  const hasInputs = block.inputs && block.inputs.length > 0;
  return BASE_BLOCK_HEIGHT + (hasInputs ? INPUT_HEIGHT_ADDITION : 0);
};



// Helper to check if a block is a drawing block
const isDrawingBlock = (blockId: string): boolean => {
  const drawingBlocks = [
    'draw_circle', 'set_fill', 'set_background', 'draw_rect', 
    'draw_circle_at', 'draw_sprite_circle', 'draw_trail'
  ];
  return drawingBlocks.includes(blockId);
};

// Helper to convert drawing code to use buffer
const convertToBufferedDrawing = (code: string): string => {
  // Convert direct drawing calls to buffered calls
  code = code.replace(/fill\(([^)]+)\);/g, 'addDrawCommand("fill", $1);');
  code = code.replace(/background\(([^)]+)\);/g, 'addDrawCommand("background", $1);');
  code = code.replace(/rect\(([^)]+)\);/g, 'addDrawCommand("rect", $1);');
  code = code.replace(/circle\(([^)]+)\);/g, 'addDrawCommand("circle", $1);');
  code = code.replace(/ellipse\(([^)]+)\);/g, 'addDrawCommand("ellipse", $1);');
  code = code.replace(/stroke\(([^)]+)\);/g, 'addDrawCommand("stroke", $1);');
  code = code.replace(/strokeWeight\(([^)]+)\);/g, 'addDrawCommand("strokeWeight", $1);');
  code = code.replace(/noStroke\(\);/g, 'addDrawCommand("noStroke");');
  
  return code;
};

// Simple sprite helper for direct p5play access
const applySpriteContextReplacement = (block: BlockInstance, code: string, spriteIndexMap: Map<string, number>): string => {
  if (block.workspaceType === 'stage') {
    // Stage blocks work with global canvas functions
    const spriteSpecificBlocks = ['move_sprite', 'set_sprite_position', 'move_to_mouse', 'change_sprite_color', 'change_sprite_size'];
    
    if (spriteSpecificBlocks.includes(block.id)) {
      return '// Sprite-specific block ignored in stage workspace';
    } else if (code.includes('sprites[0]')) {
      return code.replace(/sprites\[0\][^;]*;/g, '// Sprite reference removed for stage workspace;');
    }
    return code;
  } else if (block.workspaceType === 'sprite' && block.spriteId) {
    const spriteIndex = spriteIndexMap.get(block.spriteId);
    if (spriteIndex !== undefined) {
      // Fix moveTo calls to use p5play sprite directly
      let newCode = code.replace(/sprites\[0\]/g, `sprites[${spriteIndex}]`);
      newCode = newCode.replace(/sprites\[(\d+)\]\.moveTo\(([^)]+)\)/g, 'sprites[$1].p5playSprite.moveTo($2)');
      
      // Fix any remaining old mouse coordinate references
      newCode = newCode.replace(/\bmouseX\b/g, '(window.globalMouseX || 0)');
      newCode = newCode.replace(/\bmouseY\b/g, '(window.globalMouseY || 0)');
      
      return newCode;
    } else {
      return '// Sprite not found, block ignored';
    }
  }
  
  // For all blocks, fix old mouse coordinate references
  let fixedCode = code.replace(/\bmouseX\b/g, '(window.globalMouseX || 0)');
  fixedCode = fixedCode.replace(/\bmouseY\b/g, '(window.globalMouseY || 0)');
  
  // Convert drawing blocks to use buffer system for async contexts
  if (block.workspaceType === 'sprite' && isDrawingBlock(block.id)) {
    fixedCode = convertToBufferedDrawing(fixedCode);
  }
  
  return fixedCode;
};

// Async flowchart-based code generation with edge timing
export const generateCodeFromBlocks = (blocks: BlockInstance[], sprites: any[] = [], connections: FlowConnection[] = []): string => {
  let setupEventCode = '';
  let drawEventCode = '';
  let asyncFunctions = '';
  let eventFunctions = '';
  let asyncStartupCode = '';
  
  // Create sprite lookup maps
  const spriteIndexMap = new Map<string, number>();
  sprites.forEach((sprite, index) => {
    spriteIndexMap.set(sprite.id, index);
  });
  
  // Group blocks by workspace and event type
  const eventBlocks = blocks.filter(block => block.type === 'event');
  
  // Process each event block
  eventBlocks.forEach(eventBlock => {
    if (eventBlock.id === 'when_draw') {
      if (eventBlock.workspaceType === 'stage') {
        // Stage events still go in draw loop (background, stage effects, etc.)
        const flowchainCode = generateFlowchainCode(eventBlock, blocks, connections, spriteIndexMap);
        drawEventCode += flowchainCode;
      } else if (eventBlock.workspaceType === 'sprite' && eventBlock.spriteId) {
        // Sprite events become async functions that loop forever
        const asyncFunction = generateAsyncSpriteFunction(eventBlock, blocks, connections, spriteIndexMap);
        asyncFunctions += asyncFunction + '\n\n';
        
        // Add startup code to launch the async function
        const spriteIndex = spriteIndexMap.get(eventBlock.spriteId);
        asyncStartupCode += `  // Start async flowchart for ${eventBlock.spriteId}\n`;
        asyncStartupCode += `  startSpriteFlowchart_${eventBlock.instanceId}();\n\n`;
      }
    } else if (eventBlock.id === 'when_setup') {
      const flowchainCode = generateFlowchainCode(eventBlock, blocks, connections, spriteIndexMap);
      setupEventCode += flowchainCode;
    } else {
      // Other events (click, key press, etc.)
      const eventFunction = generateEventFunction(eventBlock, blocks, connections, spriteIndexMap);
      eventFunctions += eventFunction + '\n\n';
    }
  });

  // Generate sprite system
  let spriteVariables = '';
  let spriteSetup = '';
  let utilityFunctions = '';

  if (sprites.length > 0) {
    spriteVariables = generateSpriteVariables(sprites);
    spriteSetup = generateSpriteSetup(sprites);
    utilityFunctions = generateUtilityFunctions();
  }

  return `${spriteVariables}${utilityFunctions}function setup() {
  createCanvas(480, 360);
${spriteSetup}${setupEventCode}
${asyncStartupCode}}

function draw() {
  background(255);
  
  // Increment global frame counter
  globalFrameCount++;
  
${drawEventCode}
  // Execute buffered drawing commands from async flowcharts
  executeDrawBuffer();
  
  // p5play automatically handles sprite rendering and physics
}

${asyncFunctions}${eventFunctions}`.trim();
};

// Generate flowchain execution code from event block (simplified for sync events)
function generateFlowchainCode(
  eventBlock: BlockInstance, 
  allBlocks: BlockInstance[], 
  connections: FlowConnection[], 
  spriteIndexMap: Map<string, number>
): string {
  // Find all blocks connected to this event
  const connectedBlocks = findConnectedBlocks(eventBlock.instanceId, allBlocks, connections);
  
  if (connectedBlocks.length === 0) {
    return '';
  }

  // For sync events (setup, stage draw), just execute immediate chains
  let code = '';
  
  // Execute only immediate connections (waitFrames === 0)
  const immediateConnections = connections.filter(c => 
    c.sourceBlockId === eventBlock.instanceId && c.waitFrames === 0
  );
  
  immediateConnections.forEach(conn => {
    const targetBlock = allBlocks.find(b => b.instanceId === conn.targetBlockId);
    if (targetBlock) {
      code += '  ' + processBlockCode(targetBlock, spriteIndexMap, allBlocks, connections, new Set()) + '\n';
      // Continue following the immediate chain
      code += generateChainCode(targetBlock, allBlocks, connections, spriteIndexMap, '  ');
    }
  });

  return code;
}



// Find all blocks connected from a starting block
function findConnectedBlocks(
  startBlockId: string, 
  allBlocks: BlockInstance[], 
  connections: FlowConnection[]
): BlockInstance[] {
  const visited = new Set<string>();
  const connected: BlockInstance[] = [];
  
  function traverse(blockId: string) {
    if (visited.has(blockId)) return;
    visited.add(blockId);
    
    const block = allBlocks.find(b => b.instanceId === blockId);
    if (block) {
      connected.push(block);
    }
    
    // Find outgoing connections
    const outgoing = connections.filter(c => c.sourceBlockId === blockId);
    outgoing.forEach(conn => traverse(conn.targetBlockId));
  }
  
  // Start from connections leaving the start block
  const startConnections = connections.filter(c => c.sourceBlockId === startBlockId);
  startConnections.forEach(conn => traverse(conn.targetBlockId));
  
  return connected;
}

// Find blocks that should be execution states (not embedded in control flow)
function findExecutionStateBlocks(
  startBlockId: string, 
  allBlocks: BlockInstance[], 
  connections: FlowConnection[]
): BlockInstance[] {
  const visited = new Set<string>();
  const executionStates: BlockInstance[] = [];
  
  function traverse(blockId: string) {
    if (visited.has(blockId)) return;
    visited.add(blockId);
    
    const block = allBlocks.find(b => b.instanceId === blockId);
    if (!block) return;
    
    // Check if this is a control flow block
    const isControlFlow = block.labeledConnections && block.labeledConnections.outputs && 
                         block.labeledConnections.outputs.some(output => output.type === 'flow');
    
    if (isControlFlow) {
      // This is a control flow block - include it as an execution state
      executionStates.push(block);
      // Don't traverse into its flow outputs (they'll be handled inline)
      // But do traverse non-flow outputs if any
      const outgoing = connections.filter(c => c.sourceBlockId === blockId);
      outgoing.forEach(conn => {
        // Only traverse if it's not a flow connection
        if (!conn.sourceHandle || !conn.sourceHandle.startsWith('output-')) {
          traverse(conn.targetBlockId);
        }
      });
    } else {
      // Regular block - include it as an execution state
      executionStates.push(block);
      // Continue traversing
      const outgoing = connections.filter(c => c.sourceBlockId === blockId);
      outgoing.forEach(conn => traverse(conn.targetBlockId));
    }
  }
  
  // Start from connections leaving the start block
  const startConnections = connections.filter(c => c.sourceBlockId === startBlockId);
  startConnections.forEach(conn => traverse(conn.targetBlockId));
  
  return executionStates;
}



// Generate code for a chain of blocks (for simple linear execution)
function generateChainCode(
  currentBlock: BlockInstance,
  allBlocks: BlockInstance[],
  connections: FlowConnection[],
  spriteIndexMap: Map<string, number>,
  indent: string
): string {
  let code = '';
  
  const outgoingConnections = connections.filter(c => c.sourceBlockId === currentBlock.instanceId);
  
  outgoingConnections.forEach(conn => {
    const nextBlock = allBlocks.find(b => b.instanceId === conn.targetBlockId);
    if (!nextBlock) return;
    
    if (conn.waitFrames === 0) {
      // Immediate execution
      let blockCode = processBlockCode(nextBlock, spriteIndexMap, allBlocks, connections, new Set());
      
      // Apply drawing buffer transformation for sprite contexts
      if (nextBlock.workspaceType === 'sprite') {
        blockCode = convertToBufferedDrawing(blockCode);
      }
      
      code += indent + blockCode + '\n';
      code += generateChainCode(nextBlock, allBlocks, connections, spriteIndexMap, indent);
    } else {
      // Wait required - end chain here (will be handled by flowchart execution)
      return;
    }
  });
  
  return code;
}

// Helper function to get safe placeholder values for incomplete connections
function getSafePlaceholder(type: 'boolean' | 'number' | 'flow' | string, label: string): string {
  switch (type) {
    case 'boolean':
      return 'true'; // Safe default for boolean operations
    case 'number':
      return '0'; // Safe default for math operations
    case 'flow':
      return `/* ${label} not connected */`; // Safe comment for flow operations
    default:
      return `/* ${label} */`; // Generic safe comment
  }
}

// Process individual block code with input substitution and labeled connections
function processBlockCode(
  block: BlockInstance, 
  spriteIndexMap: Map<string, number>,
  allBlocks?: BlockInstance[],
  connections?: FlowConnection[],
  processingStack?: Set<string>
): string {
    // Prevent infinite recursion by tracking which blocks are currently being processed
    if (!processingStack) {
      processingStack = new Set<string>();
    }
    
    if (processingStack.has(block.instanceId)) {
      // Circular reference detected - return simple code without recursion
      console.warn(`Circular reference detected for block ${block.instanceId}, using simple code`);
      let code = block.code;
      
      // Only handle basic input substitution without recursive labeled connections
      if (block.inputs && block.values) {
        block.inputs.forEach(input => {
          const value = block.values![input.name] ?? input.defaultValue;
          const placeholder = `\${${input.name}}`;
          
          if (input.type === 'text') {
            code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
          } else {
            code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
          }
        });
      }
      
      return applySpriteContextReplacement(block, code, spriteIndexMap);
    }
    
    // Add this block to the processing stack
    processingStack.add(block.instanceId);
    let code = block.code;
    
    // Replace input placeholders with actual values
    if (block.inputs && block.values) {
      block.inputs.forEach(input => {
        const value = block.values![input.name] ?? input.defaultValue;
        const placeholder = `\${${input.name}}`;
        
        if (input.type === 'text') {
          code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        } else {
          code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
        }
      });
    }
    
    // Handle labeled connections if we have the necessary data
    if (block.labeledConnections && allBlocks && connections) {
      // Handle labeled input connections (like condition inputs)
      if (block.labeledConnections.inputs) {
        block.labeledConnections.inputs.forEach((input, index) => {
          const placeholder = `\${${input.label}}`;
          const handleId = `input-${index}`;
          
          try {
            // Find connection coming into this input
            const incomingConnection = connections.find(conn => 
              conn.targetBlockId === block.instanceId && 
              conn.targetHandle === handleId
            );
            
            if (incomingConnection) {
              const sourceBlock = allBlocks.find(b => b.instanceId === incomingConnection.sourceBlockId);
              if (sourceBlock && !processingStack.has(sourceBlock.instanceId)) {
                const sourceCode = processBlockCode(sourceBlock, spriteIndexMap, allBlocks, connections, processingStack);
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), sourceCode);
              } else {
                // Source block is being processed or doesn't exist, use safe placeholder
                const safeValue = getSafePlaceholder(input.type, input.label);
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
              }
            } else {
              // No connection, use safe placeholder based on type
              const safeValue = getSafePlaceholder(input.type, input.label);
              code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
            }
          } catch (error) {
            // Error in processing, use safe fallback
            console.warn(`Error processing input ${input.label} for block ${block.instanceId}:`, error);
            const safeValue = getSafePlaceholder(input.type, input.label);
            code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
                  }
                });
              }
              
      // Handle labeled output connections (like do, then, else outputs)
      if (block.labeledConnections.outputs) {
        block.labeledConnections.outputs.forEach((output, index) => {
          const placeholder = `\${${output.label}}`;
          const handleId = `output-${index}`;
          
          try {
            // Find connections going out from this output
            const outgoingConnections = connections.filter(conn => 
              conn.sourceBlockId === block.instanceId && 
              conn.sourceHandle === handleId
            );
            
            if (outgoingConnections.length > 0) {
              let outputCode = '';
              let hasValidConnections = false;
              
              outgoingConnections.forEach(conn => {
                const targetBlock = allBlocks.find(b => b.instanceId === conn.targetBlockId);
                if (targetBlock && !processingStack.has(targetBlock.instanceId)) {
                  try {
                    let targetCode = processBlockCode(targetBlock, spriteIndexMap, allBlocks, connections, processingStack);
                    
                    // Apply drawing buffer transformation for sprite contexts
                    if (targetBlock.workspaceType === 'sprite') {
                      targetCode = convertToBufferedDrawing(targetCode);
                    }
                    
                    outputCode += targetCode + '\n    ';
                    hasValidConnections = true;
                    
                    // Continue following the chain from this block (but safely)
                    const chainCode = generateChainCode(targetBlock, allBlocks, connections, spriteIndexMap, '    ');
                    outputCode += chainCode;
                  } catch (error) {
                    console.warn(`Error processing target block ${targetBlock.instanceId}:`, error);
                  }
                }
              });
              
              if (hasValidConnections) {
                // Remove trailing whitespace and newlines
                outputCode = outputCode.trim();
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), outputCode);
              } else {
                // No valid connections, use safe placeholder
                const safeValue = getSafePlaceholder(output.type, output.label);
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
              }
            } else {
              // No connections, use safe placeholder
              const safeValue = getSafePlaceholder(output.type, output.label);
              code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
            }
          } catch (error) {
            // Error in processing, use safe fallback
            console.warn(`Error processing output ${output.label} for block ${block.instanceId}:`, error);
            const safeValue = getSafePlaceholder(output.type, output.label);
            code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
          }
        });
      }
    }
    
    // Remove this block from the processing stack before returning
    processingStack.delete(block.instanceId);
    
    return applySpriteContextReplacement(block, code, spriteIndexMap);
}

// Generate async sprite function that loops forever
function generateAsyncSpriteFunction(
  eventBlock: BlockInstance,
  allBlocks: BlockInstance[],
  connections: FlowConnection[],
  spriteIndexMap: Map<string, number>
): string {
  const functionName = `startSpriteFlowchart_${eventBlock.instanceId}`;
  const spriteIndex = spriteIndexMap.get(eventBlock.spriteId!);
  
  let code = `// Async flowchart function for ${eventBlock.spriteId}\n`;
  code += `async function ${functionName}() {\n`;
  code += `  const spriteIndex = ${spriteIndex};\n`;
  code += `  \n`;
  code += `  while (true) {\n`;
  code += `    try {\n`;
  
  // Generate the flowchart execution code
  const flowchartCode = generateAsyncFlowchartCode(eventBlock, allBlocks, connections, spriteIndexMap);
  code += flowchartCode;
  
  code += `    } catch (error) {\n`;
  code += `      console.error('Sprite flowchart error:', error);\n`;
  code += `      await waitFrames(60); // Wait 1 second before retrying\n`;
  code += `    }\n`;
  code += `  }\n`;
  code += `}\n`;
  
  return code;
}

// Generate simple linear code execution
function generateAsyncFlowchartCode(
  eventBlock: BlockInstance,
  allBlocks: BlockInstance[],
  connections: FlowConnection[],
  spriteIndexMap: Map<string, number>
): string {
  let code = `    // Execute blocks in sequence\n`;
  
  // Find the linear sequence starting from the event block
  const sequence = buildLinearSequence(eventBlock, allBlocks, connections);
  
  for (const block of sequence) {
    let blockCode = processBlockCode(block, spriteIndexMap, allBlocks, connections, new Set());
    blockCode = convertToBufferedDrawing(blockCode);
    code += `    ${blockCode}\n`;
  }
  
  code += `    await waitFrames(1); // Small delay before next iteration\n`;
  
  return code;
}

// Build a linear sequence of blocks to execute
function buildLinearSequence(
  startBlock: BlockInstance,
  allBlocks: BlockInstance[],
  connections: FlowConnection[]
): BlockInstance[] {
  const sequence: BlockInstance[] = [];
  const visited = new Set<string>();
  
  function addToSequence(block: BlockInstance) {
    if (visited.has(block.instanceId)) return;
    visited.add(block.instanceId);
    
    // Don't add the event block to the sequence
    if (block.type !== 'event') {
      sequence.push(block);
    }
    
    // Find sequential flow connections (not control flow branches)
    const sequentialConnections = connections.filter(c => 
      c.sourceBlockId === block.instanceId && 
      c.waitFrames === 0 &&
      // Skip control flow branches (output-0, output-1) but include sequential flow (bottom, output)
      (!c.sourceHandle?.startsWith('output-') || c.sourceHandle === 'output' || c.sourceHandle === 'bottom')
    );
    
    // Follow the sequential connections
    sequentialConnections.forEach(conn => {
      const nextBlock = allBlocks.find(b => b.instanceId === conn.targetBlockId);
      if (nextBlock) {
        addToSequence(nextBlock);
      }
    });
  }
  
  addToSequence(startBlock);
  return sequence;
}

// Generate utility functions for frame waiting
function generateUtilityFunctions(): string {
  return `// Frame waiting utility for async functions
function waitFrames(frames) {
  return new Promise(resolve => {
    const targetFrame = globalFrameCount + frames;
    function checkFrame() {
      if (globalFrameCount >= targetFrame) {
        resolve();
      } else {
        requestAnimationFrame(checkFrame);
      }
    }
    checkFrame();
  });
}

`;
}

// Generate event function for click, key press, etc.
function generateEventFunction(
  eventBlock: BlockInstance,
  allBlocks: BlockInstance[],
  connections: FlowConnection[],
  spriteIndexMap: Map<string, number>
): string {
  const functionName = `handle_${eventBlock.id}_${eventBlock.instanceId}`;
  const flowchainCode = generateFlowchainCode(eventBlock, allBlocks, connections, spriteIndexMap);
  
  let code = `function ${functionName}() {\n`;
  code += flowchainCode;
  code += `}`;
  
  // Add event listener setup
  if (eventBlock.id === 'when_clicked') {
    code += `\n\n// Auto-setup click listener\nif (typeof mousePressed === 'undefined') {\n  function mousePressed() {\n    ${functionName}();\n  }\n}`;
  }
  
  return code;
}

// Generate sprite variables
function generateSpriteVariables(sprites: any[]): string {
  let code = `// q5.js + p5play Flowchart Sprite System
// Global frame counter for timing
let globalFrameCount = 0;

// Global mouse position for async functions
let mouseX = 0;
let mouseY = 0;

// Drawing buffer for async-to-sync drawing coordination
let drawingBuffer = [];

// p5play sprites array - automatically managed by p5play
let sprites = [`;

  sprites.forEach((sprite, index) => {
    code += `
{
    id: "${sprite.id}",
    name: "${sprite.name}",
    x: ${sprite.x},
    y: ${sprite.y},
    size: ${sprite.size || 30},
  w: ${sprite.size || 30},
  h: ${sprite.size || 30},
    color: "${sprite.color || '#ff6b6b'}",
  visible: ${sprite.visible !== false}
}`;
    
    if (index < sprites.length - 1) {
      code += ',';
    }
  });

  code += `
];

// Simple sprite helper functions
function getSpriteById(id) {
  return sprites.find(sprite => sprite.id === id);
}

function updateSprite(id, updates) {
  const sprite = getSpriteById(id);
  if (sprite) {
    Object.assign(sprite, updates);
    // Sync with p5play sprite if it exists
    if (sprite.p5playSprite) {
      if (updates.x !== undefined) sprite.p5playSprite.x = updates.x;
      if (updates.y !== undefined) sprite.p5playSprite.y = updates.y;
      if (updates.size !== undefined) { 
        sprite.p5playSprite.w = updates.size; 
        sprite.p5playSprite.h = updates.size; 
      }
      if (updates.color !== undefined) sprite.p5playSprite.color = updates.color;
      if (updates.visible !== undefined) sprite.p5playSprite.visible = updates.visible;
      if (updates.opacity !== undefined) sprite.p5playSprite.opacity = updates.opacity;
      if (updates.scale !== undefined) sprite.p5playSprite.scale = updates.scale;
      if (updates.tint !== undefined) sprite.p5playSprite.tint = updates.tint;
      if (updates.rotation !== undefined) sprite.p5playSprite.rotation = updates.rotation;
    }
  }
}

// Enhanced debug logging for q5.js + p5play
function addDebugLog(frame, message, type) {
  console.log(\`[q5+p5play] Frame \${frame}: \${message}\`);
}

// Drawing buffer management functions
function addDrawCommand(command, ...args) {
  drawingBuffer.push({ command, args });
}

function executeDrawBuffer() {
  drawingBuffer.forEach(({ command, args }) => {
    // Execute the command using the global drawing functions
    try {
      switch (command) {
        case 'fill':
          fill(...args);
          break;
        case 'background':
          background(...args);
          break;
        case 'rect':
          rect(...args);
          break;
        case 'circle':
          circle(...args);
          break;
        case 'ellipse':
          ellipse(...args);
          break;
        case 'stroke':
          stroke(...args);
          break;
        case 'strokeWeight':
          strokeWeight(...args);
          break;
        case 'noStroke':
          noStroke();
          break;
        default:
          console.warn(\`Unknown drawing command: \${command}\`);
      }
    } catch (error) {
      console.warn(\`Failed to execute drawing command: \${command}\`, error);
    }
  });
  drawingBuffer = []; // Clear buffer after execution
}
`;

  return code;
}
    
    // Generate sprite setup code
function generateSpriteSetup(sprites: any[]): string {
  let code = '  // Initialize q5.js + p5play sprite system\n';
  code += '  // Disable gravity by default (can be enabled via blocks)\n';
  code += '  if (typeof world !== "undefined") world.gravity.y = 0;\n\n';

    sprites.forEach((sprite, index) => {
    code += `  // Initialize ${sprite.name} with p5play integration\n`;
    code += `  sprites[${index}].p5playSprite = new Sprite();\n`;
    code += `  sprites[${index}].p5playSprite.x = ${sprite.x};\n`;
    code += `  sprites[${index}].p5playSprite.y = ${sprite.y};\n`;
    code += `  sprites[${index}].p5playSprite.w = ${sprite.size || 30};\n`;
    code += `  sprites[${index}].p5playSprite.h = ${sprite.size || 30};\n`;
    code += `  sprites[${index}].p5playSprite.color = "${sprite.color || '#ff6b6b'}";\n`;
    code += `  sprites[${index}].p5playSprite.visible = ${sprite.visible !== false};\n`;
    code += `  sprites[${index}].p5playSprite.collider = 'none'; // Disable physics by default\n`;
    code += `  sprites[${index}].p5playSprite.spriteId = "${sprite.id}";\n\n`;
  });

  code += '  // Sync sprite data with p5play sprites\n';
  code += '  sprites.forEach((sprite, index) => {\n';
  code += '    if (sprite.p5playSprite) {\n';
  code += '      sprite.x = sprite.p5playSprite.x;\n';
  code += '      sprite.y = sprite.p5playSprite.y;\n';
  code += '    }\n';
  code += '  });\n\n';

  return code;
}
    
    