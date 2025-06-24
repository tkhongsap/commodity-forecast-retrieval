/**
 * Forecast Service Module
 * 
 * Handles multi-horizon forecast generation using web search to find expert
 * forecasts from financial institutions, EIA, IEA, and other reliable sources.
 * Provides forecast price parsing, validation, and analysis capabilities.
 * 
 * @author Forecast Service Module
 * @version 1.0.0
 */

import { ForecastData, FORECAST_HORIZONS, CommodityData, CommodityAnalysis, SourceInfo } from '../types/commodity';
import { WebSearchService, WebSearchResult } from './web-search-service';

/**
 * Forecast generation options
 */
export interface ForecastOptions {
  /** Enable forecast diversity validation */
  validateDiversity?: boolean;
  /** Delay between forecast requests (ms) */
  requestDelay?: number;
  /** Maximum confidence threshold for warnings */
  maxConfidenceThreshold?: number;
}

/**
 * Forecast Service for multi-horizon price predictions
 */
export class ForecastService {
  private webSearchService: WebSearchService;

  constructor(webSearchService: WebSearchService) {
    this.webSearchService = webSearchService;
  }

  /**
   * Generate forecast query for specific horizon
   * 
   * @param horizon - Forecast horizon (3-month, 6-month, etc.)
   * @param currentPrice - Current commodity price
   * @returns Formatted forecast query
   */
  private generateForecastQuery(horizon: string, currentPrice: number): string {
    const horizonConfig = FORECAST_HORIZONS.find(h => h.key === horizon);
    
    if (!horizonConfig) {
      throw new Error(`Unknown forecast horizon: ${horizon}`);
    }
    
    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + (horizonConfig.months * 30 * 24 * 60 * 60 * 1000));
    
