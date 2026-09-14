import { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import "mdui/components/card.js";
import 'mdui/components/navigation-bar.js';
import 'mdui/components/navigation-bar-item.js';

interface NavItem {
  value: string;
  icon: string;
  label: string;
}

interface Props {
  activeTab: string;
  onTabChange: (value: string) => void;
  navItems: NavItem[];
  children: ComponentChildren;
}

export default function DashboardLayout({ activeTab, onTabChange, navItems, children }: Props) {
  // Capitalize the first letter of the role
  // Keep URL hash in sync with the active tab and respond to external hash changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentHash = window.location.hash.replace('#', '');
    if (currentHash && currentHash !== activeTab) {
      onTabChange(currentHash);
    }

    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h && h !== activeTab) onTabChange(h);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeTab, onTabChange]);

  const handleNavChange = (e: any) => {
    const value = e.target.value;
    if (typeof window !== 'undefined') {
      const current = window.location.hash.replace('#', '');
      if (value !== current) window.location.hash = value;
    }
    if (value !== activeTab) onTabChange(value);
  };
  return (
    <main class="contain-container">
      <h1 class="main-title">{import.meta.env.VITE_BUSINESS_NAME}</h1>
      
      <mdui-card variant="elevated" class="box">
        
        {/* The active tab's component will be injected right here */}
          {children}
      </mdui-card>

      {/* Bottom Navigation */}
      {/* Listens to the MDUI 'change' event to update the parent's state */}
      <mdui-navigation-bar value={activeTab} onChange={handleNavChange} label-visibility="labeled">
        {navItems.map((item) => (
          <mdui-navigation-bar-item key={item.value} value={item.value} icon={item.icon}>
            {item.label}
          </mdui-navigation-bar-item>
        ))}
      </mdui-navigation-bar>
    </main>
  );
}