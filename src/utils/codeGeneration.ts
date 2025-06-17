import { BlockInstance } from '../types/blocks';

// Block dimensions - must match BlockWorkspace constants
const BASE_BLOCK_HEIGHT = 36;
const INPUT_HEIGHT_ADDITION = 4;
const BLOCK_GAP = 4;

// Helper function to calculate block height (same as BlockWorkspace)
const getBlockHeight = (block: BlockInstance) => {
  const hasInputs = block.inputs && block.inputs.length > 0;
  return BASE_BLOCK_HEIGHT + (hasInputs ? INPUT_HEIGHT_ADDITION : 0);
};

// Helper function to find connected blocks using pixel-perfect detection
const findConnectedBlocks = (startBlock: BlockInstance, allBlocks: BlockInstance[]): BlockInstance[] => {
  if (!startBlock.position) return [startBlock];
  
  const connected = [startBlock];
  const visited = new Set([startBlock.instanceId]);
  
  const findBlocksBelow = (block: BlockInstance): void => {
    if (!block.position) return;
    
    const blockHeight = getBlockHeight(block);
    const expectedY = block.position.y + blockHeight + BLOCK_GAP;
    
    allBlocks.forEach(otherBlock => {
      if (visited.has(otherBlock.instanceId) || !otherBlock.position || !block.position) return;
      
      // Pixel-perfect connection detection
      const isDirectlyBelow = otherBlock.position.x === block.position.x && // Must be exactly aligned
                             otherBlock.position.y === expectedY; // Must be exactly touching
      
      if (isDirectlyBelow) {
        connected.push(otherBlock);
        visited.add(otherBlock.instanceId);
        findBlocksBelow(otherBlock); // Recursively find more connected blocks
      }
    });
  };
  
  // First, find blocks that are indented (snapped to the right) if this is an event block
  if (startBlock.type === 'event') {
    allBlocks.forEach(otherBlock => {
      if (visited.has(otherBlock.instanceId) || !otherBlock.position || !startBlock.position) return;
      
      // Check for indented blocks (exactly 15px to the right and same Y level)
      const isIndented = otherBlock.position.x === (startBlock.position.x + 15) && // Exactly 15px indent
                        otherBlock.position.y === startBlock.position.y; // Exact same Y level
      
      if (isIndented) {
        connected.push(otherBlock);
        visited.add(otherBlock.instanceId);
        // Now find any blocks connected below this indented block
        findBlocksBelow(otherBlock);
      }
    });
  }
  
  // Also find blocks directly below the start block
  findBlocksBelow(startBlock);
  return connected;
};

// Helper function to apply context-aware sprite reference replacement
const applySpriteContextReplacement = (block: BlockInstance, code: string, spriteIndexMap: Map<string, number>): string => {
  if (block.workspaceType === 'stage') {
    // Stage blocks should work with global canvas functions
    // Only filter out sprite-specific blocks
    const spriteSpecificBlocks = ['move_sprite', 'set_sprite_position', 'move_to_mouse', 'change_sprite_color', 'change_sprite_size', 'draw_sprite_circle', 'wait_frames'];
    
    if (spriteSpecificBlocks.includes(block.id)) {
      console.log(`Ignoring sprite-specific block "${block.id}" in stage workspace`);
      return '// Sprite-specific block ignored in stage workspace';
    } else if (code.includes('sprites[0]')) {
      // Replace any remaining sprite references with comments
      console.log(`Removing sprite references from "${block.id}" in stage workspace`);
      return code.replace(/sprites\[0\][^;]*;/g, '// Sprite reference removed for stage workspace;');
    }
    // Stage-appropriate blocks (background, circle, rect, fill, etc.) pass through unchanged
    return code;
  } else if (block.workspaceType === 'sprite' && block.spriteId) {
    // Sprite blocks should affect their specific sprite
    const spriteIndex = spriteIndexMap.get(block.spriteId);
    if (spriteIndex !== undefined) {
      // Replace sprites[0] with the correct sprite index
      const oldCode = code;
      const newCode = code.replace(/sprites\[0\]/g, `sprites[${spriteIndex}]`);
      if (oldCode !== newCode) {
        console.log(`🔄 Sprite index replacement for "${block.id}" on sprite ${block.spriteId}:`);
        console.log(`   Before: ${oldCode}`);
        console.log(`   After:  ${newCode}`);
        console.log(`   Sprite index: ${spriteIndex}`);
      }
      return newCode;
    } else {
      console.log(`Sprite ${block.spriteId} not found, ignoring block`);
      return '// Sprite not found, block ignored';
    }
  }
  
  return code;
};

