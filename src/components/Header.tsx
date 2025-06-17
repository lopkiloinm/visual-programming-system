import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          </div>
          <h1 className="text-xl font-bold">Snap</h1>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <span className="text-sm opacity-90">Visual Programming Environment</span>
      </div>
    </header>
  );
};