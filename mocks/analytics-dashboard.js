// ===== AI AGENT INTELLIGENCE DASHBOARD ===== 

/**
 * SUPABASE INTEGRATION NOTES:
 * =============================
 * This mockup demonstrates UI patterns that will integrate with Supabase as follows:
 * 
 * 1. REAL-TIME DATA UPDATES:
 *    - Current: Simulated with setTimeout
 *    - Supabase: Real-time subscriptions on 'content_items' table
 *    - Implementation: supabase.channel().on('postgres_changes', callback)
 * 
 * 2. CONTENT FILTERING:
 *    - Current: Client-side array filtering
 *    - Supabase: Server-side filtering with .eq(), .in(), .textSearch()
 *    - Implementation: Dynamic query building based on filter state
 * 
 * 3. SENTIMENT ANALYSIS:
 *    - Current: Static sample data
 *    - Supabase: Edge Functions for AI sentiment analysis + stored results
 *    - Implementation: Trigger functions on content insert/update
 * 
 * 4. SEARCH FUNCTIONALITY:
 *    - Current: Simple text matching
 *    - Supabase: Full-text search with .textSearch() or pg_trgm
 *    - Implementation: Indexed search across title, summary, content fields
 * 
 * 5. TIMELINE VIEW:
 *    - Current: Static timeline items
 *    - Supabase: Time-ordered queries with .order('created_at', { ascending: false })
 *    - Implementation: Infinite scroll with pagination
 */

