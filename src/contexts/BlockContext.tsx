import React, { createContext, useContext, useState, useEffect } from 'react';
import { BlockInstance, FlowConnection } from '../types/blocks';
import { generateCodeFromBlocks } from '../utils/codeGeneration';

interface BlockContextType {
  workspaceBlocks: BlockInstance[];
  connections: FlowConnection[];
  generatedCode: string;
  addBlockToWorkspace: (block: BlockInstance) => void;
  removeBlockFromWorkspace: (instanceId: string) => void;
  updateBlockPosition: (instanceId: string, position: { x: number; y: number }) => void;
  updateBlockValue: (instanceId: string, inputName: string, value: any) => void;
  updateCode: (code: string) => void;
  // Flowchart connection methods
  addConnection: (connection: FlowConnection) => void;
  removeConnection: (connectionId: string) => void;
  updateConnectionWaitTime: (connectionId: string, waitFrames: number) => void;
  getConnectionsFromBlock: (blockId: string) => FlowConnection[];
  getConnectionsToBlock: (blockId: string) => FlowConnection[];
  // Import/Export methods
  clearWorkspace: () => Promise<void>;
  importWorkspaceData: (blocks: BlockInstance[], connections: FlowConnection[]) => Promise<void>;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

export const BlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaceBlocks, setWorkspaceBlocks] = useState<BlockInstance[]>([]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  useEffect(() => {
    const generateCode = () => {
      // Get current sprites from global window object
      const sprites = (window as any).sprites || [];
      const code = generateCodeFromBlocks(workspaceBlocks, sprites, connections);
      setGeneratedCode(code);
    };

    generateCode();

    // Listen for sprite changes to regenerate code
    const handleSpritesChanged = () => generateCode();
    window.addEventListener('spritesChanged', handleSpritesChanged);

    return () => {
      window.removeEventListener('spritesChanged', handleSpritesChanged);
    };
  }, [workspaceBlocks, connections]);

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
    // Remove the block
    setWorkspaceBlocks(prev => prev.filter(block => block.instanceId !== instanceId));
    
    // Remove all connections to/from this block
    setConnections(prev => prev.filter(conn => 
      conn.sourceBlockId !== instanceId && conn.targetBlockId !== instanceId
    ));
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

  // Flowchart connection methods
  const addConnection = (connection: FlowConnection) => {
    setConnections(prev => [...prev, connection]);
  };

  const removeConnection = (connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  };

  const updateConnectionWaitTime = (connectionId: string, waitFrames: number) => {
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId 
        ? { ...conn, waitFrames }
        : conn
    ));
  };

  const getConnectionsFromBlock = (blockId: string): FlowConnection[] => {
    return connections.filter(conn => conn.sourceBlockId === blockId);
  };

  const getConnectionsToBlock = (blockId: string): FlowConnection[] => {
    return connections.filter(conn => conn.targetBlockId === blockId);
  };

  // Import/Export methods
  const clearWorkspace = async (): Promise<void> => {
    setWorkspaceBlocks([]);
    setConnections([]);
    setGeneratedCode('');
  };

  const importWorkspaceData = async (blocks: BlockInstance[], importedConnections: FlowConnection[]): Promise<void> => {
    // Validate and prepare blocks
    const validBlocks = blocks.map(block => {
      // Ensure required properties exist
      if (!block.instanceId) {
        block.instanceId = `${block.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!block.position) {
        block.position = { x: 100, y: 100 };
      }
      if (block.inputs && !block.values) {
        block.values = {};
        block.inputs.forEach(input => {
          block.values![input.name] = input.defaultValue;
        });
      }
      return block;
    });

    // Validate connections
    const validConnections = importedConnections.filter(conn => {
      const sourceExists = validBlocks.some(b => b.instanceId === conn.sourceBlockId);
      const targetExists = validBlocks.some(b => b.instanceId === conn.targetBlockId);
      return sourceExists && targetExists;
    });

    // Set the data
    setWorkspaceBlocks(validBlocks);
    setConnections(validConnections);
  };

  return (
    <BlockContext.Provider value={{
      workspaceBlocks,
      connections,
      generatedCode,
      addBlockToWorkspace,
      removeBlockFromWorkspace,
      updateBlockPosition,
      updateBlockValue,
      updateCode,
      addConnection,
      removeConnection,
      updateConnectionWaitTime,
      getConnectionsFromBlock,
      getConnectionsToBlock,
      clearWorkspace,
      importWorkspaceData
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