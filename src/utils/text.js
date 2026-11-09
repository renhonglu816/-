export const cleanAIText = (value = '') => String(value)
  .replace(/\*/g, '')
  .replace(/^\s*[-•]\s+/gm, '· ')
  .replace(/[ \t]+\n/g, '\n')
  .trim();

