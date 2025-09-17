import SwiftUI

struct RefreshControl: View {
    @Binding var isRefreshing: Bool
    let coordinateSpace: CoordinateSpace
    let onRefresh: () -> Void
    
    @State private var threshold: CGFloat = 80
    @State private var offset: CGFloat = 0
    
    var body: some View {
        GeometryReader { geometry in
            if offset > threshold && !isRefreshing {
                Color.clear.preference(key: RefreshPreferenceKey.self, value: offset)
            } else {
                Color.clear.preference(key: RefreshPreferenceKey.self, value: 0)
            }
            
            HStack {
                Spacer()
                VStack {
                    if isRefreshing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonBackground))
                    } else {
                        Image(systemName: "arrow.down")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(AppTheme.secondaryText)
                            .rotationEffect(.degrees(offset > threshold ? 180 : 0))
                            .animation(.easeInOut, value: offset > threshold)
                    }
                }
                .offset(y: -30)
                .opacity(isRefreshing || offset > 0 ? 1 : 0)
                .animation(.easeInOut, value: offset > 0)
                Spacer()
            }
        }
        .frame(height: 0)
        .onPreferenceChange(RefreshPreferenceKey.self) { value in
            if value > threshold && !isRefreshing {
                isRefreshing = true
                onRefresh()
            }
        }
        .onAppear {
            NotificationCenter.default.addObserver(forName: .init("RefreshControlOffsetChanged"), object: nil, queue: .main) { notification in
                if let userInfo = notification.userInfo, let newOffset = userInfo["offset"] as? CGFloat {
                    offset = newOffset
                }
            }
        }
        .background(
            GeometryReader { geometry in
                Color.clear.preference(key: OffsetPreferenceKey.self, value: geometry.frame(in: coordinateSpace).minY)
            }
        )
        .onPreferenceChange(OffsetPreferenceKey.self) { value in
            offset = value
            NotificationCenter.default.post(name: .init("RefreshControlOffsetChanged"), object: nil, userInfo: ["offset": value])
        }
    }
}

struct RefreshPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct OffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct RefreshControl_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            RefreshControl(isRefreshing: .constant(false), coordinateSpace: .named("pullToRefresh")) {
                print("Refreshing...")
            }
            
            Text("Pull to refresh example")
                .padding()
        }
        .coordinateSpace(name: "pullToRefresh")
    }
}
