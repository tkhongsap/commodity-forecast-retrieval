/**
 * Forecast Accuracy and Confidence Interval Validation Tests
 * 
 * Validates the accuracy metrics, confidence intervals, and statistical
 * properties of the hybrid forecasting system outputs.
 * 
 * @author Forecast Accuracy Validation Test Suite
 * @version 1.0.0
 */

import { ForecastService } from '../services/forecast-service';
import { YahooFinanceService } from '../services/yahoo-finance-service';
import { WebSearchService } from '../services/web-search-service';
import { RiskAnalyzer } from '../utils/risk-analyzer';
import { 
  CommodityData, 
  MarketConsensusForcast, 
  ForecastData,
  RiskAdjustment 
} from '../types/commodity';
import { FORECASTING_CONFIG, RISK_FACTOR_CONFIG } from '../config/yahoo-finance';

// Mock external services for controlled accuracy testing
jest.mock('./web-search-service');
jest.mock('./yahoo-finance-service');
jest.mock('../utils/risk-analyzer');

describe('Forecast Accuracy and Confidence Interval Validation', () => {
  let forecastService: ForecastService;
  let mockYahooFinanceService: jest.Mocked<YahooFinanceService>;
  let mockWebSearchService: jest.Mocked<WebSearchService>;
  let mockRiskAnalyzer: jest.Mocked<RiskAnalyzer>;

  const baseCommodityData: CommodityData = {
    symbol: 'CL=F',
    name: 'Crude Oil WTI',
    type: 'commodity',
    unit: 'USD per barrel',
    currentPrice: 75.50,
    currency: 'USD',
    lastUpdated: new Date().toISOString(),
    sources: [{
      name: 'Accuracy Test',
      date: new Date().toISOString(),
      reliability: 'high'
    }]
  };

  const mockFuturesCurve = {
    underlyingSymbol: 'CL',
    curveDate: new Date().toISOString(),
    contracts: [
      { symbol: 'CLZ23', maturity: '2023-12-19', price: 76.20, daysToExpiration: 90 },
      { symbol: 'CLF24', maturity: '2024-01-19', price: 76.80, daysToExpiration: 120 },
      { symbol: 'CLG24', maturity: '2024-02-20', price: 77.40, daysToExpiration: 150 },
      { symbol: 'CLH24', maturity: '2024-03-19', price: 78.10, daysToExpiration: 180 },
      { symbol: 'CLJ24', maturity: '2024-04-19', price: 78.80, daysToExpiration: 210 },
      { symbol: 'CLK24', maturity: '2024-05-19', price: 79.50, daysToExpiration: 240 }
    ],
    curveMetrics: { contango: true, backwardation: false, averageSpread: 0.60, steepness: 0.30 },
    sources: [{ name: 'Mock Futures', date: new Date().toISOString(), reliability: 'high' }],
    lastUpdated: new Date().toISOString()
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

    forecastService = new ForecastService(
      mockWebSearchService,
      mockYahooFinanceService,
      mockRiskAnalyzer
    );

    // Setup default mock behaviors
    mockYahooFinanceService.getCommodityData.mockResolvedValue(baseCommodityData);
    mockYahooFinanceService.getFuturesCurve.mockResolvedValue(mockFuturesCurve);
  });

  describe('Confidence Interval Validation', () => {
    it('should generate statistically valid confidence intervals', async () => {
      const mockRiskAnalysis = {
        riskAdjustments: [
          {
            riskType: 'geopolitical' as const,
            adjustmentFactor: 0.05,
            confidenceImpact: 0.1,
            description: 'Moderate geopolitical risk',
            methodology: 'OpenAI GPT-4 Risk Analysis',
            validityPeriod: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            },
            sources: [{ name: 'Mock Risk Analysis', date: new Date().toISOString(), reliability: 'high' }]
          }
        ],
        overallConfidence: 0.75,
        analysisTimestamp: new Date().toISOString(),
        keyRiskFactors: ['geopolitical tensions'],
        usedFallback: false,
        sources: [{ name: 'Mock Risk Analysis', date: new Date().toISOString(), reliability: 'high' }],
        apiCost: { tokensUsed: 1500, estimatedCost: 0.045, currency: 'USD' }
      };

      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true,
        includeConfidenceIntervals: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        baseCommodityData,
        options
      );

      result.forEach((forecast, index) => {
        const horizon = options.timeHorizons[index];
        
        // Confidence interval should exist
        expect(forecast.confidenceInterval).toBeDefined();
        
        if (forecast.confidenceInterval) {
          const ci = forecast.confidenceInterval;
          
          // Basic interval properties
          expect(ci.lower).toBeLessThan(ci.upper);
          expect(ci.confidence).toBeGreaterThan(0);
          expect(ci.confidence).toBeLessThanOrEqual(100);
          
          // Forecast price should be within interval
          expect(forecast.forecastPrice).toBeGreaterThanOrEqual(ci.lower);
          expect(forecast.forecastPrice).toBeLessThanOrEqual(ci.upper);
          
          // Interval width should be reasonable (not too narrow or too wide)
          const intervalWidth = ci.upper - ci.lower;
          const widthRatio = intervalWidth / forecast.forecastPrice;
          expect(widthRatio).toBeGreaterThan(0.05); // At least 5% width
          expect(widthRatio).toBeLessThan(0.50); // No more than 50% width
          
          // Longer horizons should generally have wider intervals
          if (index > 0) {
            const prevInterval = result[index - 1].confidenceInterval!;
            const prevWidth = prevInterval.upper - prevInterval.lower;
            const currentWidth = ci.upper - ci.lower;
            
            // Allow some variance due to different risk factors
            expect(currentWidth).toBeGreaterThanOrEqual(prevWidth * 0.8);
          }
        }
      });

      console.log('\n📊 CONFIDENCE INTERVAL ANALYSIS:');
      console.log('─'.repeat(70));
      result.forEach(forecast => {
        const ci = forecast.confidenceInterval!;
        const width = ci.upper - ci.lower;
        const widthPercent = (width / forecast.forecastPrice * 100).toFixed(1);
        console.log(`${forecast.horizon}: $${ci.lower.toFixed(2)} - $${ci.upper.toFixed(2)} (±${widthPercent}%)`);
      });
    });

    it('should adjust confidence intervals based on risk factors', async () => {
      const testScenarios = [
        {
          name: 'Low Risk',
          riskAdjustments: [{
            riskType: 'economic' as const,
            adjustmentFactor: 0.02,
            confidenceImpact: 0.05,
            description: 'Minor economic uncertainty',
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          expectedWidthRatio: { min: 0.05, max: 0.15 }
        },
        {
          name: 'High Risk',
          riskAdjustments: [{
            riskType: 'geopolitical' as const,
            adjustmentFactor: 0.12,
            confidenceImpact: -0.3,
            description: 'Major geopolitical crisis',
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          expectedWidthRatio: { min: 0.15, max: 0.40 }
        },
        {
          name: 'Multiple Risks',
          riskAdjustments: [
            {
              riskType: 'supply_demand' as const,
              adjustmentFactor: 0.08,
              confidenceImpact: -0.15,
              description: 'Supply disruption',
              methodology: 'Test',
              validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
              sources: []
            },
            {
              riskType: 'weather' as const,
              adjustmentFactor: 0.06,
              confidenceImpact: -0.10,
              description: 'Extreme weather',
              methodology: 'Test',
              validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
              sources: []
            }
          ],
          expectedWidthRatio: { min: 0.20, max: 0.45 }
        }
      ];

      for (const scenario of testScenarios) {
        const mockRiskAnalysis = {
          riskAdjustments: scenario.riskAdjustments,
          overallConfidence: 0.70,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['test'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [6], enableRiskAdjustment: true, includeConfidenceIntervals: true }
        );

        const forecast = result[0];
        const ci = forecast.confidenceInterval!;
        const widthRatio = (ci.upper - ci.lower) / forecast.forecastPrice;

        // Validate that confidence intervals reflect risk levels
        expect(widthRatio).toBeGreaterThanOrEqual(scenario.expectedWidthRatio.min);
        expect(widthRatio).toBeLessThanOrEqual(scenario.expectedWidthRatio.max);

        console.log(`${scenario.name}: Interval width ${(widthRatio * 100).toFixed(1)}% (expected ${(scenario.expectedWidthRatio.min * 100).toFixed(1)}%-${(scenario.expectedWidthRatio.max * 100).toFixed(1)}%)`);
      }
    });

    it('should maintain confidence level consistency across time horizons', async () => {
      const mockRiskAnalysis = {
        riskAdjustments: [{
          riskType: 'economic' as const,
          adjustmentFactor: 0.04,
          confidenceImpact: 0.05,
          description: 'Economic stability',
          methodology: 'Test',
          validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
          sources: []
        }],
        overallConfidence: 0.80,
        analysisTimestamp: new Date().toISOString(),
        keyRiskFactors: ['economic'],
        usedFallback: false,
        sources: [],
        apiCost: { tokensUsed: 1200, estimatedCost: 0.036, currency: 'USD' }
      };

      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

      const result = await forecastService.generateMarketConsensusForecasts(
        baseCommodityData,
        { baseSymbol: 'CL', timeHorizons: [3, 6, 12, 24], enableRiskAdjustment: true, includeConfidenceIntervals: true }
      );

      // Confidence levels should be consistent (within reasonable range)
      const confidenceLevels = result.map(f => f.confidenceLevel || 0);
      const avgConfidence = confidenceLevels.reduce((sum, c) => sum + c, 0) / confidenceLevels.length;
      const confidenceVariance = Math.max(...confidenceLevels) - Math.min(...confidenceLevels);

      expect(avgConfidence).toBeGreaterThan(50); // Reasonable average confidence
      expect(confidenceVariance).toBeLessThan(30); // Not too much variance between horizons

      console.log(`Confidence Levels: ${confidenceLevels.map(c => c.toFixed(1)).join('%, ')}%`);
      console.log(`Average: ${avgConfidence.toFixed(1)}%, Variance: ${confidenceVariance.toFixed(1)}%`);
    });
  });

  describe('Forecast Accuracy Validation', () => {
    it('should generate forecasts within reasonable price ranges', async () => {
      const priceScenarios = [
        { currentPrice: 50.0, name: 'Low Oil Price' },
        { currentPrice: 75.0, name: 'Normal Oil Price' },
        { currentPrice: 100.0, name: 'High Oil Price' },
        { currentPrice: 30.0, name: 'Crisis Oil Price' }
      ];

      for (const scenario of priceScenarios) {
        const testData = { ...baseCommodityData, currentPrice: scenario.currentPrice };
        
        // Adjust futures curve to match current price scenario
        const adjustedCurve = {
          ...mockFuturesCurve,
          contracts: mockFuturesCurve.contracts.map(contract => ({
            ...contract,
            price: scenario.currentPrice * (contract.price / 75.0) // Scale proportionally
          }))
        };
        
        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(adjustedCurve);
        
        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: 'supply_demand' as const,
            adjustmentFactor: 0.03,
            confidenceImpact: 0.0,
            description: 'Supply balance',
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: 0.75,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['supply'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          testData,
          { baseSymbol: 'CL', timeHorizons: [3, 6, 12], enableRiskAdjustment: true }
        );

        result.forEach(forecast => {
          // Forecasts should be within reasonable bounds
          expect(forecast.forecastPrice).toBeGreaterThan(scenario.currentPrice * 0.5);
          expect(forecast.forecastPrice).toBeLessThan(scenario.currentPrice * 2.0);
          
          // Market consensus should be close to futures curve
          expect(forecast.marketConsensusPrice).toBeGreaterThan(scenario.currentPrice * 0.8);
          expect(forecast.marketConsensusPrice).toBeLessThan(scenario.currentPrice * 1.5);
          
          // Risk adjusted price should be reasonable relative to consensus
          const adjustmentRatio = Math.abs(forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice;
          expect(adjustmentRatio).toBeLessThan(0.25); // Less than 25% adjustment
        });

        console.log(`${scenario.name} (${scenario.currentPrice}): Forecasts ${result.map(f => f.forecastPrice.toFixed(2)).join(', ')}`);
      }
    });

    it('should demonstrate forecast consistency and trend awareness', async () => {
      const trendScenarios = [
        {
          name: 'Upward Trend',
          curveAdjustment: (price: number, index: number) => price + (index * 0.5),
          expectedTrend: 'bullish'
        },
        {
          name: 'Downward Trend',
          curveAdjustment: (price: number, index: number) => price - (index * 0.3),
          expectedTrend: 'bearish'
        },
        {
          name: 'Flat Trend',
          curveAdjustment: (price: number, index: number) => price + (Math.random() - 0.5) * 0.2,
          expectedTrend: 'neutral'
        }
      ];

      for (const scenario of trendScenarios) {
        // Create trend-specific futures curve
        const trendCurve = {
          ...mockFuturesCurve,
          contracts: mockFuturesCurve.contracts.map((contract, index) => ({
            ...contract,
            price: scenario.curveAdjustment(76.0, index)
          }))
        };

        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(trendCurve);

        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: 'economic' as const,
            adjustmentFactor: 0.02,
            confidenceImpact: 0.0,
            description: 'Trend analysis',
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: 0.75,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['trend'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [3, 6, 12], enableRiskAdjustment: true }
        );

        // Validate trend consistency
        const prices = result.map(f => f.forecastPrice);
        
        if (scenario.expectedTrend === 'bullish') {
          // Prices should generally increase with time
          expect(prices[2]).toBeGreaterThanOrEqual(prices[0] * 0.95); // Allow some variance
        } else if (scenario.expectedTrend === 'bearish') {
          // Prices should generally decrease with time
          expect(prices[2]).toBeLessThanOrEqual(prices[0] * 1.05); // Allow some variance
        }

        // Forecasts should be smooth (no wild jumps between horizons)
        for (let i = 1; i < prices.length; i++) {
          const changeRatio = Math.abs(prices[i] - prices[i-1]) / prices[i-1];
          expect(changeRatio).toBeLessThan(0.15); // Less than 15% change between adjacent horizons
        }

        console.log(`${scenario.name}: Prices [${prices.map(p => p.toFixed(2)).join(', ')}]`);
      }
    });

    it('should validate risk adjustment accuracy', async () => {
      const riskScenarios = [
        {
          name: 'Positive Risk',
          adjustment: 0.10,
          expectedDirection: 'increase'
        },
        {
          name: 'Negative Risk',
          adjustment: -0.08,
          expectedDirection: 'decrease'
        },
        {
          name: 'Neutral Risk',
          adjustment: 0.01,
          expectedDirection: 'minimal'
        }
      ];

      for (const scenario of riskScenarios) {
        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: 'geopolitical' as const,
            adjustmentFactor: scenario.adjustment,
            confidenceImpact: 0.0,
            description: `${scenario.name} scenario`,
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: 0.75,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['test risk'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [6], enableRiskAdjustment: true }
        );

        const forecast = result[0];
        const actualAdjustment = (forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice;

        // Risk adjustment should be applied correctly
        expect(Math.abs(actualAdjustment - scenario.adjustment)).toBeLessThan(0.01);

        // Final price should equal risk-adjusted price
        expect(forecast.forecastPrice).toBeCloseTo(forecast.riskAdjustedPrice, 2);

        console.log(`${scenario.name}: Expected ${(scenario.adjustment * 100).toFixed(1)}%, Actual ${(actualAdjustment * 100).toFixed(1)}%`);
      }
    });
  });

  describe('Statistical Properties Validation', () => {
    it('should maintain statistical consistency across multiple forecast runs', async () => {
      const mockRiskAnalysis = {
        riskAdjustments: [{
          riskType: 'economic' as const,
          adjustmentFactor: 0.05,
          confidenceImpact: 0.1,
          description: 'Economic factor',
          methodology: 'Test',
          validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
          sources: []
        }],
        overallConfidence: 0.75,
        analysisTimestamp: new Date().toISOString(),
        keyRiskFactors: ['economic'],
        usedFallback: false,
        sources: [],
        apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
      };

      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

      const runs = 5;
      const results: MarketConsensusForcast[][] = [];

      // Generate multiple forecast runs
      for (let i = 0; i < runs; i++) {
        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [3, 6, 12], enableRiskAdjustment: true, includeConfidenceIntervals: true }
        );
        results.push(result);
      }

      // Analyze consistency across runs
      for (let horizonIndex = 0; horizonIndex < 3; horizonIndex++) {
        const forecastPrices = results.map(run => run[horizonIndex].forecastPrice);
        const consensusPrices = results.map(run => run[horizonIndex].marketConsensusPrice);
        const confidenceLevels = results.map(run => run[horizonIndex].confidenceLevel || 0);

        // Calculate statistics
        const avgForecast = forecastPrices.reduce((sum, p) => sum + p, 0) / forecastPrices.length;
        const avgConsensus = consensusPrices.reduce((sum, p) => sum + p, 0) / consensusPrices.length;
        const avgConfidence = confidenceLevels.reduce((sum, c) => sum + c, 0) / confidenceLevels.length;

        const forecastVariance = Math.sqrt(forecastPrices.reduce((sum, p) => sum + Math.pow(p - avgForecast, 2), 0) / forecastPrices.length);
        const consensusVariance = Math.sqrt(consensusPrices.reduce((sum, p) => sum + Math.pow(p - avgConsensus, 2), 0) / consensusPrices.length);

        // Consistency validation
        expect(forecastVariance / avgForecast).toBeLessThan(0.05); // Low variance relative to mean
        expect(consensusVariance / avgConsensus).toBeLessThan(0.02); // Very low variance for consensus
        expect(avgConfidence).toBeGreaterThan(50);

        console.log(`Horizon ${horizonIndex + 1}: Forecast σ=${forecastVariance.toFixed(2)}, Consensus σ=${consensusVariance.toFixed(2)}, Confidence=${avgConfidence.toFixed(1)}%`);
      }
    });

    it('should validate forecast distribution properties', async () => {
      const sampleSize = 10;
      const forecasts: number[] = [];

      // Generate sample of forecasts with varying risk conditions
      for (let i = 0; i < sampleSize; i++) {
        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: (['geopolitical', 'economic', 'supply_demand', 'weather', 'regulatory'] as const)[i % 5],
            adjustmentFactor: (Math.random() - 0.5) * 0.20, // Random adjustment ±10%
            confidenceImpact: (Math.random() - 0.5) * 0.40, // Random confidence impact
            description: `Random risk ${i}`,
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: 0.60 + Math.random() * 0.30, // Random confidence 60-90%
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['random'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [6], enableRiskAdjustment: true }
        );

        forecasts.push(result[0].forecastPrice);
      }

      // Statistical analysis
      const mean = forecasts.reduce((sum, f) => sum + f, 0) / forecasts.length;
      const variance = forecasts.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / forecasts.length;
      const stdDev = Math.sqrt(variance);
      
      const min = Math.min(...forecasts);
      const max = Math.max(...forecasts);
      const range = max - min;

      // Distribution properties
      expect(mean).toBeGreaterThan(60); // Reasonable mean
      expect(mean).toBeLessThan(100);
      expect(stdDev / mean).toBeLessThan(0.15); // Coefficient of variation < 15%
      expect(range / mean).toBeLessThan(0.30); // Range relative to mean < 30%

      // No extreme outliers
      forecasts.forEach(forecast => {
        expect(Math.abs(forecast - mean)).toBeLessThan(3 * stdDev); // Within 3 standard deviations
      });

      console.log(`\n📈 DISTRIBUTION ANALYSIS (n=${sampleSize}):`);
      console.log(`Mean: $${mean.toFixed(2)}, Std Dev: $${stdDev.toFixed(2)} (${(stdDev/mean*100).toFixed(1)}%)`);
      console.log(`Range: $${min.toFixed(2)} - $${max.toFixed(2)} (${(range/mean*100).toFixed(1)}%)`);
    });
  });

  describe('Boundary Conditions and Edge Cases', () => {
    it('should handle extreme confidence scenarios', async () => {
      const extremeScenarios = [
        {
          name: 'Very High Confidence',
          confidence: 0.95,
          expectedIntervalWidth: { max: 0.10 }
        },
        {
          name: 'Very Low Confidence',
          confidence: 0.30,
          expectedIntervalWidth: { min: 0.20 }
        },
        {
          name: 'Moderate Confidence',
          confidence: 0.70,
          expectedIntervalWidth: { min: 0.10, max: 0.25 }
        }
      ];

      for (const scenario of extremeScenarios) {
        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: 'economic' as const,
            adjustmentFactor: 0.03,
            confidenceImpact: scenario.confidence - 0.75, // Adjust to reach target confidence
            description: scenario.name,
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: scenario.confidence,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['confidence test'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [6], enableRiskAdjustment: true, includeConfidenceIntervals: true }
        );

        const forecast = result[0];
        const ci = forecast.confidenceInterval!;
        const widthRatio = (ci.upper - ci.lower) / forecast.forecastPrice;

        // Validate confidence interval reflects confidence level
        if (scenario.expectedIntervalWidth.max) {
          expect(widthRatio).toBeLessThanOrEqual(scenario.expectedIntervalWidth.max);
        }
        if (scenario.expectedIntervalWidth.min) {
          expect(widthRatio).toBeGreaterThanOrEqual(scenario.expectedIntervalWidth.min);
        }

        console.log(`${scenario.name} (${(scenario.confidence*100).toFixed(0)}%): Interval width ${(widthRatio*100).toFixed(1)}%`);
      }
    });

    it('should validate maximum risk adjustment caps', async () => {
      const maxRiskScenarios = [
        { riskType: 'geopolitical' as const, maxImpact: RISK_FACTOR_CONFIG.CATEGORIES.GEOPOLITICAL.maxImpact },
        { riskType: 'supply_demand' as const, maxImpact: RISK_FACTOR_CONFIG.CATEGORIES.SUPPLY_DEMAND.maxImpact },
        { riskType: 'weather' as const, maxImpact: RISK_FACTOR_CONFIG.CATEGORIES.WEATHER.maxImpact }
      ];

      for (const scenario of maxRiskScenarios) {
        const extremeAdjustment = scenario.maxImpact * 2; // Try to exceed maximum

        const mockRiskAnalysis = {
          riskAdjustments: [{
            riskType: scenario.riskType,
            adjustmentFactor: extremeAdjustment,
            confidenceImpact: -0.2,
            description: `Extreme ${scenario.riskType} risk`,
            methodology: 'Test',
            validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
            sources: []
          }],
          overallConfidence: 0.60,
          analysisTimestamp: new Date().toISOString(),
          keyRiskFactors: ['extreme risk'],
          usedFallback: false,
          sources: [],
          apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
        };

        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(mockRiskAnalysis);

        const result = await forecastService.generateMarketConsensusForecasts(
          baseCommodityData,
          { baseSymbol: 'CL', timeHorizons: [6], enableRiskAdjustment: true, maxRiskAdjustment: scenario.maxImpact }
        );

        const forecast = result[0];
        const actualAdjustment = Math.abs(
          (forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice
        );

        // Should be capped at maximum allowed adjustment
        expect(actualAdjustment).toBeLessThanOrEqual(scenario.maxImpact + 0.01); // Small tolerance

        console.log(`${scenario.riskType}: Requested ${(extremeAdjustment*100).toFixed(1)}%, Applied ${(actualAdjustment*100).toFixed(1)}%, Cap ${(scenario.maxImpact*100).toFixed(1)}%`);
      }
    });
  });
});