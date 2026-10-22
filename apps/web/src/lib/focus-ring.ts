// One focus ring for every form control, so they all look and animate the same.
// Rings are box-shadows, hence box-shadow in the transition. Change the design here.

const motion =
  "transition-[color,background-color,border-color,box-shadow] duration-200 ease-out ring-offset-background outline-none";

/** The control itself receives focus: Input, Textarea, SelectTrigger, Checkbox… */
export const focusRing = `${motion} focus-visible:ring-[1.5px] focus-visible:ring-primary focus-visible:ring-offset-2 aria-invalid:focus-visible:ring-destructive`;

/** A wrapper whose inner element gets focus: tags input, rich-text editor. */
export const focusWithinRing = `${motion} focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-offset-2 aria-invalid:focus-within:ring-destructive`;
