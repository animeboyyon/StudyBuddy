import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageCircle, Upload, Clock, User } from "lucide-react";

export default function RecentActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/recent-activity'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="bg-gray-200 p-2 rounded-lg">
                  <div className="w-4 h-4 bg-gray-300 rounded"></div>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'question_answered':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'document_uploaded':
        return <Upload className="h-4 w-4 text-success" />;
      case 'session_started':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case 'question_answered':
        return 'bg-primary/10';
      case 'document_uploaded':
        return 'bg-success/10';
      case 'session_started':
        return 'bg-warning/10';
      default:
        return 'bg-gray-100';
    }
  };

  const formatActivityMessage = (activity: any) => {
    switch (activity.type) {
      case 'question_answered':
        return {
          main: `Question answered with score: ${activity.data.score}%`,
          sub: `${new Date(activity.timestamp).toLocaleTimeString()} • AI Evaluation`
        };
      case 'document_uploaded':
        return {
          main: `Document uploaded: ${activity.data.originalName}`,
          sub: `${new Date(activity.timestamp).toLocaleTimeString()} • ${Math.round(activity.data.fileSize / 1024)} KB`
        };
      case 'session_started':
        return {
          main: `New study session started`,
          sub: `${new Date(activity.timestamp).toLocaleTimeString()} • ${activity.data.interval} min intervals`
        };
      default:
        return {
          main: 'Unknown activity',
          sub: new Date(activity.timestamp).toLocaleTimeString()
        };
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
            <p className="text-sm text-gray-400">Activity will appear here as users interact with the bot</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity: any, index: number) => {
              const message = formatActivityMessage(activity);
              return (
                <div key={index} className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <div className={`p-2 rounded-lg ${getActivityBgColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{message.main}</p>
                    <p className="text-xs text-gray-500 mt-1">{message.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
