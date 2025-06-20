import React, { useRef, useMemo } from 'react';
import { useVariableContext } from '../contexts/VariableContext';
import { useSpriteContext } from '../contexts/SpriteContext';
import { VariableReference, VariableDefinition } from '../types/blocks';

interface VariableSelectorProps {
  value?: VariableReference;
  onChange: (value: VariableReference | undefined) => void;
  allowedTypes?: ('number' | 'text' | 'boolean')[];
  allowedScopes?: ('global' | 'instance')[];
  placeholder?: string;
  currentSpriteId?: string; // For filtering instance variables to current sprite
}

export const VariableSelector: React.FC<VariableSelectorProps> = ({
  value,
  onChange,
  allowedTypes = ['number', 'text', 'boolean'],
  allowedScopes = ['global', 'instance'],
  placeholder = '$var',
  currentSpriteId
}) => {
  const { variables } = useVariableContext();
  const { sprites } = useSpriteContext();

  // Filter variables based on allowed types and scopes, and sprite context for instance variables
  const filteredVariables = variables.filter(variable => {
    // Check type and scope
    if (!allowedTypes.includes(variable.type) || !allowedScopes.includes(variable.scope)) {
      return false;
    }
    
    // For instance variables, only show variables that belong to the current sprite
    if (variable.scope === 'instance') {
      return variable.spriteId === currentSpriteId;
    }
    
    // Global variables are always accessible
    return true;
  });

  // Measure actual select width using a temporary select element with proper proportional scaling
  const measureSelectWidth = (text: string): number => {
    const tempSelect = document.createElement('select');
    const tempOption = document.createElement('option');
    
    // Apply EXACT same styles and classes as the real select
    tempSelect.className = 'py-1 text-xs rounded border focus:outline-blue-500 text-black bg-white';
    
    // DO NOT apply zoom transform - measure at natural size
    // Let the workspace CSS transform handle visual scaling
    
    // Override with inline styles to match exactly (text-xs is 12px, not 10px!)
    tempSelect.style.fontSize = '12px'; // text-xs is 0.75rem = 12px
    tempSelect.style.paddingTop = '0.25rem'; // py-1
    tempSelect.style.paddingBottom = '0.25rem'; // py-1
    tempSelect.style.paddingLeft = '4px';
    tempSelect.style.paddingRight = '8px';
    tempSelect.style.marginLeft = '1px';
    tempSelect.style.marginRight = '3px';
    tempSelect.style.borderRadius = '0.25rem'; // rounded
    tempSelect.style.borderWidth = '1px'; // border
    tempSelect.style.color = 'rgb(0 0 0)'; // text-black
    tempSelect.style.backgroundColor = 'rgb(255 255 255)'; // bg-white
    
    // Positioning for measurement
    tempSelect.style.position = 'absolute';
    tempSelect.style.visibility = 'hidden';
    tempSelect.style.top = '-9999px';
    tempSelect.style.left = '-9999px';
    tempSelect.style.width = 'auto';
    
    tempOption.textContent = text;
    tempSelect.appendChild(tempOption);
    
    document.body.appendChild(tempSelect);
    const rect = tempSelect.getBoundingClientRect();
    document.body.removeChild(tempSelect);
    
    // Measure at natural size - no zoom correction needed
    const baseWidth = rect.width;
    
    // Return pure width - let CSS handle padding for linear scaling
    return baseWidth > 0 ? baseWidth : 40; // Small fallback for empty selects
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    
    if (!selectedValue) {
      onChange(undefined);
      return;
    }

    // Parse the value (format: "scope:name:type")
    const [scope, name, type] = selectedValue.split(':');
    
    if (scope && name && type) {
      onChange({
        variableName: name,
        scope: scope as 'global' | 'instance',
        type: type as 'number' | 'text' | 'boolean'
      });
    }
  };

  const formatVariableOption = (variable: VariableDefinition) => {
    const scopeIcon = variable.scope === 'global' ? '🌐' : '📦';
    const typeIcon: { [key: string]: string } = {
      'number': '🔢',
      'text': '📝', 
      'boolean': '✅'
    };
    
    return `${scopeIcon} ${typeIcon[variable.type] || '❓'} ${getVariableDisplayName(variable)}`;
  };

  const getVariableValue = (variable: VariableDefinition) => {
    return `${variable.scope}:${variable.name}:${variable.type}`;
  };

  // Helper function to get the display name for a variable
  const getVariableDisplayName = (variable: VariableDefinition): string => {
    if (variable.scope === 'global') {
      return variable.name;
    } else {
      // Instance variable - find sprite name and add prefix
      const sprite = sprites.find(s => s.id === variable.spriteId);
      const spriteName = sprite ? sprite.name : variable.spriteId || 'unknown';
      return `${spriteName}.${variable.name}`;
    }
  };

    const currentValue = value ? `${value.scope}:${value.variableName}:${value.type}` : '';
  
  // Calculate width based on current selection using memoized select measurement
  const selectWidth = useMemo(() => {
    if (value) {
      // Find the actual variable to get proper display name
      const selectedVariable = variables.find(v => 
        v.scope === value.scope && 
        v.name === value.variableName && 
        v.type === value.type &&
        (v.scope === 'global' || v.spriteId === currentSpriteId)
      );
      
      if (selectedVariable) {
        // Create the EXACT display text that appears in the select
        const scopeIcon = value.scope === 'global' ? '🌐' : '📦';
        const typeIcon: { [key: string]: string } = {
          'number': '🔢',
          'text': '📝', 
          'boolean': '✅'
        };
        const displayText = `${scopeIcon} ${typeIcon[value.type] || '❓'} ${getVariableDisplayName(selectedVariable)}`;
        return measureSelectWidth(displayText);
      }
    }
    // Size based on placeholder
    return measureSelectWidth(placeholder);
  }, [value?.scope, value?.variableName, value?.type, placeholder, variables, currentSpriteId]);

  return (
    <div className="relative">
      <select
      value={currentValue}
      onChange={handleChange}
      className="py-1 text-xs rounded border focus:outline-blue-500 text-black bg-white"
      style={{ 
        marginLeft: '1px', 
        marginRight: '3px', // Back to original margin
        paddingLeft: '4px',
        paddingRight: '8px', // More padding pushes chevron left from right edge
        width: `${selectWidth}px` // Dynamic width based on current selection
      }}
      >
        <option value="">{placeholder}</option>
        
        {allowedScopes.includes('global') && (
          <optgroup label="🌐 Global Variables">
            {filteredVariables
              .filter(v => v.scope === 'global')
              .map(variable => (
                <option 
                  key={`global-${variable.name}`} 
                  value={getVariableValue(variable)}
                  title={`${getVariableDisplayName(variable)} - ${variable.type} variable (global scope)`}
                >
                  {formatVariableOption(variable)}
                </option>
              ))
            }
          </optgroup>
        )}
        
        {allowedScopes.includes('instance') && (
          <optgroup label="📦 Instance Variables">
            {filteredVariables
              .filter(v => v.scope === 'instance')
              .map(variable => (
                <option 
                  key={`instance-${variable.name}`} 
                  value={getVariableValue(variable)}
                  title={`${getVariableDisplayName(variable)} - ${variable.type} variable (instance scope)`}
                >
                  {formatVariableOption(variable)}
                </option>
              ))
            }
          </optgroup>
        )}
      </select>
    </div>
  );
}; 