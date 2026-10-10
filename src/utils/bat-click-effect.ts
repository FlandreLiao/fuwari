/**
 * Flandre-style click effect: a burst of red-eyed little bats on every click.
 *
 * Zero dependencies — one full-viewport canvas, pre-rendered bat sprites and a
 * requestAnimationFrame loop that stops itself as soon as nothing is alive.
 */

import {
	BAT_EYE_GLOW_RADIUS,
	BAT_EYE_LEFT,
	BAT_EYE_RIGHT,
	BAT_PATH,
} from "@constants/bat";

export type BatEffectOptions = {
	/** Bats spawned per click. Clamped to 1-40. Defaults to 12. */
	batsPerClick?: number;
	/** Hard cap on live bats. Clamped to 10-600. Defaults to 240. */
	maxBats?: number;
};

type Bat = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	rotation: number;
	spin: number;
	scale: number;
	variant: number;
	age: number;
	life: number;
	trail: boolean;
	trailAcc: number;
};

type Ember = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	radius: number;
	color: string;
	age: number;
	life: number;
};

type Ring = {
	x: number;
	y: number;
	inner: number;
	outer: number;
	width: number;
	color: string;
	age: number;
	life: number;
};

type Spark = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	rotation: number;
	age: number;
	life: number;
};

type Flash = {
	x: number;
	y: number;
	inner: number;
	outer: number;
	age: number;
	life: number;
};

type SpriteVariant = {
	top: string;
	bottom: string;
	rim: string | null;
};

const CANVAS_ID: string = "bat-click-effect-canvas";
const CANVAS_Z_INDEX: number = 9999;
const BASE_SPRITE_SIZE: number = 24;
const SPRITE_SUPERSAMPLE: number = 3;
const DEFAULT_BATS_PER_CLICK: number = 12;
const MAX_BATS_DEFAULT: number = 240;
const MAX_EMBERS: number = 400;
const MAX_RINGS: number = 6;
const MAX_SPARKS: number = 60;
const CLICK_THROTTLE_MS: number = 60;

/** Flandre palette: deep crimson, near-black silhouette, scarlet highlight, gold crystal sparks. */
const CRIMSON: string = "#e11d3c";
const SCARLET: string = "#ff5d78";
const GOLD: string = "#f5c451";
const EYE_CORE: string = "#ffd9e2";

const SPRITE_VARIANTS: SpriteVariant[] = [
	{ top: "#f23a5c", bottom: "#a30d2a", rim: null },
	{ top: "#3d0a16", bottom: "#1b040b", rim: CRIMSON },
	{ top: "#ff8fa3", bottom: "#e01f45", rim: null },
];

const BAT_POOL: number[] = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

type EffectWindow = {
	__batClickEffectStarted?: boolean;
};

type BatEffectOptionsResolved = {
	batsPerClick: number;
	maxBats: number;
};

