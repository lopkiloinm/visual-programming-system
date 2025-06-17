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
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 p-4">
        <textarea
          value={formatCode(generatedCode)}
          className="w-full h-full font-mono text-sm border border-gray-200 rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          placeholder="// Your p5.js code will appear here"
          spellCheck={false}
          readOnly
        />
      </div>
    </div>
  );
};