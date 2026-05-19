import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var viewModel = FolderTreeViewModel()
    @State private var selectedFile: FileItem?
    @State private var isDragOverRoot = false
    
    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                // Header with gradient (like Electron version)
                HStack {
                    Image(systemName: "folder.fill")
                        .foregroundColor(.orange)
                    Text("FolderTree")
                        .font(.headline)
                        .foregroundColor(.primary)
                    Spacer()
                    Button(action: openFolder) {
                        Image(systemName: "folder.badge.plus")
                            .font(.system(size: 16))
                    }
                    .buttonStyle(.borderless)
                    .help("Open Folder (⌘O)")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    LinearGradient(
                        colors: [Color(hex: "458FFC"), Color(hex: "8C6BFB")],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .opacity(0.15)
                )
                
                Divider()
                
                // Tree view with drag-drop to root
                if let root = viewModel.rootItem {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            FileTreeRow(
                                item: root,
                                selectedFile: $selectedFile,
                                viewModel: viewModel,
                                level: 0
                            )
                        }
                        .padding(.vertical, 4)
                    }
                    .background(isDragOverRoot ? Color.accentColor.opacity(0.1) : Color.clear)
                    .onDrop(of: [.fileURL], isTargeted: $isDragOverRoot) { providers in
                        handleRootDrop(providers: providers)
                    }
                } else {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "folder")
                            .font(.system(size: 64))
                            .foregroundColor(.secondary.opacity(0.5))
                        Text("Open a folder to get started")
                            .foregroundColor(.secondary)
                        Button("Open Folder") {
                            openFolder()
                        }
                        .buttonStyle(.borderedProminent)
                        Spacer()
                    }
                }
            }
            .frame(minWidth: 260)
        } detail: {
            if let file = selectedFile {
                FilePreviewView(file: file, viewModel: viewModel)
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 64))
                        .foregroundColor(.secondary.opacity(0.5))
                    Text("Select a file to preview")
                        .foregroundColor(.secondary)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openFolder)) { _ in
            openFolder()
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshTree)) { _ in
            viewModel.refresh()
        }
    }
    
    private func openFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select a folder to browse"
        
        if panel.runModal() == .OK, let url = panel.url {
            viewModel.loadFolder(url: url)
            selectedFile = nil
        }
    }
    
    private func handleRootDrop(providers: [NSItemProvider]) -> Bool {
        guard let rootURL = viewModel.rootURL else { return false }
        
        for provider in providers {
            provider.loadObject(ofClass: URL.self) { url, _ in
                guard let sourceURL = url else { return }
                let destURL = rootURL.appendingPathComponent(sourceURL.lastPathComponent)
                
                DispatchQueue.main.async {
                    do {
                        try FileManager.default.moveItem(at: sourceURL, to: destURL)
                        viewModel.refresh()
                    } catch {
                        print("Move failed: \(error)")
                    }
                }
            }
        }
        return true
    }
}

// MARK: - File Tree Row
struct FileTreeRow: View {
    let item: FileItem
    @Binding var selectedFile: FileItem?
    @ObservedObject var viewModel: FolderTreeViewModel
    let level: Int
    
    @State private var children: [FileItem]?
    @State private var isLoading = false
    @State private var isDragOver = false
    
    private var isExpanded: Bool {
        viewModel.isExpanded(item.url)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Row content
            HStack(spacing: 4) {
                // Expand arrow
                if item.isDirectory {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.secondary)
                        .frame(width: 14)
                        .onTapGesture { toggleExpand() }
                } else {
                    Spacer().frame(width: 14)
                }
                
                // Icon
                FileIconView(item: item, isExpanded: isExpanded)
                    .frame(width: 18, height: 18)
                
                // Name
                Text(item.name)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .font(.system(size: 13))
                
                Spacer()
            }
            .padding(.leading, CGFloat(level * 16) + 4)
            .padding(.vertical, 5)
            .padding(.trailing, 8)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        selectedFile?.id == item.id ? Color.accentColor.opacity(0.25) :
                        isDragOver ? Color.accentColor.opacity(0.15) : Color.clear
                    )
                    .padding(.horizontal, 4)
            )
            .contentShape(Rectangle())
            .onTapGesture {
                if item.isDirectory {
                    toggleExpand()
                } else {
                    selectedFile = item
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $isDragOver) { providers in
                handleDrop(providers: providers)
            }
            .draggable(item.url) {
                HStack(spacing: 6) {
                    FileIconView(item: item, isExpanded: false)
                        .frame(width: 16, height: 16)
                    Text(item.name)
                        .font(.system(size: 12))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(4)
                .shadow(radius: 2)
            }
            
            // Children (lazy loaded)
            if isExpanded {
                if isLoading {
                    HStack(spacing: 6) {
                        ProgressView()
                            .scaleEffect(0.6)
                        Text("Loading...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.leading, CGFloat((level + 1) * 16) + 22)
                    .padding(.vertical, 4)
                } else if let children = children, !children.isEmpty {
                    ForEach(children) { child in
                        FileTreeRow(
                            item: child,
                            selectedFile: $selectedFile,
                            viewModel: viewModel,
                            level: level + 1
                        )
                    }
                }
            }
        }
        .onChange(of: isExpanded) { newValue in
            if newValue && children == nil {
                loadChildren()
            }
        }
    }
    
    private func toggleExpand() {
        guard item.isDirectory else { return }
        viewModel.toggleExpanded(item.url)
        if viewModel.isExpanded(item.url) && children == nil {
            loadChildren()
        }
    }
    
    private func loadChildren() {
        isLoading = true
        DispatchQueue.global(qos: .userInitiated).async {
            let items = FileItem.loadChildren(of: item.url)
            DispatchQueue.main.async {
                self.children = items
                self.isLoading = false
            }
        }
    }
    
    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        guard item.isDirectory else { return false }
        
        for provider in providers {
            provider.loadObject(ofClass: URL.self) { url, _ in
                guard let sourceURL = url else { return }
                // Don't move to self
                if sourceURL == item.url { return }
                
                let destURL = item.url.appendingPathComponent(sourceURL.lastPathComponent)
                
                DispatchQueue.main.async {
                    do {
                        try FileManager.default.moveItem(at: sourceURL, to: destURL)
                        // Refresh tree
                        self.children = FileItem.loadChildren(of: item.url)
                        NotificationCenter.default.post(name: .refreshTree, object: nil)
                    } catch {
                        print("Move failed: \(error)")
                    }
                }
            }
        }
        return true
    }
}

