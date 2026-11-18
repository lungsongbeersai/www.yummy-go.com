import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
});

function selectedTextCopy(result = true, options: { modal?: boolean; blockFocus?: boolean; blockSelection?: boolean } = {}) {
  const state: { activeElement: unknown } = { activeElement: null };
  const modal = { appendChild: vi.fn() };
  const body = { appendChild: vi.fn() };
  const focus = vi.fn(() => { state.activeElement = previous; });
  const previous = {
    tagName: "INPUT",
    focus,
    closest: vi.fn(() => options.modal ? modal : null),
    selectionStart: 2,
    selectionEnd: 5,
    selectionDirection: "backward",
    setSelectionRange: vi.fn(),
  };
  state.activeElement = previous;
  const input = {
    value: "", style: {}, setAttribute: vi.fn(), remove: vi.fn(),
    selectionStart: 0, selectionEnd: 0,
    focus: vi.fn(() => { if (!options.blockFocus) state.activeElement = input; }),
    select: vi.fn(),
    setSelectionRange: vi.fn((start: number, end: number) => {
      if (!options.blockSelection) {
        input.selectionStart = start;
        input.selectionEnd = end;
      }
    }),
  };
  const execCommand = vi.fn(() => result);
  vi.stubGlobal("document", {
    body,
    get activeElement() { return state.activeElement; },
    createElement: () => input,
    execCommand,
  });
  return { input, focus, previous, modal, body, execCommand };
}

describe("clipboard support in native WebViews", () => {
  it("uses async clipboard when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { execCommand } = selectedTextCopy();

    expect(await copyTextToClipboard("https://yummy-go.com/posAll?t=table")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://yummy-go.com/posAll?t=table");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("copies selected text and restores focus when the clipboard API is absent", async () => {
    vi.stubGlobal("navigator", {});
    const { input, focus, previous, execCommand } = selectedTextCopy();

    expect(await copyTextToClipboard("table QR link")).toBe(true);
    expect(input.value).toBe("table QR link");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(input.remove).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(previous.setSelectionRange).toHaveBeenCalledWith(2, 5, "backward");
  });

  it("uses selected-text copy if the native clipboard rejects the request", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Not allowed")) } });
    const { input } = selectedTextCopy();

    expect(await copyTextToClipboard("menu QR link")).toBe(true);
    expect(input.remove).toHaveBeenCalledOnce();
  });

  it("reports a failed copy without rejecting or leaving the temporary input", async () => {
    vi.stubGlobal("navigator", {});
    const { input, execCommand } = selectedTextCopy();
    execCommand.mockImplementation(() => { throw new Error("Copy unsupported"); });

    expect(await copyTextToClipboard("menu QR link")).toBe(false);
    expect(input.remove).toHaveBeenCalledOnce();
  });

  it("keeps the copy input inside the active modal's focus scope", async () => {
    vi.stubGlobal("navigator", {});
    const { input, modal, body, previous } = selectedTextCopy(true, { modal: true });

    expect(await copyTextToClipboard("table QR link")).toBe(true);
    expect(previous.closest).toHaveBeenCalledWith('[role="dialog"], [role="alertdialog"]');
    expect(modal.appendChild).toHaveBeenCalledWith(input);
    expect(body.appendChild).not.toHaveBeenCalled();
  });

  it("does not copy an unrelated selection if focus is redirected away", async () => {
    vi.stubGlobal("navigator", {});
    const { input, execCommand } = selectedTextCopy(true, { blockFocus: true });

    expect(await copyTextToClipboard("table QR link")).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
    expect(input.remove).toHaveBeenCalledOnce();
  });

  it("does not report success when the intended text was not selected", async () => {
    vi.stubGlobal("navigator", {});
    const { execCommand } = selectedTextCopy(true, { blockSelection: true });

    expect(await copyTextToClipboard("table QR link")).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });
});
