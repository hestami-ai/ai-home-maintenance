/**
 * MCP tool: get_mobile_guidelines
 * Returns curated mobile development best practices from static knowledge.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Curated mobile development guidelines organized by topic and platform.
 */
const GUIDELINES: Record<string, Record<string, string>> = {
	'arkit-setup': {
		ios: `# ARKit Setup Guide

## Prerequisites
- Device with A9+ chip (iPhone 6s+, iPad Pro+)
- iOS 11+ (ARKit 1.0), iOS 13+ (ARKit 3.0 with people occlusion), iOS 15+ (ARKit 5 with Location Anchors)

## Basic Configuration
1. Add \`NSCameraUsageDescription\` to Info.plist
2. Import ARKit and RealityKit frameworks
3. Use \`ARView\` (RealityKit) or \`ARSCNView\` (SceneKit) as the rendering surface

## SwiftUI Integration
\`\`\`swift
import SwiftUI
import RealityKit
import ARKit

struct ARViewContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic
        arView.session.run(config)
        return arView
    }
    func updateUIView(_ uiView: ARView, context: Context) {}
}
\`\`\`

## Session Lifecycle
- Run session in \`onAppear\`, pause in \`onDisappear\`
- Handle \`ARSessionDelegate\` for tracking state changes
- Check \`ARWorldTrackingConfiguration.isSupported\` before starting`,
	},

	'swiftui-navigation': {
		ios: `# SwiftUI Navigation Patterns (iOS 16+)

## NavigationStack (replaces NavigationView)
\`\`\`swift
NavigationStack {
    List(items) { item in
        NavigationLink(value: item) {
            Text(item.name)
        }
    }
    .navigationDestination(for: Item.self) { item in
        DetailView(item: item)
    }
}
\`\`\`

## Programmatic Navigation with NavigationPath
\`\`\`swift
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    // ...
}

// Push programmatically:
path.append(someItem)
// Pop to root:
path.removeLast(path.count)
\`\`\`

## Tab-based Navigation
\`\`\`swift
TabView {
    HomeView().tabItem { Label("Home", systemImage: "house") }
    SettingsView().tabItem { Label("Settings", systemImage: "gear") }
}
\`\`\``,
	},

	'jetpack-compose': {
		android: `# Jetpack Compose Best Practices

## State Management
\`\`\`kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }
    Button(onClick = { count++ }) {
        Text("Count: $count")
    }
}
\`\`\`

## State Hoisting Pattern
\`\`\`kotlin
@Composable
fun StatefulCounter() {
    var count by rememberSaveable { mutableStateOf(0) }
    StatelessCounter(count = count, onIncrement = { count++ })
}

@Composable
fun StatelessCounter(count: Int, onIncrement: () -> Unit) {
    Button(onClick = onIncrement) { Text("Count: $count") }
}
\`\`\`

## Side Effects
- \`LaunchedEffect(key)\` — coroutine scoped to composition
- \`DisposableEffect(key)\` — cleanup on leave
- \`SideEffect\` — runs after every successful recomposition
- \`rememberCoroutineScope()\` — for event handlers

## Navigation with Compose
\`\`\`kotlin
val navController = rememberNavController()
NavHost(navController, startDestination = "home") {
    composable("home") { HomeScreen(navController) }
    composable("detail/{id}") { backStackEntry ->
        DetailScreen(backStackEntry.arguments?.getString("id"))
    }
}
\`\`\``,
	},

	'app-lifecycle': {
		ios: `# iOS App Lifecycle

## SwiftUI App Lifecycle
\`\`\`swift
@main
struct MyApp: App {
    @Environment(\\.scenePhase) var scenePhase
    var body: some Scene {
        WindowGroup { ContentView() }
            .onChange(of: scenePhase) { phase in
                switch phase {
                case .active: // App is in foreground
                case .inactive: // App is transitioning
                case .background: // App is in background
                @unknown default: break
                }
            }
    }
}
\`\`\`

## Background Tasks
- Use \`BGTaskScheduler\` for deferred work
- Register tasks in Info.plist under \`BGTaskSchedulerPermittedIdentifiers\`
- Background fetch: \`BGAppRefreshTask\` (30s execution time)
- Background processing: \`BGProcessingTask\` (minutes, requires power)`,

		android: `# Android Activity Lifecycle

## Lifecycle States
onCreate → onStart → onResume → [RUNNING] → onPause → onStop → onDestroy

## Compose Lifecycle Awareness
\`\`\`kotlin
val lifecycleOwner = LocalLifecycleOwner.current
DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
        when (event) {
            Lifecycle.Event.ON_RESUME -> { /* refresh data */ }
            Lifecycle.Event.ON_PAUSE -> { /* save state */ }
            else -> {}
        }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
}
\`\`\`

## Process Death Survival
- Use \`rememberSaveable\` for UI state
- Use \`SavedStateHandle\` in ViewModels
- Avoid storing large objects — use IDs and re-fetch`,
	},

	'mobile-architecture': {
		ios: `# iOS Architecture Patterns

## MVVM with SwiftUI
\`\`\`swift
@MainActor
class ItemViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false

    private let repository: ItemRepository

    init(repository: ItemRepository) {
        self.repository = repository
    }

    func loadItems() async {
        isLoading = true
        defer { isLoading = false }
        items = try? await repository.fetchItems() ?? []
    }
}
\`\`\`

## Dependency Injection
- Use initializer injection for ViewModels
- Use \`@Environment\` for cross-cutting concerns
- Avoid service locator pattern in SwiftUI`,

		android: `# Android Architecture Patterns

## MVVM with Compose
\`\`\`kotlin
@HiltViewModel
class ItemViewModel @Inject constructor(
    private val repository: ItemRepository,
) : ViewModel() {
    val items = repository.getItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@Composable
fun ItemScreen(viewModel: ItemViewModel = hiltViewModel()) {
    val items by viewModel.items.collectAsStateWithLifecycle()
    LazyColumn { items(items) { ItemRow(it) } }
}
\`\`\`

## Dependency Injection with Hilt
- \`@HiltAndroidApp\` on Application class
- \`@AndroidEntryPoint\` on Activities/Fragments
- \`@HiltViewModel\` + \`@Inject constructor\` on ViewModels
- \`@Module\` + \`@Provides\` / \`@Binds\` for dependencies`,
	},
};

