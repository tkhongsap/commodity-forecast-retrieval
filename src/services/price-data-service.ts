/**
 * Price Data Service Module
 * 
 * Handles current crude oil price fetching with Yahoo Finance as primary source
 * and OpenAI web search as fallback. Provides price parsing, validation,
 * and commodity data extraction capabilities.
 * 
 * @author Price Data Service Module
 * @version 1.0.0
 */

import { CommodityData, SourceInfo, ParsedPriceData, ValidationResult, CRUDE_OIL_CONFIG } from '../types/commodity';
import { WebSearchService, WebSearchResult } from './web-search-service';
import { getYahooFinanceService } from './yahoo-finance-service';
import { trackDataRetrieval } from '../utils/formatter';

/**
 * Price data service options
 */
export interface PriceDataOptions {
  /** Enable Yahoo Finance as primary source */
  useYahooFinance?: boolean;
  /** Enable web search fallback */
  useWebSearchFallback?: boolean;
  /** Enable price validation */
  validatePrice?: boolean;
  /** Use caching for Yahoo Finance */
  useCache?: boolean;
}

/**
 * Price Data Service for current commodity prices
 */
export class PriceDataService {
  private webSearchService: WebSearchService;

  constructor(webSearchService: WebSearchService) {
    this.webSearchService = webSearchService;
  }

