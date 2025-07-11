import { useQuery } from "@tanstack/react-query";
import { Bot, Users, FileText, Activity } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import RecentDocuments from "@/components/RecentDocuments";
import QuickActions from "@/components/QuickActions";
import RecentActivity from "@/components/RecentActivity";
import QuestionPreview from "@/components/QuestionPreview";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  const { data: botStatus } = useQuery({
    queryKey: ['/api/bot/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-telegram text-white rounded-lg p-2">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">StudyBot</h1>
                <p className="text-xs text-gray-500">Learning Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${botStatus?.isRunning ? 'bg-success' : 'bg-error'}`}></div>
                <span className="text-sm text-gray-600">
                  {botStatus?.isRunning ? 'Bot Active' : 'Bot Inactive'}
                </span>
              </div>
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-1">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {botStatus?.activeSessions || 0}
                </span>
                <span className="text-xs text-gray-500">sessions</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Documents"
            value={stats?.totalDocuments || 0}
            icon={FileText}
            change="+12%"
            changeType="positive"
            bgColor="bg-primary/10"
            iconColor="text-primary"
          />
          <StatsCard
            title="Questions Asked"
            value={stats?.questionsAsked || 0}
            icon={Activity}
            change="+8%"
            changeType="positive"
            bgColor="bg-warning/10"
            iconColor="text-warning"
          />
          <StatsCard
            title="Accuracy Rate"
            value={`${stats?.accuracyRate || 0}%`}
            icon={Activity}
            change="+5%"
            changeType="positive"
            bgColor="bg-success/10"
            iconColor="text-success"
          />
          <StatsCard
            title="Active Sessions"
            value={stats?.activeSessions || 0}
            icon={Users}
            change="No change"
            changeType="neutral"
            bgColor="bg-warning/10"
            iconColor="text-warning"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RecentDocuments />
          </div>
          <div>
            <QuickActions />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity />
          <QuestionPreview />
        </div>
      </main>
    </div>
  );
}