const AVAILABLE_TOPICS = Object.keys(GUIDELINES);

/**
 * Register the get_mobile_guidelines tool with the MCP server.
 */
export function registerMobileGuidelinesTool(server: McpServer): void {
	server.tool(
		'get_mobile_guidelines',
		`Get curated mobile development best practices and code patterns. Available topics: ${AVAILABLE_TOPICS.join(', ')}`,
		{
			topic: z.string().describe(
				`The mobile development topic. Available: ${AVAILABLE_TOPICS.join(', ')}`
			),
			platform: z.enum(['ios', 'android']).optional().describe(
				'Target platform (returns both if omitted)'
			),
		},
		async ({ topic, platform }) => {
			const topicData = GUIDELINES[topic];
			if (!topicData) {
				return {
					content: [{
						type: 'text' as const,
						text: `Unknown topic "${topic}". Available topics: ${AVAILABLE_TOPICS.join(', ')}`,
					}],
					isError: true,
				};
			}

			const parts: string[] = [];
			if (!platform || platform === 'ios') {
				if (topicData.ios) {
					parts.push(topicData.ios);
				}
			}
			if (!platform || platform === 'android') {
				if (topicData.android) {
					parts.push(topicData.android);
				}
			}

			if (parts.length === 0) {
				return {
					content: [{
						type: 'text' as const,
						text: `No guidelines available for topic "${topic}" on platform "${platform}".`,
					}],
				};
			}

			return {
				content: [{ type: 'text' as const, text: parts.join('\n\n---\n\n') }],
			};
		},
	);
}
