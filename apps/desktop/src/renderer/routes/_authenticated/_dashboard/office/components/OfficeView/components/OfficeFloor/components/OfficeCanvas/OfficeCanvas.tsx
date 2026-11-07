import { useEffect, useRef } from "react";
import {
	drawOffice,
	type OfficeScene,
} from "renderer/routes/_authenticated/_dashboard/office/utils/drawOffice";
import { TILE_SIZE } from "renderer/routes/_authenticated/_dashboard/office/utils/officeLayout";

const FRAME_MS = 125;

/**
 * Pixel art drawn at a whole-number scale with smoothing off, redrawn at a
 * few frames per second, or once per change with reduced motion.
 */
export function OfficeCanvas({
	scene,
	scale,
	reducedMotion,
}: {
	scene: OfficeScene;
	scale: number;
	reducedMotion: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const width = scene.layout.width * TILE_SIZE;
	const height = scene.layout.height * TILE_SIZE;

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const pixelRatio = Math.max(
			1,
			Math.round(scale * (window.devicePixelRatio || 1)),
		);
		canvas.width = width * pixelRatio;
		canvas.height = height * pixelRatio;
		ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		ctx.imageSmoothingEnabled = false;

		const render = () => drawOffice(ctx, scene, Date.now(), reducedMotion);
		render();
		if (reducedMotion) return;
		let last = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			if (now - last >= FRAME_MS) {
				last = now;
				render();
			}
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [scene, scale, reducedMotion, width, height]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className="block [image-rendering:pixelated]"
			style={{ width: width * scale, height: height * scale }}
		/>
	);
}
