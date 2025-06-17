export interface BlockInput {
  type: 'number' | 'text' | 'dropdown' | 'boolean';
  name: string;
  defaultValue?: any;
  options?: string[];
}

export interface BlockDefinition {
  id: string;
  label: string;
  category: string;
  color: string;
  type: 'action' | 'value' | 'control' | 'event';
  inputs?: BlockInput[];
  code: string;
  isContainer?: boolean; // For blocks that can contain other blocks
  valueInputs?: string[]; // Names of inputs that accept block connections
  specialHandles?: Record<string, 'top' | 'bottom' | 'left' | 'right'>; // Special output handles
  height?: 'normal' | 'medium' | 'tall'; // Block height for multiple connections
  labeledConnections?: {
    inputs?: Array<{ label: string; side: 'left' | 'right'; type: 'boolean' | 'number' | 'flow' }>;
    outputs?: Array<{ label: string; side: 'left' | 'right'; type: 'boolean' | 'number' | 'flow' }>;
  };
}

// Flowchart connection/edge definition
export interface FlowConnection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  waitFrames: number; // 0 = immediate (asynchronous), > 0 = wait frames
  sourceHandle?: 'output' | 'bottom'; // Which connection point on source block
  targetHandle?: 'input' | 'top'; // Which connection point on target block
  connectionType?: 'horizontal' | 'vertical'; // Direction of flow
}

export interface BlockInstance extends BlockDefinition {
  instanceId: string;
  position?: { x: number; y: number };
  values?: Record<string, any>;
  children?: BlockInstance[]; // For container blocks
  parentId?: string;
  workspaceType?: 'stage' | 'sprite';
  spriteId?: string;
  // Flowchart connections
  outputConnections?: string[]; // IDs of connections from this block
  inputConnections?: string[]; // IDs of connections to this block
}

export interface BlockCategory {
  name: string;
  color: string;
  blocks: BlockDefinition[];
}

// Flowchart workspace definition
export interface FlowchartWorkspace {
  blocks: BlockInstance[];
  connections: FlowConnection[];
  spriteId?: string;
  isStage?: boolean;
}