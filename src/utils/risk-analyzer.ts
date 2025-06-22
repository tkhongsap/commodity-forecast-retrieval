/**
 * Risk Analysis and AI Integration Utility
 * 
 * Provides comprehensive risk assessment functionality for commodity forecasting
 * by integrating with OpenAI to analyze market conditions, geopolitical factors,
 * supply/demand dynamics, and other risk factors that could impact price forecasts.
 * 
 * Features:
 * - Single strategic OpenAI query for all time horizons
 * - Risk factor parsing and quantification
 * - Confidence level assignment
 * - Percentage adjustment calculations
 * - Error handling and fallback strategies
 * 
 * @author Risk Analysis Module
 * @version 1.0.0
 */

import { RiskAdjustment, SourceInfo } from '../types/commodity';

/**
 * Risk analysis options for customizing the assessment
 */
export interface RiskAnalysisOptions {
  /** Time horizons to analyze (in months) */
  timeHorizons?: number[];
  /** Commodity symbol for context */
  commoditySymbol?: string;
  /** Include geopolitical risk assessment */
  includeGeopolitical?: boolean;
  /** Include supply/demand analysis */
  includeSupplyDemand?: boolean;
  /** Include economic factors */
  includeEconomic?: boolean;
  /** Include weather/seasonal factors */
  includeWeather?: boolean;
  /** Include regulatory risk assessment */
  includeRegulatory?: boolean;
  /** Maximum confidence threshold for adjustments */
  maxConfidenceThreshold?: number;
  /** Enable fallback to historical patterns if AI fails */
  enableFallback?: boolean;
}

/**
 * OpenAI response structure for risk analysis
 */
export interface OpenAIRiskResponse {
  /** Analysis for each time horizon */
  horizonAnalysis: {
    [horizon: string]: {
      riskFactors: string[];
      adjustmentDirection: 'bullish' | 'bearish' | 'neutral';
      adjustmentMagnitude: number; // 0-100 percentage
      confidence: number; // 0-100 percentage
      reasoning: string;
    };
  };
  /** Overall market sentiment */
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  /** Key risk factors identified */
  keyRiskFactors: string[];
  /** Analysis timestamp */
  analysisTimestamp: string;
}

/**
 * Risk analysis result containing all adjustments and metadata
 */
export interface RiskAnalysisResult {
  /** Array of risk adjustments for different horizons */
  riskAdjustments: RiskAdjustment[];
  /** Overall analysis confidence (0-1 scale) */
  overallConfidence: number;
  /** Analysis timestamp */
  analysisTimestamp: string;
  /** Key risk factors identified */
  keyRiskFactors: string[];
  /** Whether fallback methods were used */
  usedFallback: boolean;
  /** Source information */
  sources: SourceInfo[];
  /** API cost information */
  apiCost?: {
    tokensUsed: number;
    estimatedCost: number;
    currency: string;
  };
}

/**
 * Risk category definitions with impact ranges
 */
export const RISK_CATEGORIES = {
  GEOPOLITICAL: {
    category: 'geopolitical',
    maxImpact: 0.15, // 15% maximum adjustment
    typicalRange: [0.02, 0.08], // 2-8% typical range
    factors: [
      'international sanctions',
      'trade wars',
      'regional conflicts',
      'diplomatic tensions',
      'political instability'
    ]
  },
  SUPPLY_DEMAND: {
    category: 'supply_demand',
    maxImpact: 0.25, // 25% maximum adjustment
    typicalRange: [0.03, 0.12], // 3-12% typical range
    factors: [
      'production cuts',
      'demand spikes',
      'supply disruptions',
      'inventory levels',
      'seasonal patterns'
    ]
  },
  ECONOMIC: {
    category: 'economic',
    maxImpact: 0.20, // 20% maximum adjustment
    typicalRange: [0.02, 0.10], // 2-10% typical range
    factors: [
      'interest rates',
      'inflation',
      'currency fluctuations',
      'economic growth',
      'monetary policy'
    ]
  },
  WEATHER: {
    category: 'weather',
    maxImpact: 0.30, // 30% maximum adjustment (highest for weather-sensitive commodities)
    typicalRange: [0.05, 0.15], // 5-15% typical range
    factors: [
      'extreme weather events',
      'seasonal patterns',
      'climate change impacts',
      'natural disasters',
      'drought conditions'
    ]
  },
  REGULATORY: {
    category: 'regulatory',
    maxImpact: 0.18, // 18% maximum adjustment
    typicalRange: [0.02, 0.09], // 2-9% typical range
    factors: [
      'policy changes',
      'environmental regulations',
      'safety standards',
      'tax policy',
      'trade agreements'
    ]
  }
} as const;

