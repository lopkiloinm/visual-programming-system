export interface Sprite {
  id: string;
  name: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  rotation?: number;
  visible?: boolean;
  // Universal frame clock approach - sprite waits until this frame number
  waitUntilFrame?: number; // Frame number to wait until (0 = not waiting)
}