import { useEffect, useState } from "react"

export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    // Set initial value
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    checkIsMobile()

    // Add resize listener
    window.addEventListener("resize", checkIsMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkIsMobile)
  }, [breakpoint])

  return isMobile
}
