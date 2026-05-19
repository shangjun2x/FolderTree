import Foundation
import SwiftUI

// MARK: - File Item Model
struct FileItem: Identifiable, Hashable {
    let id = UUID()
    let url: URL
    let name: String
    let isDirectory: Bool
    let size: Int64
    let modificationDate: Date?
    
    init(url: URL) {
        self.url = url
        self.name = url.lastPathComponent
        
        var isDir: ObjCBool = false
        FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)
        self.isDirectory = isDir.boolValue
        
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        self.size = (attrs?[.size] as? Int64) ?? 0
        self.modificationDate = attrs?[.modificationDate] as? Date
    }
    
    var fileExtension: String {
        url.pathExtension.lowercased()
    }
    
    static func loadChildren(of url: URL) -> [FileItem] {
        do {
            let contents = try FileManager.default.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
                options: [.skipsHiddenFiles]
            )
            
            return contents
                .map { FileItem(url: $0) }
                .sorted { item1, item2 in
                    // Folders first, then alphabetical
                    if item1.isDirectory != item2.isDirectory {
                        return item1.isDirectory
                    }
                    return item1.name.localizedStandardCompare(item2.name) == .orderedAscending
                }
        } catch {
            return []
        }
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(url)
    }
    
    static func == (lhs: FileItem, rhs: FileItem) -> Bool {
        lhs.url == rhs.url
    }
}

// MARK: - View Model
@MainActor
class FolderTreeViewModel: ObservableObject {
    @Published var rootItem: FileItem?
    @Published var rootURL: URL?
    @Published var expandedPaths: Set<URL> = []
    
    func loadFolder(url: URL) {
        self.rootURL = url
        self.rootItem = FileItem(url: url)
        self.expandedPaths = [url] // Auto-expand root
    }
    
    func toggleExpanded(_ url: URL) {
        if expandedPaths.contains(url) {
            expandedPaths.remove(url)
        } else {
            expandedPaths.insert(url)
        }
    }
    
    func isExpanded(_ url: URL) -> Bool {
        expandedPaths.contains(url)
    }
    
    func refresh() {
        if let url = rootURL {
            // Keep expanded state
            let expanded = expandedPaths
            rootItem = FileItem(url: url)
            expandedPaths = expanded
        }
    }
}
