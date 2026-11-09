import { describe, expect, it } from "vitest";
import { placePopover, type PortalLayout } from "./popover-position";

function layout(overrides: Partial<PortalLayout> = {}): PortalLayout {
  return {
    trigger: { left: 118, top: 420, width: 44, height: 32 },
    content: { width: 240, height: 100, naturalHeight: 100 },
    viewport: { left: 0, top: 0, width: 380, height: 500 },
    ...overrides,
  };
}

describe("popover viewport placement", () => {
  it("keeps the left-edge voice panel inside a narrow viewport", () => {
    const input = layout();
    const panel = placePopover(input, "top", "end", 8);
    expect(input.trigger.left + panel.x).toBe(8);
    expect(input.trigger.top + panel.y + panel.height).toBe(412);
    expect(panel.side).toBe("top");
  });

  it("retains the requested alignment when there is enough room", () => {
    const input = layout({ viewport: { left: 0, top: 0, width: 900, height: 680 } });
    const panel = placePopover(input, "top", "start", 8);
    expect(panel.x).toBe(0);
    expect(panel.y).toBe(-108);
  });

  it("shifts a right-edge panel back inside the viewport", () => {
    const input = layout({ trigger: { left: 328, top: 20, width: 40, height: 40 } });
    const panel = placePopover(input, "bottom", "start", 8);
    expect(input.trigger.left + panel.x + panel.width).toBe(372);
    expect(panel.y).toBe(48);
  });

  it.each([
    ["bottom", 420, "top"],
    ["top", 20, "bottom"],
  ] as const)("flips from %s when that edge has too little room", (side, top, expected) => {
    const input = layout({ trigger: { left: 120, top, width: 40, height: 40 } });
    const panel = placePopover(input, side, "center", 8);
    expect(panel.side).toBe(expected);
    expect(input.trigger.top + panel.y).toBeGreaterThanOrEqual(8);
    expect(input.trigger.top + panel.y + panel.height).toBeLessThanOrEqual(492);
  });

  it("limits a tall panel on the roomier side without flipping back after measurement", () => {
    const input = layout({
      trigger: { left: 120, top: 200, width: 40, height: 40 },
      content: { width: 240, height: 600, naturalHeight: 600 },
    });
    const panel = placePopover(input, "top", "center", 8);
    expect(panel.side).toBe("bottom");
    expect(panel.maxHeight).toBe(244);
    const remeasured = placePopover({ ...input, content: { ...input.content, height: panel.height } }, "top", "center", 8);
    expect(remeasured).toEqual(panel);
  });

  it("uses the resized visual viewport and bounds an oversized panel", () => {
    const input = layout({
      viewport: { left: 40, top: 50, width: 240, height: 300 },
      content: { width: 320, height: 100, naturalHeight: 100 },
      trigger: { left: 235, top: 240, width: 40, height: 40 },
    });
    const panel = placePopover(input, "bottom", "start", 8);
    expect(panel.width).toBe(224);
    expect(input.trigger.left + panel.x).toBe(48);
    expect(panel.side).toBe("top");
    expect(input.trigger.top + panel.y).toBeGreaterThanOrEqual(58);
  });
});
