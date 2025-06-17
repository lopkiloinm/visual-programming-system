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
}

export interface BlockInstance extends BlockDefinition {
  instanceId: string;
  position?: { x: number; y: number };
  values?: Record<string, any>;
  children?: BlockInstance[]; // For container blocks
  parentId?: string;
  workspaceType?: 'stage' | 'sprite';
  spriteId?: string;
}

export interface BlockCategory {
  name: string;
  color: string;
  blocks: BlockDefinition[];
}