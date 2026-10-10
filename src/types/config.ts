import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";

export type SiteConfig = {
	title: string;
	subtitle: string;

	lang:
		| "en"
		| "zh_CN"
		| "zh_TW"
		| "ja"
		| "ko"
		| "es"
		| "th"
		| "vi"
		| "tr"
		| "id";

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export enum LinkPreset {
	Home = 0,
	Archive = 1,
	About = 2,
}

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPreset)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type ExpressiveCodeConfig = {
	theme: string;
};

export type UptimeConfig = {
	enable: boolean;
	/** The date the site went live, in ISO 8601 with a timezone offset, e.g. "2023-09-26T14:27:38+08:00" */
	startDate: string;
};

export type ClickEffectConfig = {
	enable: boolean;
	/** Number of bats spawned per click. Clamped to 1-40 by the effect. */
	batsPerClick: number;
};

export type BackgroundConfig = {
	enable: boolean;
	/** Image path relative to /src, e.g. "assets/images/芙兰.jpg" */
	src: string;
	/** CSS object-position used on desktop/landscape viewports */
	position: string;
	/** CSS object-position used below the 768px breakpoint */
	positionMobile: string;
	/** Blur applied to the background image itself, in px */
	blur: number;
	/** Brightness multiplier applied to the background image (1 = untouched) */
	brightness: number;
	/** Scrim opacity in light mode, 0-1 */
	scrimLight: number;
	/** Scrim opacity in dark mode, 0-1 */
	scrimDark: number;
	/** Strength of the crimson glow layered on top of the scrim, 0-1 */
	glow: number;
};
