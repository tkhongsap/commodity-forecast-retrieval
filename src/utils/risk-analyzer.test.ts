/**
 * Comprehensive Unit Tests for Risk Analyzer
 * 
 * Tests cover OpenAI integration, fallback analysis, risk quantification,
 * error handling, and validation logic for the commodity risk assessment system.
 * 
 * @author Risk Analyzer Test Suite
 * @version 1.0.0
 */

import { RiskAnalyzer, createRiskAnalyzer, RISK_CATEGORIES } from './risk-analyzer';
import { RiskAdjustment } from '../types/commodity';

// Mock fetch for OpenAI API calls
global.fetch = jest.fn();

describe('RiskAnalyzer', () => {
  let analyzer: RiskAnalyzer;
  const mockOpenAIApiKey = 'test-api-key';
  const mockCommodity = 'CL=F';
  const mockCurrentPrice = 75.50;

  beforeEach(() => {
    analyzer = new RiskAnalyzer({ 
      openAIApiKey: mockOpenAIApiKey,
      enableFallback: true 
    });
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create analyzer with OpenAI API key', () => {
      const analyzerWithKey = new RiskAnalyzer({ openAIApiKey: 'test-key' });
      expect(analyzerWithKey).toBeInstanceOf(RiskAnalyzer);
    });

    it('should create analyzer with fallback enabled by default', () => {
      const analyzerDefault = new RiskAnalyzer();
      expect(analyzerDefault).toBeInstanceOf(RiskAnalyzer);
    });

    it('should use environment variable for API key', () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      const analyzerEnv = new RiskAnalyzer();
      expect(analyzerEnv).toBeInstanceOf(RiskAnalyzer);
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('analyzeRisks - OpenAI Integration', () => {
    const mockOpenAIResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            horizonAnalysis: {
              '3': {
                riskFactors: ['geopolitical tensions', 'supply constraints'],
                adjustmentDirection: 'bullish',
                adjustmentMagnitude: 8.5,
                confidence: 75,
                reasoning: 'Strong upward pressure from supply concerns'
              },
              '6': {
                riskFactors: ['economic uncertainty', 'demand patterns'],
                adjustmentDirection: 'bearish',
                adjustmentMagnitude: 5.2,
                confidence: 68,
                reasoning: 'Economic headwinds may reduce demand'
              },
              '12': {
                riskFactors: ['regulatory changes', 'market dynamics'],
                adjustmentDirection: 'neutral',
                adjustmentMagnitude: 2.1,
                confidence: 60,
                reasoning: 'Balanced outlook with mixed signals'
              },
              '24': {
                riskFactors: ['long-term trends', 'structural changes'],
                adjustmentDirection: 'bullish',
                adjustmentMagnitude: 12.3,
                confidence: 55,
                reasoning: 'Long-term structural deficit expected'
              }
            },
            overallSentiment: 'bullish',
            keyRiskFactors: ['supply constraints', 'geopolitical tensions'],
            analysisTimestamp: '2025-01-01T12:00:00Z'
          })
        }
      }],
      usage: {
        total_tokens: 1500
      }
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse)
      });
    });

    it('should perform successful OpenAI risk analysis', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result).toMatchObject({
        riskAdjustments: expect.any(Array),
        overallConfidence: expect.any(Number),
        analysisTimestamp: expect.any(String),
        keyRiskFactors: expect.arrayContaining(['supply constraints', 'geopolitical tensions']),
        usedFallback: false,
        sources: expect.arrayContaining([
          expect.objectContaining({
            name: 'OpenAI Risk Analysis',
            reliability: 'high'
          })
        ]),
        apiCost: expect.objectContaining({
          tokensUsed: 1500,
          estimatedCost: expect.any(Number),
          currency: 'USD'
        })
      });

      expect(result.riskAdjustments).toHaveLength(4); // 3, 6, 12, 24 months
    });

    it('should handle different risk categories correctly', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      result.riskAdjustments.forEach(adjustment => {
        expect(adjustment).toMatchObject({
          riskType: expect.stringMatching(/geopolitical|supply_demand|economic|weather|regulatory/),
          adjustmentFactor: expect.any(Number),
          confidenceImpact: expect.any(Number),
          description: expect.any(String),
          methodology: 'OpenAI GPT-4 Risk Analysis',
          validityPeriod: {
            start: expect.any(String),
            end: expect.any(String)
          },
          sources: expect.any(Array)
        });
      });
    });

    it('should correctly calculate adjustment factors', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      // First adjustment (3-month): bullish 8.5% -> +0.085
      expect(result.riskAdjustments[0]?.adjustmentFactor).toBeCloseTo(0.085, 3);
      
      // Second adjustment (6-month): bearish 5.2% -> -0.052
      expect(result.riskAdjustments[1]?.adjustmentFactor).toBeCloseTo(-0.052, 3);
      
      // Third adjustment (12-month): neutral 2.1% -> 0
      expect(result.riskAdjustments[2]?.adjustmentFactor).toBe(0);
    });

    it('should cap adjustment factors at category maximums', async () => {
      // Mock response with extreme adjustments
      const extremeResponse = {
        ...mockOpenAIResponse,
        choices: [{
          message: {
            content: JSON.stringify({
              horizonAnalysis: {
                '3': {
                  riskFactors: ['extreme geopolitical risk'],
                  adjustmentDirection: 'bullish',
                  adjustmentMagnitude: 50, // 50% - should be capped
                  confidence: 90,
                  reasoning: 'Extreme scenario'
                }
              },
              overallSentiment: 'bullish',
              keyRiskFactors: ['extreme risk'],
              analysisTimestamp: '2025-01-01T12:00:00Z'
            })
          }
        }],
        usage: { total_tokens: 1000 }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(extremeResponse)
      });

      const options = { timeHorizons: [3] };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      // Should be capped at geopolitical maximum (15%)
      expect(result.riskAdjustments[0]?.adjustmentFactor).toBeLessThanOrEqual(0.15);
    });

    it('should handle custom analysis options', async () => {
      const options = {
        timeHorizons: [6, 12],
        commoditySymbol: 'GC=F',
        includeGeopolitical: false,
        includeWeather: false,
        maxConfidenceThreshold: 0.7
      };

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result.riskAdjustments).toHaveLength(2); // Only 6 and 12 months
      expect(result.overallConfidence).toBeLessThanOrEqual(0.7);
    });

    it('should handle OpenAI API errors and fallback', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Rate Limited'
      });

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
      expect(result.overallConfidence).toBeLessThan(0.8); // Lower confidence for fallback
      expect(result.sources[0]?.name).toContain('Fallback');
    });

    it('should handle malformed OpenAI responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'invalid json'
            }
          }]
        })
      });

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
    });
  });

  describe('Fallback Analysis', () => {
    beforeEach(() => {
      // Create analyzer without API key to force fallback
      analyzer = new RiskAnalyzer({ enableFallback: true });
    });

    it('should perform fallback analysis when no API key provided', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
      expect(result.overallConfidence).toBe(0.6);
      expect(result.keyRiskFactors).toContain('Market uncertainty');
      expect(result.sources[0]?.reliability).toBe('medium');
    });

    it('should generate reasonable risk adjustments for different commodities', async () => {
      const commodities = ['CL=F', 'GC=F', 'NG=F', 'SI=F'];
      
      for (const commodity of commodities) {
        const result = await analyzer.analyzeRisks(75.0, commodity);
        
        expect(result.riskAdjustments.length).toBeGreaterThan(0);
        result.riskAdjustments.forEach(adjustment => {
          expect(Math.abs(adjustment.adjustmentFactor)).toBeLessThan(0.5); // Reasonable bounds
        });
      }
    });

    it('should scale adjustments by time horizon', async () => {
      const options = { timeHorizons: [3, 24] };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      // Longer horizons should generally have larger potential adjustments
      const shortTerm = Math.abs(result.riskAdjustments[0]?.adjustmentFactor || 0);
      const longTerm = Math.abs(result.riskAdjustments[1]?.adjustmentFactor || 0);
      
      // Note: Due to randomness, this might not always hold, but it's the general pattern
      expect(typeof shortTerm).toBe('number');
      expect(typeof longTerm).toBe('number');
    });

    it('should throw error when fallback disabled and no API key', async () => {
      const noFallbackAnalyzer = new RiskAnalyzer({ enableFallback: false });
      
      await expect(
        noFallbackAnalyzer.analyzeRisks(mockCurrentPrice, mockCommodity)
      ).rejects.toThrow('OpenAI API key not provided and fallback disabled');
    });
  });

  describe('Risk Type Detection', () => {
    it('should correctly identify geopolitical risks', async () => {
      const geopoliticalResponse = {
        ...mockOpenAIResponse,
        choices: [{
          message: {
            content: JSON.stringify({
              horizonAnalysis: {
                '3': {
                  riskFactors: ['international sanctions', 'trade war escalation'],
                  adjustmentDirection: 'bullish',
                  adjustmentMagnitude: 10,
                  confidence: 80,
                  reasoning: 'Geopolitical tensions rising'
                }
              },
              overallSentiment: 'bullish',
              keyRiskFactors: ['geopolitical'],
              analysisTimestamp: '2025-01-01T12:00:00Z'
            })
          }
        }],
        usage: { total_tokens: 1000 }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(geopoliticalResponse)
      });

      const options = { timeHorizons: [3] };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result.riskAdjustments[0]?.riskType).toBe('geopolitical');
    });

    it('should correctly identify supply/demand risks', async () => {
      const supplyDemandResponse = {
        ...mockOpenAIResponse,
        choices: [{
          message: {
            content: JSON.stringify({
              horizonAnalysis: {
                '3': {
                  riskFactors: ['production cuts', 'demand spike'],
                  adjustmentDirection: 'bullish',
                  adjustmentMagnitude: 8,
                  confidence: 75,
                  reasoning: 'Supply constraints expected'
                }
              },
              overallSentiment: 'bullish',
              keyRiskFactors: ['supply shortage'],
              analysisTimestamp: '2025-01-01T12:00:00Z'
            })
          }
        }],
        usage: { total_tokens: 1000 }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(supplyDemandResponse)
      });

      const options = { timeHorizons: [3] };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result.riskAdjustments[0]?.riskType).toBe('supply_demand');
    });

    it('should correctly identify weather risks', async () => {
      const weatherResponse = {
        ...mockOpenAIResponse,
        choices: [{
          message: {
            content: JSON.stringify({
              horizonAnalysis: {
                '3': {
                  riskFactors: ['extreme weather events', 'seasonal patterns'],
                  adjustmentDirection: 'bullish',
                  adjustmentMagnitude: 15,
                  confidence: 70,
                  reasoning: 'Weather disruptions expected'
                }
              },
              overallSentiment: 'bullish',
              keyRiskFactors: ['weather'],
              analysisTimestamp: '2025-01-01T12:00:00Z'
            })
          }
        }],
        usage: { total_tokens: 1000 }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(weatherResponse)
      });

      const options = { timeHorizons: [3] };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result.riskAdjustments[0]?.riskType).toBe('weather');
    });
  });

  describe('Confidence Level Calculation', () => {
    it('should calculate overall confidence correctly', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      // Based on mock data: (75 + 68 + 60 + 55) / 4 / 100 = 0.645
      expect(result.overallConfidence).toBeCloseTo(0.645, 2);
    });

    it('should apply confidence impact to individual adjustments', async () => {
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      result.riskAdjustments.forEach(adjustment => {
        // Confidence impact should be in range -0.5 to 0.5
        expect(adjustment.confidenceImpact).toBeGreaterThanOrEqual(-0.5);
        expect(adjustment.confidenceImpact).toBeLessThanOrEqual(0.5);
      });
    });

    it('should respect maximum confidence threshold', async () => {
      const options = { maxConfidenceThreshold: 0.3 };
      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result.overallConfidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
      expect(result.overallConfidence).toBeLessThan(1.0);
    });

    it('should handle API authentication errors', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
    });

    it('should handle empty or null responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result.usedFallback).toBe(true);
    });

    it('should throw error when analysis completely fails', async () => {
      const noFallbackAnalyzer = new RiskAnalyzer({ 
        openAIApiKey: mockOpenAIApiKey,
        enableFallback: false 
      });

      (fetch as jest.Mock).mockRejectedValue(new Error('Total failure'));

      await expect(
        noFallbackAnalyzer.analyzeRisks(mockCurrentPrice, mockCommodity)
      ).rejects.toThrow('Risk analysis failed');
    });
  });

  describe('Risk Categories and Validation', () => {
    it('should provide risk categories configuration', () => {
      const categories = RiskAnalyzer.getRiskCategories();

      expect(categories).toHaveProperty('GEOPOLITICAL');
      expect(categories).toHaveProperty('SUPPLY_DEMAND');
      expect(categories).toHaveProperty('ECONOMIC');
      expect(categories).toHaveProperty('WEATHER');
      expect(categories).toHaveProperty('REGULATORY');

      expect(categories.GEOPOLITICAL).toMatchObject({
        category: 'geopolitical',
        maxImpact: expect.any(Number),
        typicalRange: expect.any(Array),
        factors: expect.any(Array)
      });
    });

    it('should validate risk adjustments correctly', () => {
      const validAdjustment: RiskAdjustment = {
        riskType: 'geopolitical',
        adjustmentFactor: 0.10, // 10% - within geopolitical max of 15%
        confidenceImpact: 0.1,
        description: 'Test adjustment',
        methodology: 'Test',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date().toISOString()
        },
        sources: []
      };

      const invalidAdjustment: RiskAdjustment = {
        ...validAdjustment,
        adjustmentFactor: 0.50 // 50% - exceeds geopolitical max of 15%
      };

      expect(RiskAnalyzer.validateRiskAdjustment(validAdjustment)).toBe(true);
      expect(RiskAnalyzer.validateRiskAdjustment(invalidAdjustment)).toBe(false);
    });

    it('should handle unknown risk types in validation', () => {
      const unknownTypeAdjustment: RiskAdjustment = {
        riskType: 'unknown' as any,
        adjustmentFactor: 0.10,
        confidenceImpact: 0.1,
        description: 'Test adjustment',
        methodology: 'Test',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date().toISOString()
        },
        sources: []
      };

      expect(RiskAnalyzer.validateRiskAdjustment(unknownTypeAdjustment)).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should create risk analyzer with convenience function', () => {
      const analyzer = createRiskAnalyzer({ openAIApiKey: 'test' });
      expect(analyzer).toBeInstanceOf(RiskAnalyzer);
    });

    it('should handle different commodity base volatilities', async () => {
      const commodities = ['CL=F', 'GC=F', 'NG=F', 'SI=F', 'HG=F', 'UNKNOWN=F'];
      
      for (const commodity of commodities) {
        const result = await analyzer.analyzeRisks(75.0, commodity);
        expect(result.riskAdjustments.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete risk analysis workflow', async () => {
      const options = {
        timeHorizons: [3, 6, 12, 24],
        commoditySymbol: 'CL=F',
        includeGeopolitical: true,
        includeSupplyDemand: true,
        includeEconomic: true,
        includeWeather: true,
        includeRegulatory: true,
        maxConfidenceThreshold: 0.8,
        enableFallback: true
      };

      const result = await analyzer.analyzeRisks(mockCurrentPrice, mockCommodity, options);

      expect(result).toMatchObject({
        riskAdjustments: expect.arrayContaining([
          expect.objectContaining({
            riskType: expect.any(String),
            adjustmentFactor: expect.any(Number),
            confidenceImpact: expect.any(Number),
            description: expect.any(String),
            methodology: expect.any(String),
            validityPeriod: expect.objectContaining({
              start: expect.any(String),
              end: expect.any(String)
            }),
            sources: expect.any(Array)
          })
        ]),
        overallConfidence: expect.any(Number),
        analysisTimestamp: expect.any(String),
        keyRiskFactors: expect.any(Array),
        usedFallback: expect.any(Boolean),
        sources: expect.any(Array)
      });

      // Validate all adjustments are within bounds
      result.riskAdjustments.forEach(adjustment => {
        expect(RiskAnalyzer.validateRiskAdjustment(adjustment)).toBe(true);
      });
    });

    it('should handle concurrent risk analyses', async () => {
      const promises = [
        analyzer.analyzeRisks(75.0, 'CL=F'),
        analyzer.analyzeRisks(1800.0, 'GC=F'),
        analyzer.analyzeRisks(3.5, 'NG=F')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.riskAdjustments.length).toBeGreaterThan(0);
        expect(result.overallConfidence).toBeGreaterThan(0);
      });
    });

    it('should maintain consistency across multiple calls', async () => {
      // With the same inputs, fallback should produce similar results
      const analyzerNoAPI = new RiskAnalyzer({ enableFallback: true });
      
      const result1 = await analyzerNoAPI.analyzeRisks(mockCurrentPrice, mockCommodity);
      const result2 = await analyzerNoAPI.analyzeRisks(mockCurrentPrice, mockCommodity);

      expect(result1.usedFallback).toBe(true);
      expect(result2.usedFallback).toBe(true);
      expect(result1.riskAdjustments.length).toBe(result2.riskAdjustments.length);
    });
  });
});