// Sample data representing the structure that would come from Supabase
const sampleData = {
    // This would be: SELECT * FROM sentiment_trends WHERE timeframe = '7d'
    sentimentTrends: {
        '7d': {
            labels: ['Jan 8', 'Jan 9', 'Jan 10', 'Jan 11', 'Jan 12', 'Jan 13', 'Jan 14'],
            datasets: {
                amp: {
                    positive: [65, 68, 72, 75, 73, 78, 75],
                    neutral: [20, 18, 16, 15, 17, 12, 20],
                    negative: [15, 14, 12, 10, 10, 10, 5]
                },
                cursor: {
                    positive: [70, 72, 75, 78, 76, 80, 82],
                    neutral: [18, 16, 14, 12, 14, 10, 10],
                    negative: [12, 12, 11, 10, 10, 10, 8]
                },
                'github-copilot': {
                    positive: [60, 58, 55, 52, 48, 45, 50],
                    neutral: [25, 27, 30, 32, 35, 38, 30],
                    negative: [15, 15, 15, 16, 17, 17, 20]
                },
                'claude-code': {
                    positive: [68, 70, 67, 65, 67, 69, 68],
                    neutral: [20, 18, 21, 23, 21, 19, 22],
                    negative: [12, 12, 12, 12, 12, 12, 10]
                },
                windsurf: {
                    positive: [55, 57, 60, 58, 56, 59, 62],
                    neutral: [30, 28, 25, 27, 29, 26, 23],
                    negative: [15, 15, 15, 15, 15, 15, 15]
                }
            }
        },
        '1d': {
            labels: ['12:00 AM', '4:00 AM', '8:00 AM', '12:00 PM', '4:00 PM', '8:00 PM'],
            datasets: {
                amp: {
                    positive: [70, 72, 75, 78, 76, 74],
                    neutral: [18, 16, 15, 12, 14, 16],
                    negative: [12, 12, 10, 10, 10, 10]
                },
                cursor: {
                    positive: [75, 78, 80, 82, 81, 79],
                    neutral: [15, 12, 10, 8, 9, 11],
                    negative: [10, 10, 10, 10, 10, 10]
                }
            }
        },
        '1h': {
            labels: ['58 min', '56 min', '54 min', '52 min', '50 min', '48 min'],
            datasets: {
                amp: {
                    positive: [74, 75, 76, 75, 74, 75],
                    neutral: [16, 15, 14, 15, 16, 15],
                    negative: [10, 10, 10, 10, 10, 10]
                },
                cursor: {
                    positive: [79, 80, 81, 80, 79, 80],
                    neutral: [11, 10, 9, 10, 11, 10],
                    negative: [10, 10, 10, 10, 10, 10]
                }
            }
        },
        '30d': {
            labels: ['Dec 15', 'Dec 22', 'Dec 29', 'Jan 5', 'Jan 12'],
            datasets: {
                amp: {
                    positive: [62, 65, 70, 73, 75],
                    neutral: [23, 21, 18, 17, 20],
                    negative: [15, 14, 12, 10, 5]
                },
                cursor: {
                    positive: [65, 68, 72, 76, 82],
                    neutral: [22, 20, 16, 14, 10],
                    negative: [13, 12, 12, 10, 8]
                }
            }
        }
    },
    
    // Share of Voice data - percentage of total mentions/discussions
    shareOfVoice: {
        '7d': {
            labels: ['Jan 8', 'Jan 9', 'Jan 10', 'Jan 11', 'Jan 12', 'Jan 13', 'Jan 14'],
            datasets: {
                amp: [15, 16, 18, 20, 19, 22, 21],
                cursor: [25, 27, 26, 28, 30, 29, 31],
                'github-copilot': [35, 33, 32, 30, 28, 27, 26],
                'claude-code': [12, 13, 14, 12, 13, 12, 11],
                windsurf: [13, 11, 10, 10, 10, 10, 11]
            }
        },
        '1d': {
            labels: ['12:00 AM', '4:00 AM', '8:00 AM', '12:00 PM', '4:00 PM', '8:00 PM'],
            datasets: {
                amp: [18, 19, 20, 21, 22, 20],
                cursor: [28, 29, 30, 31, 32, 30],
                'github-copilot': [30, 29, 28, 27, 26, 28],
                'claude-code': [12, 12, 11, 10, 9, 11],
                windsurf: [12, 11, 11, 11, 11, 11]
            }
        },
        '1h': {
            labels: ['58 min', '56 min', '54 min', '52 min', '50 min', '48 min'],
            datasets: {
                amp: [20, 21, 21, 20, 21, 21],
                cursor: [30, 31, 30, 31, 30, 31],
                'github-copilot': [28, 27, 28, 27, 28, 27],
                'claude-code': [11, 10, 11, 11, 10, 10],
                windsurf: [11, 11, 10, 11, 11, 11]
            }
        },
        '30d': {
            labels: ['Dec 15', 'Dec 22', 'Dec 29', 'Jan 5', 'Jan 12'],
            datasets: {
                amp: [14, 16, 18, 19, 21],
                cursor: [23, 25, 27, 29, 31],
                'github-copilot': [38, 35, 32, 30, 26],
                'claude-code': [13, 12, 13, 12, 11],
                windsurf: [12, 12, 10, 10, 11]
            }
        }
    },
    
    // This would be: SELECT * FROM content_items WHERE type IN ('highlight', 'product', 'research', 'perspective', 'social')
    contentItems: [
        {
            id: 1,
            type: 'highlight',
            category: 'product',
            agent: 'cursor',
            title: 'Cursor AI introduces new context-aware code completion',
            summary: 'Major update brings 40% improvement in code suggestion accuracy with enhanced multi-file context understanding and real-time debugging assistance.',
            source: 'Official Blog',
            sentiment: 95,
            engagement: 'trending',
            created_at: '2025-01-15T10:00:00Z',
            metadata: {
                sentiment_breakdown: { positive: 95, neutral: 3, negative: 2 },
                engagement_metrics: { likes: 1200, shares: 340, comments: 89 }
            }
        }
        // Additional items would follow this structure
    ]
};

// Chart instance
let sentimentChart = null;

// Global state for filters and search
const appState = {
    currentSection: 'overview',
    timeframe: '30d',
    chartView: 'sentiment', // 'sentiment' or 'share-of-voice'
    selectedAgents: ['amp', 'cursor'],
    selectedSources: ['reddit', 'x'],
    searchQuery: '',
    filters: {
        contentType: [],
        category: 'all',
        agent: 'all',
        source: 'all'
    }
};

// ===== INITIALIZATION ===== 
document.addEventListener('DOMContentLoaded', function() {
    initializeLucideIcons();
    initializeFilters(); // Initialize filters first to read checkbox state
    initializeChart(); // Then initialize chart with proper selected agents
    initializeTimeline(); // Initialize timeline with default 7d data
    attachEventListeners();
    initializeRealtimeSimulation();
});

// Initialize Lucide icons
function initializeLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.warn('Lucide icons not loaded');
    }
}

