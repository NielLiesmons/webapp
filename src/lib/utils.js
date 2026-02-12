/**
 * Utility functions
 */
/**
 * Combines class names, filtering out falsy values
 * Simple implementation of clsx/classnames functionality
 */
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
