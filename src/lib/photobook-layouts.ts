// Photobook layout definitions
import type { LayoutType } from "./types";

export type LayoutSlot = {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
};

export type LayoutDefinition = {
  id: LayoutType;
  name: string;
  slots: LayoutSlot[];
};

export const LAYOUTS: LayoutDefinition[] = [
  {
    id: "single-full",
    name: "Single Photo (Full Bleed)",
    slots: [{ x: 0, y: 0, width: 100, height: 100 }],
  },
  {
    id: "two-horizontal",
    name: "Two Photos (Horizontal)",
    slots: [
      { x: 0, y: 0, width: 100, height: 49 },
      { x: 0, y: 51, width: 100, height: 49 },
    ],
  },
  {
    id: "two-vertical",
    name: "Two Photos (Vertical)",
    slots: [
      { x: 0, y: 0, width: 49, height: 100 },
      { x: 51, y: 0, width: 49, height: 100 },
    ],
  },
  {
    id: "three-mixed-left",
    name: "Three Photos (Large Left)",
    slots: [
      { x: 0, y: 0, width: 65, height: 100 },
      { x: 67, y: 0, width: 33, height: 49 },
      { x: 67, y: 51, width: 33, height: 49 },
    ],
  },
  {
    id: "three-mixed-right",
    name: "Three Photos (Large Right)",
    slots: [
      { x: 0, y: 0, width: 33, height: 49 },
      { x: 0, y: 51, width: 33, height: 49 },
      { x: 35, y: 0, width: 65, height: 100 },
    ],
  },
  {
    id: "four-grid",
    name: "Four Photos (Grid)",
    slots: [
      { x: 0, y: 0, width: 49, height: 49 },
      { x: 51, y: 0, width: 49, height: 49 },
      { x: 0, y: 51, width: 49, height: 49 },
      { x: 51, y: 51, width: 49, height: 49 },
    ],
  },
  {
    id: "six-collage",
    name: "Six Photos (Collage)",
    slots: [
      { x: 0, y: 0, width: 33, height: 33 },
      { x: 34, y: 0, width: 33, height: 33 },
      { x: 67, y: 0, width: 33, height: 33 },
      { x: 0, y: 34, width: 33, height: 33 },
      { x: 34, y: 34, width: 33, height: 33 },
      { x: 67, y: 34, width: 33, height: 33 },
    ],
  },
  {
    id: "blank",
    name: "Blank Canvas",
    slots: [],
  },
];

export function getLayoutById(id: LayoutType): LayoutDefinition | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