/**
 * Risk Analysis Utility Class
 */
export class RiskAnalyzer {
  private openAIApiKey: string | null;
  private fallbackEnabled: boolean;
  private logger: Console;

  constructor(options: { openAIApiKey?: string; enableFallback?: boolean } = {}) {
    this.openAIApiKey = options.openAIApiKey || process.env.OPENAI_API_KEY || null;
    this.fallbackEnabled = options.enableFallback ?? true;
    this.logger = console;
  }

  /**
   * Perform comprehensive risk analysis for commodity forecasting
   * 
   * @param currentPrice - Current commodity price
   * @param commodity - Commodity symbol/name
   * @param options - Risk analysis options
   * @returns Promise resolving to risk analysis result
   */
  async analyzeRisks(
    currentPrice: number,
    commodity: string,
    options: RiskAnalysisOptions = {}
  ): Promise<RiskAnalysisResult> {
    try {
      this.logger.log(`[RiskAnalyzer] Starting risk analysis for ${commodity} at $${currentPrice}`);

      const {
        timeHorizons = [3, 6, 12, 24],
        commoditySymbol = commodity,
        includeGeopolitical = true,
        includeSupplyDemand = true,
        includeEconomic = true,
        includeWeather = true,
        includeRegulatory = true,
        maxConfidenceThreshold = 0.8,
        enableFallback = this.fallbackEnabled
      } = options;

      let riskAnalysisResult: RiskAnalysisResult;

      // Try OpenAI analysis first
      if (this.openAIApiKey) {
        try {
          riskAnalysisResult = await this.performOpenAIAnalysis(
            currentPrice,
            commoditySymbol,
            timeHorizons,
            {
              includeGeopolitical,
              includeSupplyDemand,
              includeEconomic,
              includeWeather,
              includeRegulatory,
              maxConfidenceThreshold
            }
          );
          
          this.logger.log(`[RiskAnalyzer] OpenAI analysis completed successfully`);
          
        } catch (error) {
          this.logger.error(`[RiskAnalyzer] OpenAI analysis failed:`, error);
          
          if (enableFallback) {
            this.logger.log(`[RiskAnalyzer] Falling back to pattern-based analysis`);
            riskAnalysisResult = await this.performFallbackAnalysis(
              currentPrice,
              commoditySymbol,
              timeHorizons,
              options
            );
          } else {
            throw error;
          }
        }
      } else {
        if (enableFallback) {
          this.logger.log(`[RiskAnalyzer] No OpenAI API key, using fallback analysis`);
          riskAnalysisResult = await this.performFallbackAnalysis(
            currentPrice,
            commoditySymbol,
            timeHorizons,
            options
          );
        } else {
          throw new Error('OpenAI API key not provided and fallback disabled');
        }
      }

      // Validate and normalize results
      riskAnalysisResult = this.validateAndNormalizeResults(riskAnalysisResult, maxConfidenceThreshold);

      this.logger.log(`[RiskAnalyzer] Risk analysis completed for ${commodity}`);
      return riskAnalysisResult;

    } catch (error) {
      this.logger.error(`[RiskAnalyzer] Risk analysis failed for ${commodity}:`, error);
      throw new Error(`Risk analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Perform OpenAI-based risk analysis
   */
  private async performOpenAIAnalysis(
    currentPrice: number,
    commodity: string,
    timeHorizons: number[],
    analysisConfig: {
      includeGeopolitical: boolean;
      includeSupplyDemand: boolean;
      includeEconomic: boolean;
      includeWeather: boolean;
      includeRegulatory: boolean;
      maxConfidenceThreshold: number;
    }
  ): Promise<RiskAnalysisResult> {
    const prompt = this.buildOpenAIPrompt(currentPrice, commodity, timeHorizons, analysisConfig);
    
    // Make OpenAI API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a expert commodity risk analyst. Provide structured JSON responses only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content) as OpenAIRiskResponse;

    // Convert OpenAI response to risk adjustments
    return this.parseOpenAIResponse(aiResponse, commodity, timeHorizons, {
      tokensUsed: data.usage?.total_tokens || 0,
      estimatedCost: (data.usage?.total_tokens || 0) * 0.00003, // Approximate GPT-4 cost
      currency: 'USD'
    });
  }

  /**
   * Build comprehensive OpenAI prompt for risk analysis
   */
  private buildOpenAIPrompt(
    currentPrice: number,
    commodity: string,
    timeHorizons: number[],
    config: any
  ): string {
    const today = new Date().toISOString().split('T')[0];
    
    return `
Analyze commodity risk factors for ${commodity} currently trading at $${currentPrice} as of ${today}.

Provide risk assessment for time horizons: ${timeHorizons.join(', ')} months ahead.

Consider these risk categories:
${config.includeGeopolitical ? '- Geopolitical risks (sanctions, conflicts, trade wars)' : ''}
${config.includeSupplyDemand ? '- Supply/demand dynamics (production, inventory, seasonal patterns)' : ''}
${config.includeEconomic ? '- Economic factors (interest rates, inflation, currency)' : ''}
${config.includeWeather ? '- Weather/climate factors (seasonal patterns, extreme events)' : ''}
${config.includeRegulatory ? '- Regulatory changes (policy, environmental, trade agreements)' : ''}

Return JSON in this exact format:
{
  "horizonAnalysis": {
    "3": {
      "riskFactors": ["factor1", "factor2"],
      "adjustmentDirection": "bullish|bearish|neutral",
      "adjustmentMagnitude": 5.2,
      "confidence": 75,
      "reasoning": "Brief explanation"
    },
    "6": { ... },
    "12": { ... },
    "24": { ... }
  },
  "overallSentiment": "bullish|bearish|neutral",
  "keyRiskFactors": ["key factor 1", "key factor 2"],
  "analysisTimestamp": "${new Date().toISOString()}"
}

Guidelines:
- adjustmentMagnitude: 0-30 (percentage points)
- confidence: 0-100 (percentage)
- Be conservative with adjustments
- Consider time horizon impact (longer = more uncertainty)
`;
  }

  /**
   * Parse OpenAI response into risk adjustments
   */
  private parseOpenAIResponse(
    aiResponse: OpenAIRiskResponse,
    commodity: string,
    timeHorizons: number[],
    apiCost: { tokensUsed: number; estimatedCost: number; currency: string }
  ): RiskAnalysisResult {
    const riskAdjustments: RiskAdjustment[] = [];
    let totalConfidence = 0;

    for (const horizon of timeHorizons) {
      const analysis = aiResponse.horizonAnalysis[horizon.toString()];
      if (!analysis) continue;

      // Convert adjustment magnitude and direction to percentage
      const adjustmentFactor = this.calculateAdjustmentFactor(
        analysis.adjustmentDirection,
        analysis.adjustmentMagnitude
      );

      // Determine risk type based on primary risk factors
      const riskType = this.determineRiskType(analysis.riskFactors);

      const riskAdjustment: RiskAdjustment = {
        riskType,
        adjustmentFactor,
        confidenceImpact: (analysis.confidence / 100) - 0.5, // Convert to -0.5 to 0.5 range
        description: analysis.reasoning,
        methodology: 'OpenAI GPT-4 Risk Analysis',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + horizon * 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        sources: [{
          name: 'OpenAI GPT-4 Analysis',
          date: aiResponse.analysisTimestamp,
          reliability: 'high'
        }]
      };

      riskAdjustments.push(riskAdjustment);
      totalConfidence += analysis.confidence;
    }

    return {
      riskAdjustments,
      overallConfidence: totalConfidence / timeHorizons.length / 100, // Average confidence 0-1
      analysisTimestamp: aiResponse.analysisTimestamp,
      keyRiskFactors: aiResponse.keyRiskFactors,
      usedFallback: false,
      sources: [{
        name: 'OpenAI Risk Analysis',
        date: aiResponse.analysisTimestamp,
        reliability: 'high'
      }],
      apiCost
    };
  }

  /**
   * Calculate adjustment factor from direction and magnitude
   */
  private calculateAdjustmentFactor(
    direction: 'bullish' | 'bearish' | 'neutral',
    magnitude: number
  ): number {
    const normalizedMagnitude = Math.min(magnitude / 100, 0.30); // Cap at 30%
    
    switch (direction) {
      case 'bullish':
        return normalizedMagnitude;
      case 'bearish':
        return -normalizedMagnitude;
      case 'neutral':
      default:
        return 0;
    }
  }

  /**
   * Determine primary risk type from risk factors
   */
  private determineRiskType(riskFactors: string[]): RiskAdjustment['riskType'] {
    const factorText = riskFactors.join(' ').toLowerCase();
    
    if (factorText.includes('geopolitical') || factorText.includes('war') || factorText.includes('sanction')) {
      return 'geopolitical';
    } else if (factorText.includes('supply') || factorText.includes('demand') || factorText.includes('production')) {
      return 'supply_demand';
    } else if (factorText.includes('economic') || factorText.includes('inflation') || factorText.includes('interest')) {
      return 'economic';
    } else if (factorText.includes('weather') || factorText.includes('climate') || factorText.includes('seasonal')) {
      return 'weather';
    } else if (factorText.includes('regulatory') || factorText.includes('policy') || factorText.includes('regulation')) {
      return 'regulatory';
    } else {
      return 'economic'; // Default fallback
    }
  }

  /**
   * Perform fallback analysis using historical patterns and basic rules
   */
  private async performFallbackAnalysis(
    currentPrice: number,
    commodity: string,
    timeHorizons: number[],
    options: RiskAnalysisOptions
  ): Promise<RiskAnalysisResult> {
    this.logger.log(`[RiskAnalyzer] Performing fallback pattern-based analysis`);

    const riskAdjustments: RiskAdjustment[] = [];
    const baseVolatility = this.getCommodityBaseVolatility(commodity);
    
    for (const horizon of timeHorizons) {
      // Simple rule-based risk assessment
      const timeDecay = Math.sqrt(horizon / 12); // Uncertainty increases with time
      const adjustmentMagnitude = baseVolatility * timeDecay * 0.5; // Conservative adjustment
      
      const riskAdjustment: RiskAdjustment = {
        riskType: 'economic',
        adjustmentFactor: Math.random() > 0.5 ? adjustmentMagnitude : -adjustmentMagnitude,
        confidenceImpact: -0.2, // Lower confidence for fallback
        description: `Fallback analysis based on historical volatility patterns for ${horizon}-month horizon`,
        methodology: 'Pattern-based Historical Analysis',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + horizon * 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        sources: [{
          name: 'Historical Pattern Analysis',
          date: new Date().toISOString(),
          reliability: 'medium'
        }]
      };

      riskAdjustments.push(riskAdjustment);
    }

    return {
      riskAdjustments,
      overallConfidence: 0.6, // Lower confidence for fallback
      analysisTimestamp: new Date().toISOString(),
      keyRiskFactors: ['Market uncertainty', 'Historical volatility patterns'],
      usedFallback: true,
      sources: [{
        name: 'Fallback Pattern Analysis',
        date: new Date().toISOString(),
        reliability: 'medium'
      }]
    };
  }

  /**
   * Get base volatility for different commodities
   */
  private getCommodityBaseVolatility(commodity: string): number {
    const volatilityMap: Record<string, number> = {
      'CL': 0.25, // Crude oil - high volatility
      'GC': 0.15, // Gold - medium volatility
      'NG': 0.35, // Natural gas - very high volatility
      'SI': 0.20, // Silver - medium-high volatility
      'HG': 0.18  // Copper - medium volatility
    };

    const baseSymbol = commodity.replace('=F', '').replace(/[0-9]/g, '').substring(0, 2);
    return volatilityMap[baseSymbol] || 0.20; // Default 20% volatility
  }

  /**
   * Validate and normalize risk analysis results
   */
  private validateAndNormalizeResults(
    result: RiskAnalysisResult,
    maxConfidenceThreshold: number
  ): RiskAnalysisResult {
    // Cap confidence levels
    result.overallConfidence = Math.min(result.overallConfidence, maxConfidenceThreshold);
    
    // Validate adjustment factors are within reasonable bounds
    result.riskAdjustments = result.riskAdjustments.map(adjustment => {
      const category = RISK_CATEGORIES[adjustment.riskType.toUpperCase() as keyof typeof RISK_CATEGORIES];
      if (category) {
        // Cap adjustment factor to category maximum
        const maxImpact = category.maxImpact;
        adjustment.adjustmentFactor = Math.max(
          Math.min(adjustment.adjustmentFactor, maxImpact),
          -maxImpact
        );
      }
      return adjustment;
    });

    return result;
  }

  /**
   * Get risk factor categories and their configurations
   */
  static getRiskCategories() {
    return RISK_CATEGORIES;
  }

  /**
   * Validate risk adjustment within acceptable bounds
   */
  static validateRiskAdjustment(adjustment: RiskAdjustment): boolean {
    const category = RISK_CATEGORIES[adjustment.riskType.toUpperCase() as keyof typeof RISK_CATEGORIES];
    if (!category) return false;

    const absAdjustment = Math.abs(adjustment.adjustmentFactor);
    return absAdjustment <= category.maxImpact;
  }
}

/**
 * Convenience function to create a risk analyzer instance
 */
export function createRiskAnalyzer(options: { openAIApiKey?: string; enableFallback?: boolean } = {}): RiskAnalyzer {
  return new RiskAnalyzer(options);
}

/**
 * Export default risk analyzer instance
 */
export default RiskAnalyzer;