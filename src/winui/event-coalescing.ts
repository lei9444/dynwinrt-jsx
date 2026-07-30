import type {
  CoalescingScheduler,
} from '../core/coalescing'

export interface CompositionTargetBinding<Token> {
  add_Rendering(callback: () => void): Token
  remove_Rendering(token: Token): void
}

export function createCompositionFrameScheduler<Token>(
  compositionTarget: CompositionTargetBinding<Token>,
): CoalescingScheduler {
  return (flush) => {
    let active = true
    let token: Token | undefined
    const cancel = () => {
      if (!active) {
        return
      }
      active = false
      if (token !== undefined) {
        compositionTarget.remove_Rendering(token)
      }
    }
    token = compositionTarget.add_Rendering(() => {
      cancel()
      flush()
    })
    return cancel
  }
}