// ===== CHART FUNCTIONALITY =====
function initializeChart() {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;

    // Use the selected agents from state instead of hardcoded
    const chartData = generateChartData(appState.selectedAgents, '7d');
    
    sentimentChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e5e7eb',
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: '#374151',
                    titleColor: '#e5e7eb',
                    bodyColor: '#e5e7eb',
                    borderColor: '#6b7280',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#374151' }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { 
                        color: '#9ca3af',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: { color: '#374151' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function generateChartData(selectedAgents, timeframe) {
    const data = sampleData.sentimentTrends[timeframe];
    if (!data) return { labels: [], datasets: [] };

    // Neutral grays per agent, with paler shade for negative sentiment
    const colors = {
        'amp': { positive: 'hsl(0, 0%, 90%)', negative: 'hsl(0, 0%, 70%)', neutral: 'hsl(0, 0%, 63.9%)' }, // lightest gray
        'cursor': { positive: 'hsl(0, 0%, 80%)', negative: 'hsl(0, 0%, 60%)', neutral: 'hsl(0, 0%, 63.9%)' }, // light gray
        'github-copilot': { positive: 'hsl(0, 0%, 70%)', negative: 'hsl(0, 0%, 50%)', neutral: 'hsl(0, 0%, 63.9%)' }, // medium gray
        'claude-code': { positive: 'hsl(0, 0%, 60%)', negative: 'hsl(0, 0%, 40%)', neutral: 'hsl(0, 0%, 63.9%)' }, // medium-dark gray
        'windsurf': { positive: 'hsl(0, 0%, 50%)', negative: 'hsl(0, 0%, 30%)', neutral: 'hsl(0, 0%, 63.9%)' } // dark gray
    };

    const datasets = [];
    
    selectedAgents.forEach(agent => {
        const agentData = data.datasets[agent];
        if (!agentData) return;

        const agentName = formatAgentName(agent);
        
        // Add positive sentiment line
        datasets.push({
            label: `${agentName} Positive`,
            data: agentData.positive,
            borderColor: colors[agent].positive,
            backgroundColor: colors[agent].positive + '20',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: colors[agent].positive,
            pointBorderColor: colors[agent].positive,
            pointHoverBackgroundColor: colors[agent].positive,
            pointHoverBorderColor: colors[agent].positive
        });

        // Add negative sentiment line (dashed and paler)
        datasets.push({
            label: `${agentName} Negative`,
            data: agentData.negative,
            borderColor: colors[agent].negative,
            backgroundColor: colors[agent].negative + '20',
            fill: false,
            tension: 0.4,
            borderDash: [5, 5], // Dashed line
            pointBackgroundColor: colors[agent].negative,
            pointBorderColor: colors[agent].negative,
            pointHoverBackgroundColor: colors[agent].negative,
            pointHoverBorderColor: colors[agent].negative
        });
    });

    return {
        labels: data.labels,
        datasets: datasets
    };
}

// Generate Share of Voice chart data
function generateShareOfVoiceData(selectedAgents, timeframe) {
    const data = sampleData.shareOfVoice[timeframe];
    if (!data) return { labels: [], datasets: [] };

    // Neutral gray scale for share of voice
    const colors = {
        'amp': 'hsl(0, 0%, 90%)', // lightest gray
        'cursor': 'hsl(0, 0%, 80%)', // light gray
        'github-copilot': 'hsl(0, 0%, 70%)', // medium gray
        'claude-code': 'hsl(0, 0%, 60%)', // medium-dark gray
        'windsurf': 'hsl(0, 0%, 50%)' // dark gray
    };

    const datasets = [];
    
    selectedAgents.forEach(agent => {
        const agentData = data.datasets[agent];
        if (!agentData) return;

        const agentName = formatAgentName(agent);
        
        // Add share of voice line
        datasets.push({
            label: `${agentName}`,
            data: agentData,
            borderColor: colors[agent],
            backgroundColor: colors[agent] + '20',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: colors[agent],
            pointBorderColor: colors[agent],
            pointHoverBackgroundColor: colors[agent],
            pointHoverBorderColor: colors[agent]
        });
    });

    return {
        labels: data.labels,
        datasets: datasets
    };
}

// Helper function to format agent names properly
function formatAgentName(agent) {
    const nameMap = {
        'amp': 'Amp',
        'cursor': 'Cursor',
        'github-copilot': 'GitHub Copilot',
        'claude-code': 'Claude Code',
        'windsurf': 'Windsurf'
    };
    return nameMap[agent] || agent.charAt(0).toUpperCase() + agent.slice(1);
}

// ===== EVENT LISTENERS =====
function attachEventListeners() {
    // Sidebar navigation
    attachNavigationListeners();
    
    // Mobile menu toggle
    attachMobileMenuListeners();
    
    // Search functionality
    attachSearchListeners();
    
    // Filter controls
    attachFilterListeners();
    
    // Chart interactions
    attachChartListeners();
    
    // Content interactions
    attachContentListeners();
    
    // Chart view toggle
    attachChartViewToggle();
}

// Navigation event listeners
function attachNavigationListeners() {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                // Smooth scroll to section
                targetSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Update active nav state
                document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                // Update app state
                appState.currentSection = targetId;
                
                // Show/hide mobile menu if needed
                if (window.innerWidth <= 1024) {
                    document.querySelector('.sidebar').classList.remove('open');
                }
            }
        });
    });
}

