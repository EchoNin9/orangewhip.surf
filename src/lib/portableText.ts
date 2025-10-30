import { toHTML } from '@portabletext/to-html';
import type { PortableTextBlock } from '@portabletext/types';

export function portableTextToHtml(blocks?: PortableTextBlock[] | null) {
  if (!blocks || blocks.length === 0) return '';
  return toHTML(blocks);
}
