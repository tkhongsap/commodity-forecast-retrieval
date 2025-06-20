import { config } from 'dotenv';
import OpenAI from 'openai';
import { 
  CommodityData, 
  WebSearchResult, 
  CRUDE_OIL_CONFIG,
  SourceInfo,
  ParsedPriceData,
  ValidationResult
} from './types/commodity';

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
        console.log('\n✅ Commodity data extraction and validation completed');
        console.log(`Current crude oil price: $${commodityData.currentPrice} ${commodityData.currency} ${commodityData.unit}`);
        console.log(`Last updated: ${new Date(commodityData.lastUpdated).toLocaleString()}`);
        console.log(`Sources: ${commodityData.sources.map(s => s.name).join(', ')}`);
      } else {
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