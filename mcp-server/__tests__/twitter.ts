import { TwitterApi } from 'twitter-api-v2';

describe('Twitter API v2 - Send Tweet', () => {
  // 这些密钥建议用环境变量管理，不要硬编码在代码里
  const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY!,
    appSecret: process.env.TWITTER_APP_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  it('should send a tweet successfully', async () => {
    const tweetText = `Test tweet from Jest at ${new Date().toISOString()}`;
    const { data } = await client.v2.tweet(tweetText);

    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('text', tweetText);
  });
});
