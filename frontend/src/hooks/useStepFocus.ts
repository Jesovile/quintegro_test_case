import { useEffect, useRef, useState } from 'react'
import { CHECKOUT_STEP_HEADING_ID, STEP_LABELS, reactToStepChange } from '@/lib/checkoutSteps'
import { CheckoutStep } from '@/types/order'

// `step` is the step actually on screen (null while loading or redirecting), so the heading exists when focus moves.
// Returns a marker for user navigation and the text for a polite live region.
export const useStepFocus = (step: CheckoutStep | null) => {
  const previous = useRef<CheckoutStep | null>(null)
  const userNavigated = useRef(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!step) {
      return
    }
    const reaction = reactToStepChange(previous.current, step, {
      userNavigated: userNavigated.current,
      focusLost: document.activeElement === document.body
    })
    previous.current = step
    userNavigated.current = false

    if (reaction === 'focus') {
      document.getElementById(CHECKOUT_STEP_HEADING_ID)?.focus()
    } else if (reaction === 'announce') {
      setAnnouncement(`Checkout step: ${STEP_LABELS[step]}`)
    }
  }, [step])

  return {
    announcement,
    // Called by actions that move the user to another step (save, pay, a link in the progress bar)
    markUserNavigation: () => {
      userNavigated.current = true
    }
  }
}
