import { motion, type HTMLMotionProps } from 'motion/react';

const spring = { type: 'spring', stiffness: 500, damping: 32 } as const;

/** Botón con feedback de hover/pressed (§13.6). Respeta `reducedMotion` vía MotionConfig. */
export function Btn({
  transition = spring,
  whileHover = { scale: 1.04 },
  whileTap = { scale: 0.95 },
  ...props
}: HTMLMotionProps<'button'>) {
  return <motion.button transition={transition} whileHover={whileHover} whileTap={whileTap} {...props} />;
}

export function Select(props: HTMLMotionProps<'select'>) {
  return <motion.select whileHover={{ scale: 1.01 }} whileFocus={{ scale: 1.02 }} transition={spring} {...props} />;
}

export function Input(props: HTMLMotionProps<'input'>) {
  return <motion.input whileHover={{ scale: 1.01 }} whileFocus={{ scale: 1.02 }} transition={spring} {...props} />;
}
