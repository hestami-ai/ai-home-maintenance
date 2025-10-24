import {
	FileLoader,
	Loader,
	Group
} from 'three';

import * as fflate from 'three/addons/libs/fflate.module.js';
// Use our custom parser with fixes
import { DebugUSDAParser } from '$lib/loaders/usd/DebugUSDAParser';
// @ts-ignore - TypeScript definitions are incomplete for USD parsers
import { USDCParser } from 'three/addons/loaders/usd/USDCParser.js';

/**
 * Debug version of USDLoader with extensive logging
 * Based on Three.js USDLoader but with added debugging
 */
class DebugUSDLoader extends Loader {
	constructor(manager?: any) {
		super(manager);
		console.log('[DebugUSDLoader] Constructor called');
	}

	load(url: string, onLoad: (group: Group) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: Error) => void) {
		console.log('[DebugUSDLoader] load() called with URL:', url);
		
		const scope = this;
		const loader = new FileLoader(scope.manager);
		loader.setPath(scope.path);
		loader.setResponseType('arraybuffer');
		loader.setRequestHeader(scope.requestHeader);
		loader.setWithCredentials(scope.withCredentials);
		
		loader.load(
			url,
			function (buffer: any) {
				console.log('[DebugUSDLoader] File loaded, buffer size:', buffer.byteLength);
				
				try {
					const result = scope.parse(buffer);
					console.log('[DebugUSDLoader] Parse successful, calling onLoad');
					onLoad(result);
				} catch (e: any) {
					console.error('[DebugUSDLoader] Parse failed:', e);
					console.error('[DebugUSDLoader] Error stack:', e.stack);
					
					if (onError) {
						onError(e as Error);
					} else {
						console.error(e);
					}
					
					scope.manager.itemError(url);
				}
			},
			onProgress,
			// @ts-ignore - Type mismatch in Three.js loader signature
			onError
		);
	}

	parse(buffer: ArrayBuffer | string): Group {
		console.log('[DebugUSDLoader] parse() called');
		console.log('[DebugUSDLoader] Buffer type:', typeof buffer);
		console.log('[DebugUSDLoader] Buffer size:', buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length);
		
		const usda = new DebugUSDAParser();
		const usdc = new USDCParser();

		function parseAssets(zip: any) {
			console.log('[DebugUSDLoader] parseAssets() called');
			console.log('[DebugUSDLoader] ZIP contents:', Object.keys(zip));
			
			const data: any = {};
			const loader = new FileLoader();
			loader.setResponseType('arraybuffer');

			for (const filename in zip) {
				console.log('[DebugUSDLoader] Processing file:', filename);
				
				// Store with multiple path variations to handle different reference styles
				// USD files can reference with @./path@ or @path@ or just path
				const normalizedPath = filename.replace(/^\.\//, ''); // Remove leading ./
				
				if (filename.endsWith('png')) {
					console.log('[DebugUSDLoader] Found PNG texture:', filename);
					const blob = new Blob([zip[filename]], { type: 'image/png' });
					data[filename] = URL.createObjectURL(blob);
				}

				if (filename.endsWith('usd') || filename.endsWith('usda') || filename.endsWith('usdc')) {
					console.log('[DebugUSDLoader] Found USD file:', filename);
					
					// DON'T parse individual files yet - store raw text/data
					// The main parser will handle parsing and resolving references
					if (isCrateFile(zip[filename])) {
						console.log('[DebugUSDLoader] File is USDC (Crate) format - storing raw buffer');
						data[filename] = zip[filename];
						if (!filename.startsWith('./')) {
							data['./' + filename] = zip[filename];
						}
					} else {
						console.log('[DebugUSDLoader] File is USDA (ASCII) format - storing raw text');
						const text = fflate.strFromU8(zip[filename]);
						console.log('[DebugUSDLoader] Converted to text, length:', text.length);
						console.log('[DebugUSDLoader] First 200 chars:', text.substring(0, 200));
						
						// Store raw text, not parsed data
						data[filename] = text;
						// Also store with ./ prefix for references like @./path@
						if (!filename.startsWith('./')) {
							data['./' + filename] = text;
							console.log('[DebugUSDLoader] Also stored as:', './' + filename);
						}
					}
				}
			}

			console.log('[DebugUSDLoader] parseAssets() complete, parsed files:', Object.keys(data));
			return data;
		}

		function isCrateFile(buffer: ArrayBuffer | Uint8Array): boolean {
			const crateHeader = new Uint8Array([0x50, 0x58, 0x52, 0x2D, 0x55, 0x53, 0x44, 0x43]); // PXR-USDC

			if (buffer.byteLength < crateHeader.length) {
				console.log('[DebugUSDLoader] Buffer too small for Crate header');
				return false;
			}

			const view = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, 0, crateHeader.length);
			
			for (let i = 0; i < crateHeader.length; i++) {
				if (view[i] !== crateHeader[i]) {
					console.log('[DebugUSDLoader] Not a Crate file (header mismatch at byte', i, ')');
					return false;
				}
			}

			console.log('[DebugUSDLoader] Confirmed Crate file (PXR-USDC header found)');
			return true;
		}

		function findUSD(zip: any) {
			console.log('[DebugUSDLoader] findUSD() called');
			
			if (Object.keys(zip).length < 1) {
				console.error('[DebugUSDLoader] ZIP is empty!');
				return undefined;
			}

			const firstFileName = Object.keys(zip)[0];
			console.log('[DebugUSDLoader] First file in ZIP:', firstFileName);
			
			let isCrate = false;

			// As per the USD specification, the first entry in the zip archive is used as the main file ("UsdStage").
			if (firstFileName.endsWith('usda')) {
				console.log('[DebugUSDLoader] First file is .usda');
				return zip[firstFileName];
			}

			if (firstFileName.endsWith('usdc')) {
				console.log('[DebugUSDLoader] First file is .usdc (Crate)');
				isCrate = true;
			} else if (firstFileName.endsWith('usd')) {
				console.log('[DebugUSDLoader] First file is .usd (generic)');
				// If this is not a crate file, we assume it is a plain USDA file.
				if (!isCrateFile(zip[firstFileName])) {
					console.log('[DebugUSDLoader] Generic .usd is actually USDA');
					return zip[firstFileName];
				} else {
					console.log('[DebugUSDLoader] Generic .usd is actually USDC');
					isCrate = true;
				}
			}

			if (isCrate) {
				console.log('[DebugUSDLoader] Returning Crate file');
				return zip[firstFileName];
			}

			console.error('[DebugUSDLoader] Could not find USD file in ZIP');
			return undefined;
		}

		// USDA (string input)
		if (typeof buffer === 'string') {
			console.log('[DebugUSDLoader] Input is string (USDA), parsing directly');
			try {
				const result = usda.parse(buffer, {});
				console.log('[DebugUSDLoader] Direct USDA parse successful');
				return result;
			} catch (e: any) {
				console.error('[DebugUSDLoader] Direct USDA parse failed:', e);
				throw e;
			}
		}

		// USDC (binary input)
		if (isCrateFile(buffer as ArrayBuffer)) {
			console.log('[DebugUSDLoader] Input is USDC (Crate), parsing directly');
			try {
				const result = usdc.parse(buffer as ArrayBuffer);
				console.log('[DebugUSDLoader] Direct USDC parse successful');
				return result;
			} catch (e: any) {
				console.error('[DebugUSDLoader] Direct USDC parse failed:', e);
				throw e;
			}
		}

		// USDZ (ZIP archive)
		console.log('[DebugUSDLoader] Input appears to be USDZ (ZIP), unzipping...');
		try {
			const zip = fflate.unzipSync(new Uint8Array(buffer as ArrayBuffer));
			console.log('[DebugUSDLoader] Unzip successful, files:', Object.keys(zip));

			const assets = parseAssets(zip);
			console.log('[DebugUSDLoader] Assets parsed');

			const file = findUSD(zip);
			if (!file) {
				throw new Error('No USD file found in USDZ archive');
			}
			console.log('[DebugUSDLoader] Main USD file found');

			const text = fflate.strFromU8(file);
			console.log('[DebugUSDLoader] Converted main file to text, length:', text.length);
			console.log('[DebugUSDLoader] First 500 chars of main file:', text.substring(0, 500));
			console.log('[DebugUSDLoader] Assets keys available for references:', Object.keys(assets));
			console.log('[DebugUSDLoader] Calling usda.parse() with text and assets...');

			try {
				const result = usda.parse(text, assets);
				console.log('[DebugUSDLoader] Final parse successful');
				return result;
			} catch (e: any) {
				console.error('[DebugUSDLoader] usda.parse() failed:', e);
				console.error('[DebugUSDLoader] This usually means a file reference could not be resolved');
				console.error('[DebugUSDLoader] Available assets:', Object.keys(assets));
				console.error('[DebugUSDLoader] Main file content (full):', text);
				throw e;
			}
		} catch (e: any) {
			console.error('[DebugUSDLoader] USDZ processing failed:', e);
			console.error('[DebugUSDLoader] Error details:', {
				message: e.message,
				stack: e.stack,
				name: e.name
			});
			throw e;
		}
	}
}

export { DebugUSDLoader };
