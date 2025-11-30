// Collision detection utilities for textbox overlap prevention

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_BOX_WIDTH = 200;
const DEFAULT_BOX_HEIGHT = 100;
const PADDING = 10; // Minimum gap between boxes

/**
 * Check if two boxes overlap
 */
export function boxesOverlap(box1: Box, box2: Box): boolean {
  return !(
    box1.x + box1.width + PADDING < box2.x ||
    box2.x + box2.width + PADDING < box1.x ||
    box1.y + box1.height + PADDING < box2.y ||
    box2.y + box2.height + PADDING < box1.y
  );
}

/**
 * Check if a position would cause overlap with existing boxes
 */
export function wouldOverlap(
  x: number,
  y: number,
  existingBoxes: Box[],
  excludeId?: string,
  width: number = DEFAULT_BOX_WIDTH,
  height: number = DEFAULT_BOX_HEIGHT
): boolean {
  const newBox: Box = { id: 'new', x, y, width, height };
  
  return existingBoxes.some((box) => {
    if (excludeId && box.id === excludeId) return false;
    return boxesOverlap(newBox, box);
  });
}

/**
 * Find the nearest non-overlapping position
 */
export function findNearestFreePosition(
  targetX: number,
  targetY: number,
  existingBoxes: Box[],
  excludeId?: string,
  width: number = DEFAULT_BOX_WIDTH,
  height: number = DEFAULT_BOX_HEIGHT,
  canvasWidth: number = 5000,
  canvasHeight: number = 5000
): { x: number; y: number } {
  // If no overlap, return original position
  if (!wouldOverlap(targetX, targetY, existingBoxes, excludeId, width, height)) {
    return { x: targetX, y: targetY };
  }

  // Spiral search for nearest free position
  const step = 20;
  const maxRadius = 500;
  
  for (let radius = step; radius <= maxRadius; radius += step) {
    // Check positions in a spiral pattern
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(targetX + radius * Math.cos(rad));
      const y = Math.round(targetY + radius * Math.sin(rad));
      
      // Keep within canvas bounds
      if (x < 0 || y < 0 || x + width > canvasWidth || y + height > canvasHeight) {
        continue;
      }
      
      if (!wouldOverlap(x, y, existingBoxes, excludeId, width, height)) {
        return { x, y };
      }
    }
  }
  
  // Fallback: return original position if no free spot found
  return { x: targetX, y: targetY };
}

/**
 * Get box dimensions from a textbox element
 */
export function getBoxFromElement(id: string, element: HTMLElement, x: number, y: number): Box {
  const rect = element.getBoundingClientRect();
  return {
    id,
    x,
    y,
    width: rect.width || DEFAULT_BOX_WIDTH,
    height: rect.height || DEFAULT_BOX_HEIGHT,
  };
}
