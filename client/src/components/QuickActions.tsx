import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, BarChart3, Settings, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function QuickActions() {
  const { toast } = useToast();

  const handleStartBot = async () => {
    try {
      await apiRequest('POST', '/api/bot/start');
      toast({
        title: "Bot Started",
        description: "The Telegram bot has been started successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start the bot. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStopBot = async () => {
    try {
      await apiRequest('POST', '/api/bot/stop');
      toast({
        title: "Bot Stopped",
        description: "The Telegram bot has been stopped.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop the bot. Please try again.",
        variant: "destructive",
      });
    }
  };

  const actions = [
    {
      title: "Start Bot",
      description: "Begin Telegram bot",
      icon: Play,
      bgColor: "bg-primary/5 hover:bg-primary/10",
      borderColor: "border-primary/20",
      iconBg: "bg-primary",
      iconColor: "text-white",
      onClick: handleStartBot,
    },
    {
      title: "Stop Bot",
      description: "Stop Telegram bot",
      icon: Settings,
      bgColor: "bg-gray-50 hover:bg-gray-100",
      borderColor: "border-gray-200",
      iconBg: "bg-gray-600",
      iconColor: "text-white",
      onClick: handleStopBot,
    },
    {
      title: "Generate Questions",
      description: "Create from documents",
      icon: Sparkles,
      bgColor: "bg-gray-50 hover:bg-gray-100",
      borderColor: "border-gray-200",
      iconBg: "bg-warning",
      iconColor: "text-white",
      onClick: () => {
        toast({
          title: "Feature Coming Soon",
          description: "Question generation will be available soon.",
        });
      },
    },
    {
      title: "View Reports",
      description: "Learning analytics",
      icon: BarChart3,
      bgColor: "bg-gray-50 hover:bg-gray-100",
      borderColor: "border-gray-200",
      iconBg: "bg-success",
      iconColor: "text-white",
      onClick: () => {
        toast({
          title: "Feature Coming Soon",
          description: "Analytics reports will be available soon.",
        });
      },
    },
  ];

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant="ghost"
            className={`w-full flex items-center justify-between p-4 ${action.bgColor} rounded-lg border ${action.borderColor} transition-colors h-auto`}
            onClick={action.onClick}
          >
            <div className="flex items-center space-x-3">
              <div className={`${action.iconBg} ${action.iconColor} rounded-lg p-2`}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