// Mobile menu listeners
function attachMobileMenuListeners() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 1024 && 
                !sidebar.contains(e.target) && 
                !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
}

// Search functionality
function attachSearchListeners() {
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        let searchTimeout;
        
        globalSearch.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                appState.searchQuery = e.target.value;
                performSearch(e.target.value);
            }, 300); // Debounce search
        });
    }
    
    // Advanced search button
    const searchButton = document.querySelector('.advanced-search .button');
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const searchInput = document.querySelector('.search-input');
            if (searchInput) {
                performAdvancedSearch(searchInput.value);
            }
        });
    }
}

// Filter event listeners
function attachFilterListeners() {
    // Timeframe filter
    const timeframeFilter = document.getElementById('timeframeFilter');
    if (timeframeFilter) {
        timeframeFilter.addEventListener('change', function() {
            appState.timeframe = this.value;
            updateGlobalTimeframe(this.value);
        });
    }
    
    // Agent checkboxes for sentiment analysis
    document.querySelectorAll('input[name="agents"], input[name="sources"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.name === 'agents') {
                updateSelectedAgents();
                // Update chart with new agent selection
                const currentPeriod = document.querySelector('[data-period].active')?.dataset.period || '7d';
                updateChart(currentPeriod, appState.selectedAgents);
            } else if (this.name === 'sources') {
                updateSelectedSources();
            }
        });
    });
    
    // Section-specific filters
    attachSectionFilters();
}

// Section-specific filter listeners
function attachSectionFilters() {
    // Highlight filter
    const highlightFilter = document.getElementById('highlightFilter');
    if (highlightFilter) {
        highlightFilter.addEventListener('change', function() {
            filterHighlights(this.value);
        });
    }
    
    // Agent filter for product updates
    const agentFilter = document.getElementById('agentFilter');
    if (agentFilter) {
        agentFilter.addEventListener('change', function() {
            appState.filters.agent = this.value;
            filterContentByAgent(this.value);
        });
    }
    
    // Research filter
    const researchFilter = document.getElementById('researchFilter');
    if (researchFilter) {
        researchFilter.addEventListener('change', function() {
            filterResearch(this.value);
        });
    }
    
    // Perspective filter
    const perspectiveFilter = document.getElementById('perspectiveFilter');
    if (perspectiveFilter) {
        perspectiveFilter.addEventListener('change', function() {
            filterPerspectives(this.value);
        });
    }
    
    // Social filter
    const socialFilter = document.getElementById('socialFilter');
    if (socialFilter) {
        socialFilter.addEventListener('change', function() {
            filterSocial(this.value);
        });
    }
    
    // Timeline timeframe filter
    const timelineTimeframe = document.getElementById('timelineTimeframe');
    if (timelineTimeframe) {
        timelineTimeframe.addEventListener('change', function() {
            updateTimelineTimeframe(this.value);
        });
    }
}

// Chart interaction listeners  
function attachChartListeners() {
    // Chart timeframe buttons
    document.querySelectorAll('[data-period]').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update chart
            const period = this.dataset.period;
            updateChart(period);
        });
    });
}

// Content interaction listeners
function attachContentListeners() {
    // Timeline view toggle buttons
    document.querySelectorAll('.button-group .button').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.closest('.button-group')) {
                // Update active state in button group
                this.closest('.button-group').querySelectorAll('.button').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Filter timeline based on selection
                const filterType = this.textContent.toLowerCase().replace(' only', '').replace(' ', '-');
                filterTimeline(filterType);
            }
        });
    });
    
    // Content item interactions (expandable cards)
    document.querySelectorAll('.content-item, .highlight-card').forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't trigger on filter controls
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                return;
            }
            
            // Toggle expanded state
            this.classList.toggle('expanded');
            
            // In a real app, this would show detailed content
            console.log('Content item clicked:', this.dataset);
        });
    });
}

