"use client";

export default function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl h-[75vh] flex flex-col rounded-2xl bg-background shadow-xl border border-border">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <div className="font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
