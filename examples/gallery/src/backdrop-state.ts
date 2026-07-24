let windowBackdropRestored = false

export function markWindowBackdropRestored(): void {
  windowBackdropRestored = true
}

export function wasWindowBackdropRestored(): boolean {
  return windowBackdropRestored
}
