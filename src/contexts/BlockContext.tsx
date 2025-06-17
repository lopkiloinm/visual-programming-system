import React, { createContext, useContext, useState, useEffect } from 'react';
import { BlockInstance } from '../types/blocks';
import { generateCodeFromBlocks } from '../utils/codeGeneration';

interface BlockContextType {
  workspaceBlocks: BlockInstance[];
  generatedCode: string;
  addBlockToWorkspace: (block: BlockInstance) => void;
  removeBlockFromWorkspace: (instanceId: string) => void;
  updateBlockPosition: (instanceId: string, position: { x: number; y: number }) => void;
  updateBlockValue: (instanceId: string, inputName: string, value: any) => void;
  updateCode: (code: string) => void;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

export const BlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaceBlocks, setWorkspaceBlocks] = useState<BlockInstance[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  useEffect(() => {
    const generateCode = () => {
      // Get current sprites from global window object
      const sprites = (window as any).sprites || [];
      const code = generateCodeFromBlocks(workspaceBlocks, sprites);
      setGeneratedCode(code);
    };

    generateCode();

    // Listen for sprite changes to regenerate code
    const handleSpritesChanged = () => generateCode();
    window.addEventListener('spritesChanged', handleSpritesChanged);

    return () => {
      window.removeEventListener('spritesChanged', handleSpritesChanged);
    };
  }, [workspaceBlocks]);

  const addBlockToWorkspace = (block: BlockInstance) => {
    if (block.inputs && !block.values) {
      block.values = {};
      block.inputs.forEach(input => {
        block.values![input.name] = input.defaultValue;
      });
    }
    setWorkspaceBlocks(prev => [...prev, block]);
  };

  const removeBlockFromWorkspace = (instanceId: string) => {
    setWorkspaceBlocks(prev => prev.filter(block => block.instanceId !== instanceId));
  };

  const updateBlockPosition = (instanceId: string, position: { x: number; y: number }) => {
    setWorkspaceBlocks(prev =>
      prev.map(block =>
        block.instanceId === instanceId
          ? { ...block, position }
          : block
      )
    );
  };

  const updateBlockValue = (instanceId: string, inputName: string, value: any) => {
    setWorkspaceBlocks(prev =>
      prev.map(block =>
        block.instanceId === instanceId
          ? { 
              ...block, 
              values: { 
                ...block.values, 
                [inputName]: value 
              } 
            }
          : block
      )
    );
  };

  const updateCode = (code: string) => {
    setGeneratedCode(code);
  };

  return (
    <BlockContext.Provider value={{
      workspaceBlocks,
      generatedCode,
      addBlockToWorkspace,
      removeBlockFromWorkspace,
      updateBlockPosition,
      updateBlockValue,
      updateCode
    }}>
      {children}
    </BlockContext.Provider>
  );
};

export const useBlockContext = () => {
  const context = useContext(BlockContext);
  if (!context) {
    throw new Error('useBlockContext must be used within a BlockProvider');
  }
  return context;
};