  /**
   * Fetch current crude oil price with Yahoo Finance primary and web search fallback
   * 
   * @param options - Price data fetching options
   * @returns Promise resolving to WebSearchResult
   */
  async fetchCurrentCrudeOilPrice(options: PriceDataOptions = {}): Promise<WebSearchResult> {
    const {
      useYahooFinance = true,
      useWebSearchFallback = true,
      validatePrice = true,
      useCache = true
    } = options;

    try {
      console.log('\n=== Fetching Current Crude Oil Price ===');
      
      // Try Yahoo Finance first if enabled
      if (useYahooFinance) {
        try {
          console.log('Attempting to fetch from Yahoo Finance (primary source)...');
          
          const yahooFinanceService = getYahooFinanceService();
          const quoteData = await yahooFinanceService.getQuoteData('CL=F', {
            validatePrice,
            useCache
          });
          
          // Track successful Yahoo Finance retrieval
          trackDataRetrieval('Yahoo Finance API', true, `Price: $${quoteData.currentPrice}`);
          
          // Format Yahoo Finance data as WebSearchResult for compatibility
          const yahooResult: WebSearchResult = {
            content: `Current WTI Crude Oil (CL=F) price: $${quoteData.currentPrice} USD per barrel
Last updated: ${new Date(quoteData.lastUpdated).toLocaleString()}
Exchange: ${quoteData.exchange}
Day Range: $${quoteData.dayLow} - $${quoteData.dayHigh}
Previous Close: $${quoteData.previousClose}
Change: ${quoteData.priceChange > 0 ? '+' : ''}${quoteData.priceChange.toFixed(2)} (${quoteData.percentChange.toFixed(2)}%)
Volume: ${quoteData.volume.toLocaleString()}
Source: Yahoo Finance`,
            timestamp: new Date().toISOString(),
            success: true,
            sources: [{
              name: 'Yahoo Finance',
              date: quoteData.lastUpdated,
              reliability: 'high'
            }]
          };
          
          console.log('✅ Yahoo Finance data fetched successfully');
          console.log(`Current price: $${quoteData.currentPrice} USD per barrel`);
          console.log(`Data source: Yahoo Finance (primary)`);
          
          return yahooResult;
          
        } catch (yahooError) {
          // Log Yahoo Finance error but continue to fallback
          console.warn('⚠️ Yahoo Finance API failed, falling back to OpenAI web search');
          console.warn('Error:', yahooError instanceof Error ? yahooError.message : yahooError);
          
          // Track Yahoo Finance failure
          trackDataRetrieval('Yahoo Finance API', false, yahooError instanceof Error ? yahooError.message : 'Unknown error');
        }
      }
      
      // Fallback to OpenAI web search if enabled
      if (useWebSearchFallback) {
        console.log('Using OpenAI web search as fallback data source...');
        
        const query = `What is the current price of crude oil WTI (CL=F) today? Please provide the latest price in USD per barrel with the source and timestamp.`;
        
        console.log('Fetching crude oil price data via web search...');
        
        const searchResult = await this.webSearchService.search(query, {
          maxRetries: 3,
          timeout: 25000,
          model: "gpt-4.1"
        });
        
        if (searchResult.success) {
          // Track successful OpenAI fallback
          trackDataRetrieval('OpenAI Web Search (Fallback)', true, 'Used as fallback after Yahoo Finance failure');
          
          console.log('✅ Crude oil price data fetched successfully via OpenAI');
          console.log(`Response length: ${searchResult.content.length} characters`);
          console.log(`Data source: OpenAI Web Search (fallback)`);
          
          return searchResult;
        }
      }
      
      // If all sources fail
      console.error('❌ Failed to fetch crude oil price from all sources');
      trackDataRetrieval('All Data Sources', false, 'Both Yahoo Finance and OpenAI failed');
      
      return {
        content: '',
        timestamp: new Date().toISOString(),
        success: false,
        sources: []
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch crude oil price from all sources:', error instanceof Error ? error.message : error);
      
      // Track complete failure
      trackDataRetrieval('All Data Sources', false, 'Both Yahoo Finance and OpenAI failed');
      
      return {
        content: '',
        timestamp: new Date().toISOString(),
        success: false,
        sources: []
      };
    }
  }

  /**
   * Parse price data from web search results
   * 
   * @param searchResult - Web search result
   * @returns Parsed price data
   */
  parsePriceFromSearchResult(searchResult: WebSearchResult): ParsedPriceData {
    const content = searchResult.content.toLowerCase();
    
    // Check if this is Yahoo Finance formatted data
    const isYahooFinance = content.includes('yahoo finance') || 
                          (searchResult.sources && searchResult.sources.length > 0 && 
                           searchResult.sources[0]?.name === 'Yahoo Finance');
    
    // Regular expressions to match different price formats
    const pricePatterns = [
      // $75.50, $75.5, $75
      /\$(\d+\.?\d*)\s*(?:per\s+barrel|\/barrel|barrel)?/gi,
      // 75.50 USD, 75.5 USD
      /(\d+\.?\d*)\s*usd\s*(?:per\s+barrel|\/barrel|barrel)?/gi,
      // 75.50 dollars, 75.5 dollars  
      /(\d+\.?\d*)\s*dollars?\s*(?:per\s+barrel|\/barrel|barrel)?/gi,
      // WTI: 75.50, crude: 75.50
      /(?:wti|crude|oil)[:\s]+\$?(\d+\.?\d*)/gi,
      // Price: $75.50
      /price[:\s]+\$?(\d+\.?\d*)/gi
    ];
    
    let extractedPrice: number | null = null;
    let confidence = 0;
    
    // Try each pattern to find a price
    for (const pattern of pricePatterns) {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0 && matches[0] && matches[0][1]) {
        // Get the first match and extract the numeric value
        const priceStr = matches[0][1];
        const price = parseFloat(priceStr);
        
        if (!isNaN(price) && price > 0 && price < 1000) { // Reasonable oil price range
          extractedPrice = price;
          
          // Calculate confidence based on context
          if (content.includes('wti') || content.includes('cl=f')) confidence += 0.3;
          if (content.includes('barrel')) confidence += 0.2;
          if (content.includes('crude oil')) confidence += 0.2;
          if (content.includes('current') || content.includes('today')) confidence += 0.2;
          if (content.includes('$') || content.includes('usd')) confidence += 0.1;
          
          // Boost confidence for Yahoo Finance data
          if (isYahooFinance) confidence += 0.2;
          
          break;
        }
      }
    }
    
    // Extract source information from content
    let sourceInfo = 'Web Search Result';
    
    if (isYahooFinance) {
      sourceInfo = 'Yahoo Finance';
    } else {
      const sourcePatterns = [
        /source[:\s]+([^.\n]+)/gi,
        /according to ([^,.\n]+)/gi,
        /reported by ([^,.\n]+)/gi,
        /from ([^,.\n]+)/gi
      ];
      
      for (const pattern of sourcePatterns) {
        const match = content.match(pattern);
        if (match && match[1] && typeof match[1] === 'string') {
          sourceInfo = match[1].trim();
          confidence += 0.1;
          break;
        }
      }
    }
    
    return {
      price: extractedPrice,
      currency: 'USD',
      unit: 'per barrel',
      source: sourceInfo,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Validate price data
   * 
   * @param parsedData - Parsed price data
   * @returns Validation result
   */
  validatePriceData(parsedData: ParsedPriceData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate price
    if (parsedData.price === null) {
      errors.push('Price is null or could not be extracted');
    } else if (parsedData.price <= 0) {
      errors.push(`Invalid price: ${parsedData.price}. Price must be positive`);
    } else if (parsedData.price < 10) {
      warnings.push(`Unusually low oil price: $${parsedData.price}. Please verify.`);
    } else if (parsedData.price > 200) {
      warnings.push(`Unusually high oil price: $${parsedData.price}. Please verify.`);
    }
    
    // Validate currency
    if (parsedData.currency !== 'USD') {
      warnings.push(`Expected USD currency, got: ${parsedData.currency}`);
    }
    
    // Validate unit
    if (!parsedData.unit.includes('barrel')) {
      warnings.push(`Expected barrel unit, got: ${parsedData.unit}`);
    }
    
    // Validate confidence
    if (parsedData.confidence < 0.3) {
      warnings.push(`Low confidence in extracted data: ${(parsedData.confidence * 100).toFixed(1)}%`);
    }
    
    // Validate source
    if (!parsedData.source || parsedData.source.trim() === '') {
      warnings.push('No source information available');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create commodity data structure from price and sources
   * 
   * @param price - Current price
   * @param sources - Source information
   * @param lastUpdated - Last update timestamp
   * @returns CommodityData structure
   */
  createCommodityDataStructure(
    price: number,
    sources: SourceInfo[],
    lastUpdated: string
  ): CommodityData {
    return {
      symbol: CRUDE_OIL_CONFIG.symbol,
      name: CRUDE_OIL_CONFIG.name,
      type: CRUDE_OIL_CONFIG.type,
      unit: CRUDE_OIL_CONFIG.unit,
      currentPrice: price,
      currency: CRUDE_OIL_CONFIG.currency,
      lastUpdated,
      sources
    };
  }

  /**
   * Extract comprehensive commodity data from search results
   * 
   * @param searchResult - Web search result
   * @returns Promise resolving to CommodityData or null
   */
  async extractCommodityDataFromSearch(searchResult: WebSearchResult): Promise<CommodityData | null> {
    try {
      console.log('Parsing price data from search result...');
      
      const parsedData = this.parsePriceFromSearchResult(searchResult);
      
      // Validate the parsed price data
      const priceValidation = this.validatePriceData(parsedData);
      
      if (!priceValidation.isValid) {
        console.error('❌ Price data validation failed:');
        priceValidation.errors.forEach(error => console.error(`  - ${error}`));
        return null;
      }
      
      if (priceValidation.warnings.length > 0) {
        console.warn('⚠️ Price data validation warnings:');
        priceValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }
      
      if (!parsedData.price) {
        console.error('❌ Could not extract price from search result');
        return null;
      }
      
      console.log(`✅ Extracted price: $${parsedData.price} ${parsedData.unit}`);
      console.log(`Confidence level: ${(parsedData.confidence * 100).toFixed(1)}%`);
      
      // Create source information
      const sources: SourceInfo[] = [{
        name: parsedData.source,
        date: searchResult.timestamp,
        reliability: parsedData.confidence > 0.7 ? 'high' : 
                     parsedData.confidence > 0.4 ? 'medium' : 'low'
      }];
      
      // Create commodity data structure
      const commodityData = this.createCommodityDataStructure(
        parsedData.price,
        sources,
        searchResult.timestamp
      );
      
      return commodityData;
      
    } catch (error) {
      console.error('❌ Error extracting commodity data:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

/**
 * Create a new PriceDataService instance
 * 
 * @param webSearchService - Web search service instance
 * @returns PriceDataService instance
 */
export function createPriceDataService(webSearchService: WebSearchService): PriceDataService {
  return new PriceDataService(webSearchService);
}