"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const BackgroundRippleEffect = ({
  cellSize = 56,
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
}) => {
  const ref = useRef<any>(null);

  const [dimensions, setDimensions] = useState({
    rows: 8,
    cols: 27,
  });

  useEffect(() => {
    const update = () => {
      setDimensions({
        rows: Math.ceil(window.innerHeight / cellSize),
        cols: Math.ceil(window.innerWidth / cellSize),
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [cellSize]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-10 pointer-events-none",
        "[--cell-border-color:var(--color-neutral-300)] [--cell-fill-color:var(--color-neutral-100)] [--cell-shadow-color:var(--color-neutral-500)]",
        "dark:[--cell-border-color:var(--color-neutral-700)] dark:[--cell-fill-color:var(--color-neutral-900)] dark:[--cell-shadow-color:var(--color-neutral-800)]"
      )}
    >
      <div className="relative h-auto w-auto overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden" />
        <DivGrid
          className="mask-radial-from-20% mask-radial-at-top opacity-600"
          rows={dimensions.rows}
          cols={dimensions.cols}
          cellSize={cellSize}
          borderColor="var(--cell-border-color)"
          fillColor="var(--cell-fill-color)"
        />
      </div>
    </div>
  );
};

type DivGridProps = {
  className?: string;
  rows: number;
  cols: number;
  cellSize: number;
  borderColor: string;
  fillColor: string;
};

const DivGrid = ({
  className,
  rows = 7,
  cols = 30,
  cellSize = 56,
  borderColor = "#3f3f46",
  fillColor = "rgba(14,165,233,0.3)",
}: DivGridProps) => {
  const cells = useMemo(
    () => Array.from({ length: rows * cols }, (_, idx) => idx),
    [rows, cols]
  );

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
    width: cols * cellSize,
    height: rows * cellSize,
    marginInline: "auto",
  };

  return (
    <div className={cn("relative z-[3]", className)} style={gridStyle}>
      {cells.map((idx) => (
        <div
          key={idx}
          className="cell relative border-[0.5px] opacity-40 dark:shadow-[0px_0px_40px_1px_var(--cell-shadow-color)_inset]"
          style={{
            backgroundColor: fillColor,
            borderColor: borderColor,
            width: cellSize,
            height: cellSize,
          }}
        />
      ))}
    </div>
  );
};