import { Dispatch, SetStateAction } from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarItem {
  id: string
  label: string
  icon: LucideIcon
  active: boolean
}

interface SidebarSection {
  title: string
  items: SidebarItem[]
}

interface SidebarProps {
  sections: SidebarSection[]
  activeSection: string
  setActiveSection: Dispatch<SetStateAction<string>>
  isOpen: boolean
}

export function Sidebar({ sections, activeSection, setActiveSection, isOpen }: SidebarProps) {
  return (
    <aside className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col h-full p-6">
        <div className="sidebar-brand">
          <div className="brand-icon">
            AV
          </div>
          <span className="brand-text">Agent Vibes</span>
        </div>

        <nav className="flex-1 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="nav-section-title">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`nav-item ${item.active ? 'active' : ''}`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
