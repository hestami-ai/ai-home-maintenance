# Mobile Code Viewer/Editor — KMP Library Plan

A Kotlin Multiplatform library providing syntax-highlighted code viewing and light editing, with native UI surfaces (SwiftUI + Jetpack Compose) designed to be embedded in host applications that supply code content.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Host App (iOS / Android)                           │
│  ┌───────────────────────────────────────────────┐  │
│  │  CodeViewerSDK (public API)                   │  │
│  │  ┌─────────────┐  ┌────────────────────────┐  │  │
│  │  │ Platform UI  │  │  KMP Shared Module     │  │  │
│  │  │ SwiftUI /    │◄─┤  - TextBuffer (rope)   │  │  │
│  │  │ Compose      │  │  - SyntaxEngine        │  │  │
│  │  │              │  │  - LanguageRegistry     │  │  │
│  │  │ Line numbers │  │  - EditOperations       │  │  │
│  │  │ Gutter       │  │  - UndoManager          │  │  │
│  │  │ Selections   │  │  - ThemeEngine          │  │  │
│  │  │ Scrolling    │  │  - SearchEngine         │  │  │
│  │  └─────────────┘  └────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Three layers:**
1. **KMP Shared (`commonMain`)** — platform-agnostic core logic
2. **Platform UI** — SwiftUI view (iOS) / Compose composable (Android)
3. **Public API surface** — what host apps import and call

---

## Key Components

### 1. Text Buffer (Shared)
- **Data structure**: Piece Table or Rope — efficient for inserts/deletes without rewriting the whole string
- **Line index**: Maintains a line-offset table for O(log n) line lookups
- **API**: `insert(offset, text)`, `delete(range)`, `lineAt(n)`, `textInRange(range)`, `lineCount`
- **Why it matters**: A naive `String` buffer breaks down on files > a few KB. Piece tables are what VS Code uses internally.

### 2. Syntax Highlighting Engine (Shared)
This is the hardest component. Two viable approaches:

| Approach | Pros | Cons |
|----------|------|------|
| **TextMate grammars (regex-based)** | Huge ecosystem of existing `.tmLanguage` grammars; proven in VS Code; pure-Kotlin implementation feasible | Regex perf on large files; no semantic understanding; some edge cases |
| **Tree-sitter (C via interop)** | Incremental parsing; accurate ASTs; industry standard | C library requires JNI (Android) + cinterop (iOS); grammar .so/.dylib bundling; more complex build |

**Recommendation**: Start with **TextMate grammars** for v1 (simpler build, no native compilation per-platform). Migrate to Tree-sitter for v2 if incremental parsing perf becomes necessary.

**Implementation**:
- Port or write a TextMate grammar interpreter in Kotlin (`commonMain`)
- Bundle `.tmLanguage.json` files as resources for each supported language
- Tokenizer produces a list of `Token(range, scope)` per line
- Theme engine maps scopes → colors

### 3. Language Registry (Shared)
- Maps file extensions → language ID → grammar definition
- Bundled grammars: **Python, TypeScript/JavaScript, Java, Kotlin, Go, Elixir, Rust, C/C++, Swift, JSON, YAML, Markdown, HTML/CSS, SQL, Shell/Bash**
- Extensible: host app can register additional grammars at runtime

### 4. Theme Engine (Shared)
- VS Code-compatible theme format (subset of `.tmTheme` / VS Code JSON themes)
- Ship 2–3 built-in themes: one dark (e.g., One Dark), one light (e.g., GitHub Light), one high-contrast
- Host app can supply custom theme JSON
- Output: `scope → TextStyle(color, bold, italic)`

### 5. Edit Operations + Undo Manager (Shared)
- Lightweight edit model: insert text, delete selection, replace selection
- `UndoManager` with undo/redo stack (operation-based, not snapshot-based)
- Selection model: single cursor + optional selection range (no multi-cursor for v1)
- Callbacks to host app: `onContentChanged(newText)`, `onSelectionChanged(range)`

### 6. Search Engine (Shared)
- Find-in-file with literal and regex modes
- Match highlighting (passes match ranges to UI layer)
- Optional find-and-replace for editing mode

### 7. Platform UI — iOS (SwiftUI)

```swift
// Host app usage:
CodeEditorView(
    content: $codeString,
    language: .typescript,
    theme: .oneDark,
    isEditable: true,
    onContentChange: { newContent in ... }
)
```

**Implementation details:**
- Custom `UITextView` subclass (wrapped in `UIViewRepresentable`) for text rendering + editing
- `NSAttributedString` driven by syntax tokens from shared module
- Custom line-number gutter view
- Gesture handling: tap-to-place-cursor, long-press-select, scroll
- iOS keyboard integration for editing mode

### 8. Platform UI — Android (Jetpack Compose)

```kotlin
// Host app usage:
CodeEditor(
    content = codeString,
    language = Language.TYPESCRIPT,
    theme = CodeTheme.OneDark,
    isEditable = true,
    onContentChange = { newContent -> ... }
)
```

**Implementation details:**
- Custom `BasicTextField` or Canvas-based rendering with `AnnotatedString` from syntax tokens
- Line-number composable in a `Row` alongside the code area
- `HorizontalScroll` + `VerticalScroll` for large files
- Software keyboard integration for editing

