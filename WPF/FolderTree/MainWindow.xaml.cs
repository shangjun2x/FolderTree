using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace FolderTree
{
    public partial class MainWindow : Window
    {
        private FileItem? _currentFile;
        private string _currentContent = "";
        private CancellationTokenSource? _loadCts;
        
        // Preview Settings
        private static readonly long MaxFileSize = 100 * 1024 * 1024; // 100 MB
        private static readonly TimeSpan LoadTimeout = TimeSpan.FromSeconds(10);
        private static HashSet<string> _whitelist = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            // Code
            "swift", "js", "jsx", "mjs", "ts", "tsx", "py", "rb", "go", "rs", "java", "cs",
            "cpp", "cc", "cxx", "hpp", "c", "h", "css", "scss", "sass", "less",
            "xml", "xsl", "xslt", "plist", "yml", "yaml", "sql", "sh", "bash", "zsh", "fish",
            // Documents
            "txt", "md", "markdown", "json", "html", "htm", "pdf",
            // Images
            "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif"
        };
        private static bool _isWhitelistEnabled = false;

        public MainWindow()
        {
            InitializeComponent();
        }

        private void OpenFolder_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new System.Windows.Forms.FolderBrowserDialog
            {
                Description = "Select a folder to browse",
                ShowNewFolderButton = false
            };

            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                LoadFolder(dialog.SelectedPath);
            }
        }

        private void LoadFolder(string path)
        {
            var rootItem = new FileItem(path);
            rootItem.LoadChildren();
            rootItem.IsExpanded = true;
            FolderTreeView.ItemsSource = new ObservableCollection<FileItem> { rootItem };
        }

        private void FolderTreeView_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            if (e.NewValue is FileItem item && !item.IsDirectory && item.FullPath != "__loading__")
            {
                _currentFile = item;
                LoadPreview(item);
            }
        }

        private void Tab_Click(object sender, RoutedEventArgs e)
        {
            if (_currentFile != null)
            {
                LoadPreview(_currentFile);
            }
        }

        private void OpenInExplorer_Click(object sender, RoutedEventArgs e)
        {
            if (_currentFile != null && File.Exists(_currentFile.FullPath))
            {
                System.Diagnostics.Process.Start("explorer.exe", $"/select,\"{_currentFile.FullPath}\"");
            }
            else if (_currentFile != null && Directory.Exists(_currentFile.FullPath))
            {
                System.Diagnostics.Process.Start("explorer.exe", _currentFile.FullPath);
            }
        }

        // Drag & Drop support
        private Point _dragStartPoint;
        private FileItem? _draggedItem;

        private void TreeItem_PreviewMouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            _dragStartPoint = e.GetPosition(null);
        }

        private void TreeItem_PreviewMouseMove(object sender, System.Windows.Input.MouseEventArgs e)
        {
            if (e.LeftButton != System.Windows.Input.MouseButtonState.Pressed) return;

            Point mousePos = e.GetPosition(null);
            Vector diff = _dragStartPoint - mousePos;

            if (Math.Abs(diff.X) > SystemParameters.MinimumHorizontalDragDistance ||
                Math.Abs(diff.Y) > SystemParameters.MinimumVerticalDragDistance)
            {
                var treeViewItem = sender as TreeViewItem;
                if (treeViewItem?.DataContext is FileItem item && item.FullPath != "__loading__")
                {
                    _draggedItem = item;
                    var data = new DataObject(DataFormats.Text, item.FullPath);
                    DragDrop.DoDragDrop(treeViewItem, data, DragDropEffects.Move);
                    _draggedItem = null;
                }
            }
        }

        private void TreeItem_DragOver(object sender, DragEventArgs e)
        {
            e.Effects = DragDropEffects.None;
            
            var treeViewItem = sender as TreeViewItem;
            if (treeViewItem?.DataContext is FileItem targetItem && targetItem.IsDirectory)
            {
                string? sourcePath = e.Data.GetData(DataFormats.Text) as string;
                if (sourcePath != null && sourcePath != targetItem.FullPath &&
                    !targetItem.FullPath.StartsWith(sourcePath + Path.DirectorySeparatorChar))
                {
                    e.Effects = DragDropEffects.Move;
                }
            }
            e.Handled = true;
        }

        private void TreeItem_Drop(object sender, DragEventArgs e)
        {
            var treeViewItem = sender as TreeViewItem;
            if (treeViewItem?.DataContext is FileItem targetItem && targetItem.IsDirectory)
            {
                string? sourcePath = e.Data.GetData(DataFormats.Text) as string;
                if (sourcePath == null) return;

                string itemName = Path.GetFileName(sourcePath);
                string destPath = Path.Combine(targetItem.FullPath, itemName);

                if (sourcePath == targetItem.FullPath) return;
                if (targetItem.FullPath.StartsWith(sourcePath + Path.DirectorySeparatorChar)) return;

                try
                {
                    if (Directory.Exists(sourcePath))
                        Directory.Move(sourcePath, destPath);
                    else if (File.Exists(sourcePath))
                        File.Move(sourcePath, destPath);

                    // Refresh tree
                    var rootItems = FolderTreeView.ItemsSource as ObservableCollection<FileItem>;
                    if (rootItems?.Count > 0)
                    {
                        LoadFolder(rootItems[0].FullPath);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Move failed: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            e.Handled = true;
        }

        private void LoadPreview(FileItem item)
        {
            // Cancel any pending load
            _loadCts?.Cancel();
            _loadCts = new CancellationTokenSource();
            var token = _loadCts.Token;
            
            // Update header
            FileIcon.Text = item.Icon;
            FileName.Text = item.Name;
            FileSize.Text = FormatSize(item.Size);

            // Hide all preview types
            PreviewScroller.Visibility = Visibility.Collapsed;
            ImagePreview.Visibility = Visibility.Collapsed;
            WebPreview.Visibility = Visibility.Collapsed;
            Placeholder.Visibility = Visibility.Collapsed;
            PreviewContent.Children.Clear();

            string ext = Path.GetExtension(item.FullPath).ToLowerInvariant().TrimStart('.');
            bool isSourceView = SourceTab.IsChecked == true;
            
            // Check file size limit (100 MB)
            if (item.Size > MaxFileSize)
            {
                ShowPlaceholder("File too large to preview (>100 MB)");
                return;
            }
            
            // Check whitelist
            if (_isWhitelistEnabled && !_whitelist.Contains(ext))
            {
                ShowPlaceholder($"File type .{ext} not in whitelist");
                return;
            }

            // Load with timeout
            Task.Run(async () =>
            {
                try
                {
                    var loadTask = Task.Run(() => LoadPreviewContent(item, ext, isSourceView, token), token);
                    var timeoutTask = Task.Delay(LoadTimeout, token);
                    
                    var completedTask = await Task.WhenAny(loadTask, timeoutTask);
                    
                    if (completedTask == timeoutTask && !loadTask.IsCompleted)
                    {
                        Dispatcher.Invoke(() => ShowPlaceholder("Preview timed out (>10s)"));
                        return;
                    }
                    
                    await loadTask;
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() => ShowPlaceholder($"Error loading file: {ex.Message}"));
                }
            }, token);
        }
        
        private void LoadPreviewContent(FileItem item, string ext, bool isSourceView, CancellationToken token)
        {
            if (token.IsCancellationRequested) return;
            
            Dispatcher.Invoke(() =>
            {
                try
                {
                    // Images
                    string[] imageExts = { "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "tiff", "tif" };
                    if (imageExts.Contains(ext))
                    {
                        var bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.UriSource = new Uri(item.FullPath);
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                        ImagePreview.Source = bitmap;
                        ImagePreview.Visibility = Visibility.Visible;
                        return;
                    }

                    // PDF / HTML
                    if (ext == "pdf" || ext == "html" || ext == "htm")
                    {
                        if (!isSourceView && (ext == "html" || ext == "htm"))
                        {
                            WebPreview.Navigate(new Uri(item.FullPath));
                            WebPreview.Visibility = Visibility.Visible;
                            return;
                        }
                    }

                    // Binary files
                    string[] binaryExts = { "zip", "tar", "gz", "rar", "7z", "exe", "dll", "pdf",
                                           "mp3", "mp4", "avi", "mkv", "mov", "wav" };
                    if (binaryExts.Contains(ext))
                    {
                        ShowPlaceholder("Binary file - no preview available");
                        return;
                    }

                    // Read file content
                    _currentContent = File.ReadAllText(item.FullPath, Encoding.UTF8);

                    // JSON
                    if (ext == "json" && !isSourceView)
                    {
                        ShowJsonTree(_currentContent);
                        return;
                    }

                    // Markdown rendered preview
                    if ((ext == "md" || ext == "markdown") && !isSourceView)
                    {
                        ShowMarkdownPreview(_currentContent);
                        return;
                    }

                    // Code with syntax highlighting
                    ShowSyntaxHighlightedCode(_currentContent, "." + ext, !isSourceView);
                }
                catch (Exception ex)
                {
                    ShowPlaceholder($"Error loading file: {ex.Message}");
                }
            });
        }

        private void ShowPlaceholder(string message)
        {
            Placeholder.Visibility = Visibility.Visible;
            var textBlock = Placeholder.Children.OfType<TextBlock>().LastOrDefault();
            if (textBlock != null) textBlock.Text = message;
        }

        private void ShowJsonTree(string json)
        {
            try
            {
                var doc = JsonDocument.Parse(json);
                var treeView = new TreeView
                {
                    Background = Brushes.Transparent,
                    BorderThickness = new Thickness(0),
                    Foreground = (SolidColorBrush)FindResource("TextBrush")
                };

                var rootItem = CreateJsonTreeItem("root", doc.RootElement);
                rootItem.IsExpanded = true;
                treeView.Items.Add(rootItem);

                PreviewContent.Children.Add(treeView);
                PreviewScroller.Visibility = Visibility.Visible;
            }
            catch
            {
                ShowSyntaxHighlightedCode(json, ".json", false);
            }
        }

        private TreeViewItem CreateJsonTreeItem(string key, JsonElement element)
        {
            var item = new TreeViewItem { Foreground = (SolidColorBrush)FindResource("TextBrush") };

            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    item.Header = CreateJsonHeader(key, "{", element.EnumerateObject().Count(), "keys", "}");
                    foreach (var prop in element.EnumerateObject())
                    {
                        item.Items.Add(CreateJsonTreeItem(prop.Name, prop.Value));
                    }
                    break;

                case JsonValueKind.Array:
                    item.Header = CreateJsonHeader(key, "[", element.GetArrayLength(), "items", "]");
                    int index = 0;
                    foreach (var child in element.EnumerateArray())
                    {
                        item.Items.Add(CreateJsonTreeItem($"[{index++}]", child));
                    }
                    break;

                case JsonValueKind.String:
                    item.Header = CreateJsonLeaf(key, $"\"{element.GetString()}\"", Brushes.Orange);
                    break;

                case JsonValueKind.Number:
                    item.Header = CreateJsonLeaf(key, element.GetRawText(), Brushes.Cyan);
                    break;

                case JsonValueKind.True:
                case JsonValueKind.False:
                    item.Header = CreateJsonLeaf(key, element.GetBoolean().ToString().ToLower(), Brushes.Orange);
                    break;

                case JsonValueKind.Null:
                    item.Header = CreateJsonLeaf(key, "null", Brushes.Red);
                    break;
            }

            return item;
        }

        private StackPanel CreateJsonHeader(string key, string open, int count, string type, string close)
        {
            var panel = new StackPanel { Orientation = Orientation.Horizontal };
            if (key != "root")
            {
                panel.Children.Add(new TextBlock { Text = $"\"{key}\": ", Foreground = Brushes.MediumPurple });
            }
            panel.Children.Add(new TextBlock { Text = open, Foreground = (SolidColorBrush)FindResource("TextSecondaryBrush") });
            panel.Children.Add(new TextBlock { Text = $" {count} {type} ", Foreground = (SolidColorBrush)FindResource("TextSecondaryBrush"), FontSize = 11 });
            panel.Children.Add(new TextBlock { Text = close, Foreground = (SolidColorBrush)FindResource("TextSecondaryBrush") });
            return panel;
        }

        private StackPanel CreateJsonLeaf(string key, string value, Brush valueBrush)
        {
            var panel = new StackPanel { Orientation = Orientation.Horizontal };
            if (!key.StartsWith("["))
            {
                panel.Children.Add(new TextBlock { Text = $"\"{key}\": ", Foreground = Brushes.MediumPurple });
            }
            else
            {
                panel.Children.Add(new TextBlock { Text = $"{key}: ", Foreground = (SolidColorBrush)FindResource("TextSecondaryBrush") });
            }
            panel.Children.Add(new TextBlock { Text = value, Foreground = valueBrush });
            return panel;
        }

        private void ShowSyntaxHighlightedCode(string code, string ext, bool collapsible)
        {
            var richTextBox = new RichTextBox
            {
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                IsReadOnly = true,
                FontFamily = new FontFamily("Consolas, Courier New"),
                FontSize = 13,
                Foreground = (SolidColorBrush)FindResource("TextBrush")
            };

            var paragraph = new Paragraph();
            var highlighter = new SyntaxHighlighter(ext);
            var lines = code.Split('\n');
            
            // Find fold regions if collapsible
            var foldRegions = collapsible ? FindFoldRegions(lines) : new List<(int start, int end)>();

            for (int i = 0; i < lines.Length; i++)
            {
                // Add line number
                paragraph.Inlines.Add(new Run($"{(i + 1).ToString().PadLeft(4)}  ")
                {
                    Foreground = (SolidColorBrush)FindResource("TextSecondaryBrush")
                });

                highlighter.HighlightLine(lines[i], paragraph);
                paragraph.Inlines.Add(new LineBreak());
            }

            richTextBox.Document = new FlowDocument(paragraph)
            {
                PagePadding = new Thickness(0),
                Background = Brushes.Transparent
            };

            PreviewContent.Children.Add(richTextBox);
            PreviewScroller.Visibility = Visibility.Visible;
        }

        private List<(int start, int end)> FindFoldRegions(string[] lines)
        {
            var regions = new List<(int start, int end)>();
            var braceStack = new Stack<(char ch, int line)>();

            for (int i = 0; i < lines.Length; i++)
            {
                foreach (char c in lines[i])
                {
                    if (c == '{' || c == '[' || c == '(')
                    {
                        braceStack.Push((c, i));
                    }
                    else if (c == '}' || c == ']' || c == ')')
                    {
                        if (braceStack.Count > 0)
                        {
                            var open = braceStack.Pop();
                            if (i - open.line >= 2)
                            {
                                regions.Add((open.line, i));
                            }
                        }
                    }
                }
            }

            regions.Sort((a, b) => a.start.CompareTo(b.start));
            return regions;
        }

        private void ShowMarkdownPreview(string markdown)
        {
            string html = ConvertMarkdownToHtml(markdown);
            string fullHtml = $@"<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
:root {{ color-scheme: light dark; }}
body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    background: #1e1e1e;
    color: #d4d4d4;
}}
a {{ color: #58a6ff; }}
code {{ background: #2d2d30; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace; font-size: 0.9em; }}
pre {{ background: #2d2d30; padding: 16px; border-radius: 6px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
h1, h2, h3, h4 {{ margin-top: 1.5em; margin-bottom: 0.5em; }}
h1 {{ font-size: 2em; border-bottom: 1px solid #444; padding-bottom: 0.3em; }}
h2 {{ font-size: 1.5em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }}
blockquote {{ border-left: 4px solid #555; margin: 0; padding-left: 16px; color: #888; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #444; padding: 8px 12px; text-align: left; }}
th {{ background: #2d2d30; }}
hr {{ border: none; border-top: 1px solid #444; margin: 2em 0; }}
ul, ol {{ padding-left: 2em; }}
li {{ margin: 0.25em 0; }}
img {{ max-width: 100%; }}
</style>
</head>
<body>{html}</body>
</html>";
            WebPreview.NavigateToString(fullHtml);
            WebPreview.Visibility = Visibility.Visible;
        }

        private string ConvertMarkdownToHtml(string md)
        {
            string html = System.Net.WebUtility.HtmlEncode(md);
            
            // Code blocks
            html = System.Text.RegularExpressions.Regex.Replace(html, @"```(\w*)\r?\n([\s\S]*?)```", "<pre><code>$2</code></pre>");
            
            // Headers
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^###### (.+)$", "<h6>$1</h6>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^##### (.+)$", "<h5>$1</h5>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^#### (.+)$", "<h4>$1</h4>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^### (.+)$", "<h3>$1</h3>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^## (.+)$", "<h2>$1</h2>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^# (.+)$", "<h1>$1</h1>");
            
            // Bold and italic
            html = System.Text.RegularExpressions.Regex.Replace(html, @"\*\*\*(.+?)\*\*\*", "<strong><em>$1</em></strong>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"\*\*(.+?)\*\*", "<strong>$1</strong>");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"\*(.+?)\*", "<em>$1</em>");
            
            // Inline code
            html = System.Text.RegularExpressions.Regex.Replace(html, @"`([^`]+)`", "<code>$1</code>");
            
            // Links and images
            html = System.Text.RegularExpressions.Regex.Replace(html, @"!\[([^\]]*)\]\(([^)]+)\)", "<img src=\"$2\" alt=\"$1\">");
            html = System.Text.RegularExpressions.Regex.Replace(html, @"\[([^\]]+)\]\(([^)]+)\)", "<a href=\"$2\">$1</a>");
            
            // Blockquotes
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^&gt; (.+)$", "<blockquote>$1</blockquote>");
            
            // Horizontal rules
            html = System.Text.RegularExpressions.Regex.Replace(html, @"(?m)^[-*_]{3,}$", "<hr>");
            
            // Paragraphs
            html = html.Replace("\r\n\r\n", "</p><p>").Replace("\n\n", "</p><p>");
            html = "<p>" + html + "</p>";
            html = html.Replace("<p></p>", "");
            
            return html;
        }

        private string FormatSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len /= 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }
    }

    // File Item Model
    public class FileItem : INotifyPropertyChanged
    {
        public string Name { get; }
        public string FullPath { get; }
        public bool IsDirectory { get; }
        public long Size { get; }
        public string Icon => GetIcon();
        
        private bool _isExpanded;
        public bool IsExpanded
        {
            get => _isExpanded;
            set { _isExpanded = value; OnPropertyChanged(nameof(IsExpanded)); LoadChildren(); }
        }

        public ObservableCollection<FileItem> Children { get; } = new();

        private bool _childrenLoaded;

        public FileItem(string path)
        {
            FullPath = path;
            Name = Path.GetFileName(path);
            if (string.IsNullOrEmpty(Name)) Name = path;
            
            IsDirectory = Directory.Exists(path);
            
            if (!IsDirectory && File.Exists(path))
            {
                Size = new FileInfo(path).Length;
            }
            
            // Add dummy child for expandable folders
            if (IsDirectory)
            {
                Children.Add(new FileItem("__loading__") { });
            }
        }

        public void LoadChildren()
        {
            if (!IsDirectory || _childrenLoaded) return;
            _childrenLoaded = true;
            Children.Clear();

            try
            {
                var dirs = Directory.GetDirectories(FullPath)
                    .Where(d => !Path.GetFileName(d).StartsWith("."))
                    .OrderBy(d => Path.GetFileName(d));
                    
                var files = Directory.GetFiles(FullPath)
                    .Where(f => !Path.GetFileName(f).StartsWith("."))
                    .OrderBy(f => Path.GetFileName(f));

                foreach (var dir in dirs)
                    Children.Add(new FileItem(dir));
                foreach (var file in files)
                    Children.Add(new FileItem(file));
            }
            catch { }
        }

        private string GetIcon()
        {
            if (IsDirectory) return IsExpanded ? "📂" : "📁";
            
            string ext = Path.GetExtension(FullPath).ToLowerInvariant();
            return ext switch
            {
                ".cs" => "🟣",
                ".js" or ".jsx" => "🟨",
                ".ts" or ".tsx" => "🔷",
                ".py" => "🐍",
                ".json" => "📋",
                ".xml" or ".xaml" => "📰",
                ".html" or ".htm" => "🌐",
                ".css" or ".scss" => "🎨",
                ".md" => "📝",
                ".png" or ".jpg" or ".jpeg" or ".gif" or ".bmp" => "🖼️",
                ".pdf" => "📕",
                ".zip" or ".rar" or ".7z" => "📦",
                ".exe" or ".dll" => "⚙️",
                ".txt" => "📄",
                ".sql" => "🗃️",
                ".yaml" or ".yml" => "📋",
                ".sh" or ".bat" or ".ps1" => "⚡",
                _ => "📄"
            };
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged(string name) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    // Syntax Highlighter
    public class SyntaxHighlighter
    {
        private readonly string _ext;
        private readonly string[] _keywords;
        private readonly string[] _types;
        
        private static readonly Brush KeywordBrush = new SolidColorBrush(Color.FromRgb(197, 134, 192)); // Pink
        private static readonly Brush TypeBrush = new SolidColorBrush(Color.FromRgb(78, 201, 176)); // Cyan
        private static readonly Brush StringBrush = new SolidColorBrush(Color.FromRgb(206, 145, 120)); // Orange
        private static readonly Brush CommentBrush = new SolidColorBrush(Color.FromRgb(106, 153, 85)); // Green
        private static readonly Brush NumberBrush = new SolidColorBrush(Color.FromRgb(181, 206, 168)); // Light green

        public SyntaxHighlighter(string ext)
        {
            _ext = ext.ToLowerInvariant();
            (_keywords, _types) = GetLanguageTokens();
        }

        private (string[], string[]) GetLanguageTokens()
        {
            return _ext switch
            {
                ".cs" => (
                    new[] { "using", "namespace", "class", "struct", "interface", "enum", "public", "private",
                           "protected", "internal", "static", "readonly", "const", "void", "var", "new", "return",
                           "if", "else", "switch", "case", "for", "foreach", "while", "do", "try", "catch", "finally",
                           "throw", "async", "await", "true", "false", "null", "this", "base", "override", "virtual" },
                    new[] { "string", "int", "long", "double", "float", "bool", "object", "dynamic", "Task", "List",
                           "Dictionary", "Action", "Func", "IEnumerable", "ObservableCollection" }
                ),
                ".js" or ".jsx" or ".ts" or ".tsx" => (
                    new[] { "function", "const", "let", "var", "class", "extends", "import", "export", "from",
                           "if", "else", "switch", "case", "for", "while", "return", "try", "catch", "throw",
                           "async", "await", "new", "this", "super", "true", "false", "null", "undefined" },
                    new[] { "string", "number", "boolean", "any", "void", "Promise", "Array", "Map", "Set" }
                ),
                ".py" => (
                    new[] { "def", "class", "import", "from", "as", "if", "elif", "else", "for", "while",
                           "try", "except", "finally", "raise", "return", "yield", "with", "lambda",
                           "True", "False", "None", "and", "or", "not", "in", "is", "async", "await" },
                    new[] { "str", "int", "float", "bool", "list", "dict", "set", "tuple" }
                ),
                ".yaml" or ".yml" => (
                    new[] { "true", "false", "null", "yes", "no" },
                    Array.Empty<string>()
                ),
                ".sql" => (
                    new[] { "SELECT", "FROM", "WHERE", "AND", "OR", "INSERT", "UPDATE", "DELETE", "CREATE",
                           "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "ON", "ORDER", "BY", "GROUP",
                           "HAVING", "LIMIT", "NULL", "NOT", "IN", "LIKE", "AS", "DISTINCT", "COUNT", "SUM" },
                    new[] { "INT", "VARCHAR", "TEXT", "BOOLEAN", "DATE", "TIMESTAMP", "FLOAT", "DECIMAL" }
                ),
                _ => (Array.Empty<string>(), Array.Empty<string>())
            };
        }

        public void HighlightLine(string line, Paragraph paragraph)
        {
            // Simple tokenization
            int i = 0;
            while (i < line.Length)
            {
                // Comments
                if (i < line.Length - 1 && line.Substring(i, 2) == "//")
                {
                    paragraph.Inlines.Add(new Run(line.Substring(i)) { Foreground = CommentBrush });
                    return;
                }
                if (line[i] == '#' && (_ext == ".py" || _ext == ".yaml" || _ext == ".yml" || _ext == ".sh"))
                {
                    paragraph.Inlines.Add(new Run(line.Substring(i)) { Foreground = CommentBrush });
                    return;
                }

                // Strings
                if (line[i] == '"' || line[i] == '\'')
                {
                    char quote = line[i];
                    int end = line.IndexOf(quote, i + 1);
                    if (end == -1) end = line.Length - 1;
                    paragraph.Inlines.Add(new Run(line.Substring(i, end - i + 1)) { Foreground = StringBrush });
                    i = end + 1;
                    continue;
                }

                // Numbers
                if (char.IsDigit(line[i]))
                {
                    int start = i;
                    while (i < line.Length && (char.IsDigit(line[i]) || line[i] == '.'))
                        i++;
                    paragraph.Inlines.Add(new Run(line.Substring(start, i - start)) { Foreground = NumberBrush });
                    continue;
                }

                // Words (keywords/types)
                if (char.IsLetter(line[i]) || line[i] == '_')
                {
                    int start = i;
                    while (i < line.Length && (char.IsLetterOrDigit(line[i]) || line[i] == '_'))
                        i++;
                    string word = line.Substring(start, i - start);
                    
                    if (_keywords.Contains(word))
                        paragraph.Inlines.Add(new Run(word) { Foreground = KeywordBrush });
                    else if (_types.Contains(word))
                        paragraph.Inlines.Add(new Run(word) { Foreground = TypeBrush });
                    else
                        paragraph.Inlines.Add(new Run(word));
                    continue;
                }

                // Other characters
                paragraph.Inlines.Add(new Run(line[i].ToString()));
                i++;
            }
        }
    }
}
