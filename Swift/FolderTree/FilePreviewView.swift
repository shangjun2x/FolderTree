import SwiftUI
import PDFKit
import WebKit

struct FilePreviewView: View {
    let file: FileItem
    @ObservedObject var viewModel: FolderTreeViewModel
    
    @State private var content: String = ""
    @State private var isLoading = true
    @State private var previewType: PreviewType = .text
    @State private var nsImage: NSImage?
    @State private var jsonObject: Any?
    @State private var selectedTab = 0  // 0 = Preview, 1 = Source
    
    enum PreviewType {
        case text
        case code(SyntaxHighlighter.Language)
        case image
        case pdf
        case json
        case html
        case markdown
        case unsupported
    }
    
    private var showTabs: Bool {
        switch previewType {
        case .image, .pdf, .unsupported:
            return false
        default:
            return true
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 10) {
                FileIconView(item: file, isExpanded: false)
                    .frame(width: 22, height: 22)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.name)
                        .font(.headline)
                        .lineLimit(1)
                    Text(formatSize(file.size))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Tabs (like Electron version)
                if showTabs {
                    Picker("", selection: $selectedTab) {
                        Text("Preview").tag(0)
                        Text("Source").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 160)
                }
                
                // Open in Finder button
                Button(action: {
                    NSWorkspace.shared.activateFileViewerSelecting([file.url])
                }) {
                    Image(systemName: "arrow.up.forward.square")
                }
                .buttonStyle(.borderless)
                .help("Show in Finder")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(NSColor.controlBackgroundColor))
            
            Divider()
            
