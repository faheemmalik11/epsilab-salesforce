import standardSprite from '@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url';
import utilitySprite from '@salesforce-ux/design-system/assets/icons/utility-sprite/svg/symbols.svg?url';

const sprites = { standard: standardSprite, utility: utilitySprite } as const;

export type IconCategory = keyof typeof sprites;

export function iconHref(category: IconCategory, name: string): string {
  return `${sprites[category]}#${name}`;
}
