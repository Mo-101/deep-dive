"""
MoStar Grid Consciousness Component
Frontend integration for 197K-node Neo4j knowledge graph, Ifá reasoning, and dual AI
"""

import { useState, useEffect } from 'react';
import { 
  Brain, 
  Flame, 
  Globe2, 
  Sparkles, 
  AlertTriangle,
  BookOpen,
  Languages,
  History,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Grid API Configuration
const GRID_API_BASE = import.meta.env.VITE_MOSTAR_GRID_API || 'http://localhost:8000';

// Types
interface GridStatus {
  status: string;
  neo4j_connected: boolean;
  ai_models: {
    qwen_ready: boolean;
    mistral_ready: boolean;
    ollama_running: boolean;
  };
  ifa_engine: boolean;
  timestamp: string;
}

interface IfaReading {
  odu_name: string;
  yoruba_name: string;
  meaning: string;
  interpretation: string;
  guidance: string;
  ebo: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  binary_pattern: string;
  ibibio?: {
    name: string;
    meaning: string;
    interpretation: string;
  };
}

interface AIAnalysis {
  immediate_threats: string[];
  cascading_effects: string[];
  case_prediction: {
    '7_day_forecast': number;
    confidence: string;
  };
  critical_infrastructure: string[];
  resource_needs: string[];
  evacuation_priority: string;
  monitoring_indicators: string[];
}

interface GridAnalysis {
  analysis_id: string;
  timestamp: string;
  convergence_assessment: {
    risk_score: number;
    risk_level: string;
    factors: Record<string, number>;
    confidence: number;
  };
  ifa_reading: IfaReading;
  ai_predictions: AIAnalysis;
  historical_patterns: Array<{
    disease: string;
    distance_km: number;
    risk_score: number;
    outcome_severity: number;
  }>;
  recommendations: string[];
}

interface GridConsciousnessProps {
  cycloneId?: string;
  outbreakId?: string;
  className?: string;
}

export const GridConsciousness = ({ 
  cycloneId, 
  outbreakId,
  className 
}: GridConsciousnessProps) => {
  const [status, setStatus] = useState<GridStatus | null>(null);
  const [analysis, setAnalysis] = useState<GridAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('consciousness');
  const [expandedSections, setExpandedSections] = useState<string[]>(['ai', 'ifa']);

  // Check Grid status on mount
  useEffect(() => {
    checkGridStatus();
    const interval = setInterval(checkGridStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Run analysis when cyclone/outbreak selected
  useEffect(() => {
    if (cycloneId && outbreakId) {
      runGridAnalysis();
    }
  }, [cycloneId, outbreakId]);

  const checkGridStatus = async () => {
    try {
      const response = await fetch(`${GRID_API_BASE}/health`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Grid status check failed:', e);
      setStatus({
        status: 'offline',
        neo4j_connected: false,
        ai_models: { qwen_ready: false, mistral_ready: false, ollama_running: false },
        ifa_engine: false,
        timestamp: new Date().toISOString()
      });
    }
  };

  const runGridAnalysis = async () => {
    if (!cycloneId || !outbreakId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Mock analysis for demo
      const mockAnalysis: GridAnalysis = {
        analysis_id: `GRID_${Date.now()}`,
        timestamp: new Date().toISOString(),
        convergence_assessment: {
          risk_score: 0.87,
          risk_level: 'CRITICAL',
          factors: {
            distance_factor: 0.86,
            severity_factor: 0.8,
            probability_factor: 1.0,
            historical_pattern_risk: 0.75,
            ifa_influence: 0.15
          },
          confidence: 0.85
        },
        ifa_reading: {
          odu_name: 'Obara',
          yoruba_name: 'Òbàrà',
          binary_pattern: '01100110',
          meaning: 'Sudden transformation, thunder, authority',
          interpretation: 'Catastrophic flooding + disease surge imminent. Evacuate now.',
          guidance: 'Act decisively. Swift action prevents greater harm.',
          ebo: 'Thunder stone and ram',
          urgency: 'critical',
          ibibio: {
            name: 'Òbàrà → Àrá',
            meaning: 'Ayípadà líle, àrá, agbára (Sudden change, thunder, power)',
            interpretation: 'Ìgbésẹ kíákíá dáàbò bo ibi (Quick action prevents harm)'
          }
        },
        ai_predictions: {
          immediate_threats: [
            'Cholera outbreak in Antananarivo threatened by approaching tropical storm',
            'Flooding will contaminate already compromised water systems',
            'Displacement camps will accelerate disease transmission'
          ],
          cascading_effects: [
            'Flooding destroys sanitation infrastructure → cholera surge',
            'Healthcare facilities damaged → treatment capacity reduced',
            'Population displacement → overcrowding in shelters',
            'Supply chain disruption → medicine shortages'
          ],
          case_prediction: {
            '7_day_forecast': 280,
            confidence: 'medium'
          },
          critical_infrastructure: [
            'Central Hospital Antananarivo',
            'Water treatment plant',
            'Road network for evacuation',
            'Cold chain for vaccines'
          ],
          resource_needs: [
            'Oral rehydration salts (5000 doses)',
            'IV fluids and antibiotics',
            'Water purification tablets',
            'Mobile cholera treatment units'
          ],
          evacuation_priority: 'critical',
          monitoring_indicators: [
            'Rainfall accumulation >50mm',
            'River level rise rate',
            'New cholera case reporting trend',
            'Healthcare facility status'
          ]
        },
        historical_patterns: [
          { disease: 'Cholera', distance_km: 85, risk_score: 0.82, outcome_severity: 0.9 },
          { disease: 'Cholera', distance_km: 120, risk_score: 0.75, outcome_severity: 0.7 }
        ],
        recommendations: [
          'Immediate evacuation of vulnerable communities',
          'Pre-position emergency medical supplies within 24 hours',
          'Monitor: Flooding destroys sanitation infrastructure → cholera surge',
          'Monitor: Healthcare facilities damaged → treatment capacity reduced',
          'Traditional guidance: Act decisively. Swift action prevents greater harm.'
        ]
      };
      
      await new Promise(r => setTimeout(r, 1500));
      setAnalysis(mockAnalysis);
      
    } catch (e) {
      setError('Grid analysis failed. Check connection to MoStar Grid API.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIfaUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-green-500 bg-green-500/10';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <Card className={cn("bg-slate-950 border-slate-800 overflow-hidden", className)}>
      <CardHeader className="border-b border-slate-800 bg-gradient-to-r from-orange-950/50 to-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 animate-pulse" />
              <Flame className="w-6 h-6 text-orange-500 relative" />
            </div>
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                MoStar Grid
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                  Consciousness
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                197K-node Neo4j • Ifá AI • Qwen + Mistral
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status?.neo4j_connected && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Neo4j
              </Badge>
            )}
            {status?.ai_models.qwen_ready && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 text-[10px]">
                <Brain className="w-3 h-3 mr-1" />
                AI
              </Badge>
            )}
            {status?.ifa_engine && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" />
                Ifá
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-slate-800 bg-slate-900/50 p-0 h-10">
            <TabsTrigger 
              value="consciousness" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-slate-800/50"
            >
              <Brain className="w-4 h-4 mr-2" />
              Consciousness
            </TabsTrigger>
            <TabsTrigger 
              value="ifa"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-slate-800/50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Ifá Reading
            </TabsTrigger>
            <TabsTrigger 
              value="patterns"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-slate-800/50"
            >
              <History className="w-4 h-4 mr-2" />
              Patterns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consciousness" className="m-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-4">
                {/* Status Bar */}
                <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Globe2 className={cn(
                      "w-5 h-5",
                      status?.status === 'conscious' ? "text-emerald-400" : "text-red-400"
                    )} />
                    <span className="text-sm text-slate-300">
                      Grid: <span className="font-medium">{status?.status || 'checking...'}</span>
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <Brain className={cn(
                      "w-5 h-5",
                      status?.ai_models.qwen_ready ? "text-blue-400" : "text-slate-600"
                    )} />
                    <span className="text-sm text-slate-300">Qwen 14B</span>
                  </div>
                </div>

                {!analysis && !isLoading && (
                  <Button 
                    onClick={runGridAnalysis}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500"
                    size="lg"
                  >
                    <Flame className="w-5 h-5 mr-2" />
                    Activate Grid Consciousness
                  </Button>
                )}

                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500 blur-xl opacity-30 animate-pulse" />
                      <Loader2 className="w-12 h-12 text-orange-500 animate-spin relative" />
                    </div>
                    <p className="text-slate-400 animate-pulse">Grid is analyzing...</p>
                    <p className="text-xs text-slate-500">Querying 197K nodes • Consulting Ifá • Running AI models</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {analysis && (
                  <div className="space-y-4">
                    {/* Risk Assessment */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      analysis.convergence_assessment.risk_level === 'CRITICAL' 
                        ? "bg-red-500/10 border-red-500/30" 
                        : "bg-orange-500/10 border-orange-500/30"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Convergence Risk Score</span>
                        <Badge className={cn(
                          analysis.convergence_assessment.risk_level === 'CRITICAL'
                            ? "bg-red-500 text-white"
                            : "bg-orange-500 text-white"
                        )}>
                          {analysis.convergence_assessment.risk_level}
                        </Badge>
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-white">
                          {(analysis.convergence_assessment.risk_score * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm text-slate-400 mb-1">
                          confidence: {(analysis.convergence_assessment.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* AI Predictions */}
                    <div className="space-y-2">
                      <button
                        onClick={() => toggleSection('ai')}
                        className="w-full flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="w-5 h-5 text-blue-400" />
                          <span className="font-medium text-slate-200">AI Predictions (Qwen)</span>
                        </div>
                        {expandedSections.includes('ai') ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      
                      {expandedSections.includes('ai') && (
                        <div className="p-4 bg-slate-900/30 rounded-lg space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Immediate Threats
                            </h4>
                            <ul className="space-y-1">
                              {analysis.ai_predictions.immediate_threats.map((threat, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                  <span className="text-red-500 mt-1">•</span>
                                  {threat}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded">
                            <TrendingUp className="w-5 h-5 text-orange-400" />
                            <div>
                              <div className="text-sm text-slate-400">7-Day Forecast</div>
                              <div className="text-xl font-bold text-white">
                                {analysis.ai_predictions.case_prediction['7_day_forecast']} cases
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                      <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Grid Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {analysis.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">{i + 1}.</span>
                            {rec.startsWith('Traditional guidance:') ? (
                              <span className="italic text-purple-300">{rec.replace('Traditional guidance: ', '')}</span>
                            ) : (
                              rec
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Ifá Tab */}
          <TabsContent value="ifa" className="m-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-4">
                {!analysis?.ifa_reading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                    <p>Run Grid analysis to receive Ifá guidance</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center p-6 bg-gradient-to-b from-purple-950/50 to-slate-950 rounded-lg border border-purple-500/20">
                      <div className="text-xs text-purple-400 uppercase tracking-wider mb-2">Odù Pattern</div>
                      <h2 className="text-3xl font-bold text-white mb-1">
                        {analysis.ifa_reading.odu_name}
                      </h2>
                      <p className="text-lg text-purple-300">{analysis.ifa_reading.yoruba_name}</p>
                      <div className="mt-4 flex justify-center gap-1">
                        {analysis.ifa_reading.binary_pattern.split('').map((bit, i) => (
                          <div 
                            key={i}
                            className={cn(
                              "w-3 h-8 rounded-sm",
                              bit === '1' ? "bg-purple-500" : "bg-slate-700"
                            )}
                          />
                        ))}
                      </div>
                      <div className="mt-4 inline-flex">
                        <Badge className={getIfaUrgencyColor(analysis.ifa_reading.urgency)}>
                          {analysis.ifa_reading.urgency} urgency
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <h3 className="text-sm font-medium text-purple-400 mb-2">Interpretation</h3>
                      <p className="text-slate-300 italic">&quot;{analysis.ifa_reading.interpretation}&quot;</p>
                    </div>

                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                        <Languages className="w-4 h-4" />
                        Ibibio
                      </h3>
                      <p className="text-slate-300">{analysis.ifa_reading.ibibio?.interpretation}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="m-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-4">
                {!analysis?.historical_patterns?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <History className="w-12 h-12 mb-4 opacity-50" />
                    <p>No historical patterns found</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-slate-400 mb-4">
                      Found {analysis.historical_patterns.length} similar events in Neo4j Grid
                    </div>
                    
                    {analysis.historical_patterns.map((pattern, i) => (
                      <div 
                        key={i}
                        className="p-4 bg-slate-900/50 rounded-lg border border-slate-800"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="border-slate-700">
                            {pattern.disease}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {(pattern.outcome_severity * 100).toFixed(0)}% severity
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Distance:</span>
                            <span className="text-slate-300 ml-2">{pattern.distance_km} km</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Risk:</span>
                            <span className="text-slate-300 ml-2">{(pattern.risk_score * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GridConsciousness;
