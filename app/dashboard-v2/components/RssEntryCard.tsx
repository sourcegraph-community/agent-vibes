interface RssEntryCardProps {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  author?: string;
  publishedAt: string;
  feedTitle: string;
  category: 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';
  starred?: boolean;
  readingTime?: number;
  showBadge?: boolean; // default true; hide for sections where category is implied
}

export default function RssEntryCard({
  title,
  url,
  summary,
  author,
  publishedAt,
  feedTitle,
  category,
  starred,
  readingTime,
  showBadge = true,
}: RssEntryCardProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getBadgeText = () => {
    switch (category) {
      case 'product_updates': return 'Product Update';
      case 'industry_research': return 'Research';
      case 'perspectives': return 'Perspective';
      default: return 'Article';
    }
  };

  // Map API categories to CSS badge tokens used by dashboard.css
  const categoryToken = (() => {
    switch (category) {
      case 'product_updates':
        return 'product';
      case 'industry_research':
        return 'research';
      case 'perspectives':
        return 'perspective';
      default:
        return '';
    }
  })();

  const headerClass = `highlight-header${showBadge ? '' : ' single'}`;
  const timeText = formatTime(publishedAt);

  return (
    <div className={`highlight-card ${category}`}>
      <div className={headerClass}>
        {showBadge && (
          <div className={`highlight-badge ${categoryToken}`}>
            {getBadgeText()}
            {starred && ' ⭐'}
          </div>
        )}
        <span className="highlight-time">
          {(!showBadge && starred) ? '⭐ ' : ''}
          {timeText}
        </span>
      </div>

      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      <p className="highlight-summary">{summary}</p>

      <div className="highlight-footer flex items-center justify-between text-xs text-gray-500">
        <span>
          {feedTitle}
          {author && ` • ${author}`}
          {readingTime && ` • ${readingTime} min read`}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          Read more →
        </a>
      </div>
    </div>
  );
}
