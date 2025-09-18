"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Calendar, Filter, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

// Mock data for sentiment trends
const mockSentimentData = {
  totalInteractions: 18534,
  positiveChange: 12.4,
  negativeChange: -2.8,
  neutralChange: 4.2,
  agents: ["Amp", "Augment", "Cline", "GitHub Copilot", "Roo Code"],
  sources: ["X", "Hacker News", "Reddit"]
}

// Chart data with each agent as separate data series
const chartData = [
  { date: "2024-09-10", Amp: 75, Augment: 68, Cline: 82, "GitHub Copilot": 71, "Roo Code": 64 },
  { date: "2024-09-11", Amp: 78, Augment: 70, Cline: 85, "GitHub Copilot": 74, "Roo Code": 67 },
  { date: "2024-09-12", Amp: 82, Augment: 72, Cline: 87, "GitHub Copilot": 76, "Roo Code": 69 },
  { date: "2024-09-13", Amp: 80, Augment: 74, Cline: 84, "GitHub Copilot": 78, "Roo Code": 71 },
  { date: "2024-09-14", Amp: 84, Augment: 76, Cline: 88, "GitHub Copilot": 80, "Roo Code": 73 },
  { date: "2024-09-15", Amp: 86, Augment: 78, Cline: 90, "GitHub Copilot": 82, "Roo Code": 75 },
  { date: "2024-09-16", Amp: 89, Augment: 81, Cline: 92, "GitHub Copilot": 85, "Roo Code": 78 },
]

// New mock data for second sentiment chart
const mockSentimentData2 = {
  totalInteractions: 24892,
  positiveChange: 8.7,
  negativeChange: -5.1,
  neutralChange: 2.9,
  agents: ["Amp", "Augment", "Cline", "GitHub Copilot", "Roo Code"],
  sources: ["X", "Hacker News", "Reddit"]
}

// Second chart data with different patterns for each agent
const chartData2 = [
  { date: "2024-09-10", Amp: 72, Augment: 65, Cline: 79, "GitHub Copilot": 68, "Roo Code": 62 },
  { date: "2024-09-11", Amp: 74, Augment: 67, Cline: 81, "GitHub Copilot": 70, "Roo Code": 64 },
  { date: "2024-09-12", Amp: 71, Augment: 69, Cline: 78, "GitHub Copilot": 72, "Roo Code": 66 },
  { date: "2024-09-13", Amp: 76, Augment: 71, Cline: 83, "GitHub Copilot": 74, "Roo Code": 68 },
  { date: "2024-09-14", Amp: 78, Augment: 73, Cline: 85, "GitHub Copilot": 76, "Roo Code": 70 },
  { date: "2024-09-15", Amp: 80, Augment: 75, Cline: 87, "GitHub Copilot": 78, "Roo Code": 72 },
  { date: "2024-09-16", Amp: 83, Augment: 78, Cline: 89, "GitHub Copilot": 81, "Roo Code": 75 },
]

const chartConfig = {
  Amp: {
    label: "Amp",
    color: "#3b82f6", // Blue
  },
  Augment: {
    label: "Augment", 
    color: "#10b981", // Green
  },
  Cline: {
    label: "Cline",
    color: "#f59e0b", // Orange
  },
  "GitHub Copilot": {
    label: "GitHub Copilot",
    color: "#8b5cf6", // Purple
  },
  "Roo Code": {
    label: "Roo Code",
    color: "#ef4444", // Red
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState("Last 7 days")

  const toggleAgent = (agent: string) => {
    setSelectedAgents(prev => 
      prev.includes(agent) 
        ? prev.filter(a => a !== agent)
        : [...prev, agent]
    )
  }

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    )
  }

  const isAgentSelected = (agent: string) => selectedAgents.includes(agent)
  const isSourceSelected = (source: string) => selectedSources.includes(source)

  // Filter data based on agent selections
  const getFilteredData = (baseData: typeof chartData) => {
    return baseData.map(item => {
      const filteredItem: any = { date: item.date }
      
      // If no agents are selected, show all agents
      if (selectedAgents.length === 0) {
        mockSentimentData.agents.forEach(agent => {
          filteredItem[agent] = item[agent as keyof typeof item]
        })
      } else {
        // Only show selected agents
        mockSentimentData.agents.forEach(agent => {
          if (selectedAgents.includes(agent)) {
            filteredItem[agent] = item[agent as keyof typeof item]
          } else {
            filteredItem[agent] = 0 // Hide non-selected agents
          }
        })
      }
      
      // Apply source filtering (reduce values if sources are filtered)
      if (selectedSources.length > 0 && selectedSources.length < mockSentimentData.sources.length) {
        const sourceMultiplier = selectedSources.length / mockSentimentData.sources.length
        mockSentimentData.agents.forEach(agent => {
          if (filteredItem[agent] > 0) {
            filteredItem[agent] = Math.round(filteredItem[agent] * sourceMultiplier)
          }
        })
      }
      
      return filteredItem
    })
  }

  const filteredChartData = getFilteredData(chartData)
  const filteredChartData2 = getFilteredData(chartData2)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitor agent sentiment and performance metrics</p>
        </div>
      </div>

      {/* Sentiment Trends Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sentiment Trends</CardTitle>
              <CardDescription>Track sentiment changes over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={timeRange === "Last 7 days" ? "default" : "outline"} 
                size="sm"
                onClick={() => setTimeRange("Last 7 days")}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Last 7 days
              </Button>
              <Button 
                variant={timeRange === "Last 30 days" ? "default" : "outline"} 
                size="sm"
                onClick={() => setTimeRange("Last 30 days")}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Last 30 days
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Agents</label>
              <div className="flex gap-2">
                {mockSentimentData.agents.map((agent) => (
                  <Button 
                    key={agent} 
                    variant={isAgentSelected(agent) ? "default" : "outline"} 
                    size="sm" 
                    className="text-xs"
                    onClick={() => toggleAgent(agent)}
                  >
                    {agent}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sources</label>
              <div className="flex gap-2">
                {mockSentimentData.sources.map((source) => (
                  <Button 
                    key={source} 
                    variant={isSourceSelected(source) ? "default" : "outline"} 
                    size="sm" 
                    className="text-xs"
                    onClick={() => toggleSource(source)}
                  >
                    {source}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <ChartContainer config={chartConfig} className="h-64">
            <AreaChart
              accessibilityLayer
              data={filteredChartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              {mockSentimentData.agents.map((agent) => (
                <Area
                  key={agent}
                  dataKey={agent}
                  type="monotone"
                  fill={chartConfig[agent as keyof typeof chartConfig]?.color}
                  fillOpacity={selectedAgents.length === 0 || selectedAgents.includes(agent) ? 0.2 : 0}
                  stroke={chartConfig[agent as keyof typeof chartConfig]?.color}
                  strokeOpacity={selectedAgents.length === 0 || selectedAgents.includes(agent) ? 1 : 0.15}
                />
              ))}
            </AreaChart>
          </ChartContainer>

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{mockSentimentData.totalInteractions.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 mr-1" />
                {mockSentimentData.positiveChange}%
              </div>
              <div className="text-sm text-muted-foreground">Positive Sentiment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 mr-1" />
                {Math.abs(mockSentimentData.negativeChange)}%
              </div>
              <div className="text-sm text-muted-foreground">Negative Sentiment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600 flex items-center justify-center">
                <Minus className="w-5 h-5 mr-1" />
                {mockSentimentData.neutralChange}%
              </div>
              <div className="text-sm text-muted-foreground">Neutral Sentiment</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
    </div>
  )
}