// Chart view toggle listeners
function attachChartViewToggle() {
    const chartViewToggle = document.getElementById('chartViewToggle');
    if (chartViewToggle) {
        chartViewToggle.querySelectorAll('.button').forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active state
                chartViewToggle.querySelectorAll('.button').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Update chart view
                const view = this.dataset.view;
                appState.chartView = view;
                
                // Update chart
                const currentPeriod = document.querySelector('[data-period].active')?.dataset.period || '7d';
                updateChart(currentPeriod, appState.selectedAgents);
                
                console.log(`Chart view changed to: ${view}`);
            });
        });
    }
}

// ===== UPDATE FUNCTIONS =====
function updateChart(timeframe = appState.timeframe, selectedAgents = appState.selectedAgents) {
    if (!sentimentChart) return;
    
    let newData;
    let yAxisLabel;
    
    if (appState.chartView === 'share-of-voice') {
        newData = generateShareOfVoiceData(selectedAgents, timeframe);
        yAxisLabel = 'Share of Voice (%)';
    } else {
        newData = generateChartData(selectedAgents, timeframe);
        yAxisLabel = 'Sentiment (%)';
    }
    
    sentimentChart.data = newData;
    
    // Update Y-axis label
    sentimentChart.options.scales.y.title = {
        display: true,
        text: yAxisLabel,
        color: 'hsl(40, 11%, 91%)'
    };
    
    sentimentChart.update();
}

function updateSelectedAgents() {
    const checkedAgents = document.querySelectorAll('input[name="agents"]:checked');
    appState.selectedAgents = Array.from(checkedAgents).map(cb => cb.value);
    console.log('Updated selected agents:', appState.selectedAgents);
}

function updateSelectedSources() {
    const checkedSources = document.querySelectorAll('input[name="sources"]:checked');
    appState.selectedSources = Array.from(checkedSources).map(cb => cb.value);
    console.log('Updated selected sources:', appState.selectedSources);
}

function updateGlobalTimeframe(timeframe) {
    appState.timeframe = timeframe;
    
    // Update all time-sensitive components
    updateChart();
    updateMetrics();
    updateTimeline();
    
    // In a Supabase implementation, this would trigger:
    // const { data } = await supabase
    //   .from('sentiment_trends')
    //   .select('*')
    //   .gte('created_at', getDateRange(timeframe).start)
    //   .lte('created_at', getDateRange(timeframe).end)
    
    console.log(`Global timeframe updated to: ${timeframe}`);
}

// ===== SEARCH FUNCTIONS =====
function performSearch(query) {
    if (!query.trim()) {
        clearSearchResults();
        return;
    }
    
    // In Supabase, this would be:
    // const { data } = await supabase
    //   .from('content_items')
    //   .select('*')
    //   .textSearch('title,summary,content', query)
    
    const results = searchContent(query);
    displaySearchResults(results);
}

function performAdvancedSearch(query) {
    const filters = getActiveFilters();
    
    // In Supabase:
    // let queryBuilder = supabase.from('content_items').select('*')
    // if (filters.contentType.length) queryBuilder = queryBuilder.in('type', filters.contentType)
    // if (filters.agent !== 'all') queryBuilder = queryBuilder.eq('agent', filters.agent)
    // if (query) queryBuilder = queryBuilder.textSearch('title,summary,content', query)
    
    console.log('Advanced search:', { query, filters });
}

function searchContent(query) {
    // Mock search implementation
    const allContent = document.querySelectorAll('.content-item, .highlight-card');
    const results = [];
    
    allContent.forEach(item => {
        const title = item.querySelector('.content-title, .highlight-title')?.textContent || '';
        const summary = item.querySelector('.content-summary, .highlight-summary')?.textContent || '';
        
        if (title.toLowerCase().includes(query.toLowerCase()) || 
            summary.toLowerCase().includes(query.toLowerCase())) {
            results.push(item);
        }
    });
    
    return results;
}

function displaySearchResults(results) {
    // Hide all content items
    document.querySelectorAll('.content-item, .highlight-card').forEach(item => {
        item.style.display = 'none';
    });
    
    // Show search results
    results.forEach(item => {
        item.style.display = 'block';
    });
    
    // Update result count
    updateSearchResultCount(results.length);
}

