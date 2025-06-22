/**
 * Yahoo Finance Parser Unit Tests
 * 
 * Comprehensive test suite for the Yahoo Finance response parser module.
 * Tests cover parsing functionality, error handling, data validation,
 * and integration with CommodityData interface.
 * 
 * @author Yahoo Finance Parser Tests
 * @version 1.0.0
 */

import {
  YahooFinanceParser,
  YahooFinanceParserException,
  YahooFinanceParserError,
  ParserOptions,
  SymbolMapping,
  DEFAULT_SYMBOL_MAPPINGS,
  createYahooFinanceParser,
  parseYahooFinanceToCommodityData,
  parseYahooFinancePriceDataToCommodityData
} from '../yahoo-finance-parser';

import {
  YahooFinanceResponse,
  YahooFinancePriceData
} from '../../types/yahoo-finance';

describe('YahooFinanceParser', () => {
  let parser: YahooFinanceParser;

  beforeEach(() => {
    parser = new YahooFinanceParser();
  });

  describe('Constructor and Initialization', () => {
    it('should create parser with default symbol mappings', () => {
      expect(parser).toBeDefined();
      expect(parser.getSymbolMappings()).toEqual(DEFAULT_SYMBOL_MAPPINGS);
    });

    it('should create parser with custom symbol mappings', () => {
      const customMappings = {
        'CUSTOM=F': {
          yahooSymbol: 'CUSTOM=F',
          commodityName: 'Custom Commodity',
          unit: 'USD per unit',
          currency: 'USD',
          type: 'commodity' as const
        }
      };

      const customParser = new YahooFinanceParser(customMappings);
      const mappings = customParser.getSymbolMappings();
      
      expect(mappings['CUSTOM=F']).toEqual(customMappings['CUSTOM=F']);
      expect(mappings['CL=F']).toEqual(DEFAULT_SYMBOL_MAPPINGS['CL=F']);
    });
  });

  describe('Symbol Mapping Management', () => {
    it('should add custom symbol mapping', () => {
      const newMapping: SymbolMapping = {
        yahooSymbol: 'NEW=F',
        commodityName: 'New Commodity',
        unit: 'USD per unit',
        currency: 'USD',
        type: 'commodity'
      };

      parser.addSymbolMapping('NEW=F', newMapping);
      expect(parser.getSymbolMappings()['NEW=F']).toEqual(newMapping);
    });

    it('should return all symbol mappings', () => {
      const mappings = parser.getSymbolMappings();
      expect(mappings).toEqual(DEFAULT_SYMBOL_MAPPINGS);
      expect(Object.keys(mappings)).toContain('CL=F');
      expect(Object.keys(mappings)).toContain('GC=F');
    });
  });

  describe('parseFromPriceData', () => {
    const mockPriceData: YahooFinancePriceData = {
      currentPrice: 75.50,
      previousClose: 74.25,
      openPrice: 74.80,
      dayHigh: 76.20,
      dayLow: 74.10,
      volume: 125000,
      yearHigh: 95.40,
      yearLow: 45.30,
      priceChange: 1.25,
      percentChange: 1.68,
      currency: 'USD',
      symbol: 'CL=F',
      lastUpdated: '2024-06-22T10:30:00.000Z',
      exchange: 'NYM',
      instrumentType: 'FUTURE'
    };

    it('should successfully parse YahooFinancePriceData to CommodityData', () => {
      const result = parser.parseFromPriceData(mockPriceData);

      expect(result).toMatchObject({
        symbol: 'CL=F',
        name: 'Crude Oil (WTI)',
        type: 'commodity',
        unit: 'USD per barrel',
        currentPrice: 75.50,
        currency: 'USD',
        lastUpdated: '2024-06-22T10:30:00.000Z'
      });

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.name).toBe('Yahoo Finance');
      expect(result.sources[0]?.reliability).toBe('high');
    });

    it('should handle unknown symbols with default mapping', () => {
      const unknownPriceData = { ...mockPriceData, symbol: 'UNKNOWN=F' };
      const result = parser.parseFromPriceData(unknownPriceData);

      expect(result.symbol).toBe('UNKNOWN=F');
      expect(result.name).toBe('Commodity (UNKNOWN=F)');
      expect(result.unit).toBe('USD per unit');
      expect(result.currency).toBe('USD');
    });

    it('should apply parser options correctly', () => {
      const options: ParserOptions = {
        currencyOverride: 'EUR',
        unitOverride: 'EUR per barrel',
        sourceUrl: 'https://custom-source.com',
        includeExtendedMetadata: true
      };

      const result = parser.parseFromPriceData(mockPriceData, options);

      expect(result.currency).toBe('EUR');
      expect(result.unit).toBe('EUR per barrel');
      expect(result.sources[0]?.url).toBe('https://custom-source.com');
    });

    it('should validate data with strict validation', () => {
      const invalidPriceData = { ...mockPriceData, currentPrice: -10 };
      const options: ParserOptions = { strictValidation: true };

      expect(() => {
        parser.parseFromPriceData(invalidPriceData, options);
      }).toThrow(YahooFinanceParserException);
    });
  });

  describe('parseToCommodityData', () => {
    const mockYahooResponse: YahooFinanceResponse = {
      chart: {
        result: [{
          meta: {
            currency: 'USD',
            symbol: 'CL=F',
            exchangeName: 'NYM',
            fullExchangeName: 'NY Mercantile',
            instrumentType: 'FUTURE',
            firstTradeDate: 1640995200,
            regularMarketTime: 1708617600,
            hasPrePostMarketData: false,
            gmtoffset: -18000,
            timezone: 'EST',
            exchangeTimezoneName: 'America/New_York',
            regularMarketPrice: 75.50,
            fiftyTwoWeekHigh: 95.40,
            fiftyTwoWeekLow: 45.30,
            regularMarketDayHigh: 76.20,
            regularMarketDayLow: 74.10,
            regularMarketVolume: 125000,
            shortName: 'Crude Oil',
            chartPreviousClose: 74.25,
            priceHint: 2,
            currentTradingPeriod: {
              pre: { timezone: 'EST', start: 1708617600, end: 1708631000, gmtoffset: -18000 },
              regular: { timezone: 'EST', start: 1708631000, end: 1708659600, gmtoffset: -18000 },
              post: { timezone: 'EST', start: 1708659600, end: 1708674000, gmtoffset: -18000 }
            },
            dataGranularity: '1d',
            range: '1d',
            validRanges: ['1d', '5d', '1mo']
          },
          timestamp: [1708617600],
          indicators: {
            quote: [{
              high: [76.20],
              open: [74.80],
              low: [74.10],
              volume: [125000],
              close: [75.50]
            }],
            adjclose: [{
              adjclose: [75.50]
            }]
          }
        }],
        error: null
      }
    };

    it('should successfully parse Yahoo Finance response to CommodityData', async () => {
      const result = await parser.parseToCommodityData(mockYahooResponse);

      expect(result).toMatchObject({
        symbol: 'CL=F',
        name: 'Crude Oil (WTI)',
        type: 'commodity',
        unit: 'USD per barrel',
        currentPrice: 75.50,
        currency: 'USD'
      });

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.name).toBe('Yahoo Finance');
    });

    it('should handle response with API error', async () => {
      const errorResponse: YahooFinanceResponse = {
        chart: {
          result: [],
          error: {
            code: 'NOT_FOUND',
            description: 'Symbol not found'
          }
        }
      };

      await expect(parser.parseToCommodityData(errorResponse))
        .rejects.toThrow(YahooFinanceParserException);
    });

    it('should handle response without chart data', async () => {
      const invalidResponse = {} as YahooFinanceResponse;

      await expect(parser.parseToCommodityData(invalidResponse))
        .rejects.toThrow(YahooFinanceParserException);
    });

    it('should handle response without metadata', async () => {
      const responseWithoutMeta = {
        chart: {
          result: [{
            timestamp: [1708617600],
            indicators: {
              quote: [{ high: [76.20], open: [74.80], low: [74.10], volume: [125000], close: [75.50] }],
              adjclose: [{ adjclose: [75.50] }]
            }
            // missing meta field
          }],
          error: null
        }
      };

      await expect(parser.parseToCommodityData(responseWithoutMeta as any))
        .rejects.toThrow(YahooFinanceParserException);
    });

    it('should handle missing price data gracefully', async () => {
      const responseWithoutPrice: YahooFinanceResponse = {
        chart: {
          result: [{
            meta: {
              ...mockYahooResponse.chart.result[0]!.meta,
              regularMarketPrice: 0 // Set to 0 to simulate missing price
            },
            timestamp: [1708617600],
            indicators: {
              quote: [{ high: [null], open: [null], low: [null], volume: [null], close: [null] }],
              adjclose: [{ adjclose: [null] }]
            }
          }],
          error: null
        }
      };

      await expect(parser.parseToCommodityData(responseWithoutPrice))
        .rejects.toThrow(YahooFinanceParserException);
    });
  });

  describe('parseMultipleToCommodityData', () => {
    const mockResponse1: YahooFinanceResponse = {
      chart: {
        result: [{
          meta: {
            currency: 'USD',
            symbol: 'CL=F',
            exchangeName: 'NYM',
            fullExchangeName: 'NY Mercantile',
            instrumentType: 'FUTURE',
            firstTradeDate: 1640995200,
            regularMarketTime: 1708617600,
            hasPrePostMarketData: false,
            gmtoffset: -18000,
            timezone: 'EST',
            exchangeTimezoneName: 'America/New_York',
            regularMarketPrice: 75.50,
            fiftyTwoWeekHigh: 95.40,
            fiftyTwoWeekLow: 45.30,
            regularMarketDayHigh: 76.20,
            regularMarketDayLow: 74.10,
            regularMarketVolume: 125000,
            shortName: 'Crude Oil',
            chartPreviousClose: 74.25,
            priceHint: 2,
            currentTradingPeriod: {
              pre: { timezone: 'EST', start: 1708617600, end: 1708631000, gmtoffset: -18000 },
              regular: { timezone: 'EST', start: 1708631000, end: 1708659600, gmtoffset: -18000 },
              post: { timezone: 'EST', start: 1708659600, end: 1708674000, gmtoffset: -18000 }
            },
            dataGranularity: '1d',
            range: '1d',
            validRanges: ['1d', '5d', '1mo']
          },
          timestamp: [1708617600],
          indicators: {
            quote: [{ high: [76.20], open: [74.80], low: [74.10], volume: [125000], close: [75.50] }],
            adjclose: [{ adjclose: [75.50] }]
          }
        }],
        error: null
      }
    };

    const mockResponse2: YahooFinanceResponse = {
      chart: {
        result: [{
          meta: {
            currency: 'USD',
            symbol: 'GC=F',
            exchangeName: 'COMEX',
            fullExchangeName: 'COMEX',
            instrumentType: 'FUTURE',
            firstTradeDate: 1640995200,
            regularMarketTime: 1708617600,
            hasPrePostMarketData: false,
            gmtoffset: -18000,
            timezone: 'EST',
            exchangeTimezoneName: 'America/New_York',
            regularMarketPrice: 2050.30,
            fiftyTwoWeekHigh: 2150.80,
            fiftyTwoWeekLow: 1810.20,
            regularMarketDayHigh: 2055.40,
            regularMarketDayLow: 2045.10,
            regularMarketVolume: 85000,
            shortName: 'Gold',
            chartPreviousClose: 2048.75,
            priceHint: 2,
            currentTradingPeriod: {
              pre: { timezone: 'EST', start: 1708617600, end: 1708631000, gmtoffset: -18000 },
              regular: { timezone: 'EST', start: 1708631000, end: 1708659600, gmtoffset: -18000 },
              post: { timezone: 'EST', start: 1708659600, end: 1708674000, gmtoffset: -18000 }
            },
            dataGranularity: '1d',
            range: '1d',
            validRanges: ['1d', '5d', '1mo']
          },
          timestamp: [1708617600],
          indicators: {
            quote: [{ high: [2055.40], open: [2049.20], low: [2045.10], volume: [85000], close: [2050.30] }],
            adjclose: [{ adjclose: [2050.30] }]
          }
        }],
        error: null
      }
    };

    it('should parse multiple responses successfully', async () => {
      const responses = [mockResponse1, mockResponse2];
      const results = await parser.parseMultipleToCommodityData(responses);

      expect(results).toHaveLength(2);
      expect(results[0]?.symbol).toBe('CL=F');
      expect(results[1]?.symbol).toBe('GC=F');
      expect(results[0]?.currentPrice).toBe(75.50);
      expect(results[1]?.currentPrice).toBe(2050.30);
    });

    it('should handle mixed success and failure responses', async () => {
      const invalidResponse: YahooFinanceResponse = {
        chart: {
          result: [],
          error: { code: 'ERROR', description: 'Test error' }
        }
      };

      const responses = [mockResponse1, invalidResponse];
      const results = await parser.parseMultipleToCommodityData(responses);

      expect(results).toHaveLength(1);
      expect(results[0]?.symbol).toBe('CL=F');
    });
  });

  describe('validateAndParsePriceData', () => {
    const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const mockResponse: YahooFinanceResponse = {
      chart: {
        result: [{
          meta: {
            currency: 'USD',
            symbol: 'CL=F',
            exchangeName: 'NYM',
            fullExchangeName: 'NY Mercantile',
            instrumentType: 'FUTURE',
            firstTradeDate: 1640995200,
            regularMarketTime: currentTime, // Use current time for fresh data
            hasPrePostMarketData: false,
            gmtoffset: -18000,
            timezone: 'EST',
            exchangeTimezoneName: 'America/New_York',
            regularMarketPrice: 75.50,
            fiftyTwoWeekHigh: 95.40,
            fiftyTwoWeekLow: 45.30,
            regularMarketDayHigh: 76.20,
            regularMarketDayLow: 74.10,
            regularMarketVolume: 125000,
            shortName: 'Crude Oil',
            chartPreviousClose: 74.25,
            priceHint: 2,
            currentTradingPeriod: {
              pre: { timezone: 'EST', start: currentTime, end: currentTime + 14400, gmtoffset: -18000 },
              regular: { timezone: 'EST', start: currentTime + 14400, end: currentTime + 43200, gmtoffset: -18000 },
              post: { timezone: 'EST', start: currentTime + 43200, end: currentTime + 57600, gmtoffset: -18000 }
            },
            dataGranularity: '1d',
            range: '1d',
            validRanges: ['1d', '5d', '1mo']
          },
          timestamp: [currentTime],
          indicators: {
            quote: [{ high: [76.20], open: [74.80], low: [74.10], volume: [125000], close: [75.50] }],
            adjclose: [{ adjclose: [75.50] }]
          }
        }],
        error: null
      }
    };

    it('should validate and parse price data successfully', () => {
      const result = parser.validateAndParsePriceData(mockResponse);

      expect(result.price).toBe(75.50);
      expect(result.currency).toBe('USD');
      expect(result.unit).toBe('USD per barrel');
      expect(result.source).toBe('Yahoo Finance');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle missing price data', () => {
      const responseWithoutPrice: YahooFinanceResponse = {
        chart: {
          result: [{
            meta: {
              ...mockResponse.chart.result[0]!.meta,
              regularMarketPrice: 0 // Set to 0 to simulate missing price
            },
            timestamp: [currentTime],
            indicators: {
              quote: [{ high: [null], open: [null], low: [null], volume: [null], close: [null] }],
              adjclose: [{ adjclose: [null] }]
            }
          }],
          error: null
        }
      };

      const result = parser.validateAndParsePriceData(responseWithoutPrice);

      expect(result.price).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should reduce confidence for stale data', () => {
      const staleTime = Math.floor(Date.now() / 1000) - (2 * 60 * 60); // 2 hours ago
      const staleResponse: YahooFinanceResponse = {
        chart: {
          result: [{
            meta: {
              ...mockResponse.chart.result[0]!.meta,
              regularMarketTime: staleTime
            },
            timestamp: [staleTime],
            indicators: {
              quote: [{ high: [76.20], open: [74.80], low: [74.10], volume: [125000], close: [75.50] }],
              adjclose: [{ adjclose: [75.50] }]
            }
          }],
          error: null
        }
      };

      const result = parser.validateAndParsePriceData(staleResponse);

      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('Error Handling', () => {
    it('should throw YahooFinanceParserException for invalid responses', async () => {
      const invalidResponse = null as any;

      await expect(parser.parseToCommodityData(invalidResponse))
        .rejects.toThrow(YahooFinanceParserException);

      try {
        await parser.parseToCommodityData(invalidResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(YahooFinanceParserException);
        expect((error as YahooFinanceParserException).errorType)
          .toBe(YahooFinanceParserError.INVALID_RESPONSE);
      }
    });

    it('should include original data in exceptions', async () => {
      const invalidResponse: YahooFinanceResponse = {
        chart: {
          result: [],
          error: { code: 'TEST_ERROR', description: 'Test error description' }
        }
      };

      try {
        await parser.parseToCommodityData(invalidResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(YahooFinanceParserException);
        expect((error as YahooFinanceParserException).originalData).toBeDefined();
      }
    });
  });

  describe('Convenience Functions', () => {
    it('should create parser with createYahooFinanceParser', () => {
      const newParser = createYahooFinanceParser();
      expect(newParser).toBeInstanceOf(YahooFinanceParser);
    });

    it('should parse with parseYahooFinanceToCommodityData', async () => {
      const mockResponse: YahooFinanceResponse = {
        chart: {
          result: [{
            meta: {
              currency: 'USD',
              symbol: 'CL=F',
              exchangeName: 'NYM',
              fullExchangeName: 'NY Mercantile',
              instrumentType: 'FUTURE',
              firstTradeDate: 1640995200,
              regularMarketTime: 1708617600,
              hasPrePostMarketData: false,
              gmtoffset: -18000,
              timezone: 'EST',
              exchangeTimezoneName: 'America/New_York',
              regularMarketPrice: 75.50,
              fiftyTwoWeekHigh: 95.40,
              fiftyTwoWeekLow: 45.30,
              regularMarketDayHigh: 76.20,
              regularMarketDayLow: 74.10,
              regularMarketVolume: 125000,
              shortName: 'Crude Oil',
              chartPreviousClose: 74.25,
              priceHint: 2,
              currentTradingPeriod: {
                pre: { timezone: 'EST', start: 1708617600, end: 1708631000, gmtoffset: -18000 },
                regular: { timezone: 'EST', start: 1708631000, end: 1708659600, gmtoffset: -18000 },
                post: { timezone: 'EST', start: 1708659600, end: 1708674000, gmtoffset: -18000 }
              },
              dataGranularity: '1d',
              range: '1d',
              validRanges: ['1d', '5d', '1mo']
            },
            timestamp: [1708617600],
            indicators: {
              quote: [{ high: [76.20], open: [74.80], low: [74.10], volume: [125000], close: [75.50] }],
              adjclose: [{ adjclose: [75.50] }]
            }
          }],
          error: null
        }
      };

      const result = await parseYahooFinanceToCommodityData(mockResponse);
      expect(result.symbol).toBe('CL=F');
      expect(result.currentPrice).toBe(75.50);
    });

    it('should parse price data with parseYahooFinancePriceDataToCommodityData', () => {
      const mockPriceData: YahooFinancePriceData = {
        currentPrice: 75.50,
        previousClose: 74.25,
        openPrice: 74.80,
        dayHigh: 76.20,
        dayLow: 74.10,
        volume: 125000,
        yearHigh: 95.40,
        yearLow: 45.30,
        priceChange: 1.25,
        percentChange: 1.68,
        currency: 'USD',
        symbol: 'CL=F',
        lastUpdated: '2024-06-22T10:30:00.000Z',
        exchange: 'NYM',
        instrumentType: 'FUTURE'
      };

      const result = parseYahooFinancePriceDataToCommodityData(mockPriceData);
      expect(result.symbol).toBe('CL=F');
      expect(result.currentPrice).toBe(75.50);
    });
  });
});