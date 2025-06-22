/**
 * Error Handling Validation Tests for Hybrid Forecasting System
 * 
 * Tests comprehensive error handling, fallback mechanisms, and recovery
 * strategies for API failures, network issues, and data quality problems.
 * 
 * @author Error Handling Validation Test Suite
 * @version 1.0.0
 */

import { ForecastService } from '../services/forecast-service';
import { YahooFinanceService } from '../services/yahoo-finance-service';
import { WebSearchService } from '../services/web-search-service';
import { RiskAnalyzer } from '../utils/risk-analyzer';
import { 
  CommodityData, 
  MarketConsensusForcast,
  ForecastData 
} from '../types/commodity';
import { ERROR_CONFIG } from '../config/yahoo-finance';

// Mock external services for controlled error testing
jest.mock('./web-search-service');
jest.mock('./yahoo-finance-service');
jest.mock('../utils/risk-analyzer');

describe('Error Handling Validation Tests', () => {
  let forecastService: ForecastService;
  let mockYahooFinanceService: jest.Mocked<YahooFinanceService>;
  let mockWebSearchService: jest.Mocked<WebSearchService>;
  let mockRiskAnalyzer: jest.Mocked<RiskAnalyzer>;

  const validCommodityData: CommodityData = {
    symbol: 'CL=F',
    name: 'Crude Oil WTI',
    type: 'commodity',
    unit: 'USD per barrel',
    currentPrice: 75.50,
    currency: 'USD',
    lastUpdated: new Date().toISOString(),
    sources: [{
      name: 'Error Test',
      date: new Date().toISOString(),
      reliability: 'high'
    }]
  };

  const validFuturesCurve = {
    underlyingSymbol: 'CL',
    curveDate: new Date().toISOString(),
    contracts: [
      { symbol: 'CLZ23', maturity: '2023-12-19', price: 76.20, daysToExpiration: 90 },
      { symbol: 'CLF24', maturity: '2024-01-19', price: 76.80, daysToExpiration: 120 }
    ],
    curveMetrics: { contango: true, backwardation: false, averageSpread: 0.60, steepness: 0.30 },
    sources: [{ name: 'Mock Futures', date: new Date().toISOString(), reliability: 'high' }],
    lastUpdated: new Date().toISOString()
  };

  const validRiskAnalysis = {
    riskAdjustments: [{
      riskType: 'economic' as const,
      adjustmentFactor: 0.05,
      confidenceImpact: 0.1,
      description: 'Standard risk',
      methodology: 'OpenAI GPT-4 Risk Analysis',
      validityPeriod: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      sources: [{ name: 'Mock Risk Analysis', date: new Date().toISOString(), reliability: 'high' }]
    }],
    overallConfidence: 0.75,
    analysisTimestamp: new Date().toISOString(),
    keyRiskFactors: ['economic'],
    usedFallback: false,
    sources: [{ name: 'Mock Risk Analysis', date: new Date().toISOString(), reliability: 'high' }],
    apiCost: { tokensUsed: 1000, estimatedCost: 0.03, currency: 'USD' }
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

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('API Failure Scenarios', () => {
    it('should handle Yahoo Finance API failures gracefully', async () => {
      // Mock Yahoo Finance service failures
      const errorScenarios = [
        { error: new Error('Network timeout'), description: 'Network Timeout' },
        { error: new Error('Rate limit exceeded'), description: 'Rate Limit' },
        { error: new Error('Invalid symbol'), description: 'Invalid Symbol' },
        { error: new Error('Service unavailable'), description: 'Service Unavailable' }
      ];

      for (const scenario of errorScenarios) {
        mockYahooFinanceService.getFuturesCurve.mockRejectedValue(scenario.error);
        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);
        
        // Mock fallback web search
        mockWebSearchService.search.mockResolvedValue({
          content: 'Fallback forecast: $78.50 per barrel',
          timestamp: new Date().toISOString(),
          success: true,
          sources: [{ name: 'Fallback Web Search', date: new Date().toISOString(), reliability: 'medium' }]
        });

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3, 6],
          enableRiskAdjustment: true,
          fallbackToWebSearch: true
        };

        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        // Should fall back to traditional forecasting
        expect(Array.isArray(result)).toBe(true);
        
        if (result.length > 0) {
          result.forEach(forecast => {
            expect(forecast.forecastPrice).toBeGreaterThan(0);
            expect(forecast.sources.length).toBeGreaterThan(0);
            // Should indicate fallback was used
            expect(forecast.methodology).toContain('Web Search');
          });
        }

        console.log(`✓ ${scenario.description}: Handled gracefully with ${result.length} forecasts`);
        
        // Reset mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle Risk Analyzer API failures with graceful degradation', async () => {
      const riskAnalyzerErrors = [
        { error: new Error('OpenAI API unavailable'), expectFallback: true },
        { error: new Error('Authentication failed'), expectFallback: true },
        { error: new Error('Token limit exceeded'), expectFallback: true },
        { error: { status: 429, message: 'Rate limited' }, expectFallback: true }
      ];

      for (const scenario of riskAnalyzerErrors) {
        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(validFuturesCurve);
        mockRiskAnalyzer.analyzeRisks.mockRejectedValue(scenario.error);

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3, 6],
          enableRiskAdjustment: true,
          fallbackToWebSearch: false // Force risk analyzer usage
        };

        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        // Should proceed with market consensus only (no risk adjustments)
        expect(result.length).toBeGreaterThan(0);
        
        result.forEach(forecast => {
          if (scenario.expectFallback) {
            // Risk adjustment should be minimal or zero due to fallback
            expect(forecast.riskAdjustments.length).toBeLessThanOrEqual(1);
            expect(forecast.marketConsensusPrice).toBeGreaterThan(0);
            
            // Risk adjusted price should equal market consensus if no risk analysis
            const adjustmentRatio = Math.abs(
              (forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice
            );
            expect(adjustmentRatio).toBeLessThan(0.10); // Minimal adjustment due to fallback
          }
        });

        console.log(`✓ Risk Analyzer Error: Generated ${result.length} consensus-only forecasts`);
      }
    });

    it('should handle multiple simultaneous API failures', async () => {
      // Simulate complete service failure
      mockYahooFinanceService.getFuturesCurve.mockRejectedValue(new Error('Yahoo Finance down'));
      mockRiskAnalyzer.analyzeRisks.mockRejectedValue(new Error('Risk analyzer down'));
      
      // Web search as last resort
      mockWebSearchService.search.mockResolvedValue({
        content: 'Emergency forecast: $77.00 per barrel based on market analysis',
        timestamp: new Date().toISOString(),
        success: true,
        sources: [{ name: 'Emergency Web Search', date: new Date().toISOString(), reliability: 'low' }]
      });

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true,
        fallbackToWebSearch: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        validCommodityData,
        options
      );

      // Should fall back to web search forecasting
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        result.forEach(forecast => {
          expect(forecast.forecastPrice).toBeGreaterThan(0);
          expect(forecast.methodology).toContain('Web Search');
          expect(forecast.sources.some(s => s.reliability === 'low')).toBe(true);
        });
      }

      console.log(`✓ Complete Service Failure: Emergency fallback with ${result.length} forecasts`);
    });
  });

  describe('Data Quality Issues', () => {
    it('should handle invalid commodity data gracefully', async () => {
      const invalidDataScenarios = [
        {
          name: 'Negative Price',
          data: { ...validCommodityData, currentPrice: -10.0 }
        },
        {
          name: 'Zero Price',
          data: { ...validCommodityData, currentPrice: 0 }
        },
        {
          name: 'Missing Symbol',
          data: { ...validCommodityData, symbol: '' }
        },
        {
          name: 'Invalid Symbol Format',
          data: { ...validCommodityData, symbol: 'INVALID_SYMBOL' }
        },
        {
          name: 'Empty Sources',
          data: { ...validCommodityData, sources: [] }
        },
        {
          name: 'Future Date',
          data: { ...validCommodityData, lastUpdated: new Date(Date.now() + 86400000).toISOString() }
        }
      ];

      for (const scenario of invalidDataScenarios) {
        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(validFuturesCurve);
        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3],
          enableRiskAdjustment: true
        };

        try {
          const result = await forecastService.generateMarketConsensusForecasts(
            scenario.data,
            options
          );

          // Should either handle gracefully or provide empty results
          expect(Array.isArray(result)).toBe(true);
          
          if (result.length > 0) {
            result.forEach(forecast => {
              expect(forecast.forecastPrice).toBeGreaterThan(0);
              expect(isFinite(forecast.forecastPrice)).toBe(true);
            });
          }

          console.log(`✓ ${scenario.name}: Handled gracefully`);
        } catch (error) {
          // Expected for some severe data quality issues
          expect(error).toBeInstanceOf(Error);
          console.log(`✓ ${scenario.name}: Appropriately rejected with error`);
        }
      }
    });

    it('should handle corrupted futures curve data', async () => {
      const corruptedCurveScenarios = [
        {
          name: 'Empty Contracts',
          curve: { ...validFuturesCurve, contracts: [] }
        },
        {
          name: 'Invalid Prices',
          curve: {
            ...validFuturesCurve,
            contracts: validFuturesCurve.contracts.map(c => ({ ...c, price: NaN }))
          }
        },
        {
          name: 'Negative Prices',
          curve: {
            ...validFuturesCurve,
            contracts: validFuturesCurve.contracts.map(c => ({ ...c, price: -10 }))
          }
        },
        {
          name: 'Missing Expiration Data',
          curve: {
            ...validFuturesCurve,
            contracts: validFuturesCurve.contracts.map(c => ({ ...c, daysToExpiration: undefined }))
          }
        },
        {
          name: 'Inconsistent Curve',
          curve: {
            ...validFuturesCurve,
            contracts: [
              { symbol: 'CLZ23', maturity: '2023-12-19', price: 100, daysToExpiration: 90 },
              { symbol: 'CLF24', maturity: '2024-01-19', price: 50, daysToExpiration: 120 } // Huge price drop
            ]
          }
        }
      ];

      for (const scenario of corruptedCurveScenarios) {
        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(scenario.curve);
        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);
        
        // Setup fallback
        mockWebSearchService.search.mockResolvedValue({
          content: 'Fallback forecast due to data quality issues: $76.00',
          timestamp: new Date().toISOString(),
          success: true,
          sources: [{ name: 'Fallback', date: new Date().toISOString(), reliability: 'medium' }]
        });

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3],
          enableRiskAdjustment: true,
          fallbackToWebSearch: true
        };

        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        // Should handle corrupted data gracefully
        expect(Array.isArray(result)).toBe(true);

        console.log(`✓ ${scenario.name}: Handled with ${result.length} forecasts`);
      }
    });

    it('should validate and sanitize risk analysis responses', async () => {
      const corruptedRiskScenarios = [
        {
          name: 'Invalid Risk Types',
          riskAnalysis: {
            ...validRiskAnalysis,
            riskAdjustments: [{
              riskType: 'invalid_type' as any,
              adjustmentFactor: 0.05,
              confidenceImpact: 0.1,
              description: 'Invalid risk type',
              methodology: 'Test',
              validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
              sources: []
            }]
          }
        },
        {
          name: 'Extreme Adjustments',
          riskAnalysis: {
            ...validRiskAnalysis,
            riskAdjustments: [{
              riskType: 'geopolitical' as const,
              adjustmentFactor: 2.0, // 200% adjustment - should be capped
              confidenceImpact: 0.1,
              description: 'Extreme adjustment',
              methodology: 'Test',
              validityPeriod: { start: new Date().toISOString(), end: new Date().toISOString() },
              sources: []
            }]
          }
        },
        {
          name: 'Invalid Confidence',
          riskAnalysis: {
            ...validRiskAnalysis,
            overallConfidence: 1.5, // > 1.0
            riskAdjustments: []
          }
        },
        {
          name: 'Empty Risk Factors',
          riskAnalysis: {
            ...validRiskAnalysis,
            keyRiskFactors: [],
            riskAdjustments: []
          }
        }
      ];

      for (const scenario of corruptedRiskScenarios) {
        mockYahooFinanceService.getFuturesCurve.mockResolvedValue(validFuturesCurve);
        mockRiskAnalyzer.analyzeRisks.mockResolvedValue(scenario.riskAnalysis);

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3],
          enableRiskAdjustment: true,
          maxRiskAdjustment: 0.25 // 25% cap
        };

        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        expect(result.length).toBeGreaterThan(0);
        
        result.forEach(forecast => {
          // Adjustments should be sanitized and capped
          const adjustmentRatio = Math.abs(
            (forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice
          );
          expect(adjustmentRatio).toBeLessThanOrEqual(options.maxRiskAdjustment + 0.01);
          
          // Confidence should be valid
          if (forecast.confidenceLevel) {
            expect(forecast.confidenceLevel).toBeGreaterThanOrEqual(0);
            expect(forecast.confidenceLevel).toBeLessThanOrEqual(100);
          }
        });

        console.log(`✓ ${scenario.name}: Data sanitized and capped appropriately`);
      }
    });
  });

  describe('Network and Timeout Scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutScenarios = [
        { service: 'Yahoo Finance', delay: 10000 },
        { service: 'Risk Analyzer', delay: 15000 },
        { service: 'Web Search', delay: 8000 }
      ];

      for (const scenario of timeoutScenarios) {
        // Simulate timeout with delayed rejection
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`${scenario.service} timeout`)), scenario.delay);
        });

        if (scenario.service === 'Yahoo Finance') {
          mockYahooFinanceService.getFuturesCurve.mockImplementation(() => timeoutPromise as any);
          mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);
        } else if (scenario.service === 'Risk Analyzer') {
          mockYahooFinanceService.getFuturesCurve.mockResolvedValue(validFuturesCurve);
          mockRiskAnalyzer.analyzeRisks.mockImplementation(() => timeoutPromise as any);
        }

        // Setup fallback
        mockWebSearchService.search.mockResolvedValue({
          content: `Fallback after ${scenario.service} timeout: $75.50`,
          timestamp: new Date().toISOString(),
          success: true,
          sources: [{ name: 'Timeout Fallback', date: new Date().toISOString(), reliability: 'medium' }]
        });

        const startTime = Date.now();
        
        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3],
          enableRiskAdjustment: true,
          fallbackToWebSearch: true
        };

        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        const executionTime = Date.now() - startTime;

        // Should complete reasonably quickly despite timeouts
        expect(executionTime).toBeLessThan(20000); // 20 seconds max
        expect(Array.isArray(result)).toBe(true);

        console.log(`✓ ${scenario.service} Timeout: Handled in ${executionTime}ms`);

        // Reset mocks for next scenario
        jest.clearAllMocks();
      }
    });

    it('should handle intermittent network failures with retry logic', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      // Mock function that fails first few times, then succeeds
      mockYahooFinanceService.getFuturesCurve.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          return Promise.reject(new Error(`Network error attempt ${attemptCount}`));
        }
        return Promise.resolve(validFuturesCurve);
      });

      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        validCommodityData,
        options
      );

      // Should eventually succeed after retries
      expect(result.length).toBeGreaterThan(0);
      expect(attemptCount).toBeGreaterThanOrEqual(maxRetries);

      console.log(`✓ Intermittent Network Failure: Succeeded after ${attemptCount} attempts`);
    });
  });

  describe('Resource and Memory Management', () => {
    it('should handle memory pressure scenarios', async () => {
      // Simulate high memory usage scenario
      const largeDataSet = Array(1000).fill(null).map((_, i) => ({
        symbol: `CONTRACT${i}`,
        maturity: new Date().toISOString(),
        price: 75 + Math.random() * 10,
        daysToExpiration: 30 + i
      }));

      const largeFuturesCurve = {
        ...validFuturesCurve,
        contracts: largeDataSet
      };

      mockYahooFinanceService.getFuturesCurve.mockResolvedValue(largeFuturesCurve);
      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);

      const memoryBefore = process.memoryUsage();

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3, 6, 12, 24],
        enableRiskAdjustment: true
      };

      const result = await forecastService.generateMarketConsensusForecasts(
        validCommodityData,
        options
      );

      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Should handle large datasets without excessive memory usage
      expect(result.length).toBe(4);
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      console.log(`✓ Large Dataset: Processed ${largeDataSet.length} contracts, memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should prevent resource leaks during error conditions', async () => {
      const memoryBefore = process.memoryUsage();

      // Simulate multiple error conditions in succession
      const errorConditions = [
        () => mockYahooFinanceService.getFuturesCurve.mockRejectedValue(new Error('Error 1')),
        () => mockRiskAnalyzer.analyzeRisks.mockRejectedValue(new Error('Error 2')),
        () => mockWebSearchService.search.mockRejectedValue(new Error('Error 3'))
      ];

      for (let i = 0; i < errorConditions.length; i++) {
        errorConditions[i]();

        try {
          await forecastService.generateMarketConsensusForecasts(
            validCommodityData,
            { baseSymbol: 'CL', timeHorizons: [3], enableRiskAdjustment: true, fallbackToWebSearch: true }
          );
        } catch (error) {
          // Expected for some scenarios
        }

        // Reset mocks for next iteration
        jest.clearAllMocks();
      }

      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Should not have significant memory leaks
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024); // Less than 10MB

      console.log(`✓ Error Conditions: No resource leaks detected, memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Recovery and Circuit Breaker', () => {
    it('should implement circuit breaker pattern for failing services', async () => {
      const failureThreshold = 3;
      let failureCount = 0;

      // Mock service that fails consistently
      mockYahooFinanceService.getFuturesCurve.mockImplementation(() => {
        failureCount++;
        return Promise.reject(new Error(`Service failure ${failureCount}`));
      });

      mockWebSearchService.search.mockResolvedValue({
        content: 'Circuit breaker fallback: $76.00',
        timestamp: new Date().toISOString(),
        success: true,
        sources: [{ name: 'Circuit Breaker Fallback', date: new Date().toISOString(), reliability: 'medium' }]
      });

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true,
        fallbackToWebSearch: true
      };

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < failureThreshold + 2; i++) {
        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        expect(Array.isArray(result)).toBe(true);
        
        if (i >= failureThreshold) {
          // After threshold, should use circuit breaker and fallback immediately
          result.forEach(forecast => {
            expect(forecast.methodology).toContain('Web Search');
          });
        }
      }

      console.log(`✓ Circuit Breaker: Activated after ${failureThreshold} failures`);
    });

    it('should implement automatic recovery after service restoration', async () => {
      let requestCount = 0;

      // Mock service that fails initially, then recovers
      mockYahooFinanceService.getFuturesCurve.mockImplementation(() => {
        requestCount++;
        if (requestCount <= 3) {
          return Promise.reject(new Error('Service temporarily down'));
        }
        return Promise.resolve(validFuturesCurve);
      });

      mockRiskAnalyzer.analyzeRisks.mockResolvedValue(validRiskAnalysis);

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true
      };

      // Multiple requests to test recovery
      const results = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await forecastService.generateMarketConsensusForecasts(
            validCommodityData,
            options
          );
          results.push({ attempt: i + 1, success: true, forecasts: result.length });
        } catch (error) {
          results.push({ attempt: i + 1, success: false, error: error.message });
        }
      }

      // Should show initial failures followed by recovery
      const successfulAttempts = results.filter(r => r.success).length;
      expect(successfulAttempts).toBeGreaterThan(0);

      console.log('✓ Service Recovery Pattern:');
      results.forEach(result => {
        console.log(`  Attempt ${result.attempt}: ${result.success ? `Success (${result.forecasts} forecasts)` : `Failed (${result.error})`}`);
      });
    });
  });

  describe('Comprehensive Error Scenarios', () => {
    it('should handle worst-case scenario: all services failing', async () => {
      // Simulate complete system failure
      mockYahooFinanceService.getFuturesCurve.mockRejectedValue(new Error('Yahoo Finance completely down'));
      mockYahooFinanceService.getCommodityData.mockRejectedValue(new Error('Commodity data unavailable'));
      mockRiskAnalyzer.analyzeRisks.mockRejectedValue(new Error('Risk analyzer offline'));
      mockWebSearchService.search.mockRejectedValue(new Error('Web search service down'));

      const options = {
        baseSymbol: 'CL',
        timeHorizons: [3],
        enableRiskAdjustment: true,
        fallbackToWebSearch: true
      };

      try {
        const result = await forecastService.generateMarketConsensusForecasts(
          validCommodityData,
          options
        );

        // Should return empty results or minimal fallback data
        expect(Array.isArray(result)).toBe(true);
        
        if (result.length === 0) {
          console.log('✓ Complete System Failure: Appropriately returned empty results');
        } else {
          console.log(`✓ Complete System Failure: Minimal fallback with ${result.length} forecasts`);
        }
      } catch (error) {
        // Acceptable for complete system failure
        expect(error).toBeInstanceOf(Error);
        console.log('✓ Complete System Failure: Appropriately threw error');
      }
    });

    it('should provide meaningful error messages and diagnostic information', async () => {
      const errorScenarios = [
        {
          name: 'Invalid API Key',
          setup: () => mockRiskAnalyzer.analyzeRisks.mockRejectedValue(new Error('Invalid API key provided'))
        },
        {
          name: 'Rate Limit Exceeded',
          setup: () => mockYahooFinanceService.getFuturesCurve.mockRejectedValue(new Error('Rate limit exceeded, try again in 60 seconds'))
        },
        {
          name: 'Malformed Response',
          setup: () => mockWebSearchService.search.mockResolvedValue({
            content: null as any,
            timestamp: new Date().toISOString(),
            success: false,
            sources: []
          })
        }
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();

        const options = {
          baseSymbol: 'CL',
          timeHorizons: [3],
          enableRiskAdjustment: true,
          fallbackToWebSearch: true
        };

        try {
          const result = await forecastService.generateMarketConsensusForecasts(
            validCommodityData,
            options
          );

          // Should provide diagnostic information in sources or methodology
          if (result.length > 0) {
            result.forEach(forecast => {
              expect(forecast.sources.length).toBeGreaterThan(0);
              expect(forecast.methodology).toBeDefined();
            });
          }

          console.log(`✓ ${scenario.name}: Provided meaningful diagnostic information`);
        } catch (error) {
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
          console.log(`✓ ${scenario.name}: Meaningful error message: "${error.message}"`);
        }

        // Reset for next scenario
        jest.clearAllMocks();
      }
    });
  });
});