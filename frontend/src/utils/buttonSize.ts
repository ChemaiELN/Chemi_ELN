/**
 * Page-level buttons across the ADC module are standardized to a 32px height.
 * Spread this into a Button's `style` to force just the height while keeping
 * its existing `size`/`type` prop (and therefore its font size, padding, and
 * icon size) untouched.
 *
 * Do NOT apply inside Modal / Drawer / Popover / Popconfirm content — those
 * keep antd's own default sizing per the design spec.
 */
export const BTN_32 = { height: 32 } as const
