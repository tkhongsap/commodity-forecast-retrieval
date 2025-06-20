import { config } from 'dotenv';
import OpenAI from 'openai';

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
    console.log('Ready to proceed with commodity forecasting functionality...');
    
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