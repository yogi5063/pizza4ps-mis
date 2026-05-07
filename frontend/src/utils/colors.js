export const CAT_COLORS = {
  'Pizza':   '#6958C2',
  'Food':    '#22c55e',
  'Drink':   '#3b82f6',
  'Dessert': '#ec4899',
  'Add-on':  '#f59e0b',
  'Retail':  '#8b5cf6',
  'Other':   '#94a3b8',
  'Comment': '#cbd5e1',
}

export const CHANNEL_COLORS = {
  'Handy': '#6958C2',
  'TTO':   '#22c55e',
  'POS':   '#f59e0b',
  'BYOD':  '#3b82f6',
}

export const CAT_ICONS = {
  'Pizza':   '🍕',
  'Food':    '🥗',
  'Drink':   '🥤',
  'Dessert': '🍰',
  'Add-on':  '➕',
  'Retail':  '🛍️',
  'Other':   '📦',
  'Comment': '💬',
}

export function goldColor(intensity) {
  const r = Math.round(18 + intensity * 210)
  const g = Math.round(15 + intensity * 165)
  const b = Math.round(8 + intensity * 15)
  return `rgb(${r},${g},${b})`
}
