# OSLog Migration Guide - My Home Agent

## Quick Reference

### Before (Old Style)
```swift
print("🌐 NetworkManager: Request to \(endpoint)")
print("❌ Error: \(error.localizedDescription)")
print("🍪 Cookie: \(cookieName)=\(cookieValue)")
```

### After (New Style)
```swift
AppLogger.network.debug("Request to \(endpoint, privacy: .public)")
AppLogger.error("Request failed", error: error, category: .network)
AppLogger.debugSensitive("Cookie", sensitiveData: "\(cookieName)=\(cookieValue)", category: .network)
```

---

## Available Loggers

### Category Loggers
```swift
AppLogger.network    // Networking operations
AppLogger.auth       // Authentication
AppLogger.media      // Media upload/download
AppLogger.roomScan   // RoomPlan operations
AppLogger.chat       // Chat/messaging
AppLogger.property   // Property management
AppLogger.service    // Service requests
AppLogger.ui         // UI events
AppLogger.storage    // Data persistence
AppLogger.app        // General app lifecycle
AppLogger.error      // Error tracking
```

---

## Log Levels

### Debug (Development Only)
Automatically stripped from release builds.
```swift
AppLogger.debug("Detailed debugging info", category: .network)
AppLogger.network.debug("Request headers: \(headers, privacy: .public)")
```

### Info
General informational messages.
```swift
AppLogger.info("User logged in successfully", category: .auth)
AppLogger.auth.info("Session validated")
```

### Notice
Significant but not error conditions.
```swift
AppLogger.notice("Cache miss for key", category: .storage)
AppLogger.storage.notice("Clearing expired cache entries")
```

### Warning
Potential issues that don't prevent operation.
```swift
AppLogger.warning("Slow network response", category: .network)
AppLogger.network.warning("Request took \(duration, privacy: .public)s")
```

### Error
Error conditions that should be investigated.
```swift
AppLogger.error("Failed to load data", error: error, category: .storage)
AppLogger.network.error("HTTP \(statusCode, privacy: .public) error")
```

### Critical
Severe errors requiring immediate attention.
```swift
AppLogger.critical("Database corruption detected", error: error, category: .storage)
AppLogger.app.critical("Failed to initialize core services")
```

---

## Privacy Annotations

### Public Data (Always Visible)
```swift
// Status codes, counts, non-sensitive strings
AppLogger.network.debug("Status: \(statusCode, privacy: .public)")
AppLogger.storage.info("Loaded \(count, privacy: .public) items")
```

### Private Data (Redacted in Production)
```swift
// User data, tokens, emails, passwords
AppLogger.auth.debug("Email: \(email, privacy: .private)")
AppLogger.network.debug("Token: \(token, privacy: .private)")
```

### Sensitive Helper
```swift
// Automatically handles privacy based on build
AppLogger.debugSensitive("User email", sensitiveData: email, category: .auth)
```

---

## Migration Patterns

### Pattern 1: Simple Print
```swift
// Before
print("🌐 NetworkManager: Starting request")

// After
AppLogger.network.debug("Starting request")
```

### Pattern 2: Print with Variables
```swift
// Before
print("🌐 NetworkManager: Request to \(endpoint) with method \(method)")

// After
AppLogger.network.debug("Request to \(endpoint, privacy: .public) with method \(method, privacy: .public)")
```

### Pattern 3: Error Logging
```swift
// Before
print("❌ NetworkManager: Request failed: \(error.localizedDescription)")

// After
AppLogger.logNetworkError(endpoint: endpoint, error: error)
// OR
AppLogger.error("Request failed", error: error, category: .network)
```

### Pattern 4: Sensitive Data
```swift
// Before
print("🔐 AuthManager: Login with email: \(email)")

// After
#if DEBUG
AppLogger.auth.debug("Login with email: \(email, privacy: .public)")
#else
AppLogger.auth.debug("Login with email: \(email, privacy: .private)")
#endif
// OR use helper:
AppLogger.debugSensitive("Login with email", sensitiveData: email, category: .auth)
```

### Pattern 5: Network Request/Response
```swift
// Before
print("🌐 NetworkManager: Request to \(endpoint)")
print("✅ NetworkManager: Response \(statusCode)")

// After
AppLogger.logRequest(method: method.rawValue, endpoint: endpoint)
AppLogger.logResponse(statusCode: statusCode, endpoint: endpoint)
```

### Pattern 6: Conditional Debug Logging
```swift
// Before
#if DEBUG
print("Debug info: \(details)")
#endif

// After
AppLogger.debug("Debug info: \(details)", category: .app)
// (debug() is already conditional)
```

---

## File-by-File Migration Order