function clearSearchResults() {
    document.querySelectorAll('.content-item, .highlight-card').forEach(item => {
        item.style.display = 'block';
    });
    updateSearchResultCount(null);
}

function updateSearchResultCount(count) {
    // Update UI with search result count
    console.log(count ? `Found ${count} results` : 'Search cleared');
}

// ===== FILTER FUNCTIONS =====
function filterHighlights(category) {
    const highlightCards = document.querySelectorAll('.highlight-card');
    
    highlightCards.forEach(card => {
        const cardCategory = card.dataset.category;
        const shouldShow = category === 'all' || cardCategory === category;
        card.style.display = shouldShow ? 'block' : 'none';
    });
}

function filterContentByAgent(agent) {
    const contentItems = document.querySelectorAll('.content-item[data-agent]');
    
    contentItems.forEach(item => {
        const itemAgent = item.dataset.agent;
        const shouldShow = agent === 'all' || itemAgent === agent;
        item.style.display = shouldShow ? 'block' : 'none';
    });
}

function filterResearch(category) {
    const researchItems = document.querySelectorAll('#research .content-item');
    
    researchItems.forEach(item => {
        const itemType = item.dataset.type;
        const shouldShow = category === 'all' || itemType === category;
        item.style.display = shouldShow ? 'block' : 'none';
    });
}

function filterPerspectives(source) {
    const perspectiveItems = document.querySelectorAll('#perspectives .content-item');
    
    perspectiveItems.forEach(item => {
        const itemSource = item.dataset.source;
        const shouldShow = source === 'all' || itemSource === source;
        item.style.display = shouldShow ? 'block' : 'none';
    });
}

function filterSocial(source) {
    const socialItems = document.querySelectorAll('#social .content-item');
    
    socialItems.forEach(item => {
        const itemSource = item.dataset.source;
        const shouldShow = source === 'all' || itemSource === source;
        item.style.display = shouldShow ? 'block' : 'none';
    });
}

function filterTimeline(filterType) {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    timelineItems.forEach(item => {
        if (filterType === 'all-content') {
            item.style.display = 'block';
        } else {
            // In a real implementation, timeline items would have data attributes
            // indicating their type (product, research, etc.)
            const shouldShow = item.dataset.type === filterType;
            item.style.display = shouldShow ? 'block' : 'none';
        }
    });
}

function getActiveFilters() {
    return {
        contentType: Array.from(document.querySelectorAll('.filter-section input[type="checkbox"]:checked')).map(cb => cb.value),
        agent: appState.filters.agent,
        source: appState.filters.source,
        timeframe: appState.timeframe
    };
}

// ===== INITIALIZATION HELPERS =====
function initializeFilters() {
    // Set initial checkbox states (already set in HTML)
    // Initialize filter state from checked checkboxes
    updateSelectedAgents();
    updateSelectedSources();
    
    console.log('Initial state:', {
        agents: appState.selectedAgents,
        sources: appState.selectedSources
    });
}

// Initialize timeline with default content
function initializeTimeline() {
    // Load default 7d timeline content
    updateTimelineTimeframe('7d');
}

// ===== REAL-TIME SIMULATION =====
function initializeRealtimeSimulation() {
    // In a Supabase implementation, this would be:
    // const subscription = supabase
    //   .channel('content_updates')
    //   .on('postgres_changes', 
    //       { event: '*', schema: 'public', table: 'content_items' }, 
    //       handleContentUpdate
    //   )
    //   .subscribe()
    
    // Simulate real-time updates for demo (disabled - not helpful for mockup)
    // setInterval(simulateContentUpdate, 15000); // Every 15 seconds
    // setInterval(simulateMetricUpdate, 10000);  // Every 10 seconds
}

function simulateContentUpdate() {
    const updateTypes = ['New research published', 'Product update released', 'Social discussion trending'];
    const randomUpdate = updateTypes[Math.floor(Math.random() * updateTypes.length)];
    
    console.log(`🔄 Real-time update: ${randomUpdate}`);
    
    // In a real app, this would update the UI with new content
    showNotification(randomUpdate);
}