export const generateCodeFromBlocks = (blocks: BlockInstance[], sprites: any[] = []): string => {
  let spriteCode = new Map<string, string>();
  let eventCode = '';
  let drawEventCode = ''; // For "when draw" events on stage
  let spriteDrawEventCode = new Map<string, string>(); // For "when draw" events on sprites
  let setupEventCode = ''; // For "when setup" events on stage
  let spriteSetupEventCode = new Map<string, string>(); // For "when setup" events on sprites
  
  // Sort blocks by position for proper execution order
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (!a.position || !b.position) return 0;
    if (Math.abs(a.position.y - b.position.y) < 10) {
      return a.position.x - b.position.x;
    }
    return a.position.y - b.position.y;
  });
  
  // Keep track of blocks that are children of events
  const eventChildBlocks = new Set<string>();
  
  // Create sprite lookup maps for efficiency
  const spriteIndexMap = new Map<string, number>();
  sprites.forEach((sprite, index) => {
    spriteIndexMap.set(sprite.id, index);
  });
  
  // Debug: Log sprite index mapping
  console.log('🗺️ Sprite Index Map:');
  spriteIndexMap.forEach((index, spriteId) => {
    console.log(`   ${spriteId} → index ${index}`);
  });
  
  // First pass: identify all event blocks and their children
  sortedBlocks.forEach(block => {
    if (block.type === 'event') {
      // Find child blocks using pixel-perfect connection detection
      const connectedBlocks = findConnectedBlocks(block, sortedBlocks);
      const childBlocks = connectedBlocks.filter(b => b.instanceId !== block.instanceId);
      
      // Mark these blocks as event children
      childBlocks.forEach(childBlock => {
        eventChildBlocks.add(childBlock.instanceId);
      });
      
      console.log(`🎯 Event "${block.id}" has ${childBlocks.length} pixel-perfect connected children:`, 
                  childBlocks.map(b => b.id));
    }
  });
  
  // Process each block
  sortedBlocks.forEach(block => {
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
    
    // Context-aware sprite reference replacement
    code = applySpriteContextReplacement(block, code, spriteIndexMap);
    
    if (block.type === 'event') {
      // Find child blocks using pixel-perfect connection detection
      const connectedBlocks = findConnectedBlocks(block, sortedBlocks);
      const childBlocks = connectedBlocks.filter(b => b.instanceId !== block.instanceId);
      
      if (childBlocks.length === 0) {
        // No child blocks, just process the event
        if (block.id === 'when_draw') {
          // Empty draw event
        } else if (block.id === 'when_setup') {
          // Empty setup event
        } else {
          code = code.replace('${content}', '');
          eventCode += code + '\n\n';
        }
        return;
      }
      
      // Generate frame-based sequencing for chained blocks
      let childCode = '';
      
      if (childBlocks.length === 1) {
        // Single block - no sequencing needed
        const childBlock = childBlocks[0];
        let childCodeStr = childBlock.code;
        
        // Process child block inputs and context
        if (childBlock.inputs && childBlock.values) {
          childBlock.inputs.forEach(input => {
            const value = childBlock.values![input.name] ?? input.defaultValue;
            const placeholder = `\${${input.name}}`;
            
            if (input.type === 'text') {
              childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
            } else {
              childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
            }
          });
        }
        
        // Apply context-aware sprite reference replacement
        childCodeStr = applySpriteContextReplacement(childBlock, childCodeStr, spriteIndexMap);
        
        childCode = '  ' + childCodeStr + '\n';
      } else {
        // Multiple blocks - use Action Queue State Machine
        console.log(`🎬 Generating action queue for ${childBlocks.length} chained blocks:`, 
                    childBlocks.map(b => b.id));
        
        if (block.workspaceType === 'sprite' && block.spriteId) {
          const spriteIndex = spriteIndexMap.get(block.spriteId);
          if (spriteIndex !== undefined) {
            // Build action queue with explicit actions
            const actions = childBlocks.map((childBlock, index) => {
              let childCodeStr = childBlock.code;
              
              // Process child block inputs and context
              if (childBlock.inputs && childBlock.values) {
                childBlock.inputs.forEach(input => {
                  const value = childBlock.values![input.name] ?? input.defaultValue;
                  const placeholder = `\${${input.name}}`;
                  
                  if (input.type === 'text') {
                    childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
                  } else {
                    childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
                  }
                });
              }
              
              // Apply context-aware sprite reference replacement
              childCodeStr = applySpriteContextReplacement(childBlock, childCodeStr, spriteIndexMap);
              
              return {
                id: childBlock.id,
                code: childCodeStr,
                index: index
              };
            });
            
            childCode += `  // Action Queue State Machine for ${childBlocks.length} actions\n`;
            childCode += `  const sprite = sprites[${spriteIndex}];\n`;
            childCode += `  \n`;
            childCode += `  // Create hash of action content to detect changes\n`;
            childCode += `  const actionHash = '${JSON.stringify(actions).replace(/'/g, "\\'")}'; \n`;
            childCode += `  \n`;
            childCode += `  // Initialize action queue if needed (checks both length AND content)\n`;
            childCode += `  if (!sprite.actionQueue || sprite.actionQueue.length !== ${childBlocks.length} || JSON.stringify(sprite.actionQueue) !== actionHash) {\n`;
            childCode += `    sprite.actionQueue = ${JSON.stringify(actions)};\n`;
            childCode += `    sprite.currentActionIndex = 0;\n`;
            childCode += `    sprite.actionState = 'ready';\n`;
            childCode += `    sprite.waitUntilFrame = 0; // Clear any existing wait state when refreshing action queue\n`;
            childCode += `    if (typeof addDebugLog === 'function') {\n`;
            childCode += `      addDebugLog(globalFrameCount, '🔄 Initialized action queue with ${childBlocks.length} actions:', 'info');\n`;
            childCode += `      sprite.actionQueue.forEach((action, i) => {\n`;
            childCode += `        addDebugLog(globalFrameCount, '  Action ' + i + ': ' + action.id + ' | Code: ' + action.code, 'info');\n`;
            childCode += `      });\n`;
            childCode += `    }\n`;
            childCode += `  }\n`;
            childCode += `  \n`;
            childCode += `  // Robust action execution: Always try to execute actions first\n`;
            childCode += `  // Only skip execution if we're in a wait state from a PREVIOUS action\n`;
            childCode += `  \n`;
            childCode += `  // Check if sprite is currently waiting from a previous action\n`;
            childCode += `  let isCurrentlyWaiting = sprite.waitUntilFrame > 0 && globalFrameCount < sprite.waitUntilFrame;\n`;
            childCode += `  \n`;
            childCode += `  // Debug: Log current state at start of frame\n`;
            childCode += `  if (typeof addDebugLog === 'function' && globalFrameCount % 30 === 0) {\n`;
            childCode += `    addDebugLog(globalFrameCount, '🔍 Frame state: actionIndex=' + sprite.currentActionIndex + ', waitUntilFrame=' + sprite.waitUntilFrame + ', isWaiting=' + isCurrentlyWaiting, 'info');\n`;
            childCode += `  }\n`;
            childCode += `  \n`;
            childCode += `  // If wait period is complete, advance to next action and clear wait\n`;
            childCode += `  if (sprite.waitUntilFrame > 0 && globalFrameCount >= sprite.waitUntilFrame) {\n`;
            childCode += `    if (typeof addDebugLog === 'function') {\n`;
            childCode += `      addDebugLog(globalFrameCount, '🔍 Wait completion detected: currentActionIndex=' + sprite.currentActionIndex + ', waitUntilFrame=' + sprite.waitUntilFrame, 'wait');\n`;
            childCode += `    }\n`;
            childCode += `    \n`;
            childCode += `    sprite.waitUntilFrame = 0;\n`;
            childCode += `    sprite.currentActionIndex++;\n`;
            childCode += `    \n`;
            childCode += `    if (typeof addDebugLog === 'function') {\n`;
            childCode += `      addDebugLog(globalFrameCount, '⏰ Wait completed! Advanced to action ' + sprite.currentActionIndex, 'wait');\n`;
            childCode += `    }\n`;
            childCode += `    \n`;
            childCode += `    // Check if we've completed all actions after advancing\n`;
            childCode += `    if (sprite.currentActionIndex >= sprite.actionQueue.length) {\n`;
            childCode += `      sprite.currentActionIndex = 0; // Loop back to start\n`;
            childCode += `      if (typeof addDebugLog === 'function') {\n`;
            childCode += `        addDebugLog(globalFrameCount, '🔄 Queue completed after wait, wrapped to action 0', 'info');\n`;
            childCode += `      }\n`;
            childCode += `    }\n`;
            childCode += `    \n`;
            childCode += `    if (typeof addDebugLog === 'function') {\n`;
            childCode += `      addDebugLog(globalFrameCount, '✅ Final action index after wait completion: ' + sprite.currentActionIndex, 'wait');\n`;
            childCode += `    }\n`;
            childCode += `    \n`;
            childCode += `    // Now that wait is complete and we've advanced, we can execute the new action\n`;
            childCode += `    isCurrentlyWaiting = false;\n`;
            childCode += `  }\n`;
            childCode += `  \n`;
            childCode += `  // Execute current action if ready (unless we're waiting from a previous action)\n`;
            childCode += `  if (!isCurrentlyWaiting && sprite.actionState === 'ready' && sprite.currentActionIndex < sprite.actionQueue.length) {\n`;
            childCode += `    const currentAction = sprite.actionQueue[sprite.currentActionIndex];\n`;
            childCode += `    \n`;
            childCode += `    // Debug: Log what we're about to execute\n`;
            childCode += `    if (typeof addDebugLog === 'function') {\n`;
            childCode += `      addDebugLog(globalFrameCount, '🔍 About to execute: actionIndex=' + sprite.currentActionIndex + ', actionId=' + currentAction.id, 'action');\n`;
            childCode += `      addDebugLog(globalFrameCount, '🎬 Executing Action ' + sprite.currentActionIndex + ': ' + currentAction.id, 'action');\n`;
            childCode += `      addDebugLog(globalFrameCount, '📝 Code: ' + currentAction.code, 'info');\n`;
            childCode += `    }\n`;
            childCode += `    \n`;
            childCode += `    // Store previous waitUntilFrame to detect if action sets a wait\n`;
            childCode += `    const previousWaitUntilFrame = sprite.waitUntilFrame;\n`;
            childCode += `    \n`;
            childCode += `    // EXECUTE THE ACTION FIRST - this is the robust approach\n`;
            childCode += `    eval(currentAction.code);\n`;
            childCode += `    \n`;
            childCode += `    // After execution, check if this action set a wait state\n`;
            childCode += `    if (sprite.waitUntilFrame > previousWaitUntilFrame) {\n`;
            childCode += `      // Action set a wait state - log it\n`;
            childCode += `      if (typeof addDebugLog === 'function') {\n`;
            childCode += `        addDebugLog(globalFrameCount, '⏳ Wait set until frame ' + sprite.waitUntilFrame + ' (pausing queue)', 'wait');\n`;
            childCode += `      }\n`;
            childCode += `      // DON'T advance to next action - let the wait complete first\n`;
            childCode += `      // The action has executed, now we wait before the next one\n`;
            childCode += `    } else {\n`;
            childCode += `      // Normal action completed without setting wait, move to next action immediately\n`;
            childCode += `      sprite.currentActionIndex++;\n`;
            childCode += `      if (typeof addDebugLog === 'function') {\n`;
            childCode += `        addDebugLog(globalFrameCount, '✅ Action completed, advancing to action ' + sprite.currentActionIndex, 'info');\n`;
            childCode += `      }\n`;
            childCode += `      \n`;
            childCode += `      // Check if we've completed all actions\n`;
            childCode += `      if (sprite.currentActionIndex >= sprite.actionQueue.length) {\n`;
            childCode += `        sprite.currentActionIndex = 0; // Loop back to start\n`;
            childCode += `        if (typeof addDebugLog === 'function') {\n`;
            childCode += `          addDebugLog(globalFrameCount, '🔄 Queue completed, restarting from action 0', 'info');\n`;
            childCode += `        }\n`;
            childCode += `      }\n`;
            childCode += `    }\n`;
            childCode += `  } else if (isCurrentlyWaiting) {\n`;
            childCode += `    // Log waiting status (only every 30 frames to avoid spam)\n`;
            childCode += `    if (globalFrameCount % 30 === 0 && typeof addDebugLog === 'function') {\n`;
            childCode += `      const framesLeft = sprite.waitUntilFrame - globalFrameCount;\n`;
            childCode += `      addDebugLog(globalFrameCount, '💤 WAITING: ' + framesLeft + ' frames left (until frame ' + sprite.waitUntilFrame + ')', 'wait');\n`;
            childCode += `    }\n`;
            childCode += `  } else {\n`;
            childCode += `    // Debug: Log when no action executes\n`;
            childCode += `    if (typeof addDebugLog === 'function' && globalFrameCount % 30 === 0) {\n`;
            childCode += `      addDebugLog(globalFrameCount, '🔍 No action executing: isWaiting=' + isCurrentlyWaiting + ', actionState=' + sprite.actionState + ', actionIndex=' + sprite.currentActionIndex + '/' + sprite.actionQueue.length, 'info');\n`;
            childCode += `    }\n`;
            childCode += `  }\n`;
            childCode += `  \n`;
          } else {
            // Fallback for stage or unknown sprite - use simple iteration
            childCode += `  // Stage action sequence for ${childBlocks.length} blocks\n`;
            childCode += `  const actionIndex = globalFrameCount % ${childBlocks.length};\n`;
            childCode += `  \n`;
            
            childBlocks.forEach((childBlock, index) => {
              let childCodeStr = childBlock.code;
              
              // Process child block inputs and context
              if (childBlock.inputs && childBlock.values) {
                childBlock.inputs.forEach(input => {
                  const value = childBlock.values![input.name] ?? input.defaultValue;
                  const placeholder = `\${${input.name}}`;
                  
                  if (input.type === 'text') {
                    childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
                  } else {
                    childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
                  }
                });
              }
              
              // Apply context-aware sprite reference replacement
              childCodeStr = applySpriteContextReplacement(childBlock, childCodeStr, spriteIndexMap);
              
              if (index === 0) {
                childCode += `  if (actionIndex === ${index}) {\n`;
              } else {
                childCode += `  } else if (actionIndex === ${index}) {\n`;
              }
              childCode += `    // Execute: ${childBlock.id}\n`;
              childCode += `    ${childCodeStr}\n`;
            });
            
            childCode += `  }\n`;
          }
        } else {
          // Stage blocks use simple iteration
          childCode += `  // Stage action sequence for ${childBlocks.length} blocks\n`;
          childCode += `  const actionIndex = globalFrameCount % ${childBlocks.length};\n`;
          childCode += `  \n`;
          
          childBlocks.forEach((childBlock, index) => {
            let childCodeStr = childBlock.code;
            
            // Process child block inputs and context
            if (childBlock.inputs && childBlock.values) {
              childBlock.inputs.forEach(input => {
                const value = childBlock.values![input.name] ?? input.defaultValue;
                const placeholder = `\${${input.name}}`;
                
                if (input.type === 'text') {
                  childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
                } else {
                  childCodeStr = childCodeStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
                }
              });
            }
            
            if (index === 0) {
              childCode += `  if (actionIndex === ${index}) {\n`;
            } else {
              childCode += `  } else if (actionIndex === ${index}) {\n`;
            }
            childCode += `    // Execute: ${childBlock.id}\n`;
            childCode += `    ${childCodeStr}\n`;
          });
          
          childCode += `  }\n`;
        }
        
        childCode += `\n`;
      }
      
      // Handle different event types
      if (block.id === 'when_draw') {
        // "when draw" events go directly into draw functions
        if (block.workspaceType === 'stage') {
          drawEventCode += childCode;
        } else if (block.workspaceType === 'sprite' && block.spriteId) {
          const existing = spriteDrawEventCode.get(block.spriteId) || '';
          spriteDrawEventCode.set(block.spriteId, existing + childCode);
        }
      } else if (block.id === 'when_setup') {
        // "when setup" events go into setup functions
        if (block.workspaceType === 'stage') {
          setupEventCode += childCode;
        } else if (block.workspaceType === 'sprite' && block.spriteId) {
          const existing = spriteSetupEventCode.get(block.spriteId) || '';
          spriteSetupEventCode.set(block.spriteId, existing + childCode);
        }
      } else {
        // Other events (like "when clicked") create their own functions
      code = code.replace('${content}', childCode.trimEnd());
      eventCode += code + '\n\n';
      }
    } else if (!eventChildBlocks.has(block.instanceId)) {
      // Regular blocks that are NOT children of events - these are "naked" blocks
      // We ignore them completely - they should not execute
      console.log(`Ignoring naked block: ${block.id} (${block.instanceId})`);
    }
    // Note: blocks that ARE children of events are handled above in the event processing
  });

  // Generate sprite variables and initialization
  let spriteVariables = '';
  let spriteSetup = '';
  let spriteFunctions = '';
  let spriteUpdateCalls = '';
  
  if (sprites.length > 0) {
    // Generate array-based sprite system instead of individual variables
    spriteVariables = `// Modern sprite system using arrays and hashmaps
let sprites = [
${sprites.map((sprite, index) => `  {
    id: "${sprite.id}",
    name: "${sprite.name}",
    x: ${sprite.x},
    y: ${sprite.y},
    size: ${sprite.size || 30},
    color: "${sprite.color || '#ff6b6b'}",
    visible: ${sprite.visible !== false},
    waitUntilFrame: ${sprite.waitUntilFrame || 0},
    actionQueue: [],
    currentActionIndex: 0,
    actionState: 'ready'
  }`).join(',\n')}
];

// Sprite lookup map for efficient access by ID
const spriteMap = new Map();
sprites.forEach((sprite, index) => {
  spriteMap.set(sprite.id, index);
});

// Sprite access functions
function getSpriteById(id) {
  const index = spriteMap.get(id);
  return index !== undefined ? sprites[index] : null;
}

function updateSprite(id, updates) {
  const index = spriteMap.get(id);
  if (index !== undefined) {
    Object.assign(sprites[index], updates);
  }
}

`;
    
    // Generate sprite setup code
    spriteSetup = '  // Initialize sprites\n';
    sprites.forEach((sprite, index) => {
      spriteSetup += `  // ${sprite.name} is at position (${sprite.x}, ${sprite.y})\n`;
      
      // Add sprite-specific setup event code
      const spriteSetupCode = spriteSetupEventCode.get(sprite.id) || '';
      if (spriteSetupCode.trim()) {
        spriteSetup += `  // When setup event code for ${sprite.name}\n`;
        spriteSetup += spriteSetupCode;
      }
    });
    spriteSetup += '\n';
    
    // Generate sprite update functions
    sprites.forEach((sprite, index) => {
      const cleanId = sprite.id.replace(/[^a-zA-Z0-9]/g, '_');
      const spriteBlockCode = spriteCode.get(sprite.id) || '';
      
      if (spriteBlockCode.trim()) {
        spriteFunctions += `function updateSprite_${cleanId}() {\n`;
        spriteFunctions += `  // Update ${sprite.name} (index ${index})\n`;
        spriteFunctions += `  const sprite = sprites[${index}];\n`;
        spriteFunctions += `  \n`;
        spriteFunctions += `  // Only execute actions if sprite is not waiting (using global frame clock)\n`;
        spriteFunctions += `  if (!sprite.waitUntilFrame || globalFrameCount >= sprite.waitUntilFrame) {\n`;
        spriteFunctions += spriteBlockCode.split('\n').map(line => line ? '    ' + line : '').join('\n');
        spriteFunctions += `  }\n`;
        spriteFunctions += `}\n\n`;
        
        spriteUpdateCalls += `  updateSprite_${cleanId}();\n`;
      }
    });
    
    // Add sprite drawing code using array system
    spriteFunctions += `function drawSprites() {\n`;
    spriteFunctions += `  // Draw all sprites using array system\n`;
    sprites.forEach((sprite, index) => {
      const spriteDrawCode = spriteDrawEventCode.get(sprite.id) || '';
      
      spriteFunctions += `  // Draw ${sprite.name} (index ${index})\n`;
      spriteFunctions += `  if (sprites[${index}].visible) {\n`;
      if (spriteDrawCode.trim()) {
        spriteFunctions += `    // When draw event code for ${sprite.name}\n`;
        // Don't add sprite declaration if the draw code already has one (from frame-based sequencing)
        if (!spriteDrawCode.includes('const sprite = sprites[')) {
          spriteFunctions += `    const sprite = sprites[${index}];\n`;
        }
        spriteFunctions += spriteDrawCode.split('\n').map(line => line ? '    ' + line : '').join('\n');
      }
      spriteFunctions += `    fill(sprites[${index}].color);\n`;
      spriteFunctions += `    stroke(255);\n`;
      spriteFunctions += `    strokeWeight(2);\n`;
      spriteFunctions += `    circle(sprites[${index}].x, sprites[${index}].y, sprites[${index}].size);\n`;
      spriteFunctions += `    \n`;
      spriteFunctions += `    // Add highlight/glare\n`;
      spriteFunctions += `    fill(255, 255, 255, 120);\n`;
      spriteFunctions += `    noStroke();\n`;
      spriteFunctions += `    circle(sprites[${index}].x - sprites[${index}].size * 0.15, sprites[${index}].y - sprites[${index}].size * 0.15, sprites[${index}].size * 0.3);\n`;
      spriteFunctions += `  }\n\n`;
    });
    spriteFunctions += `}\n\n`;
    
    spriteUpdateCalls += `  drawSprites();\n`;
  }

  // The final code structure with complete sprite information
  const finalCode = `${spriteVariables}function setup() {
  createCanvas(480, 360);
${spriteSetup}${setupEventCode}}

function draw() {
  background(255);
${drawEventCode}${spriteUpdateCalls}
}

${spriteFunctions}${eventCode}`.trim();

  return finalCode;
};