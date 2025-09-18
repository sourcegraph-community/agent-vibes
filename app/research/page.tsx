import { Metadata } from 'next';
import ResearchFeed from '@/app/components/ResearchFeed';

export const metadata: Metadata = {
  title: 'Research Papers - Agent Vibes',
  description: 'Latest computer science research papers on coding agents and AI programming assistants',
};

export default function ResearchPage() {
  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-title">
          <h1>Research Papers</h1>
          <p className="page-description">
            Latest CS research from arXiv on coding agents, AI programming assistants, and code generation
          </p>
        </div>
        
        <div className="page-actions">
          <div className="filter-controls">
            <select className="select" defaultValue="recent">
              <option value="recent">Most Recent</option>
              <option value="citations">Most Cited</option>
              <option value="relevant">Most Relevant</option>
            </select>
          </div>
        </div>
      </header>

      <main className="page-content">
        <section className="research-section">
          <ResearchFeed />
        </section>
      </main>
    </div>
  );
}
