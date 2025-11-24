"use client";

import { LAYOUTS } from "@/lib/photobook-layouts";
import type { LayoutType } from "@/lib/types";

type LayoutPanelProps = {
  selectedLayout: LayoutType;
  onSelectLayout: (layoutId: LayoutType) => void;
};

export default function LayoutPanel({
  selectedLayout,
  onSelectLayout,
}: LayoutPanelProps) {
  return (
    <div className="h-full flex flex-col bg-surface border-r border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Layouts</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            onClick={() => onSelectLayout(layout.id)}
            className={`
              w-full p-3 rounded-lg border-2 transition-all
              ${
                selectedLayout === layout.id
                  ? "border-[#5eb9b3] bg-[#5eb9b3]/10"
                  : "border-border hover:border-[#5eb9b3]/50 bg-white"
              }
            `}
          >
            <div className="mb-2 h-20 bg-gray-100 rounded overflow-hidden relative">
              {/* Visual preview of layout */}
              {layout.slots.map((slot, idx) => (
                <div
                  key={idx}
                  className="absolute border border-gray-400 bg-gray-200"
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                />
              ))}
              {layout.slots.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  Blank
                </div>
              )}
            </div>
            <div className="text-xs text-center font-medium text-foreground">
              {layout.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
