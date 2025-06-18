import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sprite } from '../types/sprites';

interface SpriteContextType {
  sprites: Sprite[];
  selectedSprite: Sprite | null;
  addSprite: (sprite: Sprite) => void;
  removeSprite: (id: string) => void;
  updateSprite: (id: string, updates: Partial<Sprite>) => void;
  selectSprite: (sprite: Sprite | null) => void;
  resetSpritesToInitial: () => void;
  // Import/Export methods
  clearSprites: () => Promise<void>;
  importSprites: (sprites: Sprite[]) => Promise<void>;
}

const SpriteContext = createContext<SpriteContextType | undefined>(undefined);

export const SpriteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [selectedSprite, setSelectedSprite] = useState<Sprite | null>(null);
  const [initialSprites, setInitialSprites] = useState<Sprite[]>([]);

  // Make sprites available globally for code generation
  useEffect(() => {
    (window as any).sprites = sprites;
    // Trigger code regeneration when sprites change
    window.dispatchEvent(new CustomEvent('spritesChanged'));
  }, [sprites]);

  const addSprite = (sprite: Sprite) => {
    setSprites(prev => [...prev, sprite]);
    setInitialSprites(prev => [...prev, { ...sprite }]); // Store initial state
    setSelectedSprite(sprite);
  };

  const removeSprite = (id: string) => {
    setSprites(prev => prev.filter(sprite => sprite.id !== id));
    setInitialSprites(prev => prev.filter(sprite => sprite.id !== id)); // Remove from initial state too
    if (selectedSprite?.id === id) {
      setSelectedSprite(null);
    }
  };

  const updateSprite = (id: string, updates: Partial<Sprite>) => {
    setSprites(prev =>
      prev.map(sprite =>
        sprite.id === id ? { ...sprite, ...updates } : sprite
      )
    );
    if (selectedSprite?.id === id) {
      setSelectedSprite(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const selectSprite = (sprite: Sprite | null) => {
    setSelectedSprite(sprite);
  };

  const resetSpritesToInitial = () => {
    // Reset all sprites to their initial positions and properties
    setSprites(initialSprites.map(sprite => ({ ...sprite })));
    // Clear selection
    setSelectedSprite(null);
  };

  // Import/Export methods
  const clearSprites = async (): Promise<void> => {
    setSprites([]);
    setInitialSprites([]);
    setSelectedSprite(null);
  };

  const importSprites = async (importedSprites: Sprite[]): Promise<void> => {
    // Validate and prepare sprites
    const validSprites = importedSprites.map(sprite => {
      // Ensure required properties exist
      if (!sprite.id) {
        sprite.id = `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!sprite.name) {
        sprite.name = `Sprite ${sprite.id}`;
      }
      if (!sprite.x) sprite.x = 0;
      if (!sprite.y) sprite.y = 0;
      if (!sprite.color) sprite.color = '#ff6b6b';
      return sprite;
    });

    setSprites(validSprites);
    setInitialSprites(validSprites.map(sprite => ({ ...sprite })));
    setSelectedSprite(null);
  };

  return (
    <SpriteContext.Provider value={{
      sprites,
      selectedSprite,
      addSprite,
      removeSprite,
      updateSprite,
      selectSprite,
      resetSpritesToInitial,
      clearSprites,
      importSprites
    }}>
      {children}
    </SpriteContext.Provider>
  );
};

export const useSpriteContext = () => {
  const context = useContext(SpriteContext);
  if (!context) {
    throw new Error('useSpriteContext must be used within a SpriteContext');
  }
  return context;
};