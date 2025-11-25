import SwiftUI

// MARK: - Standard Toolbar Styling
struct StandardToolbarModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationBarTitleDisplayMode(.large)
    }
}

extension View {
    func standardToolbar() -> some View {
        self.modifier(StandardToolbarModifier())
    }
    
    // Variant for inline title display mode
    func standardToolbar(displayMode: NavigationBarItem.TitleDisplayMode) -> some View {
        self
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .navigationBarTitleDisplayMode(displayMode)
    }
}
