import { config } from 'dotenv';
import OpenAI from 'openai';
import { 
  CommodityData, 
  WebSearchResult, 
  CRUDE_OIL_CONFIG,
  SourceInfo,
  ParsedPriceData,
  ValidationResult,
  ForecastData,
  FORECAST_HORIZONS
} from './types/commodity';
import { 
  outputComprehensiveAnalysis,
  displayCommodityDataInConsole,
  displayForecastSummaryInConsole,
  trackDataRetrieval
} from './utils/formatter';

// Load environment variables
config();

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

// Validate that the API key is present
if (!process.env['OPENAI_API_KEY']) {
  console.error('Error: OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

console.log('OpenAI client initialized successfully');

// Interface for web search options
interface WebSearchOptions {
  maxRetries?: number;
  timeout?: number;
  model?: string;
}

// Enhanced reusable web search function with proper error handling
async function performWebSearch(
  query: string, 
  options: WebSearchOptions = {}
): Promise<string> {
  const { 
    maxRetries = 3, 
    timeout = 30000, 
    model = "gpt-4o-search-preview" 
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Performing web search (attempt ${attempt}/${maxRetries}): "${query}"`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });
      
      // Create the API call promise
      const apiCallPromise = client.chat.completions.create({
        model,
        web_search_options: {},
        messages: [
          {
            role: "user",
            content: query,
          }
        ],
      });
      
      // Race between API call and timeout
      const completion = await Promise.race([apiCallPromise, timeoutPromise]);
      
      const result = completion.choices[0]?.message?.content;
      
      if (!result) {
        throw new Error('No response content received from OpenAI web search');
      }
      
      console.log(`Web search completed successfully on attempt ${attempt}`);
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Web search attempt ${attempt} failed:`, lastError.message);
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Web search failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Function to fetch current crude oil (CL=F) price via web search
async function fetchCurrentCrudeOilPrice(): Promise<WebSearchResult> {
  try {
    console.log('\n=== Fetching Current Crude Oil Price ===');
    
    const query = `What is the current price of crude oil WTI (CL=F) today? Please provide the latest price in USD per barrel with the source and timestamp.`;
    
    console.log('Fetching crude oil price data...');
    
    const result = await performWebSearch(query, {
      maxRetries: 3,
      timeout: 25000,
      model: "gpt-4o-search-preview"
    });
    
    const searchResult: WebSearchResult = {
      content: result,
      timestamp: new Date().toISOString(),
      success: true,
      sources: [] // Will be populated by parser
    };
    
    console.log('✅ Crude oil price data fetched successfully');
    console.log(`Response length: ${result.length} characters`);
    
    return searchResult;
    
  } catch (error) {
    console.error('❌ Failed to fetch crude oil price:', error instanceof Error ? error.message : error);
    
    return {
      content: '',
      timestamp: new Date().toISOString(),
      success: false,
      sources: []
    };
  }
}

// Parser to extract price data from web search results
function parsePriceFromSearchResult(searchResult: WebSearchResult): ParsedPriceData {
  const content = searchResult.content.toLowerCase();
  
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
        
        break;
      }
    }
  }
  
  // Extract source information from content
  let sourceInfo = 'Web Search Result';
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
  
  return {
    price: extractedPrice,
    currency: 'USD',
    unit: 'per barrel',
    source: sourceInfo,
    confidence: Math.min(confidence, 1.0)
  };
}