function simulateMetricUpdate() {
    // Simulate small changes in metrics
    const metricCards = document.querySelectorAll('.metric-value');
    
    metricCards.forEach(card => {
        if (Math.random() > 0.8) { // 20% chance of update
            const currentText = card.textContent;
            if (currentText.includes('%')) {
                const currentValue = parseFloat(currentText);
                const change = (Math.random() - 0.5) * 2; // -1 to +1
                const newValue = Math.max(0, Math.min(100, currentValue + change));
                card.textContent = newValue.toFixed(1) + '%';
                
                // Animate the change
                card.style.transform = 'scale(1.05)';
                setTimeout(() => card.style.transform = 'scale(1)', 200);
            }
        }
    });
}

function handleContentUpdate(payload) {
    // In a real Supabase app, this would handle real-time updates
    // payload would contain: { eventType, new: {...}, old: {...} }
    
    console.log('Real-time content update:', payload);
    
    switch (payload.eventType) {
        case 'INSERT':
            addContentItem(payload.new);
            break;
        case 'UPDATE':
            updateContentItem(payload.new);
            break;
        case 'DELETE':
            removeContentItem(payload.old.id);
            break;
    }
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: hsl(var(--card));
        border: 1px solid hsl(var(--border));
        border-radius: var(--radius-md);
        padding: var(--spacing-4);
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// ===== UTILITY FUNCTIONS =====
function updateMetrics() {
    // Update metrics based on current filters and timeframe
    console.log('Updating metrics for timeframe:', appState.timeframe);
    
    // In Supabase, this would query aggregated data:
    // const { data: metrics } = await supabase
    //   .from('sentiment_metrics')
    //   .select('*')
    //   .gte('date', getDateRange(appState.timeframe).start)
    //   .single()
}

function updateTimeline() {
    // Update timeline items based on current timeframe
    console.log('Updating timeline for timeframe:', appState.timeframe);
    
    // In Supabase:
    // const { data: timelineData } = await supabase
    //   .from('content_items')
    //   .select('*')
    //   .gte('created_at', getDateRange(appState.timeframe).start)
    //   .order('created_at', { ascending: false })
    //   .limit(50)
}

function updateTimelineTimeframe(timeframe) {
    console.log(`Timeline timeframe updated to: ${timeframe}`);
    
    // Mock timeline data for different timeframes
    const timelineData = {
        '1h': [
            { time: '2 minutes ago', title: 'Real-time sentiment spike detected', description: 'Amp mentions increase 15% on Reddit' },
            { time: '8 minutes ago', title: 'New GitHub issue discussion', description: 'Cursor performance comparison thread' },
            { time: '15 minutes ago', title: 'Twitter thread goes viral', description: 'AI coding assistant productivity tips' }
        ],
        '1d': [
            { time: '2 hours ago', title: 'Amp v2.3 Released', description: 'Major NLP improvements and debugging features' },
            { time: '6 hours ago', title: 'Cursor Update Discussion', description: 'Community feedback on new context features' },
            { time: '12 hours ago', title: 'GitHub Copilot Pricing Changes', description: 'Developer community response analysis' },
            { time: '18 hours ago', title: 'Research Paper Published', description: 'Stanford study on AI assistant productivity' }
        ],
        '7d': [
            { time: '2 hours ago', title: 'Amp v2.3 Released', description: 'Major NLP improvements and debugging features' },
            { time: '1 day ago', title: 'Stanford Research Published', description: '35% productivity boost with AI coding assistants' },
            { time: '3 days ago', title: 'Cursor Partnership Announced', description: 'Integration with popular development tools' },
            { time: '5 days ago', title: 'GitHub Copilot Enterprise Launch', description: 'New features for large organizations' }
        ],
        '30d': [
            { time: '2 hours ago', title: 'Amp v2.3 Released', description: 'Major NLP improvements and debugging features' },
            { time: '1 day ago', title: 'Stanford Research Published', description: '35% productivity boost with AI coding assistants' },
            { time: '1 week ago', title: 'Industry Survey Results', description: 'Developer preferences in AI coding tools' },
            { time: '2 weeks ago', title: 'Claude Code Beta Launch', description: 'New AI assistant enters the market' },
            { time: '3 weeks ago', title: 'Windsurf Major Update', description: 'Enhanced code analysis and suggestions' }
        ]
    };
    
    // Update timeline content
    const timelineContainer = document.querySelector('.timeline-container');
    if (timelineContainer && timelineData[timeframe]) {
        const items = timelineData[timeframe];
        
        // Clear existing timeline items
        timelineContainer.innerHTML = '';
        
        // Add new timeline items based on timeframe
        items.forEach(item => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.innerHTML = `
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-time">${item.time}</div>
                    <h4 class="timeline-title">${item.title}</h4>
                    <p class="timeline-description">${item.description}</p>
                </div>
            `;
            timelineContainer.appendChild(timelineItem);
        });
    }
    
    // Update timeline header with selected timeframe
    const timeframeLegend = {
        '1h': 'Last Hour',
        '1d': 'Last Day', 
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days'
    };
    
    console.log(`Showing timeline for: ${timeframeLegend[timeframe]} (${timelineData[timeframe]?.length || 0} items)`);
}