// MARK: - File Icon (matching Electron version)
struct FileIconView: View {
    let item: FileItem
    let isExpanded: Bool
    
    var body: some View {
        if item.isDirectory {
            Image(systemName: isExpanded ? "folder.fill" : "folder")
                .foregroundColor(.orange)
        } else {
            fileIcon
        }
    }
    
    @ViewBuilder
    private var fileIcon: some View {
        let ext = item.fileExtension
        
        switch ext {
        case "swift":
            Image(systemName: "swift")
                .foregroundColor(.orange)
        case "js", "jsx", "mjs":
            badgeIcon("JS", color: .yellow)
        case "ts", "tsx":
            badgeIcon("TS", color: .blue)
        case "py":
            badgeIcon("PY", color: Color(hex: "3776AB"))
        case "rb":
            badgeIcon("RB", color: .red)
        case "go":
            badgeIcon("GO", color: Color(hex: "00ADD8"))
        case "rs":
            badgeIcon("RS", color: Color(hex: "DEA584"))
        case "java":
            badgeIcon("JV", color: Color(hex: "B07219"))
        case "cs":
            badgeIcon("C#", color: Color(hex: "178600"))
        case "cpp", "cc", "cxx":
            badgeIcon("C+", color: Color(hex: "00599C"))
        case "c", "h":
            badgeIcon("C", color: Color(hex: "555555"))
        case "json":
            Image(systemName: "curlybraces")
                .foregroundColor(.yellow)
        case "html", "htm":
            Image(systemName: "globe")
                .foregroundColor(.orange)
        case "css", "scss", "sass":
            badgeIcon("CSS", color: Color(hex: "264DE4"))
        case "md", "markdown":
            Image(systemName: "text.document")
                .foregroundColor(.blue)
        case "pdf":
            Image(systemName: "doc.richtext.fill")
                .foregroundColor(.red)
        case "png", "jpg", "jpeg", "gif", "webp", "svg", "ico":
            Image(systemName: "photo.fill")
                .foregroundColor(.purple)
        case "tiff", "tif", "heic":
            Image(systemName: "photo")
                .foregroundColor(.purple)
        case "mp3", "wav", "m4a", "aac", "flac":
            Image(systemName: "music.note")
                .foregroundColor(.pink)
        case "mp4", "mov", "avi", "mkv", "webm":
            Image(systemName: "film")
                .foregroundColor(.pink)
        case "zip", "tar", "gz", "rar", "7z":
            Image(systemName: "doc.zipper")
                .foregroundColor(.gray)
        case "sh", "bash", "zsh":
            Image(systemName: "terminal")
                .foregroundColor(.green)
        case "yml", "yaml":
            badgeIcon("YML", color: .red)
        case "xml":
            badgeIcon("XML", color: .orange)
        case "sql":
            badgeIcon("SQL", color: .blue)
        case "txt":
            Image(systemName: "doc.text")
                .foregroundColor(.secondary)
        case "gitignore", "env":
            Image(systemName: "gearshape")
                .foregroundColor(.secondary)
        default:
            Image(systemName: "doc")
                .foregroundColor(.secondary)
        }
    }
    
    private func badgeIcon(_ text: String, color: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3)
                .fill(color)
                .frame(width: 18, height: 14)
            Text(text)
                .font(.system(size: text.count > 2 ? 6 : 7, weight: .bold))
                .foregroundColor(.white)
        }
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        (r, g, b) = (int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255
        )
    }
}

#Preview {
    ContentView()
}
