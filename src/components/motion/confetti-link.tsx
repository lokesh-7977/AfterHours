"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { popFrom } from "./confetti";

/** A Link that pops confetti from itself on click (navigation proceeds as normal). */
export function ConfettiLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        popFrom(e.currentTarget);
        onClick?.(e);
      }}
    />
  );
}
