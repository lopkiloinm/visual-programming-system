import React, { useState, useEffect } from 'react';
import { Shapes, Code, Bug, FileJson, Info } from 'lucide-react';
import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { CodeEditor } from './CodeEditor';
import { JsonEditor } from './JsonEditor';
import { useSpriteContext } from '../contexts/SpriteContext';

interface LeftPanelProps {
  debugLogs?: Array<{
    frame: number;
    message: string;
    type: 'action' | 'wait' | 'info';
    timestamp: number;
  }>;
  isRunning?: boolean;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ debugLogs = [], isRunning = false }) => {
  const [activeWorkspace, setActiveWorkspace] = useState<'stage' | string>('stage');
  const [viewMode, setViewMode] = useState<'blocks' | 'code' | 'debug' | 'json' | 'about'>('blocks');
  const { sprites, selectedSprite } = useSpriteContext();
  const debugLogScrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll debug log to bottom when new logs are added
  useEffect(() => {
    if (debugLogScrollRef.current && viewMode === 'debug') {
      debugLogScrollRef.current.scrollTop = debugLogScrollRef.current.scrollHeight;
    }
  }, [debugLogs, viewMode]);

  useEffect(() => {
    if (selectedSprite) {
      setActiveWorkspace(selectedSprite.id);
    }
  }, [selectedSprite]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Shapes size={18} className="text-blue-600" />
            <span className="font-semibold text-gray-800">Programming</span>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'blocks'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('blocks')}
            >
              <Shapes size={14} />
              <span className="text-xs font-medium">Blocks</span>
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('code')}
            >
              <Code size={14} />
              <span className="text-xs font-medium">Code</span>
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'debug'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('debug')}
            >
              <Bug size={14} />
              <span className="text-xs font-medium">Debug</span>
              {debugLogs.length > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-1">
                  {debugLogs.length > 9 ? '9+' : debugLogs.length}
                </span>
              )}
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'json'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('json')}
            >
              <FileJson size={14} />
              <span className="text-xs font-medium">JSON</span>
            </button>
            <button
              className={`flex items-center space-x-1 py-1 px-2 rounded-md transition-all duration-200 ${
                viewMode === 'about'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setViewMode('about')}
            >
              <Info size={14} />
              <span className="text-xs font-medium">About</span>
            </button>
          </div>
        </div>

        {viewMode === 'blocks' && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Workspace</div>
            <div className="flex flex-wrap gap-1">
              <button
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeWorkspace === 'stage'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => setActiveWorkspace('stage')}
              >
                🎭 Stage
              </button>
              {sprites.map(sprite => (
                <button
                  key={sprite.id}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    activeWorkspace === sprite.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setActiveWorkspace(sprite.id)}
                >
                  <div 
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: sprite.color }}
                  />
                  {sprite.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'blocks' ? (
          <>
            <BlockPalette />
            <BlockWorkspace 
              spriteId={activeWorkspace === 'stage' ? undefined : activeWorkspace}
              isStage={activeWorkspace === 'stage'}
            />
          </>
        ) : viewMode === 'code' ? (
          <div className="flex-1">
            <CodeEditor />
          </div>
        ) : viewMode === 'json' ? (
          <div className="flex-1">
            <JsonEditor />
          </div>
        ) : viewMode === 'about' ? (
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Next-Generation Visual Programming
                </h1>
                <p className="text-gray-600 text-sm">
                  The future of creative coding with WebGPU acceleration
                </p>
              </div>

              <div className="space-y-6">
                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🚀 Next-Gen WebGPU Advantage
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    While competitors use established WebGL for GPU acceleration, we compile directly to 
                    q5 WebGPU renderer - the next generation of graphics API. WebGPU offers modern GPU architecture 
                    access, better performance, and more efficient resource management than WebGL.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-800">WebGPU vs WebGL</span>
                    </div>
                    <p className="text-green-700">
                      2-10x performance improvement over WebGL through q5 WebGPU renderer. 
                      Lower CPU overhead, better multi-threading, and modern shader capabilities.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    ⚡ Direct JavaScript Transpilation
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    Unlike competitors that add abstraction layers, we transpile directly to least-verbose JavaScript. 
                    Think of this like TypeScript - both are high-level languages that transpile to clean JavaScript, 
                    maintaining the same performance characteristics while adding structured programming features.
                  </p>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    While modern JavaScript is still an order of magnitude slower than native languages for compute-intensive tasks, 
                    for simple logic with graphics-intensive workloads, performance is equivalent because graphics rendering 
                    becomes the bottleneck, not the logic processing.
                  </p>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    <strong>Note:</strong> Browser games can achieve true native-speed performance using WebAssembly (WASM) compilation. 
                    However, we chose JavaScript for maximum accessibility and ease of debugging, since our target workloads 
                    are graphics-bottlenecked rather than compute-intensive.
                  </p>
                  
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-600 mb-2">Generated Code Example:</div>
                    <pre className="text-xs text-gray-800 overflow-x-auto"><code>{`// Async flowchart function for sprite_1750231210598
async function startSpriteFlowchart_when_draw_1750231212913() {
  const spriteIndex = 0;

  while (true) {
    try {
      // Execute blocks in sequence
      if (kb.pressing("w")) {
        updateSprite(sprites[0].id, {x: sprites[0].x + 0, y: sprites[0].y + -10});
      } else {
        /* else not connected */
      }
      if (kb.pressing("s")) {
        updateSprite(sprites[0].id, {x: sprites[0].x + 0, y: sprites[0].y + 10});
      } else {
        /* else not connected */
      }
      if (kb.pressing("a")) {
        updateSprite(sprites[0].id, {x: sprites[0].x + -10, y: sprites[0].y + 0});
      } else {
        /* else not connected */
      }
      if (kb.pressing("d")) {
        updateSprite(sprites[0].id, {x: sprites[0].x + 10, y: sprites[0].y + 0});
      } else {
        /* else not connected */
      }
      await waitFrames(1); // Small delay before next iteration
    } catch (error) {
      console.error('Sprite flowchart error:', error);
      await waitFrames(60); // Wait 1 second before retrying
    }
  }
}`}</code></pre>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🔗 Advanced Node Graph System
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    Our node-based architecture represents a fundamental shift from traditional block programming. 
                    Each program is a graph of interconnected nodes that form complex execution networks, 
                    similar to professional tools like Unreal Engine's Blueprint system or Blender's shader nodes.
                  </p>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    Unlike linear block sequences, our node graphs create true visual programs where data flows 
                    through connections between nodes, multiple execution paths can run simultaneously, and 
                    complex behaviors emerge from simple node interactions. Async operations are naturally 
                    represented without awkward workarounds.
                  </p>

                  <p className="text-sm text-gray-700 mb-3">
                    <strong>The Deep Nesting Problem:</strong> Traditional blocks encourage harmful practices through easy deep nesting. 
                    Competitors make it trivial to create massive, deeply nested "super blocks" that become unmaintainable 
                    and impossible to debug, leading to monolithic code structures.
                  </p>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-3">
                    <h3 className="font-medium text-indigo-800 mb-2">State Machine Representation</h3>
                    <p className="text-sm text-indigo-700">
                      Our node graphs mirror classical state machine representations, making complex program logic 
                      intuitive to understand. Each node represents a state or operation, with clear transitions 
                      between them. This matches how computer scientists think about program flow and makes 
                      debugging and modification straightforward.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🌐 Procedural Game Development
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    Our system functions as a procedural framework for game creation. Programs are constructed 
                    as node networks that generate interactive content, sprite behaviors, and game mechanics 
                    through algorithmic processes rather than manual scripting.
                  </p>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-medium text-amber-800 mb-2">Professional Workflow Paradigm</h3>
                    <p className="text-sm text-amber-700 mb-2">
                      This approach mirrors industry-standard tools:
                    </p>
                    <ul className="text-sm text-amber-700 space-y-1 ml-4">
                      <li>• Game engines (Unreal Blueprint, Unity Visual Scripting)</li>
                      <li>• 3D software (Maya nodes, Blender geometry nodes)</li>
                      <li>• Creative tools (TouchDesigner, Max/MSP)</li>
                      <li>• AI platforms (ComfyUI, AUTOMATIC1111)</li>
                    </ul>
                    <p className="text-sm text-amber-700 mt-2">
                      What makes our system unique is combining this professional node paradigm 
                      with accessible visual programming for game development.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    ✨ Modern JavaScript Features
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    Built on the latest ES standards with async/await, modern syntax, 
                    and cutting-edge browser APIs. Your projects benefit from the newest 
                    JavaScript innovations automatically.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="font-medium text-blue-800 mb-1">ES2024+ Features</div>
                      <div className="text-blue-700 text-xs">async/await, modules, classes</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded p-3">
                      <div className="font-medium text-purple-800 mb-1">Modern APIs</div>
                      <div className="text-purple-700 text-xs">WebGPU, Canvas, Physics</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🎭 Dispelling Performance Myths
                  </h2>
                  <p className="text-sm text-gray-700 mb-3">
                    One of the biggest misconceptions in modern development is that browser applications 
                    are much slower than downloaded software. This belief stems from outdated 
                    experiences with early web technologies like Adobe Flash.
                  </p>

                  <p className="text-sm text-gray-700 mb-3">
                    <strong>The Flash Legacy Problem:</strong> Adobe Flash was single-threaded, unoptimized for GPU acceleration, 
                    and couldn't leverage multicore processors or parallel computing. This created the false impression 
                    that "browser games are always slow." Flash's limitations became synonymous with web gaming performance 
                    in many people's minds.
                  </p>

                  <p className="text-sm text-gray-700 mb-3">
                    <strong>Parallel Computing Misconception:</strong> Another myth is that browser game software doesn't utilize 
                    parallel computing or multithreading. Modern browser games absolutely do use sophisticated parallel processing 
                    for physics, rendering, AI, and audio. Our WebGPU approach gives browser games access to the same 
                    multicore and GPU parallel computing capabilities that desktop games have always used.
                  </p>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3">
                    <h3 className="font-medium text-purple-800 mb-2">Modern Web = Native Graphics Performance</h3>
                    <p className="text-sm text-purple-700">
                      With q5 WebGPU renderer and modern JavaScript JIT compilation, browser games achieve graphics
                      performance equivalent to downloaded applications. WebGPU provides direct access to 
                      GPU parallel processing, while modern browsers leverage multicore CPUs through 
                      Web Workers and optimized JavaScript engines.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="font-medium text-red-800 mb-1">Flash Era</div>
                      <div className="text-red-700 text-xs">Single-threaded, no GPU, limited CPU</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="font-medium text-green-800 mb-1">WebGPU Era</div>
                      <div className="text-green-700 text-xs">Multithreaded, GPU parallel, multicore</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🎯 Technical Stack
                  </h2>
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                                             <div className="flex justify-between">
                         <span className="text-gray-600">Graphics Engine:</span>
                         <span className="font-mono text-gray-800">q5.js v3.1.4</span>
                       </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Game Framework:</span>
                        <span className="font-mono text-gray-800">p5play v3.30.1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Physics Engine:</span>
                        <span className="font-mono text-gray-800">planck.js v1.4.2</span>
                      </div>
                                             <div className="flex justify-between">
                         <span className="text-gray-600">Transpilation Target:</span>
                         <span className="font-mono text-gray-800">ES2024+ JavaScript</span>
                       </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    🎮 Why This Matters
                  </h2>
                  <p className="text-sm text-gray-700">
                    While competitors offer solid WebGL-based performance, we're pioneering the next generation 
                    with WebGPU. By leveraging q5 WebGPU renderer as the source of WebGPU innovation, we provide access to 
                    cutting-edge GPU capabilities that represent the future of graphics programming. This gives 
                    developers early access to tomorrow's graphics standards today.
                  </p>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Debug Log</h3>
              <p className="text-xs text-gray-600">
                Real-time execution trace for system events and operations
              </p>
              <div className="mt-2 text-xs text-gray-500">
                {debugLogs.length} logs {debugLogs.length >= 50 && "(showing last 50)"} •{" "}
                <span className="text-green-600">Actions</span> •{" "}
                <span className="text-red-600">Wait states</span> •{" "}
                <span className="text-gray-600">Info</span>
              </div>
            </div>
            
            <div ref={debugLogScrollRef} className="flex-1 overflow-y-auto p-4">
              {debugLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                  <Bug size={32} className="mx-auto mb-3 text-gray-400" />
                  <p className="font-medium mb-1">No debug logs yet</p>
                  <p className="text-xs">
                    {isRunning ? "Waiting for actions to execute..." : "Press Run on the canvas to see action execution logs"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {debugLogs.map((log, index) => (
                    <div
                      key={`${log.timestamp}-${index}`}
                      className={`flex gap-3 p-2 rounded transition-colors ${
                        log.type === 'action' ? 'bg-green-50 border-l-2 border-green-300' :
                        log.type === 'wait' ? 'bg-red-50 border-l-2 border-red-300' :
                        'bg-gray-50 border-l-2 border-gray-300'
                      }`}
                    >
                      <span className={`w-12 flex-shrink-0 font-semibold ${
                        log.type === 'action' ? 'text-green-700' :
                        log.type === 'wait' ? 'text-red-700' :
                        'text-gray-700'
                      }`}>
                        F{log.frame}
                      </span>
                      <span className={`flex-1 ${
                        log.type === 'action' ? 'text-green-800' :
                        log.type === 'wait' ? 'text-red-800' :
                        'text-gray-800'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};