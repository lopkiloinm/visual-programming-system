import React from 'react';
import { useBlockContext } from '../contexts/BlockContext';

export const CodeEditor: React.FC = () => {
  const { generatedCode } = useBlockContext();

  const formatCode = (code: string) => {
    const lines = code.split('\n');
    let indentLevel = 0;
    const indentSize = 2;
    
    return lines.map(line => {
      const trimmed = line.trim();
      
      if (!trimmed) return '';
      
      // Decrease indent for closing braces
      if (trimmed === '}' || trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmed;
      
      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indentLevel++;
      }
      
      return indentedLine;
    }).join('\n');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <h3 className="text-sm font-semibold text-gray-700">Generated Code</h3>
        <div className="text-xs text-gray-500">q5.js + p5play</div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto bg-gray-900 text-green-400 font-mono text-sm">
          <pre className="p-4 whitespace-pre-wrap">
            <code>
              {formatCode(generatedCode) || '// Your q5.js + p5play code will appear here\n// Create blocks and connect them to generate code!\n\n// Example:\n// function setup() {\n//   createCanvas(480, 360);\n// }\n//\n// function draw() {\n//   background(255);\n//   // Your sprite actions will appear here\n// }'}
            </code>
          </pre>
        </div>
      </div>
      
      <div className="p-2 bg-gray-800 text-gray-400 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>Code generated from visual blocks</span>
        </div>
      </div>
    </div>
  );
};