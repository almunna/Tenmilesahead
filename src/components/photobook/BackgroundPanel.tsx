"use client";

type BackgroundPanelProps = {
  selectedColor: string;
  onSelectColor: (color: string) => void;
};

const BACKGROUND_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Paper Light", value: "#f7fafd" },
  { name: "Metal", value: "#9ca3af" },
  { name: "Paper", value: "#e5e7eb" },
  { name: "Black", value: "#000000" },
  { name: "Gray 45p", value: "#737373" },
  { name: "Paper 50p", value: "#d1d5db" },
  { name: "Gray", value: "#8b5a3c" },
  { name: "Tan", value: "#c2b5a3" },
];

const BACKGROUND_PATTERNS = [
  { name: "paper light", preview: "#f0f0f0" },
  { name: "metal *p", preview: "#c0c0c0" },
  { name: "gray 45p", preview: "#808080" },
  { name: "gray", preview: "#696969" },
  { name: "paper 50p", preview: "#e8e8e8" },
  { name: "tan", preview: "#d2b48c" },
];

export default function BackgroundPanel({
  selectedColor,
  onSelectColor,
}: BackgroundPanelProps) {
  return (
    <div className="h-full flex flex-col bg-surface border-r border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Backgrounds</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-4">
          <button className="w-full px-3 py-2 text-xs bg-white border border-border rounded hover:bg-gray-50 mb-2">
            + Get more backgrounds
          </button>
        </div>

        {/* Color swatches */}
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onSelectColor(color.value)}
              className={`
                aspect-square rounded-lg border-2 transition-all relative
                ${
                  selectedColor === color.value
                    ? "border-[#5eb9b3] ring-2 ring-[#5eb9b3]/30"
                    : "border-gray-300 hover:border-[#5eb9b3]/50"
                }
              `}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {selectedColor === color.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white drop-shadow"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Pattern section */}
        <div className="mt-6">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
            Patterns (Coming Soon)
          </div>
          <div className="grid grid-cols-3 gap-2 opacity-50">
            {BACKGROUND_PATTERNS.map((pattern, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-lg border border-gray-300"
                style={{ backgroundColor: pattern.preview }}
                title={pattern.name}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
