import React, { createContext, useContext, useState, useCallback } from 'react';
import { VariableDefinition } from '../types/blocks';

interface VariableContextType {
  variables: VariableDefinition[];
  addVariable: (variable: Omit<VariableDefinition, 'created'>) => boolean;
  updateVariable: (name: string, scope: 'global' | 'instance', newValue: any, spriteId?: string) => boolean;
  deleteVariable: (name: string, scope: 'global' | 'instance', spriteId?: string) => boolean;
  getVariable: (name: string, scope: 'global' | 'instance', spriteId?: string) => VariableDefinition | undefined;
  getVariablesByScope: (scope: 'global' | 'instance', spriteId?: string) => VariableDefinition[];
  getVariablesByType: (type: 'number' | 'text' | 'boolean') => VariableDefinition[];
  isValidVariableName: (name: string) => boolean;
  variableExists: (name: string, scope: 'global' | 'instance', spriteId?: string) => boolean;
  clearVariables: () => Promise<void>;
  importVariables: (variablesToImport: VariableDefinition[]) => Promise<void>;
}

const VariableContext = createContext<VariableContextType | undefined>(undefined);

// Safe variable name validation - only alphanumeric and underscore, no reserved words
const RESERVED_WORDS = [
  'let', 'const', 'var', 'function', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'return', 'try', 'catch', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in',
  'this', 'super', 'class', 'extends', 'import', 'export', 'default', 'async', 'await', 'yield',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'console', 'window', 'document', 'global',
  'process', 'require', 'module', 'exports', 'eval', 'arguments', 'prototype', '__proto__',
  'constructor', 'hasOwnProperty', 'valueOf', 'toString', 'sprite', 'sprites', 'variables', 
  'globalVariables', 'instanceVariables', 'setup', 'draw', 'mousePressed', 'keyPressed'
];

const isValidVariableName = (name: string): boolean => {
  // Must be non-empty string
  if (!name || typeof name !== 'string') return false;
  
  // Must only contain alphanumeric characters and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return false;
  
  // Cannot be a reserved word
  if (RESERVED_WORDS.includes(name.toLowerCase())) return false;
  
  // Cannot start with numbers
  if (/^[0-9]/.test(name)) return false;
  
  // Length limits
  if (name.length < 1 || name.length > 32) return false;
  
  return true;
};