const randomBetween = (min: number, max: number): number =>
	min + Math.random() * (max - min);

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Builds the pre-rendered bat sprites (body gradient, rim light and glowing red eyes). */
function buildSprites(dark: boolean): HTMLCanvasElement[] {
	const size = BASE_SPRITE_SIZE * SPRITE_SUPERSAMPLE;
	const scale = size / 24;
	const path = new Path2D(BAT_PATH);
	const sprites: HTMLCanvasElement[] = [];

	for (const variant of SPRITE_VARIANTS) {
		const sprite = document.createElement("canvas");
		sprite.width = size;
		sprite.height = size;
		const ctx = sprite.getContext("2d");
		if (!ctx) {
			continue;
		}

		ctx.save();
		ctx.scale(scale, scale);

		const gradient = ctx.createLinearGradient(0, 4, 0, 19);
		gradient.addColorStop(0, variant.top);
		gradient.addColorStop(1, variant.bottom);

		if (dark) {
			ctx.shadowColor = "rgba(255, 45, 85, 0.55)";
			ctx.shadowBlur = 4;
		}
		ctx.fillStyle = gradient;
		ctx.fill(path);
		ctx.restore();

		if (variant.rim) {
			ctx.save();
			ctx.scale(scale, scale);
			ctx.globalAlpha = 0.9;
			ctx.lineWidth = 0.5;
			ctx.strokeStyle = variant.rim;
			ctx.stroke(path);
			ctx.restore();
		}

		// Glowing red eyes: a soft additive halo plus a hot core.
		ctx.save();
		ctx.scale(scale, scale);
		ctx.globalCompositeOperation = "lighter";
		for (const eye of [BAT_EYE_LEFT, BAT_EYE_RIGHT]) {
			const glow = ctx.createRadialGradient(
				eye.x,
				eye.y,
				0,
				eye.x,
				eye.y,
				BAT_EYE_GLOW_RADIUS,
			);
			glow.addColorStop(0, "rgba(255, 63, 96, 0.95)");
			glow.addColorStop(0.45, "rgba(255, 40, 80, 0.45)");
			glow.addColorStop(1, "rgba(255, 40, 80, 0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(eye.x, eye.y, BAT_EYE_GLOW_RADIUS, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = EYE_CORE;
		for (const eye of [BAT_EYE_LEFT, BAT_EYE_RIGHT]) {
			ctx.beginPath();
			ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();

		sprites.push(sprite);
	}

	return sprites;
}

function spawnBurst(
	x: number,
	y: number,
	config: BatEffectOptionsResolved,
	state: {
		bats: Bat[];
		embers: Ember[];
		rings: Ring[];
		sparks: Spark[];
		flashes: Flash[];
	},
): void {
	const { bats, rings, sparks, flashes } = state;

	flashes.push({ x, y, inner: 4, outer: 30, age: 0, life: 150 });

	if (rings.length < MAX_RINGS) {
		rings.push({
			x,
			y,
			inner: 6,
			outer: 86,
			width: 3.5,
			color: CRIMSON,
			age: 0,
			life: 420,
		});
		rings.push({
			x,
			y,
			inner: 4,
			outer: 62,
			width: 1.6,
			color: GOLD,
			age: -70,
			life: 380,
		});
	}

	for (let i = 0; i < config.batsPerClick; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = randomBetween(3.2, 8.7);
		bats.push({
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			// The sprite points "up", so add a quarter turn to fly along the velocity.
			rotation: angle + Math.PI / 2,
			spin: randomBetween(-0.05, 0.05),
			scale: randomBetween(0.65, 1.35),
			variant: BAT_POOL[Math.floor(Math.random() * BAT_POOL.length)],
			age: 0,
			life: randomBetween(700, 1250),
			trail: Math.random() < 0.3,
			trailAcc: 0,
		});
	}
	while (bats.length > config.maxBats) {
		bats.shift();
	}

	const sparkCount = Math.min(
		MAX_SPARKS - sparks.length,
		Math.ceil(config.batsPerClick / 4),
	);
	for (let i = 0; i < sparkCount; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = randomBetween(2, 5);
		sparks.push({
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			size: randomBetween(4, 8),
			rotation: randomBetween(0, Math.PI),
			age: 0,
			life: randomBetween(450, 700),
		});
	}
}

/**
 * Mounts the click effect. Idempotent and a no-op when the visitor prefers reduced motion,
 * when the canvas API is unavailable, or when the effect is already running.
 */
export function initBatClickEffect(options: BatEffectOptions = {}): void {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return;
	}

	const effectWindow = window as unknown as EffectWindow;
	if (
		effectWindow.__batClickEffectStarted ||
		document.getElementById(CANVAS_ID)
	) {
		effectWindow.__batClickEffectStarted = true;
		return;
	}

	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	if (reducedMotion.matches) {
		return;
	}

	const config: BatEffectOptionsResolved = {
		batsPerClick: clamp(
			Math.round(options.batsPerClick ?? DEFAULT_BATS_PER_CLICK),
			1,
			40,
		),
		maxBats: clamp(Math.round(options.maxBats ?? MAX_BATS_DEFAULT), 10, 600),
	};

	const canvas = document.createElement("canvas");
	canvas.id = CANVAS_ID;
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return;
	}
	effectWindow.__batClickEffectStarted = true;

	// A <canvas> is a replaced element: `position: fixed; inset: 0` would still resolve its
	// width/height to the intrinsic (attribute) size, so pin the CSS box inline instead.
	canvas.style.position = "fixed";
	canvas.style.top = "0";
	canvas.style.left = "0";
	canvas.style.display = "block";
	canvas.style.pointerEvents = "none";
	canvas.style.zIndex = String(CANVAS_Z_INDEX);
	canvas.style.transition = "none";

	// The stylesheet only carries the print opt-out; geometry is set inline per resize.
	const style = document.createElement("style");
	style.textContent = `@media print{#${CANVAS_ID}{display:none}}`;
	document.head.appendChild(style);
	document.body.appendChild(canvas);

	const state = {
		bats: [] as Bat[],
		embers: [] as Ember[],
		rings: [] as Ring[],
		sparks: [] as Spark[],
		flashes: [] as Flash[],
	};

	let spritesLight: HTMLCanvasElement[] | null = null;
	let spritesDark: HTMLCanvasElement[] | null = null;
	const getSprites = (): HTMLCanvasElement[] => {
		const dark = document.documentElement.classList.contains("dark");
		if (dark) {
			spritesDark ??= buildSprites(true);
			return spritesDark;
		}
		spritesLight ??= buildSprites(false);
		return spritesLight;
	};

	let viewWidth = 0;
	let viewHeight = 0;
	let resizeFrame = 0;

	const resize = (): void => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		viewWidth = window.innerWidth;
		viewHeight = window.innerHeight;
		canvas.width = Math.round(viewWidth * dpr);
		canvas.height = Math.round(viewHeight * dpr);
		// Keep the CSS box exactly equal to the viewport so one drawing unit is one CSS pixel
		// on screen; otherwise the dpr transform would shift every particle.
		canvas.style.width = `${viewWidth}px`;
		canvas.style.height = `${viewHeight}px`;
		// canvas.width resets the 2d transform, so apply the DPR scale afterwards.
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	let rafId = 0;
	let lastFrame = 0;
	let lastBurst = 0;

	const isAlive = (): boolean =>
		state.bats.length > 0 ||
		state.embers.length > 0 ||
		state.rings.length > 0 ||
		state.sparks.length > 0 ||
		state.flashes.length > 0;

	const update = (dt: number): void => {
		const { bats, embers, rings, sparks, flashes } = state;

		for (let i = bats.length - 1; i >= 0; i--) {
			const bat = bats[i];
			bat.age += dt * (1000 / 60);
			if (bat.age >= bat.life) {
				bats.splice(i, 1);
				continue;
			}
			bat.vx *= 0.972 ** dt;
			bat.vy = bat.vy * 0.972 ** dt + 0.05 * dt;
			bat.x += bat.vx * dt;
			bat.y += bat.vy * dt;
			bat.rotation += bat.spin * dt;

			if (bat.trail) {
				bat.trailAcc += dt;
				while (bat.trailAcc >= 3) {
					bat.trailAcc -= 3;
					if (embers.length < MAX_EMBERS) {
						embers.push({
							x: bat.x + randomBetween(-2, 2),
							y: bat.y + randomBetween(-2, 2),
							vx: randomBetween(-0.5, 0.5),
							vy: randomBetween(-0.4, 0.7),
							radius: randomBetween(1.6, 2.6),
							color: Math.random() < 0.7 ? SCARLET : GOLD,
							age: 0,
							life: randomBetween(300, 520),
						});
					}
				}
			}
		}

		for (let i = embers.length - 1; i >= 0; i--) {
			const ember = embers[i];
			const step = dt * (1000 / 60);
			ember.age += step;
			if (ember.age >= ember.life || ember.y > viewHeight + 40) {
				embers.splice(i, 1);
				continue;
			}
			ember.vx *= 0.94 ** dt;
			ember.vy = ember.vy * 0.94 ** dt + 0.03 * dt;
			ember.x += ember.vx * dt;
			ember.y += ember.vy * dt;
		}

		for (let i = rings.length - 1; i >= 0; i--) {
			const ring = rings[i];
			ring.age += dt * (1000 / 60);
			if (ring.age >= ring.life) {
				rings.splice(i, 1);
			}
		}

		for (let i = sparks.length - 1; i >= 0; i--) {
			const spark = sparks[i];
			spark.age += dt * (1000 / 60);
			if (spark.age >= spark.life) {
				sparks.splice(i, 1);
				continue;
			}
			spark.vx *= 0.95 ** dt;
			spark.vy = spark.vy * 0.95 ** dt + 0.02 * dt;
			spark.x += spark.vx * dt;
			spark.y += spark.vy * dt;
			spark.rotation += 0.08 * dt;
		}

		for (let i = flashes.length - 1; i >= 0; i--) {
			const flash = flashes[i];
			flash.age += dt * (1000 / 60);
			if (flash.age >= flash.life) {
				flashes.splice(i, 1);
			}
		}
	};

	const render = (): void => {
		const { bats, embers, rings, sparks, flashes } = state;
		ctx.clearRect(0, 0, viewWidth, viewHeight);

		// Core flash + embers + sparks are additive so they glow on both themes.
		ctx.globalCompositeOperation = "lighter";
		for (const flash of flashes) {
			const t = flash.age / flash.life;
			const radius = flash.inner + (flash.outer - flash.inner) * t;
			const gradient = ctx.createRadialGradient(
				flash.x,
				flash.y,
				0,
				flash.x,
				flash.y,
				radius,
			);
			gradient.addColorStop(0, `rgba(255, 214, 224, ${0.9 * (1 - t)})`);
			gradient.addColorStop(0.4, `rgba(255, 60, 96, ${0.55 * (1 - t)})`);
			gradient.addColorStop(1, "rgba(255, 40, 80, 0)");
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
			ctx.fill();
		}
		for (const ember of embers) {
			const t = ember.age / ember.life;
			ctx.globalAlpha = 0.85 * (1 - t);
			ctx.fillStyle = ember.color;
			ctx.beginPath();
			ctx.arc(ember.x, ember.y, ember.radius * (1 - t * 0.6), 0, Math.PI * 2);
			ctx.fill();
		}
		for (const spark of sparks) {
			const t = spark.age / spark.life;
			const size = spark.size * (1 - t);
			ctx.globalAlpha = 0.9 * (1 - t);
			ctx.fillStyle = GOLD;
			ctx.save();
			ctx.translate(spark.x, spark.y);
			ctx.rotate(spark.rotation);
			ctx.beginPath();
			ctx.moveTo(0, -size);
			ctx.quadraticCurveTo(0, 0, size, 0);
			ctx.quadraticCurveTo(0, 0, 0, size);
			ctx.quadraticCurveTo(0, 0, -size, 0);
			ctx.quadraticCurveTo(0, 0, 0, -size);
			ctx.fill();
			ctx.restore();
		}
		ctx.globalAlpha = 1;

		// Shockwave rings.
		ctx.globalCompositeOperation = "source-over";
		for (const ring of rings) {
			if (ring.age < 0) {
				continue;
			}
			const t = ring.age / ring.life;
			ctx.globalAlpha = 0.75 * (1 - t) ** 1.6;
			ctx.strokeStyle = ring.color;
			ctx.lineWidth = Math.max(0.4, ring.width * (1 - t));
			ctx.beginPath();
			ctx.arc(
				ring.x,
				ring.y,
				ring.inner + (ring.outer - ring.inner) * easeOutCubic(t),
				0,
				Math.PI * 2,
			);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;

		// The bats themselves.
		const sprites = getSprites();
		for (const bat of bats) {
			const t = bat.age / bat.life;
			const fadeIn = Math.min(1, t / 0.15);
			const fadeOut = t > 0.55 ? Math.max(0, (1 - t) / 0.45) : 1;
			const sprite = sprites[bat.variant];
			if (!sprite) {
				continue;
			}
			const size = BASE_SPRITE_SIZE * bat.scale;
			ctx.globalAlpha = 0.96 * fadeIn * fadeOut;
			ctx.save();
			ctx.translate(bat.x, bat.y);
			ctx.rotate(bat.rotation);
			ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	};

	const frame = (now: number): void => {
		if (document.hidden) {
			rafId = 0;
			lastFrame = 0;
			return;
		}
		const dt =
			lastFrame === 0 ? 1 : clamp((now - lastFrame) / (1000 / 60), 0.2, 2);
		lastFrame = now;
		update(dt);
		render();
		if (isAlive()) {
			rafId = window.requestAnimationFrame(frame);
			return;
		}
		rafId = 0;
		lastFrame = 0;
		ctx.clearRect(0, 0, viewWidth, viewHeight);
	};

	const startLoop = (): void => {
		if (rafId === 0) {
			rafId = window.requestAnimationFrame(frame);
		}
	};

	const onClick = (event: MouseEvent): void => {
		if (event.button !== 0 || reducedMotion.matches) {
			return;
		}
		// Keyboard activation (Enter on a link) reports no pointer coordinates.
		if (event.detail === 0 && event.clientX === 0 && event.clientY === 0) {
			return;
		}
		const now = performance.now();
		if (now - lastBurst < CLICK_THROTTLE_MS) {
			return;
		}
		lastBurst = now;
		spawnBurst(event.clientX, event.clientY, config, state);
		startLoop();
	};

	document.addEventListener("click", onClick, { passive: true });
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden && isAlive()) {
			startLoop();
		}
	});
	window.addEventListener("resize", () => {
		if (resizeFrame !== 0) {
			return;
		}
		resizeFrame = window.requestAnimationFrame(() => {
			resizeFrame = 0;
			resize();
		});
	});

	resize();
}
