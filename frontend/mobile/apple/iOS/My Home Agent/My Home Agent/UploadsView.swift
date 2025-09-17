import SwiftUI
import Photos

struct UploadsView: View {
    @State private var mediaItems: [MediaItem] = []
    @State private var selectedCategory: String = "All"
    @State private var searchText: String = ""
    
    private let categories = ["All", "Living Room", "Kitchen", "Bedroom", "Bathroom", "Exterior", "Other"]
    
    var filteredItems: [MediaItem] {
        mediaItems.filter { item in
            let matchesCategory = selectedCategory == "All" || item.category == selectedCategory
            let matchesSearch = searchText.isEmpty || 
                item.description.localizedCaseInsensitiveContains(searchText)
            return matchesCategory && matchesSearch
        }
    }
    
    var body: some View {
        VStack {
            // Search and Filter Section
            VStack(spacing: 12) {
                TextField("Search uploads", text: $searchText)
                    .disableInputAssistant()
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding(.horizontal)
                
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(categories, id: \.self) { category in
                            CategoryButton(
                                title: category,
                                isSelected: category == selectedCategory,
                                action: { selectedCategory = category }
                            )
                        }
                    }
                    .padding(.horizontal)
                }
            }
            
            // Media Grid
            ScrollView {
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 16),
                    GridItem(.flexible(), spacing: 16)
                ], spacing: 16) {
                    ForEach(filteredItems) { item in
                        MediaItemView(item: item)
                    }
                }
                .padding()
            }
        }
        .navigationTitle("My Uploads")
        .onAppear {
            // TODO: Load actual media items from storage
            loadSampleData()
        }
    }
    
    private func loadSampleData() {
        // This is temporary sample data - replace with actual data loading
        mediaItems = [
            MediaItem(id: UUID(), type: .photo, thumbnail: nil, category: "Living Room", description: "Living room wall damage", date: Date()),
            MediaItem(id: UUID(), type: .video, thumbnail: nil, category: "Exterior", description: "Roof inspection", date: Date()),
            MediaItem(id: UUID(), type: .photo, thumbnail: nil, category: "Kitchen", description: "Leaking faucet", date: Date())
        ]
    }
}

struct CategoryButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? AppTheme.accentPrimary : AppTheme.tertiaryBackground)
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

struct MediaItemView: View {
    let item: MediaItem
    
    var body: some View {
        VStack(alignment: .leading) {
            ZStack {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .aspectRatio(1, contentMode: .fit)
                
                if let thumbnail = item.thumbnail {
                    Image(uiImage: thumbnail)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Image(systemName: item.type == .video ? "video.fill" : "photo.fill")
                        .font(.largeTitle)
                        .foregroundColor(.gray)
                }
            }
            .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(item.description)
                    .font(.subheadline)
                    .lineLimit(2)
                
                Text(item.category)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(item.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 4)
        }
    }
}

struct MediaItem: Identifiable {
    let id: UUID
    let type: UploadsMediaType
    let thumbnail: UIImage?
    let category: String
    let description: String
    let date: Date
}

enum UploadsMediaType {
    case photo
    case video
}

struct UploadsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            UploadsView()
        }
    }
}