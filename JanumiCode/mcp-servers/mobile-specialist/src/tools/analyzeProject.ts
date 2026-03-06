/**
 * MCP tool: analyze_mobile_project
 * Analyzes a workspace directory to detect mobile project type, frameworks, and structure.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ProjectAnalysis {
	platforms: string[];
	frameworks: string[];
	buildSystems: string[];
	indicators: string[];
}

/**
 * File indicators for mobile project detection.
 */
const INDICATORS: Array<{
	file: string;
	platform: string;
	framework: string;
	buildSystem: string;
}> = [
	// iOS
	{ file: 'Package.swift', platform: 'ios', framework: 'Swift Package', buildSystem: 'SwiftPM' },
	{ file: 'Podfile', platform: 'ios', framework: 'CocoaPods', buildSystem: 'CocoaPods' },
	{ file: 'Cartfile', platform: 'ios', framework: 'Carthage', buildSystem: 'Carthage' },
	// Android
	{ file: 'build.gradle', platform: 'android', framework: 'Android', buildSystem: 'Gradle' },
	{ file: 'build.gradle.kts', platform: 'android', framework: 'Android', buildSystem: 'Gradle KTS' },
	{ file: 'settings.gradle', platform: 'android', framework: 'Android', buildSystem: 'Gradle' },
	{ file: 'settings.gradle.kts', platform: 'android', framework: 'Android', buildSystem: 'Gradle KTS' },
	// Cross-platform
	{ file: 'pubspec.yaml', platform: 'cross-platform', framework: 'Flutter', buildSystem: 'Flutter' },
	{ file: 'react-native.config.js', platform: 'cross-platform', framework: 'React Native', buildSystem: 'Metro' },
	{ file: 'metro.config.js', platform: 'cross-platform', framework: 'React Native', buildSystem: 'Metro' },
	{ file: 'capacitor.config.ts', platform: 'cross-platform', framework: 'Capacitor', buildSystem: 'Capacitor' },
	{ file: 'ionic.config.json', platform: 'cross-platform', framework: 'Ionic', buildSystem: 'Ionic' },
	{ file: 'app.json', platform: 'cross-platform', framework: 'Expo', buildSystem: 'Expo' },
];

/**
 * Directory patterns that indicate mobile projects.
 */
const DIR_INDICATORS: Array<{
	dir: string;
	platform: string;
	framework: string;
}> = [
	{ dir: 'ios', platform: 'ios', framework: 'Native iOS' },
	{ dir: 'android', platform: 'android', framework: 'Native Android' },
	{ dir: 'macos', platform: 'ios', framework: 'macOS Catalyst' },
];

/**
 * Glob patterns within files for deeper detection.
 */
function detectFrameworksInFiles(workspacePath: string): string[] {
	const frameworks: string[] = [];

	// Check package.json for React Native / Expo
	const pkgPath = path.join(workspacePath, 'package.json');
	if (fs.existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
			const deps = { ...pkg.dependencies, ...pkg.devDependencies };
			if (deps['react-native']) { frameworks.push('React Native'); }
			if (deps['expo']) { frameworks.push('Expo'); }
			if (deps['@capacitor/core']) { frameworks.push('Capacitor'); }
			if (deps['nativescript']) { frameworks.push('NativeScript'); }
		} catch { /* ignore parse errors */ }
	}

	// Check for Xcode project
	try {
		const entries = fs.readdirSync(workspacePath);
		if (entries.some(e => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace'))) {
			frameworks.push('Xcode');
		}
	} catch { /* ignore read errors */ }

	return frameworks;
}

function analyzeWorkspace(workspacePath: string): ProjectAnalysis {
	const result: ProjectAnalysis = {
		platforms: [],
		frameworks: [],
		buildSystems: [],
		indicators: [],
	};

	const platformSet = new Set<string>();
	const frameworkSet = new Set<string>();
	const buildSystemSet = new Set<string>();

	// Check file indicators
	for (const indicator of INDICATORS) {
		if (fs.existsSync(path.join(workspacePath, indicator.file))) {
			platformSet.add(indicator.platform);
			frameworkSet.add(indicator.framework);
			buildSystemSet.add(indicator.buildSystem);
			result.indicators.push(`Found ${indicator.file} → ${indicator.framework} (${indicator.platform})`);
		}
	}

	// Check directory indicators
	for (const indicator of DIR_INDICATORS) {
		const dirPath = path.join(workspacePath, indicator.dir);
		if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
			platformSet.add(indicator.platform);
			frameworkSet.add(indicator.framework);
			result.indicators.push(`Found ${indicator.dir}/ directory → ${indicator.framework}`);
		}
	}

	// Deeper detection via file contents
	const deepFrameworks = detectFrameworksInFiles(workspacePath);
	for (const fw of deepFrameworks) {
		frameworkSet.add(fw);
		result.indicators.push(`Detected ${fw} via package analysis`);
	}

	result.platforms = [...platformSet];
	result.frameworks = [...frameworkSet];
	result.buildSystems = [...buildSystemSet];

	return result;
}

/**
 * Register the analyze_mobile_project tool with the MCP server.
 */
export function registerAnalyzeProjectTool(server: McpServer): void {
	server.tool(
		'analyze_mobile_project',
		'Analyze a workspace directory to detect mobile project type, frameworks, build systems, and structure. Useful for understanding the mobile development context before generating code.',
		{
			workspacePath: z.string().describe(
				'Absolute path to the workspace root to analyze'
			),
		},
		async ({ workspacePath }) => {
			try {
				if (!fs.existsSync(workspacePath)) {
					return {
						content: [{
							type: 'text' as const,
							text: `Directory not found: ${workspacePath}`,
						}],
						isError: true,
					};
				}

				const analysis = analyzeWorkspace(workspacePath);

				if (analysis.indicators.length === 0) {
					return {
						content: [{
							type: 'text' as const,
							text: `No mobile project indicators found in ${workspacePath}. This may not be a mobile project, or the project structure is non-standard.`,
						}],
					};
				}

				const report = [
					`# Mobile Project Analysis: ${workspacePath}`,
					'',
					`## Platforms: ${analysis.platforms.join(', ') || 'None detected'}`,
					`## Frameworks: ${analysis.frameworks.join(', ') || 'None detected'}`,
					`## Build Systems: ${analysis.buildSystems.join(', ') || 'None detected'}`,
					'',
					'## Indicators Found:',
					...analysis.indicators.map(i => `- ${i}`),
				].join('\n');

				return {
					content: [{ type: 'text' as const, text: report }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					content: [{
						type: 'text' as const,
						text: `Error analyzing project: ${message}`,
					}],
					isError: true,
				};
			}
		},
	);
}
