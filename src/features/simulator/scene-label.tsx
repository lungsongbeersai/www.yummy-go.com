"use client";

import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";

interface SceneLabelProps {
  children: ReactNode;
  position: [number, number, number];
  center?: boolean;
  zIndexRange?: [number, number];
  style?: CSSProperties;
}

// Each effect owns a fresh DOM container. Drei 10.7 Html reuses its container
// while synchronously unmounting a nested React root; React 19 StrictMode can
// then remove a child already replaced by the next setup. Defer root disposal
// until the parent commit ends, and never reuse that root's container.
export function SceneLabel({ children, position, center = false, zIndexRange = [50, 0], style }: SceneLabelProps) {
  const group = useRef<Group>(null);
  const root = useRef<Root | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const { gl, camera, size, invalidate } = useThree();
  const world = useMemo(() => new Vector3(), []);
  const projected = useMemo(() => new Vector3(), []);
  const high = zIndexRange[0];
  const low = zIndexRange[1];

  useLayoutEffect(() => {
    const target = gl.domElement.parentElement;
    if (!target) return;
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.top = "0";
    element.style.left = "0";
    element.style.visibility = "hidden";
    target.appendChild(element);
    const current = createRoot(element);
    host.current = element;
    root.current = current;
    invalidate();
    return () => {
      if (root.current === current) root.current = null;
      if (host.current === element) host.current = null;
      element.remove();
      queueMicrotask(() => current.unmount());
    };
  }, [gl, invalidate]);

  useLayoutEffect(() => {
    root.current?.render(<div style={style}>{children}</div>);
    invalidate();
  }, [children, style, invalidate]);

  useFrame(() => {
    const element = host.current;
    if (!element || !group.current) return;
    group.current.getWorldPosition(world);
    projected.copy(world).project(camera);
    const visible = projected.z >= -1 && projected.z <= 1;
    element.style.visibility = visible ? "visible" : "hidden";
    if (!visible) return;
    const x = (projected.x + 1) * size.width / 2;
    const y = (1 - projected.y) * size.height / 2;
    element.style.transform = `translate3d(${x}px,${y}px,0)${center ? " translate(-50%,-50%)" : ""}`;
    const depth = Math.max(0, Math.min(1, (world.distanceTo(camera.position) - camera.near) / (camera.far - camera.near)));
    element.style.zIndex = String(Math.round(high + (low - high) * depth));
  });

  return <group ref={group} position={position} />;
}
