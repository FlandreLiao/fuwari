/**
 * Bat geometry shared by the footer icon (inline SVG) and the click-effect particle sprites (canvas).
 * All coordinates are in the SVG viewBox space, so a single `d` string stays the source of truth.
 */

export const BAT_VIEWBOX: string = "0 0 24 24";

/** Closed path: two ears, two wings with scalloped trailing edges, tapered body and tail. */
export const BAT_PATH: string =
	"M12 7.4C11.6 6.3 10.8 5.4 10.1 5.1C9.9 6.2 9.8 7.1 9.7 7.8C9.2 8.1 8.9 8.6 8.8 9.1" +
	"C6.4 8.4 3.8 7.9 1.2 8.2C1.6 10.2 2.7 11.9 4.3 13.2C5.3 13.9 6.4 14.1 7.1 12.9" +
	"C7.9 14.1 8.9 15.3 9.9 16.3C10.6 17.1 11.3 17.8 12 18.4C12.7 17.8 13.4 17.1 14.1 16.3" +
	"C15.1 15.3 16.1 14.1 16.9 12.9C17.6 14.1 18.7 13.9 19.7 13.2C21.3 11.9 22.4 10.2 22.8 8.2" +
	"C20.2 7.9 17.6 8.4 15.2 9.1C15.1 8.6 14.8 8.1 14.3 7.8C14.2 7.1 14.1 6.2 13.9 5.1" +
	"C13.2 5.4 12.4 6.3 12 7.4Z";

export type BatEye = {
	x: number;
	y: number;
	r: number;
};

/** Glowing red eyes of the little bat (Flandre style). */
export const BAT_EYE_LEFT: BatEye = { x: 10.8, y: 9.2, r: 0.85 };
export const BAT_EYE_RIGHT: BatEye = { x: 13.2, y: 9.2, r: 0.85 };

/** Radius of the soft additive halo painted around each eye by the canvas sprites. */
export const BAT_EYE_GLOW_RADIUS: number = 3.4;