            // Content
            if isLoading {
                VStack(spacing: 12) {
                    Spacer()
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Loading preview...")
                        .foregroundColor(.secondary)
                    Spacer()
                }
            } else {
                if selectedTab == 1 && showTabs {
                    // Source view
                    sourceView
                } else {
                    // Preview view
                    previewContent
                }
            }
        }
        .task(id: file.id) {
            await loadPreview()
        }
    }
    
    @ViewBuilder
    private var previewContent: some View {
        switch previewType {
        case .text:
            ScrollView {
                Text(content)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            
        case .code(let language):
            ScrollView([.horizontal, .vertical]) {
                CollapsibleCodeView(content: content, language: language)
                    .padding()
            }
            .background(Color(NSColor.textBackgroundColor))
            
        case .image:
            if let image = nsImage {
                ScrollView([.horizontal, .vertical]) {
                    Image(nsImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .padding()
                }
                .background(Color(NSColor.textBackgroundColor))
            }
            
        case .pdf:
            PDFPreviewView(url: file.url)
            
        case .json:
            ScrollView {
                if let json = jsonObject {
                    JSONTreeView(value: json, key: nil, level: 0)
                        .padding()
                }
            }
            
        case .html:
            HTMLPreviewView(content: content, baseURL: file.url.deletingLastPathComponent())
            
        case .markdown:
            MarkdownPreviewView(content: content)
            
        case .unsupported:
            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "doc.questionmark")
                    .font(.system(size: 56))
                    .foregroundColor(.secondary.opacity(0.5))
                Text("Preview not available for this file type")
                    .foregroundColor(.secondary)
                Button("Open in Default App") {
                    NSWorkspace.shared.open(file.url)
                }
                .buttonStyle(.borderedProminent)
                Spacer()
            }
        }
    }
    
    @ViewBuilder
    private var sourceView: some View {
        ScrollView([.horizontal, .vertical]) {
            Text(content)
                .font(.system(size: 12, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
        .background(Color(NSColor.textBackgroundColor))
    }
    
    private func loadPreview() async {
        isLoading = true
        selectedTab = 0
        let ext = file.fileExtension
        
        // Images (macOS natively supports TIFF, HEIC, ICNS!)
        let imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif", "heic", "svg", "icns"]
        if imageExts.contains(ext) {
            if let image = NSImage(contentsOf: file.url) {
                nsImage = image
                previewType = .image
            } else {
                previewType = .unsupported
            }
            isLoading = false
            return
        }
        
        // PDF
        if ext == "pdf" {
            previewType = .pdf
            isLoading = false
            return
        }
        
        // Binary files - check early to avoid reading
        let binaryExts = ["zip", "tar", "gz", "exe", "dll", "dmg", "pkg", "app", "rar", "7z",
                         "mp3", "wav", "m4a", "mp4", "mov", "avi", "mkv", "iso", "bin", "dat"]
        if binaryExts.contains(ext) {
            previewType = .unsupported
            isLoading = false
            return
        }
        
        // JSON
        if ext == "json" {
            do {
                let data = try Data(contentsOf: file.url)
                jsonObject = try JSONSerialization.jsonObject(with: data)
                content = String(data: data, encoding: .utf8) ?? ""
                previewType = .json
            } catch {
                content = "Error parsing JSON: \(error.localizedDescription)"
                previewType = .text
            }
            isLoading = false
            return
        }
        
        // HTML
        if ["html", "htm"].contains(ext) {
            do {
                content = try String(contentsOf: file.url, encoding: .utf8)
                previewType = .html
            } catch {
                previewType = .unsupported
            }
            isLoading = false
            return
        }
        
        // Markdown - render as formatted
        if ["md", "markdown"].contains(ext) {
            do {
                content = try String(contentsOf: file.url, encoding: .utf8)
                previewType = .markdown
            } catch {
                previewType = .unsupported
            }
            isLoading = false
            return
        }
        
        // Code files with syntax highlighting
        let codeExts = ["swift", "js", "jsx", "mjs", "ts", "tsx", "py", "rb", "go", "rs", "java", "cs",
                       "cpp", "cc", "cxx", "hpp", "c", "h", "css", "scss", "sass", "less",
                       "xml", "xsl", "xslt", "plist", "yml", "yaml", "sql", "sh", "bash", "zsh", "fish"]
        if codeExts.contains(ext) {
            let language = SyntaxHighlighter.Language.from(extension: ext)
            do {
                content = try String(contentsOf: file.url, encoding: .utf8)
                previewType = .code(language)
            } catch {
                previewType = .unsupported
            }
            isLoading = false
            return
        }
        
        // Text files
        do {
            content = try String(contentsOf: file.url, encoding: .utf8)
            previewType = .text
        } catch {
            // Try other encodings
            if let data = try? Data(contentsOf: file.url),
               let str = String(data: data, encoding: .isoLatin1) {
                content = str
                previewType = .text
            } else {
                previewType = .unsupported
            }
        }
        isLoading = false
    }
    
    private func formatSize(_ size: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }
}

// MARK: - PDF Preview
struct PDFPreviewView: NSViewRepresentable {
    let url: URL
    
    func makeNSView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.document = PDFDocument(url: url)
        return pdfView
    }
    
    func updateNSView(_ nsView: PDFView, context: Context) {
        if nsView.document?.documentURL != url {
            nsView.document = PDFDocument(url: url)
        }
    }
}

// MARK: - HTML Preview (opens links in browser)
struct HTMLPreviewView: NSViewRepresentable {
    let content: String
    let baseURL: URL
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.loadHTMLString(content, baseURL: baseURL)
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        nsView.loadHTMLString(content, baseURL: baseURL)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url {
                // Open external links in browser
                if url.scheme == "http" || url.scheme == "https" {
                    NSWorkspace.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
    }
}

// MARK: - Markdown Preview (rendered)
struct MarkdownPreviewView: NSViewRepresentable {
    let content: String
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        loadMarkdown(webView)
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        loadMarkdown(nsView)
    }
    
    private func loadMarkdown(_ webView: WKWebView) {
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                :root { color-scheme: light dark; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                @media (prefers-color-scheme: dark) {
                    body { background: #1e1e1e; color: #d4d4d4; }
                    a { color: #58a6ff; }
                    code { background: #2d2d30; }
                    pre { background: #2d2d30; }
                    blockquote { border-left-color: #555; color: #888; }
                    table, th, td { border-color: #444; }
                    th { background: #2d2d30; }
                }
                h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
                h1 { font-size: 2em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
                h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Menlo, monospace; font-size: 0.9em; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
                pre code { background: none; padding: 0; }
                blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
                a { color: #0366d6; text-decoration: none; }
                a:hover { text-decoration: underline; }
                img { max-width: 100%; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
                th { background: #f6f8fa; }
                hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
                ul, ol { padding-left: 2em; }
                li { margin: 0.25em 0; }
            </style>
        </head>
        <body>\(convertMarkdownToHTML(content))</body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
    
    private func convertMarkdownToHTML(_ md: String) -> String {
        var html = escapeHTML(md)
        
        // Code blocks (before other processing)
        html = html.replacingOccurrences(of: "```([a-z]*)\\n([\\s\\S]*?)```",
                                         with: "<pre><code>$2</code></pre>",
                                         options: .regularExpression)
        
        // Headers
        html = html.replacingOccurrences(of: "(?m)^###### (.+)$", with: "<h6>$1</h6>", options: .regularExpression)
        html = html.replacingOccurrences(of: "(?m)^##### (.+)$", with: "<h5>$1</h5>", options: .regularExpression)
        html = html.replacingOccurrences(of: "(?m)^#### (.+)$", with: "<h4>$1</h4>", options: .regularExpression)
        html = html.replacingOccurrences(of: "(?m)^### (.+)$", with: "<h3>$1</h3>", options: .regularExpression)
        html = html.replacingOccurrences(of: "(?m)^## (.+)$", with: "<h2>$1</h2>", options: .regularExpression)
        html = html.replacingOccurrences(of: "(?m)^# (.+)$", with: "<h1>$1</h1>", options: .regularExpression)
        
        // Bold and italic
        html = html.replacingOccurrences(of: "\\*\\*\\*(.+?)\\*\\*\\*", with: "<strong><em>$1</em></strong>", options: .regularExpression)
        html = html.replacingOccurrences(of: "\\*\\*(.+?)\\*\\*", with: "<strong>$1</strong>", options: .regularExpression)
        html = html.replacingOccurrences(of: "\\*(.+?)\\*", with: "<em>$1</em>", options: .regularExpression)
        
        // Inline code
        html = html.replacingOccurrences(of: "`([^`]+)`", with: "<code>$1</code>", options: .regularExpression)
        
        // Links and images
        html = html.replacingOccurrences(of: "!\\[([^\\]]*)\\]\\(([^)]+)\\)", with: "<img src=\"$2\" alt=\"$1\">", options: .regularExpression)
        html = html.replacingOccurrences(of: "\\[([^\\]]+)\\]\\(([^)]+)\\)", with: "<a href=\"$2\">$1</a>", options: .regularExpression)
        
        // Blockquotes
        html = html.replacingOccurrences(of: "(?m)^&gt; (.+)$", with: "<blockquote>$1</blockquote>", options: .regularExpression)
        
        // Horizontal rules
        html = html.replacingOccurrences(of: "(?m)^[-*_]{3,}$", with: "<hr>", options: .regularExpression)
        
        // Line breaks to paragraphs (simplified)
        html = html.replacingOccurrences(of: "\n\n", with: "</p><p>")
        html = "<p>" + html + "</p>"
        html = html.replacingOccurrences(of: "<p></p>", with: "")
        
        return html
    }
    
    private func escapeHTML(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }
    
    func makeCoordinator() -> Coordinator { Coordinator() }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

// MARK: - JSON Tree View (collapsible like Electron version)
struct JSONTreeView: View {
    let value: Any
    let key: String?
    let level: Int
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let dict = value as? [String: Any] {
                expandableRow(type: "object", count: dict.count) {
                    ForEach(Array(dict.keys.sorted()), id: \.self) { k in
                        JSONTreeView(value: dict[k]!, key: k, level: level + 1)
                    }
                }
            } else if let array = value as? [Any] {
                expandableRow(type: "array", count: array.count) {
                    ForEach(Array(array.enumerated()), id: \.offset) { index, item in
                        JSONTreeView(value: item, key: "[\(index)]", level: level + 1)
                    }
                }
            } else {
                leafRow
            }
        }
    }
    
    @ViewBuilder
    private func expandableRow<Content: View>(type: String, count: Int, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 4) {
            Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.secondary)
                .frame(width: 12)
                .onTapGesture { withAnimation(.easeInOut(duration: 0.15)) { isExpanded.toggle() } }
            
            if let key = key {
                Text("\"\(key)\"")
                    .foregroundColor(.purple)
                Text(":")
                    .foregroundColor(.secondary)
            }
            
            Text(type == "object" ? "{" : "[")
                .foregroundColor(.secondary)
            
            if !isExpanded {
                Text("\(count) \(type == "object" ? "keys" : "items")")
                    .foregroundColor(.secondary)
                    .font(.caption)
                Text(type == "object" ? "}" : "]")
                    .foregroundColor(.secondary)
            }
        }
        .font(.system(size: 13, design: .monospaced))
        .padding(.leading, CGFloat(level * 16))
        
        if isExpanded {
            content()
            
            Text(type == "object" ? "}" : "]")
                .font(.system(size: 13, design: .monospaced))
                .foregroundColor(.secondary)
                .padding(.leading, CGFloat(level * 16))
        }
    }
    
    @ViewBuilder
    private var leafRow: some View {
        HStack(spacing: 4) {
            Spacer().frame(width: 12) // Align with expandable rows
            
            if let key = key, !key.hasPrefix("[") {
                Text("\"\(key)\"")
                    .foregroundColor(.purple)
                Text(":")
                    .foregroundColor(.secondary)
            } else if let key = key {
                Text(key)
                    .foregroundColor(.secondary)
                Text(":")
                    .foregroundColor(.secondary)
            }
            
            if let str = value as? String {
                Text("\"\(str)\"")
                    .foregroundColor(.green)
            } else if let num = value as? NSNumber {
                if CFBooleanGetTypeID() == CFGetTypeID(num) {
                    Text(num.boolValue ? "true" : "false")
                        .foregroundColor(.orange)
                } else {
                    Text("\(num)")
                        .foregroundColor(.blue)
                }
            } else if value is NSNull {
                Text("null")
                    .foregroundColor(.red)
            } else {
                Text("\(String(describing: value))")
                    .foregroundColor(.primary)
            }
        }
        .font(.system(size: 13, design: .monospaced))
        .padding(.leading, CGFloat(level * 16))
    }
}

#Preview {
    FilePreviewView(
        file: FileItem(url: URL(fileURLWithPath: "/Users")),
        viewModel: FolderTreeViewModel()
    )
}