---

## Public API Design

```kotlin
// commonMain — shared interface
class CodeViewerConfig(
    val language: LanguageId,          // or null for auto-detect from extension
    val theme: ThemeDefinition,
    val isEditable: Boolean = false,
    val showLineNumbers: Boolean = true,
    val wordWrap: Boolean = false,
    val fontSize: Float = 14f,
    val tabSize: Int = 4,
)

// Callbacks
interface CodeViewerDelegate {
    fun onContentChanged(content: String)
    fun onSelectionChanged(range: TextRange)
    fun onLinkTapped(url: String)          // for clickable imports/URLs
}
```

---

## Project Structure

```
code-viewer-kmp/
├── shared/                          # KMP shared module
│   ├── src/commonMain/kotlin/
│   │   ├── buffer/                  # TextBuffer, PieceTable, LineIndex
│   │   ├── syntax/                  # TextMate grammar engine, Tokenizer
│   │   ├── languages/               # LanguageRegistry, language configs
│   │   ├── theme/                   # ThemeEngine, built-in themes
│   │   ├── editing/                 # EditOperations, UndoManager, Selection
│   │   ├── search/                  # SearchEngine
│   │   └── api/                     # Public API types (Config, Delegate, etc.)
│   ├── src/commonMain/resources/    # .tmLanguage.json grammars, theme JSONs
│   ├── src/androidMain/             # Android-specific (if any)
│   └── src/iosMain/                 # iOS-specific (if any)
├── android-ui/                      # Jetpack Compose UI module
│   └── src/main/kotlin/
│       └── CodeEditor.kt            # Compose composable + rendering
├── ios-ui/                          # SwiftUI UI module (Swift package)
│   └── Sources/
│       └── CodeEditorView.swift     # SwiftUI view + UIKit bridge
├── sample-android/                  # Demo Android app
├── sample-ios/                      # Demo iOS app
├── build.gradle.kts
└── settings.gradle.kts
```

---

## Development Phases

### Phase 1: Core Engine (shared module) — ~3–4 weeks
- [ ] Piece table text buffer with line index
- [ ] TextMate grammar parser (read `.tmLanguage.json`, tokenize lines)
- [ ] Bundle grammars for top 15 languages
- [ ] Theme engine with 2 built-in themes
- [ ] Unit tests for buffer, tokenizer, theme mapping

### Phase 2: Read-Only Viewer UI — ~2–3 weeks
- [ ] Android Compose: syntax-highlighted rendering, line numbers, horizontal/vertical scroll
- [ ] iOS SwiftUI: attributed string rendering, line numbers, scroll
- [ ] Large file performance: virtualized/lazy line rendering
- [ ] Public API: `CodeViewerView` / `CodeEditor` with config object

### Phase 3: Light Editing — ~2–3 weeks
- [ ] Cursor placement + selection model
- [ ] Insert/delete/replace operations wired to text buffer
- [ ] Undo/redo manager
- [ ] Keyboard integration (iOS + Android)
- [ ] Re-tokenize on edit (incremental: only changed lines + affected scope spans)

### Phase 4: Polish + Integration — ~1–2 weeks
- [ ] Search (find in file)
- [ ] Auto-detect language from file extension
- [ ] Custom theme support (host-provided JSON)
- [ ] Accessibility (VoiceOver / TalkBack: line announcements, role labels)
- [ ] Sample apps demonstrating integration
- [ ] API documentation

### Phase 5: Optimization — ongoing
- [ ] Benchmark: tokenization speed on 10K+ line files
- [ ] Lazy tokenization (only visible lines + buffer zone)
- [ ] Consider Tree-sitter migration if TextMate perf is insufficient

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TextMate grammar engine complexity | High — oniguruma regex semantics are non-trivial | Use an existing Kotlin regex engine; limit to the TextMate grammar features actually used by top-15 language grammars |
| Large file performance | Medium — naive rendering chokes on 10K+ lines | Virtualized rendering (only compose/render visible lines); lazy tokenization |
| iOS SwiftUI text rendering limitations | Medium — SwiftUI `Text` doesn't support per-character styling well | Use `UITextView` / `UIKit` bridge via `UIViewRepresentable` for the actual code surface |
| KMP build complexity | Low–Medium — Gradle + SPM integration can be finicky | Use official KMP project templates; publish iOS module as XCFramework via `./gradlew assembleXCFramework` |
| Keyboard/IME edge cases | Medium — CJK input, autocomplete, hardware keyboards | Lean on platform text input infrastructure (`UITextView` / `BasicTextField`) rather than custom input handling |

---

## Technology Stack Summary

- **Language**: Kotlin (shared + Android), Swift (iOS UI)
- **Build**: Gradle with KMP plugin, SPM for iOS distribution
- **Syntax**: TextMate `.tmLanguage.json` grammars (v1), Tree-sitter (v2)
- **Text buffer**: Piece table (Kotlin, in `commonMain`)
- **Distribution**: Maven Central / GitHub Packages (Android), XCFramework or SPM (iOS)
- **Testing**: kotlin.test (shared), XCTest (iOS), JUnit (Android)

---

## Estimated Total Effort
**~9–12 weeks** for a single experienced KMP developer to reach a shippable v1 with read-only viewing + light editing for 15 languages.