    return `Based on current crude oil WTI (CL=F) price of $${currentPrice} per barrel, what is the forecast for crude oil prices in ${horizonConfig.months} months (around ${futureDate.toLocaleDateString()})? 

Please provide your response in this format:

${horizonConfig.months}-MONTH FORECAST PRICE: $[specific number] per barrel

Additional details:
1. Expected price range in USD per barrel
2. Key factors that will influence the price over this ${horizonConfig.months}-month period
3. Confidence level of the forecast (as percentage)
4. Market sentiment and trends
5. Major events, seasonal factors, or developments that could impact prices
6. Comparison to current price (percentage change expected)

Please start with the specific forecast price in the format shown above.
Please cite reliable sources such as EIA, IEA, major financial institutions, energy analysts, or commodities research firms.`;
  }

  /**
   * Fetch forecast data for a specific horizon
   * 
   * @param horizon - Forecast horizon
   * @param currentPrice - Current commodity price
   * @returns Promise resolving to forecast search result
   */
  private async fetchForecastData(horizon: string, currentPrice: number): Promise<WebSearchResult> {
    try {
      console.log(`\n=== Fetching ${horizon} Forecast ===`);
      
      const query = this.generateForecastQuery(horizon, currentPrice);
      console.log(`Generating forecast for ${horizon}...`);
      
      const searchResult = await this.webSearchService.search(query, {
        maxRetries: 3,
        timeout: 30000,
        model: "gpt-4.1"
      });
      
      if (searchResult.success) {
        console.log(`✅ ${horizon} forecast data fetched successfully`);
        console.log(`Response length: ${searchResult.content.length} characters`);
      } else {
        console.log(`❌ Failed to fetch ${horizon} forecast`);
      }
      
      return searchResult;
      
    } catch (error) {
      console.error(`❌ Failed to fetch ${horizon} forecast:`, error instanceof Error ? error.message : error);
      
      return {
        content: '',
        timestamp: new Date().toISOString(),
        success: false,
        sources: []
      };
    }
  }

  /**
   * Parse forecast price from search result content
   * 
   * @param content - Search result content
   * @param horizon - Forecast horizon
   * @returns Extracted price or null if parsing fails
   */
  private parseForecastPrice(content: string, horizon: string): number | null {
    const lowerContent = content.toLowerCase();
    
    // Extract horizon number for targeted parsing
    const horizonMonths = parseInt(horizon.split('-')[0] || '3');
    
    // Enhanced patterns with more specific targeting
    const pricePatterns = [
      // NEW: Exact format pattern matching our request (with markdown support)
      new RegExp(`\\*?\\*?${horizonMonths}-month\\s+forecast\\s+price:?\\*?\\*?\\s*\\$?(\\d+\\.?\\d*)`, 'gi'),
      
      // Pattern for "forecast price: $XX" anywhere in text
      /forecast\s+price:?\s*\$?(\d+\.?\d*)\s*per\s*barrel/gi,
      
      // Horizon-specific patterns: "in 3 months: $75", "3-month forecast: $75"
      new RegExp(`(?:in\\s+)?${horizonMonths}\\s*months?[\\s:]*(?:forecast|outlook|target|expected)?[\\s:]*\\$?(\\d+\\.?\\d*)`, 'gi'),
      new RegExp(`${horizonMonths}[\\s-]*month[\\s-]*(?:forecast|outlook|target|expected)[\\s:]*\\$?(\\d+\\.?\\d*)`, 'gi'),
      
      // Range patterns: "$70-80", "$70 to $80", "$70-$80" (take midpoint)
      /(?:forecast|expected|target|outlook)[\s:]*\$?(\d+\.?\d*)\s*(?:to|-|–)\s*\$?(\d+\.?\d*)/gi,
      
      // Pattern for "approximately $XX per barrel"
      /approximately\s*\$?(\d+\.?\d*)\s*per\s*barrel/gi,
      
      // Context-specific patterns
      /(?:price|crude|oil|wti)\s+(?:forecast|expected|target|outlook)[\s:]*\$?(\d+\.?\d*)/gi,
      
      // General forecast patterns (less specific, lower priority)
      /(?:forecast|expected|target|predict)(?:ed)?\s*(?:price\s*)?:?\s*\$?(\d+\.?\d*)/gi,
    ];
    
    let extractedPrice: number | null = null;
    let bestMatch: { price: number; confidence: number } | null = null;
    
    for (let i = 0; i < pricePatterns.length; i++) {
      const pattern = pricePatterns[i];
      if (!pattern) continue;
      const matches = [...lowerContent.matchAll(pattern)];
      
      if (matches.length > 0 && matches[0]) {
        let price: number;
        let confidence = 1.0 - (i * 0.1); // Higher confidence for more specific patterns
        
        if (matches[0][2]) {
          // Range pattern - take the average
          const lowPrice = parseFloat(matches[0][1] || '0');
          const highPrice = parseFloat(matches[0][2] || '0');
          price = (lowPrice + highPrice) / 2;
          confidence += 0.1; // Range patterns are often more reliable
        } else if (matches[0][1]) {
          // Single price pattern
          price = parseFloat(matches[0][1]);
        } else {
          continue;
        }
        
        // Validate the price is reasonable for oil
        if (!isNaN(price) && price > 0 && price < 1000) {
          // Boost confidence for horizon-specific matches
          if (i === 0 || i === 1) {
            confidence += 0.2;
          }
          
          // Only use this price if it's better than what we have
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { price, confidence };
          }
        }
      }
    }
    
    if (bestMatch) {
      extractedPrice = bestMatch.price;
      console.log(`   Extracted price: $${extractedPrice} (confidence: ${bestMatch.confidence.toFixed(2)})`);
    }
    
    return extractedPrice;
  }

  /**
   * Parse confidence level from forecast content
   * 
   * @param content - Search result content
   * @returns Confidence level or null if not found
   */
  private parseConfidenceLevel(content: string): number | null {
    const lowerContent = content.toLowerCase();
    
    const confidencePatterns = [
      // "confidence: 70%", "confidence level: 70%"
      /confidence(?:\s+level)?\s*:?\s*(\d+)%/gi,
      // "70% confidence", "70% certain"
      /(\d+)%\s*(?:confidence|certain|sure|likely)/gi,
      // "high confidence", "medium confidence", "low confidence"
      /(high|medium|low)\s*confidence/gi
    ];
    
    for (const pattern of confidencePatterns) {
      const match = lowerContent.match(pattern);
      if (match) {
        if (match[1] && !isNaN(parseInt(match[1]))) {
          // Numeric confidence
          const confidence = parseInt(match[1]);
          if (confidence >= 0 && confidence <= 100) {
            return confidence;
          }
        } else if (match[1]) {
          // Text-based confidence - convert to numeric
          switch (match[1].toLowerCase()) {
            case 'high': return 80;
            case 'medium': return 60;
            case 'low': return 40;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Parse key factors from forecast content
   * 
   * @param content - Search result content
   * @returns Array of key factors
   */
  private parseKeyFactors(content: string): string[] {
    const factors: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Common oil market factors
    const factorKeywords = [
      'opec', 'supply', 'demand', 'inventory', 'production', 'refinery',
      'geopolitical', 'sanctions', 'weather', 'hurricane', 'seasonal',
      'economic growth', 'recession', 'inflation', 'dollar', 'usd',
      'china', 'russia', 'venezuela', 'iran', 'saudi arabia',
      'shale', 'drilling', 'reserves', 'exports', 'imports'
    ];
    
    factorKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        // Find sentences containing the keyword
        const sentences = content.split(/[.!?]+/);
        sentences.forEach(sentence => {
          if (sentence.toLowerCase().includes(keyword) && sentence.trim().length > 20) {
            factors.push(sentence.trim());
          }
        });
      }
    });
    
    // Remove duplicates and limit to top 5 factors
    return [...new Set(factors)].slice(0, 5);
  }

  /**
   * Calculate percentage change between current and forecast price
   * 
   * @param currentPrice - Current price
   * @param forecastPrice - Forecast price
   * @returns Percentage change
   */
  private calculatePercentageChange(currentPrice: number, forecastPrice: number): number {
    if (currentPrice <= 0) {
      throw new Error('Current price must be greater than zero');
    }
    
    const change = ((forecastPrice - currentPrice) / currentPrice) * 100;
    return Math.round(change * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Create forecast data structure from search result
   * 
   * @param searchResult - Web search result
   * @param horizon - Forecast horizon
   * @param currentPrice - Current commodity price
   * @returns ForecastData or null if parsing fails
   */
  private createForecastData(
    searchResult: WebSearchResult,
    horizon: string,
    currentPrice: number
  ): ForecastData | null {
    try {
      const content = searchResult.content;
      
      // Parse forecast price
      const forecastPrice = this.parseForecastPrice(content, horizon);
      if (!forecastPrice) {
        console.warn(`⚠️ Could not extract forecast price for ${horizon}`);
        return null;
      }
      
      // Calculate percentage change
      const percentageChange = this.calculatePercentageChange(currentPrice, forecastPrice);
      
      // Parse confidence level
      const confidenceLevel = this.parseConfidenceLevel(content);
      
      // Parse key factors
      const keyFactors = this.parseKeyFactors(content);
      
      // Calculate date range
      const horizonConfig = FORECAST_HORIZONS.find(h => h.key === horizon);
      if (!horizonConfig) {
        throw new Error(`Unknown forecast horizon: ${horizon}`);
      }
      
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + (horizonConfig.months * 30 * 24 * 60 * 60 * 1000));
      
      // Create source information
      const sources: SourceInfo[] = [{
        name: 'Web Search Forecast Analysis',
        date: searchResult.timestamp,
        reliability: 'medium' // Default, could be enhanced based on content analysis
      }];
      
      const forecastData: ForecastData = {
        horizon: horizon as '3-month' | '6-month' | '12-month' | '24-month',
        forecastPrice,
        currency: 'USD',
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        percentageChange,
        sources,
        methodology: 'Web Search Analysis with Expert Sources',
        ...(confidenceLevel !== null && { confidenceLevel }),
        ...(keyFactors.length > 0 && { keyFactors })
      };
      
      return forecastData;
      
    } catch (error) {
      console.error(`❌ Error creating forecast data for ${horizon}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Validate forecast diversity to detect suspicious patterns
   * 
   * @param forecasts - Array of forecast data
   * @param currentPrice - Current commodity price
   * @returns Validated forecasts array
   */
  private validateForecastDiversity(forecasts: ForecastData[], currentPrice: number): ForecastData[] {
    console.log('\n🔍 Validating forecast diversity...');
    console.log(`   Received ${forecasts.length} forecasts to validate`);
    
    if (forecasts.length < 2) {
      console.log('   ✅ Not enough data to validate diversity, returning as-is');
      return forecasts; // Not enough data to validate diversity
    }
    
    // Check for identical or suspiciously similar forecasts
    const prices = forecasts.map(f => f.forecastPrice);
    const uniquePrices = [...new Set(prices)];
    
    console.log(`   Forecast prices: ${prices.map(p => `$${p}`).join(', ')}`);
    console.log(`   Unique prices: ${uniquePrices.length}`);
    
    if (uniquePrices.length === 1) {
      console.warn('⚠️ WARNING: All forecasts have identical prices - this is suspicious!');
      console.warn(`   All forecasts: $${uniquePrices[0]}`);
      console.warn('   This suggests a parsing issue or insufficient forecast variation.');
      
      // Log the forecast details for debugging
      forecasts.forEach(forecast => {
        console.warn(`   ${forecast.horizon}: $${forecast.forecastPrice} (${forecast.percentageChange}%)`);
      });
      
      return []; // Return empty array to indicate validation failure
    }
    
    // Check for minimal variation (less than 2% difference between min and max)
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceVariation = ((maxPrice - minPrice) / minPrice) * 100;
    
    if (priceVariation < 2) {
      console.warn(`⚠️ WARNING: Very low price variation (${priceVariation.toFixed(1)}%) across forecasts`);
      console.warn('   This may indicate parsing issues or unrealistic forecast similarity.');
      
      // Still return the forecasts but with warning
      forecasts.forEach(forecast => {
        console.warn(`   ${forecast.horizon}: $${forecast.forecastPrice} (${forecast.percentageChange}%)`);
      });
    }
    
    // Check for unrealistic patterns (e.g., all forecasts too close to current price)
    const allChanges = forecasts.map(f => Math.abs(f.percentageChange));
    const maxChange = Math.max(...allChanges);
    
    if (maxChange < 0.5) {
      console.warn('⚠️ WARNING: All forecasts are very close to current price');
      console.warn('   This may indicate the parsing is picking up current price instead of forecasts.');
    }
    
    console.log('✅ Forecast diversity validation completed');
    
    return forecasts;
  }

  /**
   * Generate multi-horizon forecasts for a commodity
   * 
   * @param commodityData - Current commodity data
   * @param options - Forecast generation options
   * @returns Promise resolving to array of forecast data
   */
  async generateMultiHorizonForecasts(
    commodityData: CommodityData, 
    options: ForecastOptions = {}
  ): Promise<ForecastData[]> {
    const { 
      validateDiversity = true, 
      requestDelay = 2000 
    } = options;
    
    const forecasts: ForecastData[] = [];
    
    console.log('\n🔮 Generating Multi-Horizon Forecasts...');
    
    for (const horizonConfig of FORECAST_HORIZONS) {
      try {
        console.log(`\n--- Processing ${horizonConfig.label} ---`);
        
        // Fetch forecast data for this horizon
        const searchResult = await this.fetchForecastData(horizonConfig.key, commodityData.currentPrice);
        
        if (!searchResult.success) {
          console.warn(`⚠️ Failed to fetch data for ${horizonConfig.key}`);
          continue;
        }
        
        // Create forecast data structure
        const forecastData = this.createForecastData(searchResult, horizonConfig.key, commodityData.currentPrice);
        
        if (forecastData) {
          forecasts.push(forecastData);
          console.log(`✅ ${horizonConfig.label}: $${forecastData.forecastPrice} (${forecastData.percentageChange > 0 ? '+' : ''}${forecastData.percentageChange}%)`);
          
          if (forecastData.confidenceLevel) {
            console.log(`   Confidence: ${forecastData.confidenceLevel}%`);
          }
          
          if (forecastData.keyFactors && forecastData.keyFactors.length > 0) {
            console.log(`   Key Factors: ${forecastData.keyFactors.length} identified`);
          }
        } else {
          console.warn(`⚠️ Could not create forecast data for ${horizonConfig.key}`);
        }
        
        // Add delay between requests to be respectful to the API
        if (requestDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, requestDelay));
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${horizonConfig.key}:`, error instanceof Error ? error.message : error);
      }
    }
    
    // Validate forecast diversity if requested
    const validatedForecasts = validateDiversity ? 
      this.validateForecastDiversity(forecasts, commodityData.currentPrice) : 
      forecasts;
    
    console.log(`\n✅ Multi-horizon forecast generation completed. Generated ${validatedForecasts.length}/${FORECAST_HORIZONS.length} forecasts.`);
    
    return validatedForecasts;
  }

  /**
   * Create comprehensive commodity analysis with forecasts
   * 
   * @param commodityData - Current commodity data
   * @param options - Forecast generation options
   * @returns Promise resolving to comprehensive analysis
   */
  async createComprehensiveAnalysis(
    commodityData: CommodityData,
    options: ForecastOptions = {}
  ): Promise<CommodityAnalysis> {
    try {
      console.log('\n📊 Creating Comprehensive Commodity Analysis...');
      
      // Generate forecasts for all horizons
      const forecasts = await this.generateMultiHorizonForecasts(commodityData, options);
      
      // Determine overall trend based on forecasts
      let overallTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      
      if (forecasts.length > 0) {
        const avgPercentageChange = forecasts.reduce((sum, f) => sum + f.percentageChange, 0) / forecasts.length;
        
        if (avgPercentageChange > 5) {
          overallTrend = 'bullish';
        } else if (avgPercentageChange < -5) {
          overallTrend = 'bearish';
        }
      }
      
      // Collect risk factors from all forecasts
      const allKeyFactors = forecasts.flatMap(f => f.keyFactors || []);
      const riskFactors = [...new Set(allKeyFactors)].slice(0, 10); // Top 10 unique factors
      
      // Create comprehensive analysis
      const analysis: CommodityAnalysis = {
        commodity: commodityData,
        forecasts,
        analysisDate: new Date().toISOString(),
        overallTrend,
        marketSentiment: overallTrend === 'bullish' ? 'Positive outlook with expected price increases' :
                         overallTrend === 'bearish' ? 'Negative outlook with expected price decreases' :
                         'Mixed signals with uncertain price direction',
        ...(riskFactors.length > 0 && { riskFactors })
      };
      
      console.log(`✅ Comprehensive analysis completed!`);
      console.log(`   Overall Trend: ${overallTrend.toUpperCase()}`);
      console.log(`   Forecasts Generated: ${forecasts.length}`);
      console.log(`   Risk Factors Identified: ${riskFactors.length}`);
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Error creating comprehensive analysis:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

/**
 * Create a new ForecastService instance
 * 
 * @param webSearchService - Web search service instance
 * @returns ForecastService instance
 */
export function createForecastService(webSearchService: WebSearchService): ForecastService {
  return new ForecastService(webSearchService);
}