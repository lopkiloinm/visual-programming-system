import React, { useState } from 'react';
import { Plus, X, Globe, Package } from 'lucide-react';
import { useVariableContext } from '../contexts/VariableContext';
import { useSpriteContext } from '../contexts/SpriteContext';

interface VariableManagerProps {
  currentSpriteId?: string; // Current sprite workspace for scoping instance variables
}

export const VariableManager: React.FC<VariableManagerProps> = ({ currentSpriteId }) => {
  const {
    variables,
    addVariable,
    updateVariable,
    deleteVariable,
    isValidVariableName
  } = useVariableContext();
  const { sprites } = useSpriteContext();

  const [panelHeight, setPanelHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarType, setNewVarType] = useState<'number' | 'text' | 'boolean'>('number');
  const [newVarScope, setNewVarScope] = useState<'global' | 'instance'>('global');
  const [nameError, setNameError] = useState('');

  // Helper function to get the display name for a variable
  const getVariableDisplayName = (variable: any): string => {
    if (variable.scope === 'global') {
      return variable.name;
    } else {
      // Instance variable - find sprite name and add prefix
      const sprite = sprites.find(s => s.id === variable.spriteId);
      const spriteName = sprite ? sprite.name : variable.spriteId || 'unknown';
      return `${spriteName}.${variable.name}`;
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = panelHeight;

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(400, startHeight + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleAddVariable = () => {
    const trimmedName = newVarName.trim();
    
    // Validate variable name
    if (!trimmedName) {
      setNameError('Variable name is required');
      return;
    }
    
    if (!isValidVariableName(trimmedName)) {
      setNameError('Invalid name. Use letters, numbers, and underscores only. No reserved words.');
      return;
    }

    // Convert value based on type
    let value: any = newVarValue;
    if (newVarType === 'number') {
      value = parseFloat(newVarValue) || 0;
    } else if (newVarType === 'boolean') {
      value = newVarValue.toLowerCase() === 'true';
    }

    const success = addVariable({
      name: trimmedName,
      type: newVarType,
      scope: effectiveScope,
      spriteId: effectiveScope === 'instance' ? currentSpriteId : undefined,
      initialValue: value
    });

    if (success) {
      // Reset form
      setNewVarName('');
      setNewVarValue('');
      setNewVarType('number');
      if (!isStageWorkspace) {
        setNewVarScope('global');
      }
      setNameError('');
    } else {
      if (effectiveScope === 'instance') {
        const sprite = sprites.find(s => s.id === currentSpriteId);
        const spriteName = sprite ? sprite.name : currentSpriteId || 'unknown';
        setNameError(`Variable ${spriteName}.${trimmedName} already exists`);
      } else {
        setNameError(`Variable ${trimmedName} already exists in global scope`);
      }
    }
  };

  const handleUpdateVariable = (name: string, scope: 'global' | 'instance', newValue: string, type: 'number' | 'text' | 'boolean', spriteId?: string) => {
    let value: any = newValue;
    if (type === 'number') {
      value = parseFloat(newValue) || 0;
    } else if (type === 'boolean') {
      value = newValue.toLowerCase() === 'true';
    }
    
    updateVariable(name, scope, value, spriteId);
  };

  const handleNameChange = (name: string) => {
    setNewVarName(name);
    if (nameError) {
      setNameError('');
    }
  };

  const globalVariables = variables.filter(v => v.scope === 'global');
  const instanceVariables = variables.filter(v => v.scope === 'instance' && v.spriteId === currentSpriteId);

  // When in stage workspace (currentSpriteId is undefined), force global scope
  const isStageWorkspace = !currentSpriteId;
  const effectiveScope = isStageWorkspace ? 'global' : newVarScope;

  return (
    <div 
      className="bg-white border-t border-gray-300 flex flex-col"
      style={{ height: panelHeight }}
    >
      <div 
        className={`w-full h-1 bg-gray-300 hover:bg-blue-500 cursor-row-resize transition-colors duration-200 flex items-center justify-center select-none ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleResizeStart}
      >
        <div className="w-8 h-0.5 bg-gray-400 hover:bg-white transition-colors duration-200 select-none"></div>
      </div>
      
      <div className="px-3 pt-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Variables {isStageWorkspace && <span className="text-xs font-normal text-gray-500">(Stage - Global Only)</span>}
          </h3>
          <button
            onClick={handleAddVariable}
            disabled={!newVarName.trim()}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0 -mx-3 px-3">
          <div className="space-y-3 pb-3">
            {/* Add New Variable Form */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Variable name"
                  className={`w-full text-xs border px-2 py-1 ${nameError ? 'border-red-500' : 'border-gray-200'}`}
                />
                {nameError && (
                  <div className="text-xs text-red-500 mt-1">{nameError}</div>
                )}
              </div>
              
              {/* Hide scope selector in stage workspace, always use global */}
              {isStageWorkspace ? (
                <div className="text-xs border border-gray-200 px-2 py-1 bg-gray-100 text-gray-600 flex items-center">
                  🌐 Global (Stage)
                </div>
              ) : (
                <select
                  value={newVarScope}
                  onChange={(e) => setNewVarScope(e.target.value as 'global' | 'instance')}
                  className="text-xs border border-gray-200 px-2 py-1"
                >
                  <option value="global">🌐 Global</option>
                  <option value="instance">📦 Instance</option>
                </select>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newVarType}
                onChange={(e) => setNewVarType(e.target.value as any)}
                className="text-xs border border-gray-200 px-2 py-1"
              >
                <option value="number">🔢 Number</option>
                <option value="text">📝 Text</option>
                <option value="boolean">✅ Boolean</option>
              </select>
              
              {newVarType === 'boolean' ? (
                <select
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="text-xs border border-gray-200 px-2 py-1"
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : (
                <input
                  type={newVarType === 'number' ? 'number' : 'text'}
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="Initial value"
                  className="text-xs border border-gray-200 px-2 py-1"
                />
              )}
            </div>

            {/* Variables List */}
            {variables.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-6">
                <div className="text-2xl mb-2">📊</div>
                <p>No variables yet</p>
                <p className="text-xs mt-1">Fill the form above and click "Add"</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {/* Global Variables - always shown */}
                {globalVariables.map((variable) => (
                  <div
                    key={`global-${variable.name}`}
                    className="p-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    title={`${getVariableDisplayName(variable)} - Global variable, shared across all sprites`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1 min-w-0">
                        <Globe size={8} className="text-blue-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-800 truncate font-mono">
                          {getVariableDisplayName(variable)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteVariable(variable.name, variable.scope, variable.spriteId)}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                        title={`Delete ${getVariableDisplayName(variable)}`}
                      >
                        <X size={8} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 text-[10px]">{variable.type}:</span>
                      {variable.type === 'boolean' ? (
                        <select
                          value={String(variable.initialValue)}
                          onChange={(e) => handleUpdateVariable(variable.name, variable.scope, e.target.value, variable.type, variable.spriteId)}
                          className="text-xs border border-gray-200 px-1 py-0.5 flex-1"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={variable.initialValue}
                          onChange={(e) => handleUpdateVariable(variable.name, variable.scope, e.target.value, variable.type, variable.spriteId)}
                          className="text-xs border border-gray-200 px-1 py-0.5 flex-1 min-w-0"
                        />
                      )}
                    </div>
                  </div>
                ))}

                {/* Instance Variables - only shown when in sprite workspace */}
                {!isStageWorkspace && instanceVariables.map((variable) => (
                  <div
                    key={`instance-${variable.name}`}
                    className="p-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    title={`${getVariableDisplayName(variable)} - Instance variable, unique to this sprite`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1 min-w-0">
                        <Package size={8} className="text-purple-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-800 truncate font-mono">
                          {getVariableDisplayName(variable)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteVariable(variable.name, variable.scope, variable.spriteId)}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                        title={`Delete ${getVariableDisplayName(variable)}`}
                      >
                        <X size={8} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 text-[10px]">{variable.type}:</span>
                      {variable.type === 'boolean' ? (
                        <select
                          value={String(variable.initialValue)}
                          onChange={(e) => handleUpdateVariable(variable.name, variable.scope, e.target.value, variable.type, variable.spriteId)}
                          className="text-xs border border-gray-200 px-1 py-0.5 flex-1"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={variable.initialValue}
                          onChange={(e) => handleUpdateVariable(variable.name, variable.scope, e.target.value, variable.type, variable.spriteId)}
                          className="text-xs border border-gray-200 px-1 py-0.5 flex-1 min-w-0"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 