import { Test, TestingModule } from '@nestjs/testing';
import { ScraperService } from './scraper.service';
import { BrowserService } from './services/browser.service';
import { FacebookService } from './services/facebook.service';
import { FacebookScraperService } from './services/facebook-scraper.service';
import { CookieService } from './services/cookie.service';
import { WebDriver } from 'selenium-webdriver';

describe('ScraperService', () => {
  let service: ScraperService;
  let browserService: BrowserService;
  let facebookService: FacebookService;
  let facebookScraperService: FacebookScraperService;
  let cookieService: CookieService;

  const mockDriver = {
    get: jest.fn(),
    sleep: jest.fn(),
    wait: jest.fn(),
    findElement: jest.fn(),
    findElements: jest.fn(),
    executeScript: jest.fn(),
    getPageSource: jest.fn(),
    getCurrentUrl: jest.fn(),
    getTitle: jest.fn(),
    quit: jest.fn(),
    manage: jest.fn().mockReturnValue({
      getCookies: jest.fn(),
      addCookie: jest.fn(),
      deleteAllCookies: jest.fn(),
    }),
  } as unknown as WebDriver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperService,
        {
          provide: BrowserService,
          useValue: {
            initializeDriver: jest.fn().mockResolvedValue(mockDriver),
            closeDriver: jest.fn(),
          },
        },
        {
          provide: FacebookService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              success: true,
              message: 'Login successful',
            }),
          },
        },
        {
          provide: FacebookScraperService,
          useValue: {
            scrapeGroupPosts: jest.fn().mockResolvedValue({
              name: 'Test Group',
              member_count: 1000,
              posts: [],
            }),
          },
        },
        {
          provide: CookieService,
          useValue: {
            saveCookies: jest.fn(),
            loadCookies: jest.fn().mockResolvedValue([]),
            clearCookies: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScraperService>(ScraperService);
    browserService = module.get<BrowserService>(BrowserService);
    facebookService = module.get<FacebookService>(FacebookService);
    facebookScraperService = module.get<FacebookScraperService>(FacebookScraperService);
    cookieService = module.get<CookieService>(CookieService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should initialize driver and perform Facebook login', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'testpassword',
      };

      const result = await service.login(loginDto);

      expect(browserService.initializeDriver).toHaveBeenCalled();
      expect(facebookService.login).toHaveBeenCalledWith(mockDriver, loginDto);
      expect(cookieService.saveCookies).toHaveBeenCalledWith(mockDriver);
      expect(result).toEqual({
        success: true,
        message: 'Login successful',
      });
    });

    it('should handle login failure', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      jest.spyOn(facebookService, 'login').mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(browserService.closeDriver).toHaveBeenCalledWith(mockDriver);
    });
  });

  describe('scrapeGroupPosts', () => {
    it('should scrape posts from a Facebook group', async () => {
      const groupPostsDto = {
        groupId: '123456789',
        maxPosts: 10,
        includeComments: true,
        maxCommentsPerPost: 5,
      };

      const expectedResult = {
        name: 'Test Group',
        member_count: 1000,
        posts: [
          {
            text: 'Test post content',
            author_name: 'John Doe',
            author_url: 'https://www.facebook.com/user/123',
            url: 'https://www.facebook.com/groups/123456789/posts/987654321',
            timestamp: new Date('2024-01-01'),
            likes_count: 10,
            comments_count: 5,
            shares_count: 2,
            images: ['https://example.com/image1.jpg'],
            comments: [
              {
                author_name: 'Jane Smith',
                author_url: 'https://www.facebook.com/user/456',
                text: 'Great post!',
                likes_count: 2,
                timestamp: new Date('2024-01-02'),
              },
            ],
          },
        ],
      };

      jest.spyOn(facebookScraperService, 'scrapeGroupPosts').mockResolvedValue(expectedResult);

      const result = await service.scrapeGroupPosts(groupPostsDto);

      expect(browserService.initializeDriver).toHaveBeenCalled();
      expect(cookieService.loadCookies).toHaveBeenCalledWith(mockDriver);
      expect(facebookScraperService.scrapeGroupPosts).toHaveBeenCalledWith(mockDriver, groupPostsDto);
      expect(result).toEqual({
        success: true,
        message: `Successfully scraped ${expectedResult.posts.length} posts`,
        data: expectedResult,
      });
    });

    it('should handle scraping errors gracefully', async () => {
      const groupPostsDto = {
        groupId: 'invalid',
        maxPosts: 10,
      };

      jest.spyOn(facebookScraperService, 'scrapeGroupPosts').mockRejectedValue(
        new Error('Group not found'),
      );

      await expect(service.scrapeGroupPosts(groupPostsDto)).rejects.toThrow('Group not found');
      expect(browserService.closeDriver).toHaveBeenCalledWith(mockDriver);
    });

    it('should handle empty posts result', async () => {
      const groupPostsDto = {
        groupId: '123456789',
        maxPosts: 10,
      };

      jest.spyOn(facebookScraperService, 'scrapeGroupPosts').mockResolvedValue({
        name: 'Empty Group',
        member_count: 0,
        posts: [],
      });

      const result = await service.scrapeGroupPosts(groupPostsDto);

      expect(result).toEqual({
        success: true,
        message: 'Successfully scraped 0 posts',
        data: {
          name: 'Empty Group',
          member_count: 0,
          posts: [],
        },
      });
    });
  });

  describe('Driver lifecycle', () => {
    it('should reuse existing driver if available', async () => {
      // First call
      await service.login({
        email: 'test@example.com',
        password: 'testpassword',
      });

      // Second call should reuse driver
      await service.scrapeGroupPosts({
        groupId: '123456789',
      });

      // initializeDriver should only be called once
      expect(browserService.initializeDriver).toHaveBeenCalledTimes(1);
    });
  });
});