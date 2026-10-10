import type {
	BackgroundConfig,
	ClickEffectConfig,
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
	UptimeConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "FlandreLiao's Blog",
	subtitle: "Hello World",
	lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 25, // Locked to Flandre crimson; see backgroundConfig + styles/variables.styl
		fixed: true, // Hide the theme color picker and ignore any stored hue
	},
	banner: {
		enable: false, // The full-page background image replaces the banner
		src: "assets/images/芙兰.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "top", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		{
			src: "/favicon/favicon.png", // Path of the favicon, relative to the /public directory
			// theme: "light", // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
			// sizes: "32x32", // (Optional) Size of the favicon, set only if you have favicons of different sizes
		},
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/FlandreLiao", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/芙兰头像.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "FlandreLiao",
	bio: "开发者 & 车万人 & ...",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/FlandreLiao",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};

export const uptimeConfig: UptimeConfig = {
	enable: true, // Show "本站已持续运行 X 天 X 小时 X 分 X 秒" in the footer
	// Blog launch = the first personalized + Cloudflare deploy commit (2026-07-14 10:55 +08:00).
	startDate: "2026-07-14T10:55:00+08:00", // ISO 8601 with a timezone offset; an invalid date hides the line
};

export const clickEffectConfig: ClickEffectConfig = {
	enable: true, // Flandre-style red-eyed bat particle burst on every click
	batsPerClick: 12, // Bats spawned per click, clamped to 1-40
};

export const backgroundConfig: BackgroundConfig = {
	enable: true, // Full-viewport background image with glass surfaces on top
	src: "assets/images/芙兰.jpg", // Relative to the /src directory
	position: "center", // Desktop/landscape framing
	positionMobile: "62% 32%", // Portrait framing, keeps Flandre's face in view
	blur: 0, // Blur of the image itself, in px (0 = crisp artwork)
	brightness: 1, // Brightness multiplier of the image (1 = untouched)
	scrimLight: 0.28, // Scrim opacity in light mode (0-1)
	scrimDark: 0.26, // Scrim opacity in dark mode (0-1)
	glow: 0.14, // Crimson glow strength layered over the scrim (0-1)
};
