/**
 * Generates a random pleasing color for user identification
 */
const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
  '#F8B500', // Amber
  '#00CED1', // Dark Cyan
  '#FF7F50', // Coral
  '#9370DB', // Medium Purple
  '#20B2AA', // Light Sea Green
];

let colorIndex = 0;

export function getNextColor(): string {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
