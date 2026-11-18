import { afterEach, describe, expect, it, vi } from "vitest"
import { shakeDialog } from "@/components/ui/dialog-shake"

afterEach(() => vi.unstubAllGlobals())

function animationEnvironment(individualTranslate: boolean, reducedMotion = false) {
  vi.stubGlobal("CSS", { supports: () => individualTranslate })
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reducedMotion }) })
  vi.stubGlobal("document", { documentElement: { classList: { contains: () => false } } })
  const animations: Array<{ id: string; cancel: ReturnType<typeof vi.fn> }> = []
  const animate = vi.fn(() => {
    const animation = { id: "", cancel: vi.fn() }
    animations.push(animation)
    return animation
  })
  // The old engine exposes animate but has no getAnimations method.
  const element = { animate } as unknown as HTMLElement
  return { element, animate, animations }
}

describe("dialog backdrop feedback", () => {
  it("flashes without replacing legacy centering and cancels the previous flash on WebView 83", () => {
    const { element, animate, animations } = animationEnvironment(false)
    shakeDialog(element)
    shakeDialog(element)
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    expect(animations[1].id).toBe("dialog-shake")
    const [keyframes, options] = animate.mock.calls[1] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(keyframes.every(frame => "boxShadow" in frame && !("transform" in frame))).toBe(true)
    expect(options.duration).toBe(600)
  })

  it("keeps movement when translate handles centering and respects reduced motion", () => {
    const modern = animationEnvironment(true)
    shakeDialog(modern.element)
    expect((modern.animate.mock.calls[0] as unknown as [Keyframe[]])[0][1].transform).toBe("translateX(-10px)")
    const reduced = animationEnvironment(true, true)
    shakeDialog(reduced.element)
    expect((reduced.animate.mock.calls[0] as unknown as [Keyframe[]])[0][0]).toHaveProperty("boxShadow")
  })

  it("tolerates an absent element or animation API", () => {
    expect(() => shakeDialog(null)).not.toThrow()
    expect(() => shakeDialog({} as HTMLElement)).not.toThrow()
  })
})
