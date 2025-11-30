import React from 'react';
import { CursorPosition } from '../types';

interface OtherCursorProps {
  cursor: CursorPosition;
}

export const OtherCursor: React.FC<OtherCursorProps> = ({ cursor }) => {
  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-75 ease-out"
      style={{
        left: cursor.positionX,
        top: cursor.positionY,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M5 3L19 12L12 13L9 20L5 3Z"
          fill={cursor.color}
          stroke="#000"
          strokeWidth="1"
        />
      </svg>
      
      {/* Username label */}
      <div
        className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shadow-lg"
        style={{
          backgroundColor: cursor.color,
          color: getContrastColor(cursor.color),
        }}
      >
        {cursor.username}
      </div>
    </div>
  );
};

// Helper to determine text color based on background
function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