// Type validation functions
const validateValueType = (value: any, expectedType: 'number' | 'text' | 'boolean'): boolean => {
  switch (expectedType) {
    case 'number':
      return typeof value === 'number' && !isNaN(value) && isFinite(value);
    case 'text':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
};

const coerceValueToType = (value: any, targetType: 'number' | 'text' | 'boolean'): any => {
  switch (targetType) {
    case 'number':
      const num = Number(value);
      return isNaN(num) || !isFinite(num) ? 0 : num;
    case 'text':
      return String(value);
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      return Boolean(value);
    default:
      return value;
  }
};

export const VariableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [variables, setVariables] = useState<VariableDefinition[]>([]);

  const addVariable = useCallback((variable: Omit<VariableDefinition, 'created'>): boolean => {
    // Validate variable name
    if (!isValidVariableName(variable.name)) {
      console.warn(`Invalid variable name: ${variable.name}`);
      return false;
    }

    // Instance variables must have a spriteId
    if (variable.scope === 'instance' && !variable.spriteId) {
      console.warn(`Instance variables must have a spriteId`);
      return false;
    }

    // Check if variable already exists in this scope (considering spriteId for instance variables)
    const exists = variables.some(v => {
      if (v.name === variable.name && v.scope === variable.scope) {
        if (variable.scope === 'global') {
          return true; // Global variables are unique by name
        } else {
          return v.spriteId === variable.spriteId; // Instance variables are unique by name + spriteId
        }
      }
      return false;
    });
    
    if (exists) {
      const scopeDesc = variable.scope === 'global' ? 'global scope' : `instance scope for sprite ${variable.spriteId}`;
      console.warn(`Variable ${variable.name} already exists in ${scopeDesc}`);
      return false;
    }

    // Validate initial value type
    const coercedValue = coerceValueToType(variable.initialValue, variable.type);
    if (!validateValueType(coercedValue, variable.type)) {
      console.warn(`Invalid initial value for ${variable.type} variable: ${variable.initialValue}`);
      return false;
    }

    const newVariable: VariableDefinition = {
      ...variable,
      initialValue: coercedValue,
      created: Date.now()
    };

    setVariables(prev => [...prev, newVariable]);
    return true;
  }, [variables]);

  const updateVariable = useCallback((name: string, scope: 'global' | 'instance', newValue: any, spriteId?: string): boolean => {
    const variable = variables.find(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return true;
        } else {
          return v.spriteId === spriteId;
        }
      }
      return false;
    });
    
    if (!variable) {
      const scopeDesc = scope === 'global' ? 'global scope' : `instance scope for sprite ${spriteId}`;
      console.warn(`Variable ${name} not found in ${scopeDesc}`);
      return false;
    }

    // Type-check the new value
    const coercedValue = coerceValueToType(newValue, variable.type);
    if (!validateValueType(coercedValue, variable.type)) {
      console.warn(`Invalid value for ${variable.type} variable ${name}: ${newValue}`);
      return false;
    }

    setVariables(prev => prev.map(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return { ...v, initialValue: coercedValue };
        } else {
          return v.spriteId === spriteId ? { ...v, initialValue: coercedValue } : v;
        }
      }
      return v;
    }));
    return true;
  }, [variables]);

  const deleteVariable = useCallback((name: string, scope: 'global' | 'instance', spriteId?: string): boolean => {
    const exists = variables.some(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return true;
        } else {
          return v.spriteId === spriteId;
        }
      }
      return false;
    });
    
    if (!exists) {
      const scopeDesc = scope === 'global' ? 'global scope' : `instance scope for sprite ${spriteId}`;
      console.warn(`Variable ${name} not found in ${scopeDesc}`);
      return false;
    }

    setVariables(prev => prev.filter(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return false; // Remove global variable
        } else {
          return v.spriteId !== spriteId; // Remove instance variable for specific sprite
        }
      }
      return true;
    }));
    return true;
  }, [variables]);

  const getVariable = useCallback((name: string, scope: 'global' | 'instance', spriteId?: string): VariableDefinition | undefined => {
    return variables.find(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return true;
        } else {
          return v.spriteId === spriteId;
        }
      }
      return false;
    });
  }, [variables]);

  const getVariablesByScope = useCallback((scope: 'global' | 'instance', spriteId?: string): VariableDefinition[] => {
    return variables.filter(v => {
      if (v.scope === scope) {
        if (scope === 'global') {
          return true;
        } else {
          return v.spriteId === spriteId;
        }
      }
      return false;
    });
  }, [variables]);

  const getVariablesByType = useCallback((type: 'number' | 'text' | 'boolean'): VariableDefinition[] => {
    return variables.filter(v => v.type === type);
  }, [variables]);

  const variableExists = useCallback((name: string, scope: 'global' | 'instance', spriteId?: string): boolean => {
    return variables.some(v => {
      if (v.name === name && v.scope === scope) {
        if (scope === 'global') {
          return true;
        } else {
          return v.spriteId === spriteId;
        }
      }
      return false;
    });
  }, [variables]);

  const clearVariables = useCallback(async (): Promise<void> => {
    setVariables([]);
  }, []);

  const importVariables = useCallback(async (variablesToImport: VariableDefinition[]): Promise<void> => {
    setVariables(prev => [...prev, ...variablesToImport]);
  }, []);

  const value: VariableContextType = {
    variables,
    addVariable,
    updateVariable,
    deleteVariable,
    getVariable,
    getVariablesByScope,
    getVariablesByType,
    isValidVariableName,
    variableExists,
    clearVariables,
    importVariables
  };

  return (
    <VariableContext.Provider value={value}>
      {children}
    </VariableContext.Provider>
  );
};

export const useVariableContext = (): VariableContextType => {
  const context = useContext(VariableContext);
  if (!context) {
    throw new Error('useVariableContext must be used within a VariableProvider');
  }
  return context;
}; 