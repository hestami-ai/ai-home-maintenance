/**
 * Goal Detector — Mobile Development
 * Analyzes workflow goals to determine whether mobile-specialist
 * MCP tools should be injected for the Executor.
 */

const MOBILE_KEYWORDS = [
	'ios', 'android', 'mobile', 'iphone', 'ipad',
	'swift', 'swiftui', 'uikit',
	'kotlin', 'jetpack compose', 'jetpack',
	'react native', 'flutter', 'expo',
	'xcode', 'cocoapods', 'gradle',
	'arkit', 'realitykit', 'core ml', 'core data',
	'app store', 'play store', 'google play',
	'mobile app', 'native app',
	'capacitor', 'ionic',
	'kotlin multiplatform', 'kmp',
];

const IOS_PATTERN = /\b(ios|iphone|ipad|swift|swiftui|uikit|arkit|realitykit|xcode|cocoapods|core\s*ml|core\s*data|app\s*store)\b/i;
const ANDROID_PATTERN = /\b(android|kotlin|jetpack|gradle|play\s*store|google\s*play|camerax|ml\s*kit)\b/i;
const CROSS_PLATFORM_PATTERN = /\b(react\s*native|flutter|expo|capacitor|ionic|cross[- ]?platform|kotlin\s*multiplatform|kmp)\b/i;

export type MobilePlatform = 'ios' | 'android' | 'cross-platform';

export interface GoalAnalysis {
	/** Whether the goal involves mobile development */
	isMobileRelated: boolean;
	/** Detected target platforms */
	detectedPlatforms: MobilePlatform[];
	/** Keywords that matched */
	matchedKeywords: string[];
}

/**
 * Analyze a goal string for mobile development relevance.
 */
export function analyzeGoalForMobile(goal: string): GoalAnalysis {
	const lower = goal.toLowerCase();
	const matchedKeywords = MOBILE_KEYWORDS.filter(kw => lower.includes(kw));

	const detectedPlatforms: MobilePlatform[] = [];
	if (IOS_PATTERN.test(goal)) {
		detectedPlatforms.push('ios');
	}
	if (ANDROID_PATTERN.test(goal)) {
		detectedPlatforms.push('android');
	}
	if (CROSS_PLATFORM_PATTERN.test(goal)) {
		detectedPlatforms.push('cross-platform');
	}

	return {
		isMobileRelated: matchedKeywords.length > 0,
		detectedPlatforms,
		matchedKeywords,
	};
}
