using System;
using System.Windows;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace FolderTree
{
    public partial class App : Application
    {
        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        private const int DWMWA_CAPTION_COLOR = 35;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            ApplySystemTheme();
            SystemEvents.UserPreferenceChanged += (s, args) =>
            {
                if (args.Category == UserPreferenceCategory.General)
                    Dispatcher.Invoke(ApplySystemTheme);
            };
            DispatcherUnhandledException += (s, args) =>
            {
                System.IO.File.WriteAllText("crash.log", args.Exception.ToString());
                MessageBox.Show(args.Exception.Message, "Error");
                args.Handled = true;
            };
        }

        private void ApplySystemTheme()
        {
            bool isLight = IsLightTheme();
            var resources = Current.Resources;

            if (isLight)
            {
                resources["BackgroundColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#F5F7FA");
                resources["SidebarColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#EEF1F5");
                resources["BorderColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#E0E0E0");
                resources["AccentColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#0078D4");
                resources["TextColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#1E293B");
                resources["TextSecondaryColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#64748B");
                resources["HoverColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#E8EBF0");
                resources["SelectedColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCE4F7");
            }
            else
            {
                resources["BackgroundColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#1E1E1E");
                resources["SidebarColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#252526");
                resources["BorderColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#3C3C3C");
                resources["AccentColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#0078D4");
                resources["TextColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC");
                resources["TextSecondaryColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#808080");
                resources["HoverColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#2D2D30");
                resources["SelectedColor"] = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#094771");
            }

            // Update brushes
            resources["BackgroundBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["BackgroundColor"]);
            resources["SidebarBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["SidebarColor"]);
            resources["BorderBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["BorderColor"]);
            resources["AccentBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["AccentColor"]);
            resources["TextBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["TextColor"]);
            resources["TextSecondaryBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["TextSecondaryColor"]);
            resources["HoverBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["HoverColor"]);
            resources["SelectedBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["SelectedColor"]);

            // Apply dark/light title bar to all windows
            foreach (Window window in Current.Windows)
            {
                ApplyTitleBarTheme(window, !isLight);
            }
        }

        public static void ApplyTitleBarTheme(Window window, bool darkMode)
        {
            var hwnd = new System.Windows.Interop.WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;

            int value = darkMode ? 1 : 0;
            DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref value, sizeof(int));

            // Set caption color to match background
            int color = darkMode ? 0x001E1E1E : 0x00FAF7F5; // BGR format
            DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, ref color, sizeof(int));
        }

        private static bool IsLightTheme()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
                var value = key?.GetValue("AppsUseLightTheme");
                return value is int intValue && intValue == 1;
            }
            catch
            {
                return false;
            }
        }
    }
}
