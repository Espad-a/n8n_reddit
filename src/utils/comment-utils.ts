export const getCommentIndentationClass = (depth: number): string => {
  // Define a base unit for indentation using Tailwind's spacing scale.
  // For mobile, we'll use multiples of pl-4 (16px).
  // For desktop, we'll use multiples of md:pl-6 (24px).

  // Cap the depth to prevent excessively deep nesting from causing issues
  const maxDepth = 8; 
  const effectiveDepth = Math.min(depth, maxDepth);

  const mobilePl = effectiveDepth * 4; // e.g., pl-0, pl-4, pl-8, pl-12, ...
  const desktopPl = effectiveDepth * 6; // e.g., md:pl-0, md:pl-6, md:pl-12, md:pl-18, ...

  return `pl-${mobilePl} md:pl-${desktopPl}`;
};