/**
 * Web Search Service Module
 * 
 * Handles OpenAI web search functionality with retry logic, timeout handling,
 * and proper error management. Provides a clean interface for web search operations
 * used as fallback for Yahoo Finance API failures.
 * 
 * @author Web Search Service Module
 * @version 1.0.0
 */

import OpenAI from 'openai';

/**
 * Web search options configuration
 */
export interface WebSearchOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** OpenAI model to use for search */
  model?: string;
}

/**
 * Web search result structure
 */
export interface WebSearchResult {
  /** Search result content */
  content: string;
  /** Search timestamp */
  timestamp: string;
  /** Whether search was successful */
  success: boolean;
  /** Source information */
  sources: Array<{
    name: string;
    date: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Web Search Service for OpenAI integration
 */
export class WebSearchService {
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  /**
   * Perform web search with retry logic and timeout handling
   * 
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search result content
   */
  async performSearch(query: string, options: WebSearchOptions = {}): Promise<string> {
    const { 
      maxRetries = 3, 
      timeout = 30000, 
      model = "gpt-4.1" 
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Performing web search (attempt ${attempt}/${maxRetries}): "${query}"`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
        });
        
        // Create the API call promise using Responses API
        const apiCallPromise = this.client.responses.create({
          model,
          tools: [{ type: "web_search_preview" }],
          tool_choice: { type: "web_search_preview" }, // Force web search for consistent results
          input: query,
        });
        
        // Race between API call and timeout
        const response = await Promise.race([apiCallPromise, timeoutPromise]);
        
        const result = response.output_text;
        
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

  /**
   * Perform web search and return structured result
   * 
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to WebSearchResult
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult> {
    try {
      const content = await this.performSearch(query, options);
      
      return {
        content,
        timestamp: new Date().toISOString(),
        success: true,
        sources: [] // Will be populated by parser if needed
      };
      
    } catch (error) {
      console.error('❌ Web search failed:', error instanceof Error ? error.message : error);
      
      return {
        content: '',
        timestamp: new Date().toISOString(),
        success: false,
        sources: []
      };
    }
  }

  /**
   * Test API connectivity
   * 
   * @returns Promise resolving to connectivity test result
   */
  async testConnectivity(): Promise<boolean> {
    try {
      console.log('\n=== Testing API Connectivity ===');
      
      const testQuery = "What time is it right now?";
      console.log(`Testing with query: "${testQuery}"`);
      
      const result = await this.performSearch(testQuery, {
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

  /**
   * Test web search functionality with commodity query
   * 
   * @returns Promise resolving to functionality test result
   */
  async testFunctionality(): Promise<boolean> {
    try {
      console.log('\n=== Testing Web Search Functionality ===');
      
      const testQuery = "What is the current price of crude oil today?";
      console.log(`Testing with commodity query: "${testQuery}"`);
      
      const result = await this.performSearch(testQuery, {
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
}

/**
 * Create a new WebSearchService instance
 * 
 * @param client - OpenAI client instance
 * @returns WebSearchService instance
 */
export function createWebSearchService(client: OpenAI): WebSearchService {
  return new WebSearchService(client);
}