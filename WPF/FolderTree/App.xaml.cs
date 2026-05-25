using System.Windows;
using Microsoft.Win32;

namespace FolderTree
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            ApplySystemTheme();
            SystemEvents.UserPreferenceChanged += (s, args) =>
            {
                if (args.Category == UserPreferenceCategory.General)
                    Dispatcher.Invoke(ApplySystemTheme);
            };
        }

        private void ApplySystemTheme()
        {
            bool isLight = IsLightTheme();
            var resources = Current.Resources;

            if (isLight)
            {
                resources["BackgroundColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#F5F7FA");
                resources["SidebarColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#EEF1F5");
                resources["BorderColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#E0E0E0");
                resources["AccentColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#0078D4");
                resources["TextColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#1E293B");
                resources["TextSecondaryColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#64748B");
                resources["HoverColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#E8EBF0");
                resources["SelectedColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#CCE4F7");
            }
            else
            {
                resources["BackgroundColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#1E1E1E");
                resources["SidebarColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#252526");
                resources["BorderColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#3C3C3C");
                resources["AccentColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#0078D4");
                resources["TextColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC");
                resources["TextSecondaryColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#808080");
                resources["HoverColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#2D2D30");
                resources["SelectedColor"] = System.Windows.Media.ColorConverter.ConvertFromString("#094771");
            }

            // Update brushes that reference colors
            resources["BackgroundBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["BackgroundColor"]);
            resources["SidebarBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["SidebarColor"]);
            resources["BorderBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["BorderColor"]);
            resources["AccentBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["AccentColor"]);
            resources["TextBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["TextColor"]);
            resources["TextSecondaryBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["TextSecondaryColor"]);
            resources["HoverBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["HoverColor"]);
            resources["SelectedBrush"] = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)resources["SelectedColor"]);
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
