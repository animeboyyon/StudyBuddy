import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Lightbulb } from "lucide-react";

export default function QuestionPreview() {
  const { data: questions, isLoading } = useQuery({
    queryKey: ['/api/sample-questions'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sample Questions</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-success/10 text-success';
      case 'medium':
        return 'bg-warning/10 text-warning';
      case 'hard':
        return 'bg-error/10 text-error';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sample Questions</h2>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            <Lightbulb className="h-4 w-4 mr-1" />
            Generate More
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!questions || questions.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No sample questions available</p>
            <p className="text-sm text-gray-400">Upload documents to generate questions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.slice(0, 2).map((question: any, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {question.category}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty}
                  </Badge>
                </div>
                <p className="text-sm text-gray-900 mb-3 font-medium">
                  {question.question}
                </p>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Expected Answer:</p>
                  <p className="text-sm text-gray-700 font-mono leading-relaxed">
                    {question.expectedAnswer}
                  </p>
                </div>
                {question.document && (
                  <div className="mt-2 text-xs text-gray-500">
                    From: {question.document}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
