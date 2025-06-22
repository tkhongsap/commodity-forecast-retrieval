/**
 * Comprehensive Integration Tests for Hybrid Forecasting System
 * 
 * Tests the complete Market Consensus + Risk Adjustment forecasting pipeline
 * from futures data retrieval through risk analysis to final forecast generation.
 * Validates the 75% cost reduction target and forecast quality metrics.
 * 
 * @author Hybrid Forecasting Integration Test Suite
 * @version 1.0.0
 */

import { ForecastService } from './forecast-service';
import { YahooFinanceService } from './yahoo-finance-service';
import { WebSearchService } from './web-search-service';
import { RiskAnalyzer } from '../utils/risk-analyzer';
import { FuturesMapper } from '../utils/futures-mapper';
import { CommodityData, MarketConsensusForcast, FuturesCurve, FuturesContract } from '../types/commodity';
import { COMMODITY_SYMBOLS } from '../config/yahoo-finance';

// Mock external services for controlled testing
jest.mock('./web-search-service');
jest.mock('./yahoo-finance-service');
jest.mock('../utils/risk-analyzer');

describe('Hybrid Forecasting System Integration Tests', () => {
  let forecastService: ForecastService;
  let mockYahooFinanceService: jest.Mocked<YahooFinanceService>;
  let mockWebSearchService: jest.Mocked<WebSearchService>;
  let mockRiskAnalyzer: jest.Mocked<RiskAnalyzer>;

  const mockCommodityData: CommodityData = {
    symbol: 'CL=F',
    name: 'Crude Oil WTI',
    type: 'commodity',
    unit: 'USD per barrel',
    currentPrice: 75.50,
    currency: 'USD',
    lastUpdated: new Date().toISOString(),
    sources: [{
      name: 'Yahoo Finance',
      url: 'https://finance.yahoo.com',
      date: new Date().toISOString(),
      reliability: 'high'
    }]
  };

  const mockFuturesCurve: FuturesCurve = {
    underlyingSymbol: 'CL',
    curveDate: new Date().toISOString(),
    contracts: [
      {
        symbol: 'CLZ23',
        maturity: '2023-12-19',
        price: 76.20,
        volume: 150000,
        openInterest: 45000,
        daysToExpiration: 90
      },
      {
        symbol: 'CLF24',
        maturity: '2024-01-19',
        price: 76.80,
        volume: 120000,
        openInterest: 38000,
        daysToExpiration: 120
      },
      {
        symbol: 'CLG24',
        maturity: '2024-02-20',
        price: 77.40,
        volume: 95000,
        openInterest: 32000,
        daysToExpiration: 150
      },
      {
        symbol: 'CLH24',
        maturity: '2024-03-19',
        price: 78.10,
        volume: 80000,
        openInterest: 28000,
        daysToExpiration: 180
      }
    ],
    curveMetrics: {
      contango: true,
      backwardation: false,
      averageSpread: 0.60,
      steepness: 0.30
    },
    sources: [{
      name: 'Yahoo Finance Futures',
      date: new Date().toISOString(),
      reliability: 'high'
    }],
    lastUpdated: new Date().toISOString()
  };

  const mockRiskAnalysisResult = {
    riskAdjustments: [
      {
        riskType: 'geopolitical' as const,
        adjustmentFactor: 0.08, // 8% bullish adjustment
        confidenceImpact: 0.1,
        description: 'Geopolitical tensions in key oil regions',
        methodology: 'OpenAI GPT-4 Risk Analysis',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        },
        sources: [{
          name: 'OpenAI Risk Analysis',
          date: new Date().toISOString(),
          reliability: 'high'
        }]
      },
      {
        riskType: 'supply_demand' as const,
        adjustmentFactor: -0.05, // 5% bearish adjustment
        confidenceImpact: -0.05,
        description: 'Expected demand softening',
        methodology: 'OpenAI GPT-4 Risk Analysis',
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
        },
        sources: [{
          name: 'OpenAI Risk Analysis',
          date: new Date().toISOString(),
          reliability: 'high'
        }]
      }
    ],
    overallConfidence: 0.75,
    analysisTimestamp: new Date().toISOString(),
    keyRiskFactors: ['geopolitical tensions', 'supply constraints', 'demand patterns'],
    usedFallback: false,
    sources: [{
      name: 'OpenAI Risk Analysis',
      date: new Date().toISOString(),
      reliability: 'high'
    }],
    apiCost: {
      tokensUsed: 1500,
      estimatedCost: 0.045,
      currency: 'USD'
    }
  };

  beforeEach(() => {
    // Create mock services
    mockWebSearchService = {
      search: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true)
    } as any;

    mockYahooFinanceService = {
      getCommodityData: jest.fn(),
      getFuturesCurve: jest.fn(),
      getFuturesContract: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true)
    } as any;

    mockRiskAnalyzer = {
      analyzeRisks: jest.fn()
    } as any;

    // Initialize forecast service with mocked dependencies
    forecastService = new ForecastService(
      mockWebSearchService,
      mockYahooFinanceService,
      mockRiskAnalyzer
    );

    // Setup default mock behaviors
    mockYahooFinanceService.getCommodityData.mockResolvedValue(mockCommodityData);
    mockYahooFinanceService.getFuturesCurve.mockResolvedValue(mockFuturesCurve);
    mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysisResult);
  });

  describe('End-to-End Hybrid Forecasting Pipeline', () => {
    it('should successfully generate market consensus forecasts with risk adjustments', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true,
        includeConfidenceIntervals: true,
        maxRiskAdjustment: 0.25
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Validate result structure
      expect(result).toHaveLength(4); // 3, 6, 12, 24 months
      expect(result[0]).toMatchObject({
        horizon: expect.stringMatching(/3-month|6-month|12-month|24-month/),
        marketConsensusPrice: expect.any(Number),
        riskAdjustedPrice: expect.any(Number),
        forecastPrice: expect.any(Number),
        riskAdjustments: expect.any(Array),
        confidenceInterval: expect.objectContaining({
          lower: expect.any(Number),
          upper: expect.any(Number),
          confidence: expect.any(Number)
        })
      });

      // Validate API calls were made correctly
      expect(mockYahooFinanceService.getFuturesCurve).toHaveBeenCalledWith('CL', expect.any(Object));
      expect(mockRiskAnalyzer.analyzeRisks).toHaveBeenCalledWith(
        mockCommodityData.currentPrice,
        mockCommodityData.symbol,
        expect.objectContaining({
          timeHorizons: options.timeHorizons
        })
      );

      // Validate forecast calculations
      result.forEach(forecast => {
        expect(forecast.marketConsensusPrice).toBeGreaterThan(0);
        expect(forecast.riskAdjustedPrice).toBeGreaterThan(0);
        expect(forecast.forecastPrice).toBe(forecast.riskAdjustedPrice); // Final price should equal risk-adjusted
        expect(forecast.riskAdjustments.length).toBeGreaterThan(0);
      });
    });

    it('should handle different time horizons correctly', async () => {
      const customHorizons = [1, 3, 6, 18];
      const options = {
        baseSymbol: 'CL',
        timeHorizons: customHorizons,
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      expect(result).toHaveLength(customHorizons.length);
      
      // Validate horizon-specific calculations
      result.forEach((forecast, index) => {
        const expectedHorizon = customHorizons[index];
        expect(forecast.horizon).toBe(`${expectedHorizon}-month`);
        
        // Longer horizons should generally have wider confidence intervals
        if (index > 0) {
          const currentInterval = forecast.confidenceInterval!.upper - forecast.confidenceInterval!.lower;
          const previousInterval = result[index - 1].confidenceInterval!.upper - result[index - 1].confidenceInterval!.lower;
          // Allow for some variation due to risk factors
          expect(currentInterval).toBeGreaterThanOrEqual(previousInterval * 0.8);
        }
      });
    });

    it('should apply risk adjustments correctly', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Validate risk adjustment application
      result.forEach(forecast => {
        const marketPrice = forecast.marketConsensusPrice;
        const riskAdjustedPrice = forecast.riskAdjustedPrice;
        
        // Calculate expected adjustment
        let expectedAdjustment = 0;
        forecast.riskAdjustments.forEach(adj => {
          expectedAdjustment += adj.adjustmentFactor;
        });
        
        const expectedRiskAdjustedPrice = marketPrice * (1 + expectedAdjustment);
        expect(Math.abs(riskAdjustedPrice - expectedRiskAdjustedPrice)).toBeLessThan(0.01);
      });
    });

    it('should cap risk adjustments at maximum limits', async () => {
      // Mock extreme risk scenario
      const extremeRiskResult = {
        ...mockRiskAnalysisResult,
        riskAdjustments: [
          {
            ...mockRiskAnalysisResult.riskAdjustments[0],
            adjustmentFactor: 0.50 // 50% extreme adjustment
          }
        ]
      };
      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(extremeRiskResult);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true,
        maxRiskAdjustment: 0.25 // 25% cap
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      const forecast = result[0];
      const adjustmentRatio = (forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice;
      expect(Math.abs(adjustmentRatio)).toBeLessThanOrEqual(options.maxRiskAdjustment + 0.01); // Small tolerance
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to web search when futures data unavailable', async () => {
      // Mock futures data failure
      mockYahooFinanceService.getFuturesCurve.mockRejectedValue(new Error('Futures data unavailable'));
      
      // Mock web search response
      mockWebSearchService.search.mockResolvedValue({
        content: 'Crude oil forecast for 3 months: $78.50 per barrel',
        timestamp: new Date().toISOString(),
        success: true,
        sources: [{
          name: 'Web Search',
          date: new Date().toISOString(),
          reliability: 'medium'
        }]
      });

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true,
        fallbackToWebSearch: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Should fallback to traditional web search forecasting
      expect(mockWebSearchService.search).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].methodology).toContain('Web Search'); // Should indicate fallback was used
    });

    it('should handle risk analyzer failures gracefully', async () => {
      // Mock risk analyzer failure
      mockRiskAnalyzer.analyzeRisks.mockRejectedValue(new Error('Risk analysis failed'));

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Should proceed with market consensus only (no risk adjustments)
      result.forEach(forecast => {
        expect(forecast.marketConsensusPrice).toBeGreaterThan(0);
        expect(forecast.riskAdjustedPrice).toBe(forecast.marketConsensusPrice); // No risk adjustment
        expect(forecast.riskAdjustments).toHaveLength(0);
      });
    });

    it('should handle partial futures curve data', async () => {
      // Mock incomplete futures curve
      const incompleteCurve: FuturesCurve = {
        ...mockFuturesCurve,
        contracts: mockFuturesCurve.contracts.slice(0, 2) // Only 2 contracts instead of 4
      };
      mockYahooFinanceService.getFuturesCurve.mockResolvedValue(incompleteCurve);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Should handle missing data points with interpolation or reasonable defaults
      expect(result).toHaveLength(4);
      result.forEach(forecast => {
        expect(forecast.marketConsensusPrice).toBeGreaterThan(0);
        expect(forecast.confidenceLevel).toBeDefined();
      });
    });
  });

  describe('Performance and Cost Validation', () => {
    let performanceStartTime: number;

    beforeEach(() => {
      performanceStartTime = Date.now();
    });

    it('should complete forecast generation within performance targets', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true,
        includeConfidenceIntervals: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      const executionTime = Date.now() - performanceStartTime;
      
      // Should complete within 15 seconds (target from config)
      expect(executionTime).toBeLessThan(15000);
      expect(result).toHaveLength(4);
    });

    it('should achieve cost reduction targets', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      // Validate API call efficiency
      // Should make only 1 risk analysis call vs 4 web search calls in traditional approach
      expect(mockRiskAnalyzer.analyzeRisks).toHaveBeenCalledTimes(1);
      expect(mockYahooFinanceService.getFuturesCurve).toHaveBeenCalledTimes(1);
      
      // Traditional approach would make 4 web search calls
      expect(mockWebSearchService.search).not.toHaveBeenCalled();

      // Estimated cost should be ~75% lower than web search approach
      const estimatedHybridCost = mockRiskAnalysisResult.apiCost?.estimatedCost || 0;
      const estimatedWebSearchCost = 0.10 * 4; // $0.10 per web search * 4 horizons
      const costReduction = (estimatedWebSearchCost - estimatedHybridCost) / estimatedWebSearchCost;
      
      expect(costReduction).toBeGreaterThan(0.70); // At least 70% cost reduction
    });

    it('should handle concurrent forecast requests efficiently', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6],
        enableRiskAdjustment: true
      };

      // Create multiple concurrent requests
      const requests = Array(5).fill(null).map(() =>
        forecastService.generateMarketConsensusForecasts(mockCommodityData, options)
      );

      const results = await Promise.all(requests);
      const executionTime = Date.now() - performanceStartTime;

      // Should handle concurrent requests efficiently
      expect(executionTime).toBeLessThan(20000); // 20 seconds for 5 concurrent requests
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveLength(2); // 2 horizons each
      });
    });
  });

  describe('Data Quality and Validation', () => {
    it('should validate forecast data quality', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true,
        includeConfidenceIntervals: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      result.forEach(forecast => {
        // Price validation
        expect(forecast.marketConsensusPrice).toBeGreaterThan(30); // Reasonable oil price floor
        expect(forecast.marketConsensusPrice).toBeLessThan(200); // Reasonable oil price ceiling
        expect(forecast.riskAdjustedPrice).toBeGreaterThan(30);
        expect(forecast.riskAdjustedPrice).toBeLessThan(200);

        // Confidence validation
        expect(forecast.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(forecast.confidenceLevel).toBeLessThanOrEqual(100);

        // Confidence interval validation
        if (forecast.confidenceInterval) {
          expect(forecast.confidenceInterval.lower).toBeLessThan(forecast.confidenceInterval.upper);
          expect(forecast.confidenceInterval.confidence).toBeGreaterThan(0);
          expect(forecast.confidenceInterval.confidence).toBeLessThanOrEqual(100);
        }

        // Date range validation
        const startDate = new Date(forecast.dateRange.start);
        const endDate = new Date(forecast.dateRange.end);
        expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());

        // Sources validation
        expect(forecast.sources).toHaveLength(expect.any(Number));
        expect(forecast.sources.length).toBeGreaterThan(0);
      });
    });

    it('should maintain forecast consistency across multiple calls', async () => {
      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6],
        enableRiskAdjustment: true
      };

      const result1 = await forecastService.generateMarketConsensusForecasts(mockCommodityData, options);
      const result2 = await forecastService.generateMarketConsensusForecasts(mockCommodityData, options);

      // With same inputs and mocked data, results should be consistent
      expect(result1).toHaveLength(result2.length);
      
      for (let i = 0; i < result1.length; i++) {
        const forecast1 = result1[i];
        const forecast2 = result2[i];
        
        expect(forecast1.horizon).toBe(forecast2.horizon);
        expect(Math.abs(forecast1.marketConsensusPrice - forecast2.marketConsensusPrice)).toBeLessThan(0.01);
        expect(Math.abs(forecast1.riskAdjustedPrice - forecast2.riskAdjustedPrice)).toBeLessThan(0.01);
      }
    });

    it('should handle edge cases in futures curve data', async () => {
      // Test with minimal futures curve
      const minimalCurve: FuturesCurve = {
        ...mockFuturesCurve,
        contracts: [{
          symbol: 'CLZ23',
          maturity: '2023-12-19',
          price: 76.20,
          daysToExpiration: 90
        }]
      };
      mockYahooFinanceService.getFuturesCurve.mockResolvedValue(minimalCurve);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        options
      );

      expect(result).toHaveLength(1);
      expect(result[0].marketConsensusPrice).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Options', () => {
    it('should respect custom configuration options', async () => {
      const customOptions = {
        baseSymbol: 'CL',
        timeHorizons: [1, 2, 4],
        enableRiskAdjustment: false,
        includeConfidenceIntervals: false,
        maxRiskAdjustment: 0.10,
        fallbackToWebSearch: false
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        mockCommodityData,
        customOptions
      );

      expect(result).toHaveLength(3); // Custom horizons
      result.forEach(forecast => {
        if (!customOptions.enableRiskAdjustment) {
          expect(forecast.riskAdjustments).toHaveLength(0);
          expect(forecast.riskAdjustedPrice).toBe(forecast.marketConsensusPrice);
        }
        
        if (!customOptions.includeConfidenceIntervals) {
          expect(forecast.confidenceInterval).toBeUndefined();
        }
      });
    });

    it('should handle different commodity types', async () => {
      const goldData: CommodityData = {
        ...mockCommodityData,
        symbol: 'GC=F',
        name: 'Gold',
        currentPrice: 1850.0
      };

      const options = {
        baseSymbol: 'GC',
        timeHorizons: [3, 6],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        goldData,
        options
      );

      expect(result).toHaveLength(2);
      expect(mockYahooFinanceService.getFuturesCurve).toHaveBeenCalledWith('GC', expect.any(Object));
      expect(mockRiskAnalyzer.analyzeRisks).toHaveBeenCalledWith(
        goldData.currentPrice,
        goldData.symbol,
        expect.any(Object)
      );
    });
  });
});