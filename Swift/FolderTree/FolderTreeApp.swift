import SwiftUI

@main
struct FolderTreeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var previewSettings = PreviewSettings.shared
    @State private var showingSettings = false
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(previewSettings)
                .sheet(isPresented: $showingSettings) {
                    PreviewSettingsView()
                        .environmentObject(previewSettings)
                }
                .onReceive(NotificationCenter.default.publisher(for: .openPreviewSettings)) { _ in
                    showingSettings = true
                }
        }
        .windowStyle(.automatic)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Open Folder...") {
                    NotificationCenter.default.post(name: .openFolder, object: nil)
                }
                .keyboardShortcut("o", modifiers: .command)
            }
            CommandGroup(after: .appSettings) {
                Button("Preview Settings...") {
                    NotificationCenter.default.post(name: .openPreviewSettings, object: nil)
                }
                .keyboardShortcut(",", modifiers: .command)
            }
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

extension Notification.Name {
    static let openFolder = Notification.Name("openFolder")
    static let refreshTree = Notification.Name("refreshTree")
    static let openPreviewSettings = Notification.Name("openPreviewSettings")
}

// MARK: - Preview Settings
class PreviewSettings: ObservableObject {
    static let shared = PreviewSettings()
    
    private let whitelistKey = "previewFileTypeWhitelist"
    private let enableWhitelistKey = "previewWhitelistEnabled"
    
    static let defaultWhitelist: Set<String> = [
        // Code
        "swift", "js", "jsx", "mjs", "ts", "tsx", "py", "rb", "go", "rs", "java", "cs",
        "cpp", "cc", "cxx", "hpp", "c", "h", "css", "scss", "sass", "less",
        "xml", "xsl", "xslt", "plist", "yml", "yaml", "sql", "sh", "bash", "zsh", "fish",
        // Documents
        "txt", "md", "markdown", "json", "html", "htm", "pdf",
        // Images
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif", "heic", "svg", "icns"
    ]
    
    static let maxFileSize: Int64 = 100 * 1024 * 1024  // 100 MB
    static let loadTimeout: UInt64 = 10_000_000_000    // 10 seconds in nanoseconds
    
    @Published var whitelist: Set<String> {
        didSet { save() }
    }
    
    @Published var isWhitelistEnabled: Bool {
        didSet { UserDefaults.standard.set(isWhitelistEnabled, forKey: enableWhitelistKey) }
    }
    
    private init() {
        if let saved = UserDefaults.standard.array(forKey: whitelistKey) as? [String] {
            self.whitelist = Set(saved)
        } else {
            self.whitelist = Self.defaultWhitelist
        }
        self.isWhitelistEnabled = UserDefaults.standard.bool(forKey: enableWhitelistKey)
    }
    
    private func save() {
        UserDefaults.standard.set(Array(whitelist).sorted(), forKey: whitelistKey)
    }
    
    func isAllowed(_ ext: String) -> Bool {
        guard isWhitelistEnabled else { return true }
        return whitelist.contains(ext.lowercased())
    }
    
    func resetToDefault() {
        whitelist = Self.defaultWhitelist
    }
}

// MARK: - Preview Settings View
struct PreviewSettingsView: View {
    @EnvironmentObject var settings: PreviewSettings
    @Environment(\.dismiss) var dismiss
    @State private var newExtension = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Preview Settings")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding()
            
            Divider()
            
            Form {
                Toggle("Enable file type whitelist", isOn: $settings.isWhitelistEnabled)
                    .padding(.bottom, 8)
                
                if settings.isWhitelistEnabled {
                    Section("Allowed file extensions") {
                        // Add new extension
                        HStack {
                            TextField("Add extension (e.g. txt)", text: $newExtension)
                                .textFieldStyle(.roundedBorder)
                            Button("Add") {
                                let ext = newExtension.lowercased().trimmingCharacters(in: .whitespaces)
                                if !ext.isEmpty {
                                    settings.whitelist.insert(ext)
                                    newExtension = ""
                                }
                            }
                            .disabled(newExtension.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        
                        // Extension list
                        ScrollView {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 8) {
                                ForEach(Array(settings.whitelist).sorted(), id: \.self) { ext in
                                    HStack(spacing: 4) {
                                        Text(ext)
                                            .font(.system(size: 12, design: .monospaced))
                                        Button {
                                            settings.whitelist.remove(ext)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 12))
                                                .foregroundColor(.secondary)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.secondary.opacity(0.15))
                                    .cornerRadius(4)
                                }
                            }
                        }
                        .frame(height: 200)
                        
                        Button("Reset to Default") {
                            settings.resetToDefault()
                        }
                    }
                }
                
                Section {
                    Text("Files larger than 100 MB will not be previewed")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text("Preview will timeout after 10 seconds")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
            }
            .formStyle(.grouped)
        }
        .frame(width: 450, height: settings.isWhitelistEnabled ? 450 : 150)
    }
}
