import getCache from './cache';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing tokens in the cache
 */
export class TokenService {
  /**
   * Store tokens in the cache
   * @param sessionId The NextAuth session ID
   * @param tokens The tokens to store
   */
  static async storeTokens(
    sessionId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      userId: string;
    }
  ): Promise<void> {
    const cache = await getCache();
    const { accessToken, refreshToken, userId } = tokens;

    try {
      // Store access token with 15-minute expiration
      await cache.set(`auth:${sessionId}:access_token`, accessToken, {
        EX: 15 * 60 // 15 minutes in seconds
      });

      // Store refresh token with 7-day expiration
      await cache.set(`auth:${sessionId}:refresh_token`, refreshToken, {
        EX: 7 * 24 * 60 * 60 // 7 days in seconds
      });

      // Store user ID with same expiration as refresh token
      await cache.set(`auth:${sessionId}:user_id`, userId, {
        EX: 7 * 24 * 60 * 60 // 7 days in seconds
      });

      console.log(`Tokens stored in cache for session ${sessionId}`);
    } catch (error) {
      console.error('Error storing tokens in cache:', error);
      throw error;
    }
  }

  /**
   * Get tokens from the cache
   * @param sessionId The NextAuth session ID
   * @returns The tokens stored for the session
   */
  static async getTokens(
    sessionId: string
  ): Promise<{
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
  }> {
    const cache = await getCache();

    try {
      const [accessToken, refreshToken, userId] = await Promise.all([
        cache.get(`auth:${sessionId}:access_token`),
        cache.get(`auth:${sessionId}:refresh_token`),
        cache.get(`auth:${sessionId}:user_id`)
      ]);

      return {
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        userId: userId || undefined
      };
    } catch (error) {
      console.error('Error getting tokens from cache:', error);
      return {};
    }
  }

  /**
   * Remove tokens from the cache
   * @param sessionId The NextAuth session ID
   */
  static async removeTokens(sessionId: string): Promise<void> {
    const cache = await getCache();

    try {
      await Promise.all([
        cache.del(`auth:${sessionId}:access_token`),
        cache.del(`auth:${sessionId}:refresh_token`),
        cache.del(`auth:${sessionId}:user_id`),
        cache.del(`auth:${sessionId}:logged_out`)
      ]);

      console.log(`Tokens removed from cache for session ${sessionId}`);
    } catch (error) {
      console.error('Error removing tokens from cache:', error);
      throw error;
    }
  }

  /**
   * Mark a session as logged out in the cache
   * @param sessionId The NextAuth session ID
   */
  static async markSessionAsLoggedOut(sessionId: string): Promise<void> {
    try {
      const cache = await getCache();
      
      try {
        // Set a logged_out flag with the same expiry as the refresh token
        await cache.set(`auth:${sessionId}:logged_out`, 'true', {
          EX: 7 * 24 * 60 * 60 // 7 days in seconds
        });
        
        console.log(`Session ${sessionId} marked as logged out in cache`);
      } catch (error) {
        console.error('Error marking session as logged out in cache:', error);
      }
    } catch (cacheConnectionError) {
      console.error('Cache connection error in markSessionAsLoggedOut:', cacheConnectionError);
      // We can continue without throwing an error, as the session will still be invalidated by NextAuth
    }
  }

  /**
   * Check if a session is marked as logged out
   * @param sessionId The NextAuth session ID
   * @returns Whether the session is logged out
   */
  static async isSessionLoggedOut(sessionId: string): Promise<boolean> {
    try {
      const cache = await getCache();
      
      try {
        const loggedOut = await cache.get(`auth:${sessionId}:logged_out`);
        return loggedOut === 'true';
      } catch (error) {
        console.error('Error checking if session is logged out in cache:', error);
        // Default to false if there's an error
        return false;
      }
    } catch (cacheConnectionError) {
      console.error('Cache connection error in isSessionLoggedOut:', cacheConnectionError);
      // Default to false if cache is unavailable
      return false;
    }
  }

  /**
   * Refresh the access token in the cache
   * @param sessionId The NextAuth session ID
   * @param accessToken The new access token
   */
  static async refreshTokens(sessionId: string, accessToken: string): Promise<void> {
    const cache = await getCache();

    try {
      // Store access token with 15-minute expiration
      await cache.set(`auth:${sessionId}:access_token`, accessToken, {
        EX: 15 * 60 // 15 minutes in seconds
      });

      console.log(`Access token refreshed in cache for session ${sessionId}`);
    } catch (error) {
      console.error('Error refreshing tokens in cache:', error);
      throw error;
    }
  }

  /**
   * Generate a unique session ID
   * @returns A unique session ID
   */
  static generateSessionId(): string {
    return uuidv4();
  }
}

export default TokenService;
