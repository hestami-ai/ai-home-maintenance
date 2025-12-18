/**
 * Type declaration shim for @prisma/client/runtime/library
 * 
 * In Prisma 7.x, the runtime path changed from @prisma/client/runtime/library
 * to @prisma/client/runtime/client. The zod-prisma-types generator still uses
 * the old path, so we create this shim to re-export from the correct location.
 */
declare module '@prisma/client/runtime/library' {
	export { Decimal, DecimalJsLike } from '@prisma/client/runtime/client';
}
