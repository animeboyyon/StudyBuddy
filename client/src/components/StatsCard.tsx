import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  bgColor: string;
  iconColor: string;
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeType, 
  bgColor, 
  iconColor 
}: StatsCardProps) {
  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'negative':
        return <TrendingDown className="h-3 w-3 text-error" />;
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-error';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className={`${bgColor} p-3 rounded-lg`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          {getChangeIcon()}
          <span className={`font-medium ml-1 ${getChangeColor()}`}>
            {change}
          </span>
          {changeType !== 'neutral' && (
            <span className="text-gray-500 ml-1">from last week</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
