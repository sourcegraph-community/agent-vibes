# Agent Intelligence Dashboard Mock

A minimalistic, dark-themed analytics dashboard providing comprehensive insights into AI agents and competitors.

## Files

- **analytics-dashboard.html** - Main HTML structure with semantic markup
- **analytics-dashboard.css** - Dark theme styling with responsive design and accessibility features
- **analytics-dashboard.js** - Interactive functionality including Chart.js integration and filtering
- **README.md** - This documentation

## Features

### Design
- **Dark theme** with carefully chosen color palette for reduced eye strain
- **Minimalistic** design focusing on essential information
- **Responsive** layout that works across all device sizes
- **Accessible** with proper WCAG compliance and keyboard navigation

### Sections

1. **Header & Navigation**
   - Clean navigation with smooth scrolling
   - Global timeframe filter
   - Dark mode toggle (placeholder)

2. **Overview Section**
   - Key metrics cards with trend indicators
   - Real-time sentiment scores for Amp vs competitors
   - Alert highlights for important events

3. **Sentiment Trends**
   - Interactive Chart.js visualization
   - Multi-agent comparison capability
   - Flexible timeframe selection (7D, 30D, 90D)

4. **Agent Updates Feed**
   - Chronological list of product updates, incidents, partnerships
   - Expandable details on click
   - Filter by agent or category

5. **Research Feed**
   - Latest research papers, industry reports, blog posts
   - Categorized with visual tags
   - Expandable summaries

### Interactivity

- **Chart interactions** - hover tooltips, legend toggles, timeframe switching
- **Filtering** - real-time filtering of feeds by various criteria
- **Expandable content** - click to show/hide additional details
- **Smooth scrolling** navigation between sections
- **Keyboard navigation** - full accessibility support

### Technical Features

- **Chart.js integration** for professional data visualization
- **CSS Grid & Flexbox** for responsive layouts
- **CSS Custom Properties** for consistent theming
- **Progressive enhancement** - works without JavaScript
- **Print styles** for dashboard reports
- **High contrast mode** support
- **Reduced motion** support for accessibility

## Usage

Simply open `analytics-dashboard.html` in a web browser. The dashboard includes:

- Sample data for all visualizations
- Interactive chart with multiple agents
- Functioning filters and navigation
- Responsive design demonstration

## Color Palette

- **Backgrounds**: Deep navy/charcoal (#1a1d23 to #353c4a)
- **Text**: Light gray to white (#6b7280 to #e5e7eb)
- **Accents**: Blue primary (#3b82f6), with distinct colors for each agent
- **Sentiment**: Green positive (#10b981), Red negative (#ef4444), Gray neutral (#6b7280)

## Accessibility Features

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- High contrast color ratios
- Focus indicators
- Screen reader announcements
- Reduced motion support
- Print-friendly styles

## Browser Support

- Modern browsers with ES6+ support
- Chart.js requires browsers that support Canvas API
- CSS Grid and Flexbox support required for layout
- Progressive enhancement ensures basic functionality without JavaScript

## Future Enhancements

This mock demonstrates the core functionality. In a production environment, you would add:

- Real API integration for live data
- WebSocket connections for real-time updates
- User authentication and personalization
- Export functionality (PDF, Excel, etc.)
- Advanced filtering and search capabilities
- Collaborative features and sharing
- Performance monitoring and analytics
