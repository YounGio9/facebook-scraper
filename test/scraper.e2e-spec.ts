import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('ScraperController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/scraper/login (POST)', () => {
    it('should return 400 without credentials', () => {
      return request(app.getHttpServer())
        .post('/scraper/login')
        .send({})
        .expect(400);
    });

    // This test requires real credentials - skip in CI
    it.skip('should successfully login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/scraper/login')
        .send({
          email: process.env.FACEBOOK_EMAIL,
          password: process.env.FACEBOOK_PASSWORD,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    }, 60000); // Increase timeout for real browser operations
  });

  describe('/scraper/group-posts (POST)', () => {
    it('should return 400 without groupId', () => {
      return request(app.getHttpServer())
        .post('/scraper/group-posts')
        .send({})
        .expect(400);
    });

    // This test requires being logged in and a valid group ID
    it.skip('should scrape posts from a public Facebook group', async () => {
      // First, ensure we're logged in
      await request(app.getHttpServer())
        .post('/scraper/login')
        .send({
          email: process.env.FACEBOOK_EMAIL,
          password: process.env.FACEBOOK_PASSWORD,
        });

      // Then scrape posts
      const response = await request(app.getHttpServer())
        .post('/scraper/group-posts')
        .send({
          groupId: process.env.TEST_GROUP_ID || '2834082050243806', // Example group ID
          maxPosts: 5,
          includeComments: true,
          maxCommentsPerPost: 3,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('posts');
      expect(Array.isArray(response.body.data.posts)).toBe(true);

      // Log the results for debugging
      console.log('Scraped posts:', JSON.stringify(response.body.data, null, 2));

      // Save results to file for analysis
      const debugDir = path.join(process.cwd(), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.join(debugDir, `scrape-results-${timestamp}.json`);
      fs.writeFileSync(filename, JSON.stringify(response.body, null, 2));
      console.log(`Results saved to ${filename}`);
    }, 120000); // 2 minute timeout for scraping
  });
});

// Helper test for debugging specific issues
describe('Debugging Helper Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Enable debug mode
    process.env.DEBUG = 'true';
    process.env.BROWSER_HEADLESS = 'false'; // Run browser in visible mode for debugging

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env.DEBUG = 'false';
    process.env.BROWSER_HEADLESS = 'true';
  });

  // Manual debugging test - run with: npm test -- --testNamePattern="debug HTML structure"
  it.skip('should debug HTML structure when scraping fails', async () => {
    try {
      // Login first
      await request(app.getHttpServer())
        .post('/scraper/login')
        .send({
          email: process.env.FACEBOOK_EMAIL,
          password: process.env.FACEBOOK_PASSWORD,
        });

      // Try to scrape with debug mode on
      const response = await request(app.getHttpServer())
        .post('/scraper/group-posts')
        .send({
          groupId: process.env.TEST_GROUP_ID || '2834082050243806',
          maxPosts: 1,
          includeComments: false,
        });

      // Check if debug file was created
      const debugFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('debug-'));
      if (debugFiles.length > 0) {
        console.log('Debug files created:', debugFiles);

        // Analyze the HTML structure
        const latestDebugFile = debugFiles[debugFiles.length - 1];
        const htmlContent = fs.readFileSync(path.join(process.cwd(), latestDebugFile), 'utf-8');

        // Check for expected elements
        console.log('\nHTML Analysis:');
        console.log('- Contains div[dir="auto"]:', htmlContent.includes('dir="auto"'));
        console.log('- Contains h2 tags:', htmlContent.includes('<h2'));
        console.log('- Contains role="article":', htmlContent.includes('role="article"'));
        console.log('- Contains data-ft attribute:', htmlContent.includes('data-ft'));
        console.log('- HTML file size:', (htmlContent.length / 1024).toFixed(2), 'KB');

        // Look for post-like structures
        const postPatterns = [
          /<h2.*?>.*?<\/h2>/g,
          /dir="auto".*?>.*?</g,
          /role="article"/g,
        ];

        postPatterns.forEach((pattern, index) => {
          const matches = htmlContent.match(pattern);
          console.log(`Pattern ${index + 1} matches:`, matches ? matches.length : 0);
        });
      }

      console.log('\nResponse:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.error('Debug test error:', error);
    }
  }, 180000); // 3 minute timeout for debugging
});