// Enhanced function to extract comprehensive commodity data
async function extractCommodityDataFromSearch(searchResult: WebSearchResult): Promise<CommodityData | null> {
  try {
    console.log('Parsing price data from search result...');
    
    const parsedData = parsePriceFromSearchResult(searchResult);
    
    // Validate the parsed price data
    const priceValidation = validatePriceData(parsedData);
    
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
    const commodityData = createCommodityDataStructure(
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

// Data validation functions for retrieved price information
function validatePriceData(parsedData: ParsedPriceData): ValidationResult {
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

function validateCommodityData(commodityData: CommodityData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate symbol
  if (commodityData.symbol !== CRUDE_OIL_CONFIG.symbol) {
    errors.push(`Expected symbol ${CRUDE_OIL_CONFIG.symbol}, got: ${commodityData.symbol}`);
  }
  
  // Validate current price
  if (commodityData.currentPrice <= 0) {
    errors.push(`Invalid current price: ${commodityData.currentPrice}`);
  }
  
  // Validate currency
  if (commodityData.currency !== CRUDE_OIL_CONFIG.currency) {
    errors.push(`Expected currency ${CRUDE_OIL_CONFIG.currency}, got: ${commodityData.currency}`);
  }
  
  // Validate unit
  if (commodityData.unit !== CRUDE_OIL_CONFIG.unit) {
    errors.push(`Expected unit ${CRUDE_OIL_CONFIG.unit}, got: ${commodityData.unit}`);
  }
  
  // Validate last updated timestamp
  const lastUpdated = new Date(commodityData.lastUpdated);
  const now = new Date();
  const timeDifference = now.getTime() - lastUpdated.getTime();
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  
  if (isNaN(lastUpdated.getTime())) {
    errors.push('Invalid lastUpdated timestamp format');
  } else if (hoursDifference > 24) {
    warnings.push(`Data is ${hoursDifference.toFixed(1)} hours old`);
  }
  
  // Validate sources
  if (!commodityData.sources || commodityData.sources.length === 0) {
    warnings.push('No source information available');
  } else {
    commodityData.sources.forEach((source, index) => {
      if (!source.name || source.name.trim() === '') {
        warnings.push(`Source ${index + 1} has no name`);
      }
      if (!source.date || isNaN(new Date(source.date).getTime())) {
        warnings.push(`Source ${index + 1} has invalid date`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function validateWebSearchResult(searchResult: WebSearchResult): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate success status
  if (!searchResult.success) {
    errors.push('Web search was not successful');
  }
  
  // Validate content
  if (!searchResult.content || searchResult.content.trim() === '') {
    errors.push('No content in search result');
  } else if (searchResult.content.length < 50) {
    warnings.push('Search result content is very short');
  }
  
  // Validate timestamp
  const timestamp = new Date(searchResult.timestamp);
  if (isNaN(timestamp.getTime())) {
    errors.push('Invalid timestamp format');
  }
  
  // Check for relevant content
  const content = searchResult.content.toLowerCase();
  const relevantTerms = ['oil', 'crude', 'wti', 'barrel', 'price'];
  const foundTerms = relevantTerms.filter(term => content.includes(term));
  
  if (foundTerms.length === 0) {
    warnings.push('Search result may not be relevant to crude oil pricing');
  } else if (foundTerms.length < 2) {
    warnings.push('Search result has limited relevant content');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Enhanced extraction function with validation
async function extractAndValidateCommodityData(searchResult: WebSearchResult): Promise<CommodityData | null> {
  try {
    console.log('\n=== Validating and Extracting Commodity Data ===');
    
    // First validate the search result
    const searchValidation = validateWebSearchResult(searchResult);
    
    if (!searchValidation.isValid) {
      console.error('❌ Search result validation failed:');
      searchValidation.errors.forEach(error => console.error(`  - ${error}`));
      return null;
    }
    
    if (searchValidation.warnings.length > 0) {
      console.warn('⚠️ Search result validation warnings:');
      searchValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    // Extract data
    const commodityData = await extractCommodityDataFromSearch(searchResult);
    
    if (!commodityData) {
      console.error('❌ Failed to extract commodity data');
      return null;
    }
    
    // Validate the extracted commodity data
    const dataValidation = validateCommodityData(commodityData);
    
    if (!dataValidation.isValid) {
      console.error('❌ Commodity data validation failed:');
      dataValidation.errors.forEach(error => console.error(`  - ${error}`));
      return null;
    }
    
    if (dataValidation.warnings.length > 0) {
      console.warn('⚠️ Commodity data validation warnings:');
      dataValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    console.log('✅ Data validation passed successfully');
    return commodityData;
    
  } catch (error) {
    console.error('❌ Error in validation and extraction:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Function to create a basic commodity data structure
function createCommodityDataStructure(
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

// Multi-Horizon Forecast Generation Functions

// Generate forecast query for specific horizon
function generateForecastQuery(horizon: string, currentPrice: number): string {
  const horizonConfig = FORECAST_HORIZONS.find(h => h.key === horizon);
  
  if (!horizonConfig) {
    throw new Error(`Unknown forecast horizon: ${horizon}`);
  }
  
  const currentDate = new Date();
  const futureDate = new Date(currentDate.getTime() + (horizonConfig.months * 30 * 24 * 60 * 60 * 1000));
  
  return `Based on current crude oil WTI (CL=F) price of $${currentPrice} per barrel, what is the forecast for crude oil prices in ${horizonConfig.months} months (around ${futureDate.toLocaleDateString()})? 

Please provide:
1. Expected price range in USD per barrel
2. Key factors that will influence the price over this ${horizonConfig.months}-month period
3. Confidence level of the forecast
4. Market sentiment and trends
5. Major events, seasonal factors, or developments that could impact prices
6. Comparison to current price (percentage change expected)

Please cite reliable sources such as EIA, IEA, major financial institutions, energy analysts, or commodities research firms.`;
}

// Fetch forecast data for a specific horizon
async function fetchForecastData(horizon: string, currentPrice: number): Promise<WebSearchResult> {
  try {
    console.log(`\n=== Fetching ${horizon} Forecast ===`);
    
    const query = generateForecastQuery(horizon, currentPrice);
    console.log(`Generating forecast for ${horizon}...`);
    
    const result = await performWebSearch(query, {
      maxRetries: 3,
      timeout: 30000,
      model: "gpt-4o-search-preview"
    });
    
    const searchResult: WebSearchResult = {
      content: result,
      timestamp: new Date().toISOString(),
      success: true,
      sources: []
    };
    
    console.log(`✅ ${horizon} forecast data fetched successfully`);
    console.log(`Response length: ${result.length} characters`);
    
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

// Percentage change calculation logic
function calculatePercentageChange(currentPrice: number, forecastPrice: number): number {
  if (currentPrice <= 0) {
    throw new Error('Current price must be greater than zero');
  }
  
  const change = ((forecastPrice - currentPrice) / currentPrice) * 100;
  return Math.round(change * 100) / 100; // Round to 2 decimal places
}

// Parse forecast price from search result content
function parseForecastPrice(content: string, horizon: string): number | null {
  const lowerContent = content.toLowerCase();
  
  // Extract horizon number for targeted parsing
  const horizonMonths = parseInt(horizon.split('-')[0] || '3');
  
  // Enhanced patterns with more specific targeting
  const pricePatterns = [
    // Horizon-specific patterns: "in 3 months: $75", "3-month forecast: $75"
    new RegExp(`(?:in\\s+)?${horizonMonths}\\s*months?[\\s:]*(?:forecast|outlook|target|expected)?[\\s:]*\\$?(\\d+\\.?\\d*)`, 'gi'),
    new RegExp(`${horizonMonths}[\\s-]*month[\\s-]*(?:forecast|outlook|target|expected)[\\s:]*\\$?(\\d+\\.?\\d*)`, 'gi'),
    
    // Range patterns: "$70-80", "$70 to $80", "$70-$80" (take midpoint)
    /(?:forecast|expected|target|outlook)[\s:]*\$?(\d+\.?\d*)\s*(?:to|-|–)\s*\$?(\d+\.?\d*)/gi,
    
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

// Parse confidence level from forecast content
function parseConfidenceLevel(content: string): number | null {
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

// Parse key factors from forecast content
function parseKeyFactors(content: string): string[] {
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

// Create forecast data structure from search result
function createForecastData(
  searchResult: WebSearchResult,
  horizon: string,
  currentPrice: number
): ForecastData | null {
  try {
    const content = searchResult.content;
    
    // Parse forecast price
    const forecastPrice = parseForecastPrice(content, horizon);
    if (!forecastPrice) {
      console.warn(`⚠️ Could not extract forecast price for ${horizon}`);
      return null;
    }
    
    // Calculate percentage change
    const percentageChange = calculatePercentageChange(currentPrice, forecastPrice);
    
    // Parse confidence level
    const confidenceLevel = parseConfidenceLevel(content);
    
    // Parse key factors
    const keyFactors = parseKeyFactors(content);
    
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

// Generate multi-horizon forecast analysis
async function generateMultiHorizonForecast(commodityData: CommodityData): Promise<ForecastData[]> {
  const forecasts: ForecastData[] = [];
  
  console.log('\n🔮 Generating Multi-Horizon Forecasts...');
  
  for (const horizonConfig of FORECAST_HORIZONS) {
    try {
      console.log(`\n--- Processing ${horizonConfig.label} ---`);
      
      // Fetch forecast data for this horizon
      const searchResult = await fetchForecastData(horizonConfig.key, commodityData.currentPrice);
      
      if (!searchResult.success) {
        console.warn(`⚠️ Failed to fetch data for ${horizonConfig.key}`);
        continue;
      }
      
      // Create forecast data structure
      const forecastData = createForecastData(searchResult, horizonConfig.key, commodityData.currentPrice);
      
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error processing ${horizonConfig.key}:`, error instanceof Error ? error.message : error);
    }
  }
  
  // Validate forecast diversity before returning
  const validatedForecasts = validateForecastDiversity(forecasts, commodityData.currentPrice);
  
  console.log(`\n✅ Multi-horizon forecast generation completed. Generated ${validatedForecasts.length}/${FORECAST_HORIZONS.length} forecasts.`);
  
  return validatedForecasts;
}

// Validation function to detect suspicious forecast patterns
function validateForecastDiversity(forecasts: ForecastData[], _currentPrice: number): ForecastData[] {
  if (forecasts.length < 2) {
    return forecasts; // Not enough data to validate diversity
  }
  
  console.log('\n🔍 Validating forecast diversity...');
  
  // Check for identical or suspiciously similar forecasts
  const prices = forecasts.map(f => f.forecastPrice);
  const uniquePrices = [...new Set(prices)];
  
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
  
  // Validate that longer horizons generally have more uncertainty
  const sortedByHorizon = [...forecasts].sort((a, b) => {
    const aMonths = parseInt(a.horizon.split('-')[0] || '3');
    const bMonths = parseInt(b.horizon.split('-')[0] || '3');
    return aMonths - bMonths;
  });
  
  // Check if longer-term forecasts show reasonable variation
  if (sortedByHorizon.length >= 3) {
    const shortTerm = sortedByHorizon[0];
    const longTerm = sortedByHorizon[sortedByHorizon.length - 1];
    
    if (shortTerm && longTerm) {
      const shortTermChange = Math.abs(shortTerm.percentageChange);
      const longTermChange = Math.abs(longTerm.percentageChange);
    
      if (longTermChange <= shortTermChange) {
        console.warn('⚠️ WARNING: Long-term forecasts show less variation than short-term');
        console.warn('   This is unusual - longer horizons typically have more uncertainty.');
      }
    }
  }
  
  console.log('✅ Forecast diversity validation completed');
  
  return forecasts;
}

// Aggregate all forecast data into comprehensive commodity analysis
import { CommodityAnalysis } from './types/commodity';

async function createComprehensiveCommodityAnalysis(commodityData: CommodityData): Promise<CommodityAnalysis> {
  try {
    console.log('\n📊 Creating Comprehensive Commodity Analysis...');
    
    // Generate forecasts for all horizons
    const forecasts = await generateMultiHorizonForecast(commodityData);
    
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

// Test API connectivity and web search functionality
async function testApiConnectivity(): Promise<boolean> {
  try {
    console.log('\n=== Testing API Connectivity ===');
    
    // Simple connectivity test query
    const testQuery = "What time is it right now?";
    console.log(`Testing with query: "${testQuery}"`);
    
    const result = await performWebSearch(testQuery, {
      maxRetries: 2,
      timeout: 15000
    });
    
    if (result && result.length > 10) {
      console.log('✅ API connectivity test passed');
      console.log('Sample response length:', result.length, 'characters');
      return true;
    } else {
      console.log('❌ API connectivity test failed - insufficient response');
      return false;
    }
  } catch (error) {
    console.error('❌ API connectivity test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Test web search functionality with commodity query
async function testWebSearchFunctionality(): Promise<boolean> {
  try {
    console.log('\n=== Testing Web Search Functionality ===');
    
    const testQuery = "What is the current price of crude oil today?";
    console.log(`Testing with commodity query: "${testQuery}"`);
    
    const result = await performWebSearch(testQuery, {
      maxRetries: 3,
      timeout: 20000
    });
    
    // Check if the result contains relevant commodity information
    const hasRelevantContent = result.toLowerCase().includes('oil') || 
                               result.toLowerCase().includes('crude') ||
                               result.toLowerCase().includes('barrel') ||
                               result.toLowerCase().includes('price');
    
    if (hasRelevantContent) {
      console.log('✅ Web search functionality test passed');
      console.log('Response contains relevant commodity information');
      return true;
    } else {
      console.log('❌ Web search functionality test failed - no relevant content found');
      console.log('Response preview:', result.substring(0, 200) + '...');
      return false;
    }
  } catch (error) {
    console.error('❌ Web search functionality test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Main function to run the commodity forecast test
async function main() {
  try {
    console.log('🚀 Starting commodity forecast test...');
    
    // Test API connectivity first
    const connectivityTest = await testApiConnectivity();
    
    if (!connectivityTest) {
      console.error('❌ API connectivity test failed. Exiting...');
      process.exit(1);
    }
    
    // Test web search functionality
    const functionalityTest = await testWebSearchFunctionality();
    
    if (!functionalityTest) {
      console.error('❌ Web search functionality test failed. Exiting...');
      process.exit(1);
    }
    
    console.log('\n✅ All tests passed! OpenAI API integration is working correctly.');
    
    // Test crude oil data retrieval and processing
    const searchResult = await fetchCurrentCrudeOilPrice();
    
    if (searchResult.success) {
      console.log('\n✅ Crude oil price data fetched successfully');
      
      // Test data extraction and validation
      const commodityData = await extractAndValidateCommodityData(searchResult);
      
      if (commodityData) {
        // Track successful data extraction
        trackDataRetrieval('Commodity Data Extraction', true, `Price: $${commodityData.currentPrice}`);
        
        console.log('\n✅ Commodity data extraction and validation completed');
        console.log(`Current crude oil price: $${commodityData.currentPrice} ${commodityData.currency} ${commodityData.unit}`);
        console.log(`Last updated: ${new Date(commodityData.lastUpdated).toLocaleString()}`);
        console.log(`Sources: ${commodityData.sources.map(s => s.name).join(', ')}`);
        
        // Display commodity data in formatted table
        displayCommodityDataInConsole(commodityData);
        
        // Generate comprehensive commodity analysis with forecasts
        trackDataRetrieval('Multi-Horizon Forecast Generation', true, 'Starting forecast analysis');
        
        const comprehensiveAnalysis = await createComprehensiveCommodityAnalysis(commodityData);
        
        // Track successful analysis completion
        trackDataRetrieval('Comprehensive Analysis', true, `Generated ${comprehensiveAnalysis.forecasts.length} forecasts`);
        
        console.log('\n🎯 Quick Analysis Summary:');
        console.log(`   Overall Market Trend: ${comprehensiveAnalysis.overallTrend.toUpperCase()}`);
        console.log(`   Total Forecasts Generated: ${comprehensiveAnalysis.forecasts.length}`);
        console.log(`   Market Sentiment: ${comprehensiveAnalysis.marketSentiment}`);
        
        if (comprehensiveAnalysis.riskFactors && comprehensiveAnalysis.riskFactors.length > 0) {
          console.log(`   Risk Factors Identified: ${comprehensiveAnalysis.riskFactors.length}`);
        }
        
        // Display forecast summary in console
        if (comprehensiveAnalysis.forecasts.length > 0) {
          displayForecastSummaryInConsole(comprehensiveAnalysis.forecasts);
        }
        
        // Output comprehensive analysis (table + files)
        console.log('\n' + '='.repeat(80));
        console.log('🎉 GENERATING COMPREHENSIVE OUTPUT...');
        console.log('='.repeat(80));
        
        const outputResult = await outputComprehensiveAnalysis(comprehensiveAnalysis);
        
        console.log('\n🎊 COMMODITY FORECAST ANALYSIS COMPLETED SUCCESSFULLY! 🎊');
        console.log('✅ All data has been processed, analyzed, and saved');
        console.log(`📊 Console: Full analysis displayed`);
        console.log(`📁 Files: Saved to ${outputResult.filesWritten.jsonPath.split('/').pop()} and ${outputResult.filesWritten.tablePath.split('/').pop()}`);
        console.log(`📝 Tracking: All operations logged with timestamps`);
        
      } else {
        // Track failed data extraction
        trackDataRetrieval('Commodity Data Extraction', false, 'Failed to extract or validate data');
        console.error('❌ Failed to extract or validate commodity data');
      }
    } else {
      console.error('❌ Failed to fetch crude oil price data');
    }
    
    console.log('\n🚀 Ready to proceed with forecasting functionality...');
    
    // More functionality will be added in subsequent tasks
  } catch (error) {
    console.error('❌ Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
} 