import { useEffect, useState } from 'react'

export function useCountdown(targetTimestamp?: number | null): string | null {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!targetTimestamp) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [targetTimestamp])

  if (!targetTimestamp) return null

  const remainingMs = Math.max(0, targetTimestamp - now)
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
