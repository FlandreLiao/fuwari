/**
 * "本站已持续运行 X 天 X 小时 X 分 X 秒" helpers.
 * The same formatting runs at build time (Footer.astro) and in the browser every second.
 */

const UPTIME_PREFIX: string = "本站已持续运行";

type SwupLike = {
	hooks?: {
		on: (event: string, handler: () => void) => void;
	};
};

type ClockWindow = {
	swup?: SwupLike;
	__blogUptimeClockStarted?: boolean;
};

/**
 * Milliseconds since the site went live, or `null` when `startDate` is not a valid date.
 * A start date in the future is clamped to 0 instead of returning a negative duration.
 */
export function getElapsedMs(
	startDate: string,
	now: number = Date.now(),
): number | null {
	const start = new Date(startDate).getTime();
	if (Number.isNaN(start)) {
		return null;
	}
	return Math.max(0, now - start);
}

/** Formats an elapsed duration as `本站已持续运行 366 天 10 小时 12 分 56 秒`. */
export function formatUptimeLine(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${UPTIME_PREFIX} ${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒`;
}

/**
 * Starts the seconds clock that keeps every `[data-blog-uptime]` element in sync.
 * Idempotent: safe to call again after a Swup navigation or a dev-server HMR reload.
 */
export function startUptimeClock(): void {
	const clockWindow = window as unknown as ClockWindow;
	if (clockWindow.__blogUptimeClockStarted) {
		return;
	}
	clockWindow.__blogUptimeClockStarted = true;

	// ISO strings are parsed once per distinct value, not once per second.
	const startTimes = new Map<string, number>();

	const update = (): void => {
		const nodes = document.querySelectorAll<HTMLElement>("[data-blog-uptime]");
		for (const node of nodes) {
			const raw = node.dataset.start;
			if (!raw) {
				continue;
			}
			if (!startTimes.has(raw)) {
				startTimes.set(raw, new Date(raw).getTime());
			}
			const start = startTimes.get(raw);
			if (start === undefined || Number.isNaN(start)) {
				continue;
			}
			const line = formatUptimeLine(Math.max(0, Date.now() - start));
			if (node.textContent !== line) {
				node.textContent = line;
			}
		}
	};

	// Self-correcting timeout keeps the seconds digit flipping on wall-clock boundaries.
	const tick = (): void => {
		update();
		window.setTimeout(tick, 1000 - (Date.now() % 1000));
	};

	// The desktop footer lives inside the Swup container and is replaced on every navigation,
	// so refresh immediately after a page view instead of waiting for the next tick.
	const hookSwup = (): void => {
		clockWindow.swup?.hooks?.on("page:view", update);
	};
	if (clockWindow.swup?.hooks) {
		hookSwup();
	} else {
		document.addEventListener("swup:enable", hookSwup);
	}

	tick();
}