### High Priority (Most Logs)
1. **NetworkManager.swift** (52 prints) - Start here
2. **AuthManager.swift** (21 prints)
3. **MediaUploadManager.swift** (62 prints)
4. **RoomPlanView.swift** (60 prints)

### Medium Priority
5. **RoomScanStorageService.swift** (48 prints)
6. **FloorplanGeneratorService.swift** (41 prints)
7. **SavedRoomScansView.swift** (31 prints)
8. **ChatViewModel.swift** (25 prints)
9. **ChatService.swift** (24 prints)

### Lower Priority
10. Remaining files with <20 prints each

---

## Viewing Logs

### During Development (Xcode)
Logs appear in Xcode console as before, with better formatting.

### From Device (Console.app)
1. Connect device to Mac
2. Open Console.app
3. Select your device
4. Filter by subsystem: `com.hestami.app`
5. Filter by category: `networking`, `authentication`, etc.

### Production Debugging
```bash
# View logs from connected device
log show --predicate 'subsystem == "com.hestami.app"' --last 1h

# Filter by category
log show --predicate 'subsystem == "com.hestami.app" AND category == "networking"' --last 1h

# Filter by level
log show --predicate 'subsystem == "com.hestami.app" AND messageType >= "error"' --last 1h
```

---

## Best Practices

### DO ✅
- Use appropriate log levels
- Add privacy annotations to all variables
- Use category-specific loggers
- Keep debug logs detailed
- Log errors with context
- Use convenience methods for common patterns

### DON'T ❌
- Log passwords or tokens without `.private`
- Use `print()` in new code
- Over-log in production (use `.debug()` for verbose logs)
- Log in tight loops without throttling
- Include PII without privacy annotations
- Use generic messages without context

---

## Common Mistakes to Avoid

### Mistake 1: Forgetting Privacy Annotations
```swift
// ❌ BAD - No privacy annotation
AppLogger.auth.debug("User email: \(email)")

// ✅ GOOD
AppLogger.auth.debug("User email: \(email, privacy: .private)")
```

### Mistake 2: Wrong Log Level
```swift
// ❌ BAD - Using error for non-errors
AppLogger.error("Request started", category: .network)

// ✅ GOOD
AppLogger.network.debug("Request started")
```

### Mistake 3: Not Using Categories
```swift
// ❌ BAD - Using default category
AppLogger.debug("Network request failed")

// ✅ GOOD
AppLogger.network.error("Request failed")
```

### Mistake 4: Logging Too Much in Production
```swift
// ❌ BAD - Info logs in tight loop
for item in items {
    AppLogger.info("Processing \(item)", category: .storage)
}

// ✅ GOOD
AppLogger.debug("Processing \(items.count, privacy: .public) items", category: .storage)
for item in items {
    AppLogger.debug("Processing item: \(item, privacy: .public)", category: .storage)
}
```

---

## Testing Your Migration

### 1. Build and Run
Ensure no compiler errors after migration.

### 2. Check Console Output
Verify logs appear correctly in Xcode console.

### 3. Test Privacy
Build in Release mode and verify sensitive data is redacted:
```bash
# In Xcode, change scheme to Release and run
# Check Console.app to verify private data shows as <private>
```

### 4. Performance Check
Use Instruments to verify logging doesn't impact performance.

---

## Example: Complete File Migration

### Before: NetworkManager.swift (excerpt)
```swift
func request<T: Decodable>(...) async throws -> T {
    print("🌐 NetworkManager: Request to \(baseURL)\(endpoint)")
    
    do {
        let (data, response) = try await session.data(for: request)
        print("✅ NetworkManager: Response received")
        return try jsonDecoder.decode(T.self, from: data)
    } catch {
        print("❌ NetworkManager: Request failed: \(error)")
        throw error
    }
}
```

### After: NetworkManager.swift (excerpt)
```swift
func request<T: Decodable>(...) async throws -> T {
    AppLogger.logRequest(method: method.rawValue, endpoint: endpoint)
    
    do {
        let (data, response) = try await session.data(for: request)
        if let httpResponse = response as? HTTPURLResponse {
            AppLogger.logResponse(statusCode: httpResponse.statusCode, endpoint: endpoint)
        }
        return try jsonDecoder.decode(T.self, from: data)
    } catch {
        AppLogger.logNetworkError(endpoint: endpoint, error: error)
        throw error
    }
}
```

---

## Need Help?

- Review `AppLogger.swift` for all available methods
- Check `AppConfiguration.swift` for feature flags
- See `APP_STORE_READINESS_CHECKLIST.md` for overall progress
- Apple's OSLog documentation: https://developer.apple.com/documentation/os/logging

---

**Remember**: Debug logs are automatically stripped from release builds, so be generous with debugging information during development!
