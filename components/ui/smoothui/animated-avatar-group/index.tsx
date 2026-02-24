"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export type AvatarData = {
  src: string;
  alt: string;
  href?: string;
};

export type AnimatedAvatarGroupProps = {
  avatars: AvatarData[];
  maxVisible?: number;
  size?: number;
  overlap?: number;
  className?: string;
  expandOnHover?: boolean;
  /** Override the "+N" counter with a fixed number (e.g. total member count) */
  extraCount?: number;
  /** Show first 3 chars of alt text below each avatar when expanded */
  showLabel?: boolean;
};

const AnimatedAvatarGroup = ({
  avatars,
  maxVisible = 4,
  size = 40,
  overlap = 0.3,
  className,
  expandOnHover = true,
  extraCount,
  showLabel = false,
}: AnimatedAvatarGroupProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsHoverDevice(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsHoverDevice(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const visibleAvatars = avatars.slice(0, maxVisible);
  const hiddenCount =
    extraCount !== undefined ? extraCount : avatars.length - maxVisible;
  const hasHiddenAvatars = hiddenCount > 0;

  const overlapPx = size * overlap;
  const expanded = expandOnHover && isHoverDevice && isHovered;

  const springTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.25, bounce: 0.1 };

  const labelTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.2, bounce: 0 };

  return (
    <motion.div
      aria-label="Avatar group"
      className={cn("flex items-start", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="group"
    >
      {visibleAvatars.map((avatar, index) => {
        const marginLeft = index === 0 ? 0 : expanded ? 4 : -overlapPx;

        const content = (
          <motion.img
            alt={avatar.alt}
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: expanded ? 1.05 : 1 }
            }
            className="rounded-full object-cover"
            height={size}
            initial={
              shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
            }
            src={avatar.src}
            style={{ width: size, height: size, flexShrink: 0 }}
            transition={{
              ...springTransition,
              delay: shouldReduceMotion ? 0 : index * 0.03,
            }}
            width={size}
          />
        );

        return (
          <motion.div
            animate={{ marginLeft, opacity: 1 }}
            className="relative flex flex-col items-center"
            key={avatar.src}
            style={{
              zIndex: visibleAvatars.length - index,
              width: size,
            }}
            transition={{
              ...springTransition,
              delay: shouldReduceMotion ? 0 : index * 0.03,
            }}
          >
            {/* Avatar circle — overflow-hidden ensures rounded-full clips the image */}
            <div
              className="rounded-full border-2 border-background overflow-hidden shrink-0"
              style={{ width: size, height: size }}
            >
              {avatar.href ? (
                <a aria-label={avatar.alt} href={avatar.href} rel="noopener">
                  {content}
                </a>
              ) : (
                content
              )}
            </div>

            {/* Label: only rendered when showLabel is on */}
            {showLabel && (
              <motion.span
                animate={
                  expanded
                    ? { opacity: 1, y: 0, height: "auto" }
                    : { opacity: 0, y: -4, height: 0 }
                }
                className="overflow-hidden text-center leading-none"
                initial={{ opacity: 0, y: -4, height: 0 }}
                style={{
                  fontSize: size * 0.28,
                  width: size + 4,
                  color: "var(--muted-foreground)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                transition={{
                  ...labelTransition,
                  delay: shouldReduceMotion ? 0 : index * 0.03,
                }}
              >
                {avatar.alt.slice(0, 3)}
              </motion.span>
            )}
          </motion.div>
        );
      })}

      {hasHiddenAvatars ? (
        <motion.div
          animate={{
            marginLeft: expanded ? 4 : -overlapPx,
            opacity: 1,
          }}
          className="relative flex flex-col items-center"
          style={{ width: size, zIndex: 0 }}
          transition={{
            ...springTransition,
            delay: shouldReduceMotion ? 0 : visibleAvatars.length * 0.03,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full border-2 border-background bg-muted shrink-0"
            style={{ width: size, height: size }}
          >
            <span
              className="font-medium text-muted-foreground"
              style={{ fontSize: size * 0.3 }}
            >
              {`+${hiddenCount}`}
            </span>
          </div>

          {showLabel && (
            <motion.span
              animate={
                expanded
                  ? { opacity: 1, y: 0, height: "auto" }
                  : { opacity: 0, y: -4, height: 0 }
              }
              className="overflow-hidden text-center leading-none"
              initial={{ opacity: 0, y: -4, height: 0 }}
              style={{
                fontSize: size * 0.28,
                width: size + 4,
                color: "var(--muted-foreground)",
                marginTop: 2,
              }}
              transition={{
                ...labelTransition,
                delay: shouldReduceMotion
                  ? 0
                  : visibleAvatars.length * 0.03,
              }}
            >
              &nbsp;
            </motion.span>
          )}
        </motion.div>
      ) : null}
    </motion.div>
  );
};

export default AnimatedAvatarGroup;
