interface RssEntryCardProps {
  id: number;
  title: string;
  url: string;
  summary: string;
  author?: string;
  publishedAt: string;
  source: string;
  category: 'product' | 'research' | 'perspective';
  starred?: boolean;
  readingTime?: number;
}

export default function RssEntryCard({
  title,
  url,
  summary,
  author,
  publishedAt,
  source,
  category,
  starred,
  readingTime,
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
      case 'product': return 'Product Update';
      case 'research': return 'Research';
      case 'perspective': return 'Perspective';
      default: return 'Article';
    }
  };

  return (
    <div className={`highlight-card ${category}`}>
      <div className="highlight-header">
        <div className={`highlight-badge ${category}`}>
          {getBadgeText()}
          {starred && ' ⭐'}
        </div>
        <span className="highlight-time">{formatTime(publishedAt)}</span>
      </div>

      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      <p className="text-sm text-gray-400 mb-3">{summary}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {source}
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
