"use client";

import { ReactNode, useState,useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";
type NavItem = {
  name: string;
  link: string;
  icon?: ReactNode;
};

type FloatingNavProps = {
  navItems: NavItem[];
  leftSlot: ReactNode;
  rightSlot: ReactNode;
  onMobileMenuOpen: () => void;
  className?: string;
};

export const FloatingNav = ({
  navItems,
  leftSlot,
  rightSlot,
  onMobileMenuOpen,
  className,
}: FloatingNavProps) => {
  const { scrollYProgress } = useScroll();

  const [visible, setVisible] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const [canScroll, setCanScroll] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------------- helpers ---------------- */

  const clearHideTimer = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const startIdleHideTimer = () => {
    if (!canScroll || isInteracting || isScrolling) return;

    clearHideTimer();
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 2000);
  };

  /* ---------------- detect scrollability ---------------- */

  useEffect(() => {
    const checkScrollable = () => {
      setCanScroll(
        document.documentElement.scrollHeight >
          window.innerHeight + 4
      );
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);
    return () => window.removeEventListener("resize", checkScrollable);
  }, []);

  /* ---------------- force visible on short pages ---------------- */

  useEffect(() => {
    if (!canScroll) {
      clearHideTimer();
      setVisible(true);
    }
  }, [canScroll]);

  /* ---------------- scroll logic ---------------- */

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (!canScroll || typeof current !== "number") return;

    const prev = scrollYProgress.getPrevious() ?? current;
    const direction = current - prev;

    if (Math.abs(direction) < 0.002) return;

    setIsScrolling(true);
    clearHideTimer();

    if (scrollEndTimeoutRef.current) {
      clearTimeout(scrollEndTimeoutRef.current);
    }

    scrollEndTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      startIdleHideTimer();
    }, 150);

    if (direction > 0) {
      // ⬇ scroll down → hide immediately
      setVisible(false);
    } else {
      // ⬆ scroll up → show
      setVisible(true);
    }
  });

  /* ---------------- interaction handling ---------------- */

  const beginInteraction = () => {
    setIsInteracting(true);
    clearHideTimer();
  };

  const endInteraction = () => {
    setIsInteracting(false);
    startIdleHideTimer();
  };


  return (
    <AnimatePresence>
      <motion.div
      onMouseEnter={beginInteraction}
      onMouseLeave={endInteraction}
      onTouchStart={beginInteraction}
      onFocusCapture={beginInteraction}
      onBlurCapture={endInteraction}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed top-3 inset-x-0 mx-auto z-[5000]",
          "max-w-6xl",
          "rounded-full border bg-background/80 backdrop-blur-md shadow-lg",
          "px-6 py-2",
          className
        )}
      >
        <div className="relative flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            {leftSlot}
          </div>

          {/* CENTER (DESKTOP ONLY) */}
          <nav className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
            <a
            key={item.name}
            href={item.link}
            className="flex items-center gap-2 text-md font-medium text-muted-foreground hover:text-foreground transition whitespace-nowrap"
          >
                   
                {item.icon}
                <span>{item.name}</span>
              </a>
            ))}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-3">
              {rightSlot}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={onMobileMenuOpen}
              className="lg:hidden p-2 rounded-md hover:bg-muted"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
