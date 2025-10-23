import { useTheme } from './ThemeProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  const getThemeDisplayName = (themeValue: string) => {
    switch (themeValue) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'auto': return 'Auto';
      default: return 'Light';
    }
  };

  return (
    <div className="banking-list-item">
      <span className="text-body text-foreground">Theme</span>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger className="w-24 h-8 ml-auto">
          <SelectValue>
            {getThemeDisplayName(theme)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="auto">Auto</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default ThemeSelector;