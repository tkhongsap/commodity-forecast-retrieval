import { CommodityAnalysis, ForecastData, CommodityData, MarketConsensusForcast } from '../types/commodity';
import { promises as fs } from 'fs';
import { join } from 'path';

// JSON formatter utility for structured data output
export function formatAnalysisAsJSON(analysis: CommodityAnalysis): string {
  try {
    // Create a clean, structured representation
    const formattedAnalysis = {
      metadata: {
        analysisDate: analysis.analysisDate,
        timestamp: new Date().toISOString(),
        generatedBy: 'OpenAI Commodity Forecast System'
      },
      commodity: {
        symbol: analysis.commodity.symbol,
        name: analysis.commodity.name,
        currentPrice: analysis.commodity.currentPrice,
        currency: analysis.commodity.currency,
        unit: analysis.commodity.unit,
        lastUpdated: analysis.commodity.lastUpdated,
        sources: analysis.commodity.sources
      },
      marketAnalysis: {
        overallTrend: analysis.overallTrend,
        marketSentiment: analysis.marketSentiment,
        riskFactors: analysis.riskFactors || [],
        totalForecastsGenerated: analysis.forecasts.length
      },
      forecasts: analysis.forecasts.map(forecast => ({
        horizon: forecast.horizon,
        timeRange: {
          start: new Date(forecast.dateRange.start).toLocaleDateString(),
          end: new Date(forecast.dateRange.end).toLocaleDateString()
        },
        pricing: {
          currentPrice: analysis.commodity.currentPrice,
          forecastPrice: forecast.forecastPrice,
          currency: forecast.currency,
          percentageChange: forecast.percentageChange,
          changeDirection: forecast.percentageChange > 0 ? 'increase' : 
                           forecast.percentageChange < 0 ? 'decrease' : 'neutral'
        },
        confidence: {
          level: forecast.confidenceLevel || null,
          methodology: forecast.methodology
        },
        factors: {
          keyFactors: forecast.keyFactors || [],
          factorCount: (forecast.keyFactors || []).length
        },
        sources: forecast.sources
      }))
    };

    return JSON.stringify(formattedAnalysis, null, 2);
  } catch (error) {
    console.error('Error formatting analysis as JSON:', error);
    throw new Error(`JSON formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Simplified JSON formatter for quick exports
export function formatCommodityDataAsJSON(commodityData: CommodityData): string {
  try {
    const formattedData = {
      timestamp: new Date().toISOString(),
      commodity: commodityData,
      priceInfo: {
        current: `$${commodityData.currentPrice}`,
        currency: commodityData.currency,
        unit: commodityData.unit,
        lastUpdated: new Date(commodityData.lastUpdated).toLocaleString()
      }
    };

    return JSON.stringify(formattedData, null, 2);
  } catch (error) {
    console.error('Error formatting commodity data as JSON:', error);
    throw new Error(`JSON formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// JSON formatter for individual forecasts
export function formatForecastAsJSON(forecast: ForecastData, currentPrice: number): string {
  try {
    const formattedForecast = {
      timestamp: new Date().toISOString(),
      forecast: {
        horizon: forecast.horizon,
        dateRange: {
          start: new Date(forecast.dateRange.start).toLocaleDateString(),
          end: new Date(forecast.dateRange.end).toLocaleDateString(),
          duration: forecast.horizon
        },
        prices: {
          current: currentPrice,
          forecast: forecast.forecastPrice,
          currency: forecast.currency,
          change: {
            absolute: Math.round((forecast.forecastPrice - currentPrice) * 100) / 100,
            percentage: forecast.percentageChange,
            direction: forecast.percentageChange > 0 ? 'bullish' : 
                      forecast.percentageChange < 0 ? 'bearish' : 'neutral'
          }
        },
        analysis: {
          confidenceLevel: forecast.confidenceLevel,
          methodology: forecast.methodology,
          keyFactors: forecast.keyFactors || [],
          sources: forecast.sources
        }
      }
    };

    return JSON.stringify(formattedForecast, null, 2);
  } catch (error) {
    console.error('Error formatting forecast as JSON:', error);
    throw new Error(`JSON formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Table formatter utility for human-readable console display
export function formatAnalysisAsTable(analysis: CommodityAnalysis): string {
  try {
    const lines: string[] = [];
    
    // Header
    lines.push('═'.repeat(80));
    lines.push('                    CRUDE OIL FORECAST ANALYSIS REPORT');
    lines.push('═'.repeat(80));
    lines.push('');
    
    // Current commodity info
    lines.push('📊 CURRENT MARKET DATA');
    lines.push('─'.repeat(50));
    lines.push(`Commodity:     ${analysis.commodity.name} (${analysis.commodity.symbol})`);
    lines.push(`Current Price: $${analysis.commodity.currentPrice} ${analysis.commodity.currency} ${analysis.commodity.unit}`);
    lines.push(`Last Updated:  ${new Date(analysis.commodity.lastUpdated).toLocaleString()}`);
    lines.push(`Data Sources:  ${analysis.commodity.sources.map(s => s.name).join(', ')}`);
    lines.push('');
    
    // Market analysis
    lines.push('🎯 MARKET ANALYSIS');
    lines.push('─'.repeat(50));
    lines.push(`Overall Trend:     ${analysis.overallTrend.toUpperCase()}`);
    lines.push(`Market Sentiment:  ${analysis.marketSentiment}`);
    lines.push(`Analysis Date:     ${new Date(analysis.analysisDate).toLocaleString()}`);
    if (analysis.riskFactors && analysis.riskFactors.length > 0) {
      lines.push(`Risk Factors:      ${analysis.riskFactors.length} identified`);
    }
    lines.push('');
    
    // Forecasts table
    if (analysis.forecasts.length > 0) {
      lines.push('📈 MULTI-HORIZON PRICE FORECASTS');
      lines.push('─'.repeat(80));
      
      // Table header
      lines.push('┌─────────────┬─────────────┬─────────────┬──────────────┬─────────────┐');
      lines.push('│   Horizon   │   Current   │  Forecast   │    Change    │ Confidence  │');
      lines.push('│             │    Price    │    Price    │      %       │    Level    │');
      lines.push('├─────────────┼─────────────┼─────────────┼──────────────┼─────────────┤');
      
      // Table rows
      analysis.forecasts.forEach(forecast => {
        const horizon = forecast.horizon.padEnd(11);
        const current = `$${analysis.commodity.currentPrice}`.padEnd(11);
        const forecastPrice = `$${forecast.forecastPrice}`.padEnd(11);
        const change = `${forecast.percentageChange > 0 ? '+' : ''}${forecast.percentageChange}%`.padEnd(12);
        const confidence = forecast.confidenceLevel ? `${forecast.confidenceLevel}%`.padEnd(11) : 'N/A'.padEnd(11);
        
        lines.push(`│ ${horizon} │ ${current} │ ${forecastPrice} │ ${change} │ ${confidence} │`);
      });
      
      lines.push('└─────────────┴─────────────┴─────────────┴──────────────┴─────────────┘');
      lines.push('');
    }
    
    // Risk factors section
    if (analysis.riskFactors && analysis.riskFactors.length > 0) {
      lines.push('⚠️  KEY RISK FACTORS');
      lines.push('─'.repeat(50));
      analysis.riskFactors.slice(0, 5).forEach((factor, index) => {
        lines.push(`${index + 1}. ${factor.length > 70 ? factor.substring(0, 67) + '...' : factor}`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('─'.repeat(80));
    lines.push(`Generated by OpenAI Commodity Forecast System | ${new Date().toLocaleString()}`);
    lines.push('═'.repeat(80));
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error formatting analysis as table:', error);
    throw new Error(`Table formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Simple table formatter for commodity data only
export function formatCommodityDataAsTable(commodityData: CommodityData): string {
  try {
    const lines: string[] = [];
    
    lines.push('┌─────────────────────────────────────────────────────────┐');
    lines.push('│                COMMODITY PRICE DATA                     │');
    lines.push('├─────────────────────────────────────────────────────────┤');
    lines.push(`│ Symbol:      ${commodityData.symbol.padEnd(43)} │`);
    lines.push(`│ Name:        ${commodityData.name.padEnd(43)} │`);
    lines.push(`│ Price:       $${commodityData.currentPrice} ${commodityData.currency} ${commodityData.unit}`.padEnd(55) + ' │');
    lines.push(`│ Updated:     ${new Date(commodityData.lastUpdated).toLocaleString()}`.padEnd(55) + ' │');
    lines.push(`│ Sources:     ${commodityData.sources.length} source(s)`.padEnd(55) + ' │');
    lines.push('└─────────────────────────────────────────────────────────┘');
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error formatting commodity data as table:', error);
    throw new Error(`Table formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Compact forecast summary table
export function formatForecastSummaryTable(forecasts: ForecastData[]): string {
  try {
    const lines: string[] = [];
    
    lines.push('FORECAST SUMMARY');
    lines.push('─'.repeat(60));
    
    forecasts.forEach(forecast => {
      const trend = forecast.percentageChange > 0 ? '📈' : forecast.percentageChange < 0 ? '📉' : '➡️';
      const change = forecast.percentageChange > 0 ? '+' : '';
      lines.push(`${trend} ${forecast.horizon.padEnd(12)}: $${forecast.forecastPrice.toString().padEnd(8)} (${change}${forecast.percentageChange}%)`);
    });
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error formatting forecast summary table:', error);
    throw new Error(`Table formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// File Writing Functionality

// Ensure output directory exists
async function ensureOutputDirectory(): Promise<void> {
  try {
    const outputDir = join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Error creating output directory:', error);
    throw new Error(`Failed to create output directory: ${error instanceof Error ? error.message : error}`);
  }
}

// Write JSON output to file
export async function writeJSONToFile(
  data: string, 
  filename: string = 'forecast-results.json'
): Promise<string> {
  try {
    await ensureOutputDirectory();
    
    const filePath = join(process.cwd(), 'output', filename);
    await fs.writeFile(filePath, data, 'utf8');
    
    console.log(`✅ JSON data written to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error writing JSON file:', error);
    throw new Error(`Failed to write JSON file: ${error instanceof Error ? error.message : error}`);
  }
}

// Write table output to file
export async function writeTableToFile(
  data: string, 
  filename: string = 'forecast-results.txt'
): Promise<string> {
  try {
    await ensureOutputDirectory();
    
    const filePath = join(process.cwd(), 'output', filename);
    await fs.writeFile(filePath, data, 'utf8');
    
    console.log(`✅ Table data written to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error writing table file:', error);
    throw new Error(`Failed to write table file: ${error instanceof Error ? error.message : error}`);
  }
}

// Write both JSON and table formats with timestamps
export async function writeAnalysisToFiles(analysis: CommodityAnalysis): Promise<{
  jsonPath: string;
  tablePath: string;
}> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timePart = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1];
    const timeNow = timePart ? timePart.split('.')[0] : 'unknown';
    
    const jsonFilename = `crude-oil-forecast-${timestamp}-${timeNow}.json`;
    const tableFilename = `crude-oil-forecast-${timestamp}-${timeNow}.txt`;
    
    // Format the data
    const jsonData = formatAnalysisAsJSON(analysis);
    const tableData = formatAnalysisAsTable(analysis);
    
    // Write both files
    const [jsonPath, tablePath] = await Promise.all([
      writeJSONToFile(jsonData, jsonFilename),
      writeTableToFile(tableData, tableFilename)
    ]);
    
    console.log(`📁 Analysis saved to output folder:`);
    console.log(`   JSON: ${jsonFilename}`);
    console.log(`   Table: ${tableFilename}`);
    
    return { jsonPath, tablePath };
    
  } catch (error) {
    console.error('Error writing analysis files:', error);
    throw new Error(`Failed to write analysis files: ${error instanceof Error ? error.message : error}`);
  }
}

// Quick save function for commodity data only
export async function saveCommodityData(commodityData: CommodityData): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `commodity-data-${timestamp}.json`;
    
    const jsonData = formatCommodityDataAsJSON(commodityData);
    return await writeJSONToFile(jsonData, filename);
    
  } catch (error) {
    console.error('Error saving commodity data:', error);
    throw new Error(`Failed to save commodity data: ${error instanceof Error ? error.message : error}`);
  }
}

// Append forecast to existing log file
export async function appendForecastToLog(
  forecast: ForecastData, 
  currentPrice: number
): Promise<string> {
  try {
    await ensureOutputDirectory();
    
    const logFilePath = join(process.cwd(), 'output', 'forecast-log.txt');
    const timestamp = new Date().toLocaleString();
    
    const logEntry = [
      `\n--- Forecast Entry: ${timestamp} ---`,
      `Horizon: ${forecast.horizon}`,
      `Current Price: $${currentPrice}`,
      `Forecast Price: $${forecast.forecastPrice}`,
      `Change: ${forecast.percentageChange > 0 ? '+' : ''}${forecast.percentageChange}%`,
      `Confidence: ${forecast.confidenceLevel || 'N/A'}%`,
      `Date Range: ${new Date(forecast.dateRange.start).toLocaleDateString()} - ${new Date(forecast.dateRange.end).toLocaleDateString()}`,
      `Methodology: ${forecast.methodology}`,
      '─'.repeat(50),
      ''
    ].join('\n');
    
    await fs.appendFile(logFilePath, logEntry, 'utf8');
    
    console.log(`📝 Forecast appended to log: ${logFilePath}`);
    return logFilePath;
    
  } catch (error) {
    console.error('Error appending to forecast log:', error);
    throw new Error(`Failed to append to forecast log: ${error instanceof Error ? error.message : error}`);
  }
}

// Console Display Functions

// Display formatted table in console
export function displayAnalysisInConsole(analysis: CommodityAnalysis): void {
  try {
    const tableOutput = formatAnalysisAsTable(analysis);
    console.log('\n' + tableOutput + '\n');
  } catch (error) {
    console.error('Error displaying analysis in console:', error);
  }
}

// Display commodity data in console
export function displayCommodityDataInConsole(commodityData: CommodityData): void {
  try {
    const tableOutput = formatCommodityDataAsTable(commodityData);
    console.log('\n' + tableOutput + '\n');
  } catch (error) {
    console.error('Error displaying commodity data in console:', error);
  }
}

// Display forecast summary in console
export function displayForecastSummaryInConsole(forecasts: ForecastData[]): void {
  try {
    const summaryOutput = formatForecastSummaryTable(forecasts);
    console.log('\n' + summaryOutput + '\n');
  } catch (error) {
    console.error('Error displaying forecast summary in console:', error);
  }
}

// Timestamp and Tracking Functions

// Generate timestamp for data retrieval tracking
export function generateTimestamp(): string {
  return new Date().toISOString();
}

// Generate formatted timestamp for filenames
export function generateFileTimestamp(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.');
  return timestamp[0] || 'unknown';
}

// Generate human-readable timestamp
export function generateReadableTimestamp(): string {
  return new Date().toLocaleString();
}

// Track data retrieval with timestamp
export function trackDataRetrieval(operation: string, success: boolean, details?: string): string {
  const timestamp = generateReadableTimestamp();
  const status = success ? '✅ SUCCESS' : '❌ FAILED';
  const message = `[${timestamp}] ${status}: ${operation}`;
  
  if (details) {
    console.log(`${message} - ${details}`);
  } else {
    console.log(message);
  }
  
  return message;
}

// JSON formatter for Market Consensus forecasts
export function formatMarketConsensusForecastAsJSON(forecasts: MarketConsensusForcast[]): string {
  try {
    const formattedForecasts = {
      metadata: {
        forecastType: 'Market Consensus + Risk Adjustment',
        timestamp: new Date().toISOString(),
        generatedBy: 'Hybrid Forecasting Engine',
        totalForecasts: forecasts.length
      },
      forecasts: forecasts.map(forecast => ({
        horizon: forecast.horizon,
        timeRange: {
          start: new Date(forecast.dateRange.start).toLocaleDateString(),
          end: new Date(forecast.dateRange.end).toLocaleDateString()
        },
        pricing: {
          marketConsensusPrice: forecast.marketConsensusPrice,
          riskAdjustedPrice: forecast.riskAdjustedPrice,
          finalForecastPrice: forecast.forecastPrice,
          currency: forecast.currency,
          percentageChange: forecast.percentageChange,
          riskAdjustmentImpact: Math.round(((forecast.riskAdjustedPrice - forecast.marketConsensusPrice) / forecast.marketConsensusPrice) * 10000) / 100
        },
        confidence: {
          level: forecast.confidenceLevel || null,
          interval: forecast.confidenceInterval ? {
            lower: forecast.confidenceInterval.lower,
            upper: forecast.confidenceInterval.upper,
            confidence: forecast.confidenceInterval.confidence
          } : null,
          methodology: forecast.methodology
        },
        riskAnalysis: {
          totalAdjustments: forecast.riskAdjustments?.length || 0,
          riskFactors: forecast.riskAdjustments?.map(adj => ({
            type: adj.riskType,
            impact: adj.adjustmentFactor,
            confidenceImpact: adj.confidenceImpact,
            description: adj.description
          })) || []
        },
        sources: forecast.sources
      }))
    };

    return JSON.stringify(formattedForecasts, null, 2);
  } catch (error) {
    console.error('Error formatting market consensus forecast as JSON:', error);
    throw new Error(`JSON formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Table formatter for Market Consensus forecasts
export function formatMarketConsensusForecastAsTable(forecasts: MarketConsensusForcast[]): string {
  try {
    const lines: string[] = [];
    
    // Header
    lines.push('═'.repeat(100));
    lines.push('                    MARKET CONSENSUS + RISK ADJUSTMENT FORECAST REPORT');
    lines.push('═'.repeat(100));
    lines.push('');
    
    if (forecasts.length > 0) {
      lines.push('📈 HYBRID FORECASTING RESULTS');
      lines.push('─'.repeat(100));
      
      // Enhanced table header
      lines.push('┌─────────────┬─────────────┬─────────────┬─────────────┬──────────────┬─────────────┐');
      lines.push('│   Horizon   │  Consensus  │Risk Adjusted│   Final     │    Change    │ Confidence  │');
      lines.push('│             │    Price    │    Price    │  Forecast   │      %       │    Level    │');
      lines.push('├─────────────┼─────────────┼─────────────┼─────────────┼──────────────┼─────────────┤');
      
      // Table rows
      forecasts.forEach(forecast => {
        const horizon = forecast.horizon.padEnd(11);
        const consensus = `$${forecast.marketConsensusPrice.toFixed(2)}`.padEnd(11);
        const riskAdjusted = `$${forecast.riskAdjustedPrice.toFixed(2)}`.padEnd(11);
        const final = `$${forecast.forecastPrice.toFixed(2)}`.padEnd(11);
        const change = `${forecast.percentageChange > 0 ? '+' : ''}${forecast.percentageChange.toFixed(1)}%`.padEnd(12);
        const confidence = forecast.confidenceLevel ? `${forecast.confidenceLevel}%`.padEnd(11) : 'N/A'.padEnd(11);
        
        lines.push(`│ ${horizon} │ ${consensus} │ ${riskAdjusted} │ ${final} │ ${change} │ ${confidence} │`);
      });
      
      lines.push('└─────────────┴─────────────┴─────────────┴─────────────┴──────────────┴─────────────┘');
      lines.push('');
    }
    
    // Risk adjustments summary
    if (forecasts.length > 0 && forecasts[0] && forecasts[0].riskAdjustments && forecasts[0].riskAdjustments.length > 0) {
      lines.push('⚠️  RISK ADJUSTMENT SUMMARY');
      lines.push('─'.repeat(80));
      
      const allRiskTypes = new Set<string>();
      forecasts.forEach(forecast => {
        forecast.riskAdjustments?.forEach(adj => allRiskTypes.add(adj.riskType));
      });
      
      Array.from(allRiskTypes).slice(0, 5).forEach((riskType, index) => {
        const adjustments = forecasts.map(f => 
          f.riskAdjustments?.find(adj => adj.riskType === riskType)?.adjustmentFactor || 0
        );
        const avgAdjustment = adjustments.reduce((sum, adj) => sum + Math.abs(adj), 0) / adjustments.length;
        lines.push(`${index + 1}. ${riskType.toUpperCase()}: Average ${(avgAdjustment * 100).toFixed(1)}% impact`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('─'.repeat(100));
    lines.push(`Generated by Hybrid Forecasting Engine (Market Consensus + AI Risk Analysis) | ${new Date().toLocaleString()}`);
    lines.push('═'.repeat(100));
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error formatting market consensus forecast as table:', error);
    throw new Error(`Table formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Enhanced analysis table that shows both traditional and market consensus forecasts
export function formatEnhancedAnalysisAsTable(analysis: CommodityAnalysis, marketConsensusForecasts?: MarketConsensusForcast[]): string {
  try {
    const lines: string[] = [];
    
    // Header
    lines.push('═'.repeat(120));
    lines.push('                    ENHANCED CRUDE OIL FORECAST ANALYSIS REPORT');
    lines.push('═'.repeat(120));
    lines.push('');
    
    // Current commodity info
    lines.push('📊 CURRENT MARKET DATA');
    lines.push('─'.repeat(60));
    lines.push(`Commodity:     ${analysis.commodity.name} (${analysis.commodity.symbol})`);
    lines.push(`Current Price: $${analysis.commodity.currentPrice} ${analysis.commodity.currency} ${analysis.commodity.unit}`);
    lines.push(`Last Updated:  ${new Date(analysis.commodity.lastUpdated).toLocaleString()}`);
    lines.push(`Data Sources:  ${analysis.commodity.sources.map(s => s.name).join(', ')}`);
    lines.push('');
    
    // Market analysis
    lines.push('🎯 MARKET ANALYSIS');
    lines.push('─'.repeat(60));
    lines.push(`Overall Trend:     ${analysis.overallTrend.toUpperCase()}`);
    lines.push(`Market Sentiment:  ${analysis.marketSentiment}`);
    lines.push(`Analysis Date:     ${new Date(analysis.analysisDate).toLocaleString()}`);
    if (analysis.riskFactors && analysis.riskFactors.length > 0) {
      lines.push(`Risk Factors:      ${analysis.riskFactors.length} identified`);
    }
    lines.push('');
    
    // Traditional forecasts vs Market consensus comparison
    if (analysis.forecasts.length > 0 && marketConsensusForecasts && marketConsensusForecasts.length > 0) {
      lines.push('📈 FORECAST COMPARISON: TRADITIONAL vs MARKET CONSENSUS + RISK');
      lines.push('─'.repeat(120));
      
      // Enhanced comparison table header
      lines.push('┌─────────────┬──────────────┬─────────────┬─────────────┬─────────────┬──────────────┬─────────────┐');
      lines.push('│   Horizon   │  Traditional │  Consensus  │Risk Adjusted│   Hybrid    │    Change    │ Confidence  │');
      lines.push('│             │   Forecast   │    Price    │    Price    │  Forecast   │      %       │   Levels    │');
      lines.push('├─────────────┼──────────────┼─────────────┼─────────────┼─────────────┼──────────────┼─────────────┤');
      
      // Comparison rows
      const maxLength = Math.max(analysis.forecasts.length, marketConsensusForecasts.length);
      for (let i = 0; i < maxLength; i++) {
        const traditional = analysis.forecasts[i];
        const consensus = marketConsensusForecasts[i];
        
        const horizon = (traditional?.horizon || consensus?.horizon || 'N/A').padEnd(11);
        const tradPrice = traditional ? `$${traditional.forecastPrice.toFixed(2)}`.padEnd(12) : 'N/A'.padEnd(12);
        const consPrice = consensus ? `$${consensus.marketConsensusPrice.toFixed(2)}`.padEnd(11) : 'N/A'.padEnd(11);
        const riskPrice = consensus ? `$${consensus.riskAdjustedPrice.toFixed(2)}`.padEnd(11) : 'N/A'.padEnd(11);
        const hybridPrice = consensus ? `$${consensus.forecastPrice.toFixed(2)}`.padEnd(11) : 'N/A'.padEnd(11);
        const change = consensus ? `${consensus.percentageChange > 0 ? '+' : ''}${consensus.percentageChange.toFixed(1)}%`.padEnd(12) : 'N/A'.padEnd(12);
        const confidence = `${traditional?.confidenceLevel || 'N/A'}% | ${consensus?.confidenceLevel || 'N/A'}%`.padEnd(11);
        
        lines.push(`│ ${horizon} │ ${tradPrice} │ ${consPrice} │ ${riskPrice} │ ${hybridPrice} │ ${change} │ ${confidence} │`);
      }
      
      lines.push('└─────────────┴──────────────┴─────────────┴─────────────┴─────────────┴──────────────┴─────────────┘');
      lines.push('');
    } else if (analysis.forecasts.length > 0) {
      // Fallback to traditional table if no market consensus data
      lines.push('📈 TRADITIONAL FORECASTS');
      lines.push('─'.repeat(80));
      
      lines.push('┌─────────────┬─────────────┬─────────────┬──────────────┬─────────────┐');
      lines.push('│   Horizon   │   Current   │  Forecast   │    Change    │ Confidence  │');
      lines.push('│             │    Price    │    Price    │      %       │    Level    │');
      lines.push('├─────────────┼─────────────┼─────────────┼──────────────┼─────────────┤');
      
      analysis.forecasts.forEach(forecast => {
        const horizon = forecast.horizon.padEnd(11);
        const current = `$${analysis.commodity.currentPrice}`.padEnd(11);
        const forecastPrice = `$${forecast.forecastPrice}`.padEnd(11);
        const change = `${forecast.percentageChange > 0 ? '+' : ''}${forecast.percentageChange}%`.padEnd(12);
        const confidence = forecast.confidenceLevel ? `${forecast.confidenceLevel}%`.padEnd(11) : 'N/A'.padEnd(11);
        
        lines.push(`│ ${horizon} │ ${current} │ ${forecastPrice} │ ${change} │ ${confidence} │`);
      });
      
      lines.push('└─────────────┴─────────────┴─────────────┴──────────────┴─────────────┘');
      lines.push('');
    }
    
    // Risk factors section
    if (analysis.riskFactors && analysis.riskFactors.length > 0) {
      lines.push('⚠️  KEY RISK FACTORS');
      lines.push('─'.repeat(60));
      analysis.riskFactors.slice(0, 5).forEach((factor, index) => {
        lines.push(`${index + 1}. ${factor.length > 70 ? factor.substring(0, 67) + '...' : factor}`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('─'.repeat(120));
    lines.push(`Generated by Enhanced Forecasting System | ${new Date().toLocaleString()}`);
    lines.push('═'.repeat(120));
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error formatting enhanced analysis as table:', error);
    throw new Error(`Table formatting failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Display market consensus forecasts in console
export function displayMarketConsensusForecastsInConsole(forecasts: MarketConsensusForcast[]): void {
  try {
    const tableOutput = formatMarketConsensusForecastAsTable(forecasts);
    console.log('\n' + tableOutput + '\n');
  } catch (error) {
    console.error('Error displaying market consensus forecasts in console:', error);
  }
}

// Write market consensus forecasts to files
export async function writeMarketConsensusForecastsToFiles(forecasts: MarketConsensusForcast[]): Promise<{
  jsonPath: string;
  tablePath: string;
}> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timePart = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1];
    const timeNow = timePart ? timePart.split('.')[0] : 'unknown';
    
    const jsonFilename = `market-consensus-forecast-${timestamp}-${timeNow}.json`;
    const tableFilename = `market-consensus-forecast-${timestamp}-${timeNow}.txt`;
    
    // Format the data
    const jsonData = formatMarketConsensusForecastAsJSON(forecasts);
    const tableData = formatMarketConsensusForecastAsTable(forecasts);
    
    // Write both files
    const [jsonPath, tablePath] = await Promise.all([
      writeJSONToFile(jsonData, jsonFilename),
      writeTableToFile(tableData, tableFilename)
    ]);
    
    console.log(`📁 Market consensus forecasts saved to output folder:`);
    console.log(`   JSON: ${jsonFilename}`);
    console.log(`   Table: ${tableFilename}`);
    
    return { jsonPath, tablePath };
    
  } catch (error) {
    console.error('Error writing market consensus forecast files:', error);
    throw new Error(`Failed to write market consensus forecast files: ${error instanceof Error ? error.message : error}`);
  }
}

// Comprehensive output function that integrates all output methods
export async function outputComprehensiveAnalysis(analysis: CommodityAnalysis): Promise<{
  consoleDisplayed: boolean;
  filesWritten: { jsonPath: string; tablePath: string };
  tracked: string;
}> {
  try {
    console.log('\n🎯 OUTPUTTING COMPREHENSIVE ANALYSIS...');
    
    // Track the operation start
    const trackingMessage = trackDataRetrieval('Comprehensive Analysis Output', true, 'Starting output process');
    
    // Display in console
    displayAnalysisInConsole(analysis);
    console.log('✅ Analysis displayed in console');
    
    // Write to files
    const filePaths = await writeAnalysisToFiles(analysis);
    console.log('✅ Analysis written to files');
    
    // Track completion
    trackDataRetrieval('Comprehensive Analysis Output', true, 'All outputs completed successfully');
    
    console.log('\n🎉 COMPREHENSIVE ANALYSIS OUTPUT COMPLETED!');
    console.log(`📊 Console: Displayed full analysis table`);
    console.log(`📁 Files: JSON and table formats saved`);
    console.log(`📝 Tracking: All operations logged\n`);
    
    return {
      consoleDisplayed: true,
      filesWritten: filePaths,
      tracked: trackingMessage
    };
    
  } catch (error) {
    const errorMessage = `Comprehensive analysis output failed: ${error instanceof Error ? error.message : error}`;
    trackDataRetrieval('Comprehensive Analysis Output', false, errorMessage);
    throw new Error(errorMessage);
  }
}

// Enhanced comprehensive output for both traditional and market consensus forecasts
export async function outputEnhancedAnalysis(
  analysis: CommodityAnalysis, 
  marketConsensusForecasts?: MarketConsensusForcast[]
): Promise<{
  consoleDisplayed: boolean;
  filesWritten: { 
    traditionalFiles: { jsonPath: string; tablePath: string };
    marketConsensusFiles?: { jsonPath: string; tablePath: string };
    enhancedTablePath?: string;
  };
  tracked: string;
}> {
  try {
    console.log('\n🎯 OUTPUTTING ENHANCED ANALYSIS...');
    
    // Track the operation start
    const trackingMessage = trackDataRetrieval('Enhanced Analysis Output', true, 'Starting enhanced output process');
    
    // Display enhanced table in console
    const enhancedTableOutput = formatEnhancedAnalysisAsTable(analysis, marketConsensusForecasts);
    console.log('\n' + enhancedTableOutput + '\n');
    console.log('✅ Enhanced analysis displayed in console');
    
    // Write traditional analysis files
    const traditionalFiles = await writeAnalysisToFiles(analysis);
    console.log('✅ Traditional analysis written to files');
    
    // Write market consensus files if available
    let marketConsensusFiles: { jsonPath: string; tablePath: string } | undefined;
    if (marketConsensusForecasts && marketConsensusForecasts.length > 0) {
      marketConsensusFiles = await writeMarketConsensusForecastsToFiles(marketConsensusForecasts);
      console.log('✅ Market consensus forecasts written to files');
    }
    
    // Write enhanced comparison table
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timePart = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1];
    const timeNow = timePart ? timePart.split('.')[0] : 'unknown';
    const enhancedTableFilename = `enhanced-analysis-${timestamp}-${timeNow}.txt`;
    
    const enhancedTablePath = await writeTableToFile(enhancedTableOutput, enhancedTableFilename);
    console.log(`✅ Enhanced comparison table written to: ${enhancedTableFilename}`);
    
    // Track completion
    trackDataRetrieval('Enhanced Analysis Output', true, 'All enhanced outputs completed successfully');
    
    console.log('\n🎉 ENHANCED ANALYSIS OUTPUT COMPLETED!');
    console.log(`📊 Console: Displayed enhanced comparison table`);
    console.log(`📁 Files: Traditional, market consensus, and enhanced comparison saved`);
    console.log(`📝 Tracking: All operations logged\n`);
    
    return {
      consoleDisplayed: true,
      filesWritten: {
        traditionalFiles,
        marketConsensusFiles,
        enhancedTablePath
      },
      tracked: trackingMessage
    };
    
  } catch (error) {
    const errorMessage = `Enhanced analysis output failed: ${error instanceof Error ? error.message : error}`;
    trackDataRetrieval('Enhanced Analysis Output', false, errorMessage);
    throw new Error(errorMessage);
  }
} 