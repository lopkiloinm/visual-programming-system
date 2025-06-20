export interface BlockInput {
  type: 'number' | 'text' | 'dropdown' | 'boolean' | 'variable';
  name: string;
  defaultValue?: any;
  options?: string[];
  acceptsVariables?: boolean; // Whether this input can accept variable references
  variableTypes?: ('number' | 'text' | 'boolean')[]; // Which variable types are accepted
  variableScope?: ('global' | 'instance')[]; // Which scopes are accepted
  min?: number; // Minimum value for number inputs
  max?: number; // Maximum value for number inputs
}

export interface BlockDefinition {
  id: string;
  label: string;
  category: string;
  color: string;
  type: 'action' | 'value' | 'control' | 'event' | 'definition';
  inputs?: BlockInput[];
  code: string;
  isContainer?: boolean; // For blocks that can contain other blocks
  valueInputs?: string[]; // Names of inputs that accept block connections
  specialHandles?: Record<string, 'top' | 'bottom' | 'left' | 'right'>; // Special output handles
  height?: 'normal' | 'medium' | 'tall' | 'custom'; // Block height for multiple connections
  customizable?: boolean; // Whether the block can be customized
  dynamicInputs?: boolean; // Whether the block has dynamic inputs based on argCount

  labeledConnections?: {
    inputs?: Array<{ label: string; side: 'left' | 'right' | 'top' | 'bottom'; type: 'boolean' | 'number' | 'flow' | 'any' }>;
    outputs?: Array<{ label: string; side: 'left' | 'right' | 'top' | 'bottom'; type: 'boolean' | 'number' | 'flow' | 'any' }>;
  };
}

// Flowchart connection/edge definition
export interface FlowConnection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  waitFrames: number; // 0 = immediate (asynchronous), > 0 = wait frames
  sourceHandle?: 'output' | 'bottom' | string; // Which connection point on source block
  targetHandle?: 'input' | 'top' | string; // Which connection point on target block
  connectionType?: 'horizontal' | 'vertical'; // Direction of flow
  targetInputName?: string; // For data connections to specific inputs
}

// Data connections now use FlowConnection with targetInputName
// No separate DataConnection interface needed

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
  // Data connections
  dataInputConnections?: Record<string, string>; // inputName -> sourceBlockId
  connectedInputs?: Set<string>; // Set of input names that have data connections
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

// Variable definition with strong typing and scoping
export interface VariableDefinition {
  name: string;
  type: 'number' | 'text' | 'boolean';
  scope: 'global' | 'instance'; // global = shared, instance = per sprite
  spriteId?: string; // For instance variables - which sprite they belong to
  initialValue: any;
  created: number; // timestamp
}

// Safe variable reference (no direct text input)
export interface VariableReference {
  variableName: string;
  scope: 'global' | 'instance';
  type: 'number' | 'text' | 'boolean';
}