"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Send, 
  BarChart2, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  Zap, 
  Brain, 
  Sparkles, 
  Command,
  Cpu
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  ResponsiveContainer 
} from 'recharts';
import { LucideIcon } from 'lucide-react';

interface Metrics {
  accuracy: number;
  relevancy: number;
  responseTime: number;
  cost: number;
  tokenCount: number;
}

interface Response {
  model: string;
  response: string;
  metrics: Metrics;
  error?: string;
}

interface ModelInfoType {
  [key: string]: {
    description: string;
    context: string;
    costPer1k: string;
    icon: LucideIcon;
    color: string;
  }
}

interface MetricDisplayProps {
  label: string;
  value: number;
  icon: LucideIcon;
  unit?: string;
  type?: string;
}

const ModelInfo: ModelInfoType = {
  'mixtral-8x7b-32768': {
    description: 'Mixtral 8x7B',
    context: '32K context',
    costPer1k: '$0.0027',
    icon: Brain,
    color: '#FF6B6B'
  },
  'gemma2-9b-it': {
    description: 'Gemma 2 9B',
    context: 'Instruct',
    costPer1k: '$0.0001',
    icon: Command,
    color: '#45B7D1'
  },
  'llama-3.3-70b-versatile': {
    description: 'LLaMA 3.3 70B',
    context: 'Versatile',
    costPer1k: '$0.0007',
    icon: Sparkles,
    color: '#4ECDC4'
  },
  'llama-3.1-8b-instant': {
    description: 'LLaMA 3.1 8B',
    context: 'Instant',
    costPer1k: '$0.0001',
    icon: Cpu,
    color: '#96CEB4'
  }
};

const metricFormats: Record<string, { decimals: number; multiplier: number }> = {
  accuracy: { decimals: 1, multiplier: 100 },
  relevancy: { decimals: 1, multiplier: 100 },
  responseTime: { decimals: 2, multiplier: 1 },
  cost: { decimals: 4, multiplier: 1 },
  tokenCount: { decimals: 0, multiplier: 1 }
};

const MetricDisplay: React.FC<MetricDisplayProps> = ({ label, value, icon: Icon, unit = '', type = 'default' }) => {
  const format = metricFormats[label.toLowerCase()] || { decimals: 2, multiplier: 1 };
  const formattedValue = (value * format.multiplier).toFixed(format.decimals);

  return (
    <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">
        {label}: {formattedValue}{unit}
      </span>
    </div>
  );
};

export default function Dashboard() {
  const [prompt, setPrompt] = useState<string>('');
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResponses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getRadarData = (response: Response) => [
    {
      subject: 'Accuracy',
      value: response.metrics.accuracy * 100,
      fullMark: 100,
    },
    {
      subject: 'Relevancy',
      value: response.metrics.relevancy * 100,
      fullMark: 100,
    },
    {
      subject: 'Speed',
      value: Math.max(0, 100 - (response.metrics.responseTime * 20)),
      fullMark: 100,
    },
    {
      subject: 'Efficiency',
      value: Math.max(0, 100 - (response.metrics.cost * 1000)),
      fullMark: 100,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
              LLM Evaluation
            </h1>
            <p className="text-gray-600 mt-2">Compare and evaluate Groq's most powerful models</p>
          </div>
        </div>

        <Card className="mb-8 border-2 border-blue-100">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="min-h-[100px] text-lg"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  size="lg"
                >
                  <Send className="mr-2 h-5 w-5" />
                  {isLoading ? 'Running Evaluation...' : 'Start Evaluation'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {responses.length > 0 && (
          <Tabs defaultValue="comparison" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
              <TabsTrigger value="comparison">Comparison View</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {responses.map((response, idx) => {
                  const ModelIcon = ModelInfo[response.model]?.icon || Brain;
                  return (
                    <Card key={idx} className={`transform transition-all duration-200 hover:shadow-lg ${
                      response.error ? 'border-red-500' : ''
                    }`}>
                      <CardHeader className="bg-gray-50 border-b">
                        <CardTitle className="flex items-center gap-2">
                          <ModelIcon className="h-6 w-6" style={{ color: ModelInfo[response.model]?.color }} />
                          <div>
                            <div>{ModelInfo[response.model]?.description || response.model}</div>
                            <div className="text-sm text-gray-500">
                              {ModelInfo[response.model]?.context} • {ModelInfo[response.model]?.costPer1k} per 1K tokens
                            </div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {response.error ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{response.error}</AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <div className="mb-6">
                              <div className="text-sm font-medium text-gray-500 mb-2">Response:</div>
                              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                                {response.response}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <MetricDisplay 
                                label="Accuracy" 
                                value={response.metrics.accuracy} 
                                icon={CheckCircle}
                                unit="%" 
                                type="accuracy"
                              />
                              <MetricDisplay 
                                label="Relevancy" 
                                value={response.metrics.relevancy} 
                                icon={BarChart2}
                                unit="%" 
                                type="relevancy"
                              />
                              <MetricDisplay 
                                label="Response Time" 
                                value={response.metrics.responseTime} 
                                icon={Clock}
                                unit="s" 
                                type="responseTime"
                              />
                              <MetricDisplay 
                                label="Cost" 
                                value={response.metrics.cost} 
                                icon={DollarSign}
                                unit="$" 
                                type="cost"
                              />
                            </div>

                            <div className="mt-6">
                              <ResponsiveContainer width="100%" height={200}>
                                <RadarChart data={getRadarData(response)}>
                                  <PolarGrid />
                                  <PolarAngleAxis dataKey="subject" />
                                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                  <Radar
                                    name={ModelInfo[response.model]?.description || response.model}
                                    dataKey="value"
                                    stroke={ModelInfo[response.model]?.color || '#000'}
                                    fill={ModelInfo[response.model]?.color || '#000'}
                                    fillOpacity={0.3}
                                  />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

          
          </Tabs>
        )}
      </div>
    </div>
  );
}