import React, { useState, useRef } from 'react';
import { Download, Upload, Save, FileJson, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { useBlockContext } from '../contexts/BlockContext';
import { useSpriteContext } from '../contexts/SpriteContext';
import { useVariableContext } from '../contexts/VariableContext';

interface WorkspaceData {
  version: string;
  exportDate: string;
  workspaceBlocks: any[];
  connections: any[];
  sprites: any[];
  variables: any[];
  metadata: {
    totalBlocks: number;
    totalConnections: number;
    totalSprites: number;
    totalVariables: number;
    workspaceTypes: string[];
  };
}

export const JsonEditor: React.FC = () => {
  const { workspaceBlocks, connections, clearWorkspace, importWorkspaceData } = useBlockContext();
  const { sprites, clearSprites, importSprites } = useSpriteContext();
  const { variables, clearVariables, importVariables } = useVariableContext();
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'info' | null, message: string}>({type: null, message: ''});
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate current workspace JSON
  const generateCurrentJson = (): WorkspaceData => {
    const workspaceTypes = Array.from(new Set([
      ...workspaceBlocks.map(b => b.workspaceType || 'stage'),
      'stage'
    ]));

    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      workspaceBlocks,
      connections,
      sprites,
      variables,
      metadata: {
        totalBlocks: workspaceBlocks.length,
        totalConnections: connections.length,
        totalSprites: sprites.length,
        totalVariables: variables.length,
        workspaceTypes
      }
    };
  };

  // Export current workspace to JSON
  const handleExport = () => {
    try {
      const data = generateCurrentJson();
      const jsonString = JSON.stringify(data, null, 2);
      setJsonText(jsonString);
      setStatus({type: 'success', message: `Exported ${data.metadata.totalBlocks} blocks, ${data.metadata.totalConnections} connections, ${data.metadata.totalSprites} sprites, and ${data.metadata.totalVariables} variables`});
    } catch (error) {
      setStatus({type: 'error', message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`});
    }
  };

  // Download JSON file
  const handleDownload = () => {
    try {
      const data = generateCurrentJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({type: 'success', message: 'JSON file downloaded successfully'});
    } catch (error) {
      setStatus({type: 'error', message: `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`});
    }
  };

  // Import from JSON text
  const handleImport = async () => {
    if (!jsonText.trim()) {
      setStatus({type: 'error', message: 'Please provide JSON data to import'});
      return;
    }

    setIsLoading(true);
    try {
      const data: WorkspaceData = JSON.parse(jsonText);
      
      // Validate JSON structure
      if (!data.workspaceBlocks || !Array.isArray(data.workspaceBlocks)) {
        throw new Error('Invalid JSON: workspaceBlocks must be an array');
      }
      if (!data.connections || !Array.isArray(data.connections)) {
        throw new Error('Invalid JSON: connections must be an array');
      }
      if (!data.sprites || !Array.isArray(data.sprites)) {
        throw new Error('Invalid JSON: sprites must be an array');
      }
      
      // Variables are optional for backwards compatibility
      const variablesToImport = data.variables && Array.isArray(data.variables) ? data.variables : [];

      // Clear existing data
      await clearWorkspace();
      await clearSprites();
      await clearVariables();

      // Import new data
      if (data.sprites.length > 0) {
        await importSprites(data.sprites);
      }
      
      if (data.workspaceBlocks.length > 0 || data.connections.length > 0) {
        await importWorkspaceData(data.workspaceBlocks, data.connections);
      }

      if (variablesToImport.length > 0) {
        await importVariables(variablesToImport);
      }

      setStatus({
        type: 'success', 
        message: `Import successful! Loaded ${data.workspaceBlocks.length} blocks, ${data.connections.length} connections, ${data.sprites.length} sprites, and ${variablesToImport.length} variables`
      });
    } catch (error) {
      setStatus({
        type: 'error', 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load from file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setStatus({type: 'error', message: 'Please select a JSON file'});
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setJsonText(content);
        setStatus({type: 'info', message: `File "${file.name}" loaded. Click Import to apply changes.`});
      } catch (error) {
        setStatus({type: 'error', message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`});
      }
    };
    reader.readAsText(file);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setStatus({type: 'success', message: 'JSON copied to clipboard'});
    } catch (error) {
      setStatus({type: 'error', message: 'Failed to copy to clipboard'});
    }
  };

  // Clear JSON text
  const handleClear = () => {
    setJsonText('');
    setStatus({type: null, message: ''});
  };

  // Auto-refresh JSON when workspace changes
  React.useEffect(() => {
    if (!jsonText) {
      handleExport();
    }
  }, [workspaceBlocks.length, connections.length, sprites.length, variables.length]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <FileJson size={18} className="text-blue-600" />
          <span className="font-semibold text-gray-800">JSON Import/Export</span>
        </div>
        
        <div className="text-xs text-gray-600 mb-3">
          Save and load your entire workspace including blocks, connections, and sprites as JSON data.
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-xs transition-colors"
          >
            <Save size={12} />
            <span>Export Current</span>
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-xs transition-colors"
          >
            <Download size={12} />
            <span>Download</span>
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md text-xs transition-colors"
          >
            <Upload size={12} />
            <span>Load File</span>
          </button>
          
          <button
            onClick={handleCopy}
            disabled={!jsonText}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy size={12} />
            <span>Copy</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Status message */}
      {status.type && (
        <div className={`p-3 border-b flex items-center space-x-2 ${
          status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {status.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          <span className="text-xs">{status.message}</span>
        </div>
      )}

      {/* JSON Editor */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">JSON Data</span>
            <div className="flex space-x-2">
              <button
                onClick={handleImport}
                disabled={!jsonText.trim() || isLoading}
                className="flex items-center space-x-1 px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                <span>{isLoading ? 'Importing...' : 'Import'}</span>
              </button>
              
              <button
                onClick={handleClear}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="JSON workspace data will appear here... You can also paste your own JSON data to import."
          className="flex-1 p-4 font-mono text-xs bg-white border-none resize-none focus:outline-none focus:ring-0"
          style={{ fontFamily: 'Monaco, Consolas, "Lucida Console", monospace' }}
        />
      </div>
    </div>
  );
}; 