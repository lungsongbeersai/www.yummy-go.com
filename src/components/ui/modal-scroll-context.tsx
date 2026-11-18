"use client"

import { createContext } from "react"

// A portalled nested popover needs its own topmost Radix scroll lock.
export const ModalScrollContext = createContext(false)
