import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
const WHEEL_ZOOM_SPEED = 0.0025;
const FIT_MARGIN = 24;

export interface Camera {
	/** Screen pixels from the viewport's top-left to the world's origin. */
	x: number;
	y: number;
	zoom: number;
}

export interface WorldRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function clampZoom(zoom: number) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The camera that shows `rect` whole and centered in a viewport. */
export function fitCamera(
	rect: WorldRect,
	viewport: { width: number; height: number },
	maxZoom = MAX_ZOOM,
): Camera {
	const zoom = clampZoom(
		Math.min(
			(viewport.width - 2 * FIT_MARGIN) / Math.max(rect.width, 1),
			(viewport.height - 2 * FIT_MARGIN) / Math.max(rect.height, 1),
			maxZoom,
		),
	);
	return {
		zoom,
		x: (viewport.width - rect.width * zoom) / 2 - rect.x * zoom,
		y: (viewport.height - rect.height * zoom) / 2 - rect.y * zoom,
	};
}

/** Zooms by `factor` while the world point under `at` stays put. */
export function zoomAround(
	camera: Camera,
	factor: number,
	at: { x: number; y: number },
): Camera {
	const zoom = clampZoom(camera.zoom * factor);
	const ratio = zoom / camera.zoom;
	return {
		zoom,
		x: at.x - (at.x - camera.x) * ratio,
		y: at.y - (at.y - camera.y) * ratio,
	};
}

/**
 * Pan and zoom over a world drawn in CSS pixels. Wheel or two fingers pan,
 * pinch or ⌘/Ctrl + wheel zooms at the pointer, and a drag on empty floor
 * pans. The first time the world has a size, the camera fits it whole.
 */
export function useOfficeCamera(world: { width: number; height: number }) {
	const worldRef = useRef(world);
	worldRef.current = world;
	const viewportRef = useRef<HTMLDivElement>(null);
	const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
	const [viewport, setViewport] = useState({ width: 0, height: 0 });
	const fitted = useRef(false);

	useEffect(() => {
		const element = viewportRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			setViewport({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const fit = useCallback(() => {
		const { width, height } = worldRef.current;
		if (viewport.width === 0 || width === 0) return;
		setCamera(fitCamera({ x: 0, y: 0, width, height }, viewport, 1.5));
	}, [viewport]);

	useEffect(() => {
		if (fitted.current || viewport.width === 0 || world.width === 0) return;
		fitted.current = true;
		fit();
	}, [fit, viewport.width, world.width]);

	const focusRect = useCallback(
		(rect: WorldRect) => {
			if (viewport.width === 0) return;
			setCamera(fitCamera(rect, viewport, 2.5));
		},
		[viewport],
	);

	const zoomBy = useCallback(
		(factor: number) => {
			setCamera((current) =>
				zoomAround(current, factor, {
					x: viewport.width / 2,
					y: viewport.height / 2,
				}),
			);
		},
		[viewport],
	);

	/** Pans just enough to bring a world rectangle into view. */
	const reveal = useCallback(
		(rect: WorldRect) => {
			setCamera((current) => {
				const left = rect.x * current.zoom + current.x;
				const top = rect.y * current.zoom + current.y;
				const right = left + rect.width * current.zoom;
				const bottom = top + rect.height * current.zoom;
				let dx = 0;
				let dy = 0;
				if (left < FIT_MARGIN) dx = FIT_MARGIN - left;
				else if (right > viewport.width - FIT_MARGIN)
					dx = viewport.width - FIT_MARGIN - right;
				if (top < FIT_MARGIN) dy = FIT_MARGIN - top;
				else if (bottom > viewport.height - FIT_MARGIN)
					dy = viewport.height - FIT_MARGIN - bottom;
				if (dx === 0 && dy === 0) return current;
				return { ...current, x: current.x + dx, y: current.y + dy };
			});
		},
		[viewport],
	);

	useEffect(() => {
		const element = viewportRef.current;
		if (!element) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const bounds = element.getBoundingClientRect();
			if (event.ctrlKey || event.metaKey) {
				const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED * 4);
				setCamera((current) =>
					zoomAround(current, factor, {
						x: event.clientX - bounds.left,
						y: event.clientY - bounds.top,
					}),
				);
				return;
			}
			setCamera((current) => ({
				...current,
				x: current.x - event.deltaX,
				y: current.y - event.deltaY,
			}));
		};
		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, []);

	const drag = useRef<{ x: number; y: number; id: number } | null>(null);
	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			if ((event.target as HTMLElement).closest("button, a, input")) return;
			drag.current = {
				x: event.clientX,
				y: event.clientY,
				id: event.pointerId,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[],
	);
	const onPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const start = drag.current;
			if (!start || start.id !== event.pointerId) return;
			const dx = event.clientX - start.x;
			const dy = event.clientY - start.y;
			drag.current = { ...start, x: event.clientX, y: event.clientY };
			setCamera((current) => ({
				...current,
				x: current.x + dx,
				y: current.y + dy,
			}));
		},
		[],
	);
	const onPointerUp = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (drag.current?.id === event.pointerId) drag.current = null;
		},
		[],
	);

	return {
		viewportRef,
		camera,
		viewport,
		fit,
		focusRect,
		zoomBy,
		reveal,
		isDragging: () => drag.current !== null,
		panHandlers: { onPointerDown, onPointerMove, onPointerUp },
	};
}
