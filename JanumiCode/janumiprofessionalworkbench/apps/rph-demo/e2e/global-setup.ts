// Clear the review gallery before each run so it always reflects THIS run's end-to-end testing.
import { mkdirSync, rmSync } from 'node:fs';
import { GALLERY_ROOT } from './support/gallery';

export default function globalSetup(): void {
	rmSync(GALLERY_ROOT, { recursive: true, force: true });
	mkdirSync(GALLERY_ROOT, { recursive: true });
}
