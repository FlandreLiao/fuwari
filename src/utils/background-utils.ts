/**
 * Resolves the config-driven site background image.
 * `import.meta.glob` is a build-time macro, so the lookup lives in this module and is reused
 * by both the `<html>` class decision (Layout.astro) and the image itself (SiteBackground.astro).
 */

import path from "node:path";
import type { ImageMetadata } from "astro";

const backgroundFiles = import.meta.glob<ImageMetadata>(
	"../**/*.{jpg,jpeg,png,webp,avif,gif}",
	{
		import: "default",
	},
);

function resolveKey(src: string): string {
	return path.join("../", src).replace(/\\/g, "/");
}

/** Whether the configured background image exists in the project. */
export function hasBackgroundImage(src: string): boolean {
	return Boolean(backgroundFiles[resolveKey(src)]);
}

/** Loads the configured background image metadata, or `null` when it cannot be found. */
export async function loadBackgroundImage(
	src: string,
): Promise<ImageMetadata | null> {
	const loader = backgroundFiles[resolveKey(src)];
	if (!loader) {
		return null;
	}
	return await loader();
}