function getDateRange(timeframe) {
    const now = new Date();
    const ranges = {
        '1h': new Date(now.getTime() - 1 * 60 * 60 * 1000),
        '1d': new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    };
    
    return {
        start: ranges[timeframe] || ranges['30d'],
        end: now
    };
}

// ===== ACCESSIBILITY HELPERS =====
function announceUpdate(message) {
    // Create temporary element for screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
}

// ===== KEYBOARD NAVIGATION =====
document.addEventListener('keydown', function(e) {
    // Navigation shortcuts
    if (e.altKey) {
        switch(e.key) {
            case '1':
                document.querySelector('[href="#overview"]')?.click();
                e.preventDefault();
                break;
            case '2':
                document.querySelector('[href="#highlights"]')?.click();
                e.preventDefault();
                break;
            case '3':
                document.querySelector('[href="#sentiment"]')?.click();
                e.preventDefault();
                break;
            case '4':
                document.querySelector('[href="#updates"]')?.click();
                e.preventDefault();
                break;
            case 's':
                document.getElementById('globalSearch')?.focus();
                e.preventDefault();
                break;
        }
    }
    
    // ESC to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            clearSearchResults();
            searchInput.blur();
        }
        
        // Close mobile menu
        document.querySelector('.sidebar')?.classList.remove('open');
    }
});

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Dashboard error:', e.error);
    
    // In production, this would send error reports to monitoring service:
    // await supabase.from('error_logs').insert({
    //     message: e.error.message,
    //     stack: e.error.stack,
    //     url: window.location.href,
    //     user_agent: navigator.userAgent,
    //     timestamp: new Date().toISOString()
    // });
});

// Chart.js error handling
if (typeof Chart !== 'undefined') {
    Chart.defaults.plugins.legend.onClick = function(e, legendItem, legend) {
        try {
            const original = Chart.defaults.plugins.legend.onClick;
            if (original) {
                original.call(this, e, legendItem, legend);
            }
        } catch (error) {
            console.error('Chart interaction error:', error);
            announceUpdate('Chart interaction failed. Please try again.');
        }
    };
}

/**
 * SUPABASE INTEGRATION SUMMARY:
 * =============================
 * 
 * This mockup provides a complete UI framework that can be directly adapted for 
 * Next.js + Supabase. Key integration points:
 * 
 * 1. DATABASE SCHEMA:
 *    - content_items (id, type, category, agent, title, summary, content, source, sentiment, created_at, metadata)
 *    - sentiment_trends (id, agent, date, positive, neutral, negative, timeframe)
 *    - sentiment_metrics (id, date, overall_sentiment, total_content, active_discussions, research_count)
 * 
 * 2. REAL-TIME SUBSCRIPTIONS:
 *    - Content updates: supabase.channel().on('postgres_changes', { table: 'content_items' })
 *    - Sentiment changes: supabase.channel().on('postgres_changes', { table: 'sentiment_trends' })
 * 
 * 3. EDGE FUNCTIONS:
 *    - Sentiment analysis on content insert/update
 *    - Data aggregation for metrics
 *    - Content categorization and tagging
 * 
 * 4. ROW LEVEL SECURITY:
 *    - Content filtering based on user permissions
 *    - Agent-specific access controls if needed
 * 
 * 5. FULL-TEXT SEARCH:
 *    - CREATE INDEX ON content_items USING gin(to_tsvector('english', title || ' ' || summary || ' ' || content))
 *    - Search queries: .textSearch('title,summary,content', query)
 * 
 * 6. PERFORMANCE OPTIMIZATIONS:
 *    - Materialized views for aggregated metrics
 *    - Proper indexing on filtered columns (agent, category, created_at)
 *    - Connection pooling and caching strategies
 */

console.log('🚀 AI Agent Intelligence Dashboard initialized');
console.log('📊 Ready for Supabase integration');
