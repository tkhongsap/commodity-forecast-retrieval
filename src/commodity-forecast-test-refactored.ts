/**
 * Commodity Forecast Test Application - Refactored
 * 
 * Clean, modular main application that orchestrates commodity price fetching
 * and multi-horizon forecast generation using dedicated service modules.
 * This refactored version reduces complexity and improves maintainability.
 * 
 * @author Commodity Forecast Application
 * @version 2.0.0
 */

import { config } from 'dotenv';
import OpenAI from 'openai';
import { CommodityData } from './types/commodity';
import { 
  outputComprehensiveAnalysis,
  displayCommodityDataInConsole,
  displayForecastSummaryInConsole,
  trackDataRetrieval
} from './utils/formatter';
import { createWebSearchService } from './services/web-search-service';
import { createPriceDataService } from './services/price-data-service';
import { createForecastService } from './services/forecast-service';

/**
 * Application configuration
 */
interface AppConfig {
  /** Enable API connectivity testing */
  testConnectivity?: boolean;
  /** Enable web search functionality testing */
  testWebSearch?: boolean;
  /** Enable Yahoo Finance as primary data source */
  useYahooFinance?: boolean;
  /** Enable forecast generation */
  generateForecasts?: boolean;
  /** Enable comprehensive output */
  outputResults?: boolean;
}

/**
 * Main Application Class
 */
class CommodityForecastApp {
  private client: OpenAI;
  private webSearchService: ReturnType<typeof createWebSearchService>;
  private priceDataService: ReturnType<typeof createPriceDataService>;
  private forecastService: ReturnType<typeof createForecastService>;

  constructor() {
    // Load environment variables
    config();
    
    // Validate that the API key is present
    if (!process.env['OPENAI_API_KEY']) {
      console.error('Error: OPENAI_API_KEY environment variable is not set');
      process.exit(1);
    }

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });

    console.log('OpenAI client initialized successfully');

    // Initialize services
    this.webSearchService = createWebSearchService(this.client);
    this.priceDataService = createPriceDataService(this.webSearchService);
    this.forecastService = createForecastService(this.webSearchService);
  }

  /**
   * Run connectivity and functionality tests
   * 
   * @returns Promise resolving to test results
   */
  private async runTests(): Promise<{ connectivity: boolean; functionality: boolean }> {
    console.log('🚀 Starting commodity forecast test...');
    
    // Test API connectivity
    const connectivityTest = await this.webSearchService.testConnectivity();
    
    if (!connectivityTest) {
      console.error('❌ API connectivity test failed. Exiting...');
      return { connectivity: false, functionality: false };
    }
    
    // Test web search functionality
    const functionalityTest = await this.webSearchService.testFunctionality();
    
    if (!functionalityTest) {
      console.error('❌ Web search functionality test failed. Exiting...');
      return { connectivity: connectivityTest, functionality: false };
    }
    
    console.log('\n✅ All tests passed! OpenAI API integration is working correctly.');
    return { connectivity: connectivityTest, functionality: functionalityTest };
  }

  /**
   * Fetch and validate current commodity data
   * 
   * @returns Promise resolving to CommodityData or null
   */
  private async fetchAndValidateCommodityData(): Promise<CommodityData | null> {
    // Fetch current crude oil price
    const searchResult = await this.priceDataService.fetchCurrentCrudeOilPrice({
      useYahooFinance: true,
      useWebSearchFallback: true,
      validatePrice: true,
      useCache: true
    });
    
    if (!searchResult.success) {
      console.error('❌ Failed to fetch crude oil price data');
      return null;
    }
    
    console.log('\n✅ Crude oil price data fetched successfully');
    
    // Extract and validate commodity data
    const commodityData = await this.priceDataService.extractCommodityDataFromSearch(searchResult);
    
    if (!commodityData) {
      trackDataRetrieval('Commodity Data Extraction', false, 'Failed to extract or validate data');
      console.error('❌ Failed to extract or validate commodity data');
      return null;
    }
    
    // Track successful data extraction
    trackDataRetrieval('Commodity Data Extraction', true, `Price: $${commodityData.currentPrice}`);
    
    console.log('\n✅ Commodity data extraction and validation completed');
    console.log(`Current crude oil price: $${commodityData.currentPrice} ${commodityData.currency} ${commodityData.unit}`);
    console.log(`Last updated: ${new Date(commodityData.lastUpdated).toLocaleString()}`);
    console.log(`Sources: ${commodityData.sources.map(s => s.name).join(', ')}`);
    
    return commodityData;
  }

  /**
   * Generate comprehensive analysis with forecasts
   * 
   * @param commodityData - Current commodity data
   * @returns Promise resolving to comprehensive analysis
   */
  private async generateComprehensiveAnalysis(commodityData: CommodityData) {
    // Display commodity data in formatted table
    displayCommodityDataInConsole(commodityData);
    
    // Generate comprehensive commodity analysis with forecasts
    trackDataRetrieval('Multi-Horizon Forecast Generation', true, 'Starting forecast analysis');
    
    const comprehensiveAnalysis = await this.forecastService.createComprehensiveAnalysis(commodityData, {
      validateDiversity: true,
      requestDelay: 2000
    });
    
    // Track successful analysis completion
    trackDataRetrieval('Comprehensive Analysis', true, `Generated ${comprehensiveAnalysis.forecasts.length} forecasts`);
    
    // Display analysis summary
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
    
    return comprehensiveAnalysis;
  }

  /**
   * Output comprehensive analysis results
   * 
   * @param analysis - Comprehensive commodity analysis
   */
  private async outputResults(analysis: any) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 GENERATING COMPREHENSIVE OUTPUT...');
    console.log('='.repeat(80));
    
    const outputResult = await outputComprehensiveAnalysis(analysis);
    
    console.log('\n🎊 COMMODITY FORECAST ANALYSIS COMPLETED SUCCESSFULLY! 🎊');
    console.log('✅ All data has been processed, analyzed, and saved');
    console.log(`📊 Console: Full analysis displayed`);
    console.log(`📁 Files: Saved to ${outputResult.filesWritten.jsonPath.split('/').pop()} and ${outputResult.filesWritten.tablePath.split('/').pop()}`);
    console.log(`📝 Tracking: All operations logged with timestamps`);
  }

  /**
   * Run the complete commodity forecast application
   * 
   * @param config - Application configuration
   */
  async run(config: AppConfig = {}): Promise<void> {
    const {
      testConnectivity = true,
      testWebSearch = true,
      useYahooFinance = true,
      generateForecasts = true,
      outputResults = true
    } = config;

    try {
      // Run tests if enabled
      if (testConnectivity || testWebSearch) {
        const testResults = await this.runTests();
        if (!testResults.connectivity || !testResults.functionality) {
          process.exit(1);
        }
      }
      
      // Fetch and validate commodity data
      const commodityData = await this.fetchAndValidateCommodityData();
      if (!commodityData) {
        process.exit(1);
      }
      
      // Generate forecasts and analysis if enabled
      if (generateForecasts) {
        const analysis = await this.generateComprehensiveAnalysis(commodityData);
        
        // Output results if enabled
        if (outputResults) {
          await this.outputResults(analysis);
        }
      }
      
      console.log('\n🚀 Ready to proceed with forecasting functionality...');
      
    } catch (error) {
      console.error('❌ Error in main application:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

/**
 * Main function to run the application
 */
async function main() {
  const app = new CommodityForecastApp();
  await app.run();
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}

export { CommodityForecastApp, main };