/**
 * Simple HTTP Client for Yahoo Finance
 * Simplified version focusing on core functionality needed for price fetching
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '../types/yahoo-finance';

export interface YahooFinanceHttpClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  getChart<T>(symbol: string, interval?: string, range?: string): Promise<ApiResponse<T>>;
  getStatus(): {
    ready: boolean;
    lastRequest?: Date;
    requestCount: number;
  };
}

class SimpleHttpClient implements YahooFinanceHttpClient {
  private client: AxiosInstance;
  private requestCount = 0;
  private lastRequest?: Date;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YahooFinanceClient/1.0)',
        'Accept': 'application/json, text/plain, */*',
      }
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      this.requestCount++;
      this.lastRequest = new Date();
      
      const response: AxiosResponse<T> = await this.client.get(url, config);
      return response.data;
    } catch (error: any) {
      console.error('HTTP request failed:', error.message);
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  async getChart<T>(symbol: string, interval?: string, range?: string): Promise<ApiResponse<T>> {
    try {
      this.requestCount++;
      this.lastRequest = new Date();
      
      const baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/';
      const url = `${baseUrl}${symbol}`;
      
      // Build query parameters
      const params: any = {};
      if (interval) params.interval = interval;
      if (range) params.range = range;
      
      const response: AxiosResponse<T> = await this.client.get(url, { params });
      
      return {
        data: response.data,
        success: true,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        fromCache: false
      };
    } catch (error: any) {
      console.error('Yahoo Finance API request failed:', error.message);
      
      return {
        data: null,
        success: false,
        error: error.message,
        statusCode: error.response?.status || 500,
        timestamp: new Date().toISOString(),
        fromCache: false
      };
    }
  }

  getStatus() {
    return {
      ready: true,
      lastRequest: this.lastRequest,
      requestCount: this.requestCount
    };
  }
}

let httpClientInstance: YahooFinanceHttpClient | null = null;

export function getHttpClient(): YahooFinanceHttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new SimpleHttpClient();
  }
  return httpClientInstance;
}

// Export for backward compatibility
export { SimpleHttpClient as HttpClient };