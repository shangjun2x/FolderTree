import SwiftUI

// MARK: - Syntax Highlighter
struct SyntaxHighlighter {
    
    enum Language {
        case swift, javascript, typescript, python, ruby, go, rust, java, csharp, cpp, c
        case html, css, xml, yaml, sql, shell, markdown, json
        case unknown
        
        static func from(extension ext: String) -> Language {
            switch ext.lowercased() {
            case "swift": return .swift
            case "js", "jsx", "mjs": return .javascript
            case "ts", "tsx": return .typescript
            case "py": return .python
            case "rb": return .ruby
            case "go": return .go
            case "rs": return .rust
            case "java": return .java
            case "cs": return .csharp
            case "cpp", "cc", "cxx", "hpp": return .cpp
            case "c", "h": return .c
            case "html", "htm": return .html
            case "css", "scss", "sass", "less": return .css
            case "xml", "xsl", "xslt", "plist": return .xml
            case "yml", "yaml": return .yaml
            case "sql": return .sql
            case "sh", "bash", "zsh", "fish": return .shell
            case "md", "markdown": return .markdown
            case "json": return .json
            default: return .unknown
            }
        }
    }
    
    static func highlight(_ text: String, language: Language) -> AttributedString {
        var result = AttributedString(text)
        
        let keywords: [String]
        let types: [String]
        let commentPatterns: [String]
        let stringPattern = "\"[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*\"|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'"
        
        switch language {
        case .swift:
            keywords = ["import", "func", "var", "let", "class", "struct", "enum", "protocol", "extension",
                       "if", "else", "guard", "switch", "case", "default", "for", "while", "repeat",
                       "return", "throw", "try", "catch", "async", "await", "init", "deinit", "self",
                       "private", "public", "internal", "fileprivate", "open", "static", "override",
                       "true", "false", "nil", "in", "where", "some", "any", "@State", "@Binding",
                       "@Published", "@ObservedObject", "@StateObject", "@MainActor", "@ViewBuilder"]
            types = ["String", "Int", "Double", "Float", "Bool", "Array", "Dictionary", "Set", "Optional",
                    "View", "some", "Any", "AnyObject", "Self", "Type", "URL", "Data", "Date"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .javascript, .typescript:
            keywords = ["function", "const", "let", "var", "class", "extends", "import", "export", "from",
                       "if", "else", "switch", "case", "default", "for", "while", "do", "return",
                       "try", "catch", "finally", "throw", "async", "await", "new", "this", "super",
                       "true", "false", "null", "undefined", "typeof", "instanceof", "of", "in",
                       "static", "get", "set", "constructor", "yield", "delete"]
            types = ["string", "number", "boolean", "object", "any", "void", "never", "unknown",
                    "Promise", "Array", "Map", "Set", "Date", "RegExp", "Error", "Function"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .python:
            keywords = ["def", "class", "import", "from", "as", "if", "elif", "else", "for", "while",
                       "try", "except", "finally", "raise", "with", "return", "yield", "pass", "break",
                       "continue", "lambda", "and", "or", "not", "in", "is", "True", "False", "None",
                       "global", "nonlocal", "assert", "del", "async", "await", "self", "cls"]
            types = ["str", "int", "float", "bool", "list", "dict", "set", "tuple", "bytes", "type"]
            commentPatterns = ["#.*$", "\"\"\"[\\s\\S]*?\"\"\"", "'''[\\s\\S]*?'''"]
            
        case .ruby:
            keywords = ["def", "class", "module", "if", "elsif", "else", "unless", "case", "when",
                       "while", "until", "for", "do", "end", "return", "yield", "begin", "rescue",
                       "ensure", "raise", "require", "include", "extend", "attr_reader", "attr_writer",
                       "attr_accessor", "true", "false", "nil", "self", "super", "private", "public", "protected"]
            types = ["String", "Integer", "Float", "Array", "Hash", "Symbol", "Proc", "Lambda"]
            commentPatterns = ["#.*$", "=begin[\\s\\S]*?=end"]
            
        case .go:
            keywords = ["package", "import", "func", "var", "const", "type", "struct", "interface",
                       "if", "else", "switch", "case", "default", "for", "range", "return", "defer",
                       "go", "chan", "select", "break", "continue", "fallthrough", "goto", "map",
                       "true", "false", "nil", "iota", "make", "new", "len", "cap", "append", "copy"]
            types = ["string", "int", "int8", "int16", "int32", "int64", "uint", "byte", "rune",
                    "float32", "float64", "bool", "error", "any", "interface{}"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .rust:
            keywords = ["fn", "let", "mut", "const", "static", "struct", "enum", "trait", "impl",
                       "if", "else", "match", "loop", "while", "for", "in", "return", "break",
                       "continue", "pub", "mod", "use", "crate", "self", "super", "as", "where",
                       "async", "await", "move", "ref", "true", "false", "Some", "None", "Ok", "Err"]
            types = ["i8", "i16", "i32", "i64", "i128", "u8", "u16", "u32", "u64", "u128",
                    "f32", "f64", "bool", "char", "str", "String", "Vec", "Option", "Result", "Box"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .java:
            keywords = ["public", "private", "protected", "class", "interface", "extends", "implements",
                       "import", "package", "if", "else", "switch", "case", "default", "for", "while",
                       "do", "return", "try", "catch", "finally", "throw", "throws", "new", "this",
                       "super", "static", "final", "abstract", "synchronized", "volatile", "transient",
                       "true", "false", "null", "void", "instanceof", "enum", "assert", "break", "continue"]
            types = ["int", "long", "short", "byte", "float", "double", "boolean", "char",
                    "String", "Integer", "Long", "Double", "Boolean", "Object", "List", "Map", "Set", "Array"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .csharp:
            keywords = ["public", "private", "protected", "internal", "class", "struct", "interface",
                       "using", "namespace", "if", "else", "switch", "case", "default", "for", "foreach",
                       "while", "do", "return", "try", "catch", "finally", "throw", "new", "this", "base",
                       "static", "readonly", "const", "virtual", "override", "abstract", "sealed", "async",
                       "await", "true", "false", "null", "void", "var", "dynamic", "is", "as", "in", "out", "ref"]
            types = ["int", "long", "short", "byte", "float", "double", "decimal", "bool", "char",
                    "string", "object", "String", "Int32", "List", "Dictionary", "Task", "Action", "Func"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .cpp, .c:
            keywords = ["if", "else", "switch", "case", "default", "for", "while", "do", "return",
                       "break", "continue", "goto", "typedef", "struct", "enum", "union", "sizeof",
                       "static", "extern", "const", "volatile", "inline", "register", "auto",
                       "class", "public", "private", "protected", "virtual", "override", "template",
                       "namespace", "using", "try", "catch", "throw", "new", "delete", "true", "false",
                       "nullptr", "NULL", "this", "#include", "#define", "#ifdef", "#ifndef", "#endif", "#pragma"]
            types = ["int", "long", "short", "char", "float", "double", "void", "bool", "unsigned",
                    "signed", "size_t", "auto", "string", "vector", "map", "set", "pair"]
            commentPatterns = ["//.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .sql:
            keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
                       "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE",
                       "ALTER", "DROP", "INDEX", "VIEW", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
                       "ON", "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION",
                       "NULL", "TRUE", "FALSE", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE",
                       "DEFAULT", "CHECK", "CONSTRAINT", "CASCADE", "EXISTS", "DISTINCT", "COUNT",
                       "SUM", "AVG", "MIN", "MAX", "IF", "ELSE", "THEN", "END", "CASE", "WHEN",
                       "select", "from", "where", "and", "or", "insert", "update", "delete", "create"]
            types = ["INT", "INTEGER", "VARCHAR", "TEXT", "BOOLEAN", "DATE", "DATETIME", "TIMESTAMP",
                    "FLOAT", "DOUBLE", "DECIMAL", "BLOB", "CHAR", "BIGINT", "SMALLINT"]
            commentPatterns = ["--.*$", "/\\*[\\s\\S]*?\\*/"]
            
        case .shell:
            keywords = ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
                       "esac", "in", "function", "return", "exit", "break", "continue", "export",
                       "local", "readonly", "declare", "set", "unset", "source", "alias", "echo",
                       "cd", "pwd", "ls", "rm", "cp", "mv", "mkdir", "rmdir", "cat", "grep", "sed",
                       "awk", "find", "xargs", "chmod", "chown", "curl", "wget", "tar", "zip", "unzip",
                       "git", "npm", "yarn", "pip", "brew", "apt", "yum", "sudo", "true", "false"]
            types = []
            commentPatterns = ["#.*$"]
            
        case .yaml:
            return highlightYAML(text)
            
        case .xml:
            return highlightXML(text)
            
        case .html:
            return highlightHTML(text)
            
        case .css:
            return highlightCSS(text)
            
        case .markdown:
            return highlightMarkdown(text)
            
        case .json, .unknown:
            return result
        }
        
        // Apply highlighting
        applyPatternHighlighting(&result, text: text, keywords: keywords, types: types,
                                  commentPatterns: commentPatterns, stringPattern: stringPattern)
        
        return result
    }
    
    private static func applyPatternHighlighting(_ result: inout AttributedString, text: String,
                                                   keywords: [String], types: [String],
                                                   commentPatterns: [String], stringPattern: String) {
        // Comments (green)
        for pattern in commentPatterns {
            highlightPattern(&result, in: text, pattern: pattern, color: .green)
        }
        
        // Strings (orange)
        highlightPattern(&result, in: text, pattern: stringPattern, color: .orange)
        
        // Numbers (cyan)
        highlightPattern(&result, in: text, pattern: "\\b\\d+\\.?\\d*\\b", color: .cyan)
        
        // Keywords (pink/magenta)
        for keyword in keywords {
            highlightWord(&result, in: text, word: keyword, color: .pink)
        }
        
        // Types (cyan)
        for type in types {
            highlightWord(&result, in: text, word: type, color: .cyan)
        }
    }
    
    private static func highlightPattern(_ result: inout AttributedString, in text: String,
                                          pattern: String, color: Color) {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines]) else { return }
        let range = NSRange(text.startIndex..., in: text)
        
        for match in regex.matches(in: text, options: [], range: range) {
            if let swiftRange = Range(match.range, in: text),
               let attrRange = result.range(of: String(text[swiftRange])) {
                result[attrRange].foregroundColor = color
            }
        }
    }
    
    private static func highlightWord(_ result: inout AttributedString, in text: String,
                                       word: String, color: Color) {
        let pattern = "\\b\(NSRegularExpression.escapedPattern(for: word))\\b"
        highlightPattern(&result, in: text, pattern: pattern, color: color)
    }
    
    // MARK: - YAML Highlighting
    private static func highlightYAML(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        
        // Comments
        highlightPattern(&result, in: text, pattern: "#.*$", color: .green)
        
        // Keys (before colon)
        highlightPattern(&result, in: text, pattern: "^\\s*[\\w\\-\\.]+(?=\\s*:)", color: .cyan)
        
        // Boolean and null values
        highlightPattern(&result, in: text, pattern: ":\\s*(true|false|yes|no|null|~)\\s*$", color: .orange)
        
        // Numbers
        highlightPattern(&result, in: text, pattern: ":\\s*-?\\d+\\.?\\d*\\s*$", color: .purple)
        
        // Strings in quotes
        highlightPattern(&result, in: text, pattern: "\"[^\"]*\"|'[^']*'", color: .orange)
        
        // List markers
        highlightPattern(&result, in: text, pattern: "^\\s*-\\s", color: .pink)
        
        // Anchors and aliases
        highlightPattern(&result, in: text, pattern: "[&*][\\w]+", color: .yellow)
        
        return result
    }
    
    // MARK: - XML Highlighting
    private static func highlightXML(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        
        // Comments
        highlightPattern(&result, in: text, pattern: "<!--[\\s\\S]*?-->", color: .green)
        
        // Tags
        highlightPattern(&result, in: text, pattern: "</?[\\w:-]+", color: .pink)
        highlightPattern(&result, in: text, pattern: "/?>", color: .pink)
        
        // Attributes
        highlightPattern(&result, in: text, pattern: "\\s[\\w:-]+(?==)", color: .cyan)
        
        // Attribute values
        highlightPattern(&result, in: text, pattern: "\"[^\"]*\"", color: .orange)
        
        // CDATA
        highlightPattern(&result, in: text, pattern: "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>", color: .gray)
        
        // Processing instructions
        highlightPattern(&result, in: text, pattern: "<\\?[\\s\\S]*?\\?>", color: .purple)
        
        return result
    }
    
    // MARK: - HTML Highlighting
    private static func highlightHTML(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        
        // Comments
        highlightPattern(&result, in: text, pattern: "<!--[\\s\\S]*?-->", color: .green)
        
        // DOCTYPE
        highlightPattern(&result, in: text, pattern: "<!DOCTYPE[^>]*>", color: .gray)
        
        // Tags
        highlightPattern(&result, in: text, pattern: "</?[a-zA-Z][a-zA-Z0-9]*", color: .pink)
        highlightPattern(&result, in: text, pattern: "/?>", color: .pink)
        
        // Attributes
        highlightPattern(&result, in: text, pattern: "\\s[a-zA-Z][a-zA-Z0-9-]*(?==)", color: .cyan)
        
        // Attribute values
        highlightPattern(&result, in: text, pattern: "\"[^\"]*\"", color: .orange)
        
        return result
    }
    
    // MARK: - CSS Highlighting
    private static func highlightCSS(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        
        // Comments
        highlightPattern(&result, in: text, pattern: "/\\*[\\s\\S]*?\\*/", color: .green)
        
        // Selectors (before {)
        highlightPattern(&result, in: text, pattern: "[.#]?[a-zA-Z][a-zA-Z0-9_-]*(?=\\s*[{,])", color: .pink)
        
        // Properties
        highlightPattern(&result, in: text, pattern: "[a-z-]+(?=\\s*:)", color: .cyan)
        
        // Values with units
        highlightPattern(&result, in: text, pattern: "\\d+\\.?\\d*(px|em|rem|%|vh|vw|pt|cm|mm|in)", color: .purple)
        
        // Colors
        highlightPattern(&result, in: text, pattern: "#[a-fA-F0-9]{3,8}\\b", color: .orange)
        
        // Strings
        highlightPattern(&result, in: text, pattern: "\"[^\"]*\"|'[^']*'", color: .orange)
        
        // Important
        highlightPattern(&result, in: text, pattern: "!important", color: .red)
        
        // At-rules
        highlightPattern(&result, in: text, pattern: "@[a-zA-Z-]+", color: .purple)
        
        return result
    }
    
    // MARK: - Markdown Highlighting
    private static func highlightMarkdown(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        
        // Headers
        highlightPattern(&result, in: text, pattern: "^#{1,6}\\s.*$", color: .pink)
        
        // Bold
        highlightPattern(&result, in: text, pattern: "\\*\\*[^*]+\\*\\*|__[^_]+__", color: .orange)
        
        // Italic
        highlightPattern(&result, in: text, pattern: "\\*[^*]+\\*|_[^_]+_", color: .yellow)
        
        // Code blocks
        highlightPattern(&result, in: text, pattern: "```[\\s\\S]*?```", color: .green)
        
        // Inline code
        highlightPattern(&result, in: text, pattern: "`[^`]+`", color: .green)
        
        // Links
        highlightPattern(&result, in: text, pattern: "\\[[^\\]]+\\]\\([^)]+\\)", color: .cyan)
        
        // Images
        highlightPattern(&result, in: text, pattern: "!\\[[^\\]]*\\]\\([^)]+\\)", color: .purple)
        
        // Blockquotes
        highlightPattern(&result, in: text, pattern: "^>.*$", color: .gray)
        
        // Lists
        highlightPattern(&result, in: text, pattern: "^\\s*[-*+]\\s", color: .cyan)
        highlightPattern(&result, in: text, pattern: "^\\s*\\d+\\.\\s", color: .cyan)
        
        // Horizontal rules
        highlightPattern(&result, in: text, pattern: "^[-*_]{3,}$", color: .gray)
        
        return result
    }
}

// MARK: - Syntax Highlighted Text View
struct SyntaxHighlightedText: View {
    let content: String
    let language: SyntaxHighlighter.Language
    
    var body: some View {
        Text(SyntaxHighlighter.highlight(content, language: language))
            .font(.system(size: 13, design: .monospaced))
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Collapsible Code View
struct CollapsibleCodeView: View {
    let content: String
    let language: SyntaxHighlighter.Language
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(parseCodeBlocks().enumerated()), id: \.offset) { _, block in
                CodeBlockView(block: block, language: language)
            }
        }
    }
    
    private func parseCodeBlocks() -> [CodeBlock] {
        let lines = content.components(separatedBy: "\n")
        var blocks: [CodeBlock] = []
        var currentBlock: CodeBlock?
        var braceDepth = 0
        var bracketDepth = 0
        var parenDepth = 0
        
        for (index, line) in lines.enumerated() {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            // Count braces/brackets
            let openBraces = line.filter { $0 == "{" }.count
            let closeBraces = line.filter { $0 == "}" }.count
            let openBrackets = line.filter { $0 == "[" }.count
            let closeBrackets = line.filter { $0 == "]" }.count
            let openParens = line.filter { $0 == "(" }.count
            let closeParens = line.filter { $0 == ")" }.count
            
            // Detect block start patterns
            let isBlockStart = detectBlockStart(line: line, trimmed: trimmed, language: language)
            
            if isBlockStart && currentBlock == nil {
                // Start new collapsible block
                currentBlock = CodeBlock(
                    startLine: index,
                    header: line,
                    lines: [line],
                    isCollapsible: true
                )
                braceDepth = openBraces - closeBraces
                bracketDepth = openBrackets - closeBrackets
                parenDepth = openParens - closeParens
            } else if var block = currentBlock {
                // Continue current block
                block.lines.append(line)
                braceDepth += openBraces - closeBraces
                bracketDepth += openBrackets - closeBrackets
                parenDepth += openParens - closeParens
                
                // Check if block ended
                if braceDepth <= 0 && bracketDepth <= 0 && parenDepth <= 0 {
                    block.endLine = index
                    blocks.append(block)
                    currentBlock = nil
                    braceDepth = 0
                    bracketDepth = 0
                    parenDepth = 0
                } else {
                    currentBlock = block
                }
            } else {
                // Single line (not in a block)
                blocks.append(CodeBlock(
                    startLine: index,
                    header: line,
                    lines: [line],
                    isCollapsible: false
                ))
            }
        }
        
        // Handle unclosed block
        if let block = currentBlock {
            blocks.append(block)
        }
        
        return blocks
    }
    
    private func detectBlockStart(line: String, trimmed: String, language: SyntaxHighlighter.Language) -> Bool {
        // Common patterns that start collapsible blocks
        let patterns: [String]
        
        switch language {
        case .swift:
            patterns = ["func ", "class ", "struct ", "enum ", "protocol ", "extension ", "init(", "var ", "let "]
        case .javascript, .typescript:
            patterns = ["function ", "class ", "const ", "let ", "var ", "=>", "async "]
        case .python:
            patterns = ["def ", "class ", "if ", "for ", "while ", "with ", "try:"]
        case .ruby:
            patterns = ["def ", "class ", "module ", "if ", "unless ", "case "]
        case .go:
            patterns = ["func ", "type ", "if ", "for ", "switch "]
        case .rust:
            patterns = ["fn ", "impl ", "struct ", "enum ", "trait ", "mod "]
        case .java, .csharp:
            patterns = ["public ", "private ", "protected ", "class ", "interface ", "void ", "static "]
        case .cpp, .c:
            patterns = ["void ", "int ", "char ", "class ", "struct ", "if ", "for ", "while ", "#"]
        case .css:
            patterns = [".", "#", "@media", "@keyframes"]
        case .html, .xml:
            patterns = ["<div", "<section", "<header", "<footer", "<article", "<nav", "<main"]
        case .yaml:
            return trimmed.hasSuffix(":") && !trimmed.contains(": ")
        default:
            patterns = ["func ", "function ", "class ", "def "]
        }
        
        // Check if line contains opening brace/bracket
        let hasOpener = line.contains("{") || line.contains("[") || line.contains("(")
        
        // Check for pattern match
        for pattern in patterns {
            if trimmed.hasPrefix(pattern) || trimmed.contains(" \(pattern)") {
                return hasOpener || language == .python || language == .yaml
            }
        }
        
        return false
    }
}

struct CodeBlock: Identifiable {
    let id = UUID()
    var startLine: Int
    var endLine: Int?
    var header: String
    var lines: [String]
    var isCollapsible: Bool
    
    var lineCount: Int { lines.count }
}

struct CodeBlockView: View {
    let block: CodeBlock
    let language: SyntaxHighlighter.Language
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if block.isCollapsible && block.lineCount > 1 {
                // Collapsible header
                HStack(spacing: 4) {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                        .frame(width: 14)
                    
                    Text(SyntaxHighlighter.highlight(block.header, language: language))
                        .font(.system(size: 13, design: .monospaced))
                    
                    if !isExpanded {
                        Text("// \(block.lineCount - 1) lines")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isExpanded.toggle()
                    }
                }
                
                // Body (when expanded)
                if isExpanded && block.lineCount > 1 {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(block.lines.dropFirst().enumerated()), id: \.offset) { _, line in
                            HStack(spacing: 0) {
                                Spacer().frame(width: 18) // Indent
                                Text(SyntaxHighlighter.highlight(line, language: language))
                                    .font(.system(size: 13, design: .monospaced))
                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
            } else {
                // Non-collapsible single line
                HStack(spacing: 0) {
                    Spacer().frame(width: 18)
                    Text(SyntaxHighlighter.highlight(block.header, language: language))
                        .font(.system(size: 13, design: .monospaced))
                    Spacer(minLength: 0)
                }
            }
        }
        .textSelection(.enabled)
    }
}
