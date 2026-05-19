using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace FolderTree
{
    public partial class MainWindow : Window
    {
        private FileItem? _currentFile;
        private string _currentContent = "";

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
            if (e.NewValue is FileItem item && !item.IsDirectory)
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

        private void LoadPreview(FileItem item)
        {
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

            string ext = Path.GetExtension(item.FullPath).ToLowerInvariant();
            bool isSourceView = SourceTab.IsChecked == true;

            try
            {
                // Images
                string[] imageExts = { ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif" };
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
                if (ext == ".pdf" || ext == ".html" || ext == ".htm")
                {
                    if (!isSourceView && (ext == ".html" || ext == ".htm"))
                    {
                        WebPreview.Navigate(new Uri(item.FullPath));
                        WebPreview.Visibility = Visibility.Visible;
                        return;
                    }
                }

                // Binary files
                string[] binaryExts = { ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dll", ".pdf",
                                       ".mp3", ".mp4", ".avi", ".mkv", ".mov", ".wav" };
                if (binaryExts.Contains(ext))
                {
                    ShowPlaceholder("Binary file - no preview available");
                    return;
                }

                // Read file content
                _currentContent = File.ReadAllText(item.FullPath, Encoding.UTF8);

                // JSON
                if (ext == ".json" && !isSourceView)
                {
                    ShowJsonTree(_currentContent);
                    return;
                }

                // Code with syntax highlighting
                ShowSyntaxHighlightedCode(_currentContent, ext, !isSourceView);
            }
            catch (Exception ex)
            {
                ShowPlaceholder($"Error loading file: {ex.Message}");
            }
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
            
            foreach (var line in code.Split('\n'))
            {
                highlighter.HighlightLine(line, paragraph);
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
