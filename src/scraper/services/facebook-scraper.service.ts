import { Injectable, Logger } from '@nestjs/common';
import { WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { GroupPost, Comment, GroupPostsDto } from '../dto/group-posts.dto';

@Injectable()
export class FacebookScraperService {
  private readonly logger = new Logger(FacebookScraperService.name);
  private readonly MOBILE_FACEBOOK_URL = 'https://m.facebook.com';

  async scrapeGroupPosts(
    driver: WebDriver,
    groupPostsDto: GroupPostsDto,
  ): Promise<{ name: string | null; member_count: number | null; posts: GroupPost[] }> {
    const { groupId, maxPosts = 50, includeComments = true, maxCommentsPerPost = 20 } = groupPostsDto;

    try {
      // Navigate to mobile group page
      const groupUrl = `${this.MOBILE_FACEBOOK_URL}/groups/${groupId}`;
      this.logger.log(`Navigating to group: ${groupUrl}`);
      await driver.get(groupUrl);

      // Wait for page to load with dynamic content
      await this.waitForPageLoad(driver);
      await driver.sleep(3000); // Additional wait for dynamic content

      // Extract group metadata
      const groupName = await this.extractGroupName(driver);
      const memberCount = await this.extractMemberCount(driver);
      this.logger.log(`Group: ${groupName}, Members: ${memberCount}`);

      // Scroll and load posts
      this.logger.log(`Starting to scrape posts (max: ${maxPosts})...`);
      await this.scrollToLoadPosts(driver, maxPosts);

      // Click "See More" buttons to expand truncated posts
      await this.expandAllPosts(driver);

      // Extract posts
      const posts = await this.extractPosts(driver, maxPosts, includeComments, maxCommentsPerPost);
      this.logger.log(`Successfully extracted ${posts.length} posts`);

      return {
        name: groupName,
        member_count: memberCount,
        posts,
      };
    } catch (error) {
      this.logger.error(`Error scraping group posts: ${error.message}`);
      throw error;
    }
  }

  private async extractGroupName(driver: WebDriver): Promise<string | null> {
    try {
      const selectors = [
        By.css('h3'),
        By.css('h1'),
        By.css('[data-sigil="group-name"]'),
        By.css('div[data-sigil="m-group-header"] h3'),
      ];

      for (const selector of selectors) {
        try {
          const element = await driver.findElement(selector);
          const name = await element.getText();
          if (name && name.trim().length > 0) {
            return name.trim();
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn(`Could not extract group name: ${error.message}`);
    }
    return null;
  }

  private async extractMemberCount(driver: WebDriver): Promise<number | null> {
    try {
      const selectors = [
        By.xpath("//div[contains(text(), 'member') or contains(text(), 'Member')]"),
        By.css('[data-sigil="m-group-members-count"]'),
      ];

      for (const selector of selectors) {
        try {
          const element = await driver.findElement(selector);
          const text = await element.getText();
          const match = text.match(/[\d,\.]+/);
          if (match) {
            const count = match[0].replace(/[,\.]/g, '');
            return parseInt(count, 10);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn(`Could not extract member count: ${error.message}`);
    }
    return null;
  }

  private async scrollToLoadPosts(driver: WebDriver, maxPosts: number): Promise<void> {
    this.logger.log('Scrolling to load more posts...');

    const maxScrollAttempts = Math.ceil(maxPosts / 10) + 5; // Estimate scroll attempts needed
    let scrollAttempts = 0;
    let previousHeight = 0;
    let noNewContentCount = 0;

    while (scrollAttempts < maxScrollAttempts && noNewContentCount < 3) {
      // Scroll to bottom
      await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
      await driver.sleep(2000); // Wait for content to load

      // Check if new content loaded
      const currentHeight = await driver.executeScript<number>('return document.body.scrollHeight;');

      if (currentHeight === previousHeight) {
        noNewContentCount++;
        this.logger.log(`No new content loaded (attempt ${noNewContentCount}/3)`);
      } else {
        noNewContentCount = 0;
        this.logger.log(`Scroll attempt ${scrollAttempts + 1}: Page height increased`);
      }

      previousHeight = currentHeight;
      scrollAttempts++;

      // Try to click "See More Posts" button if it exists
      await this.clickSeeMorePostsButton(driver);
    }

    this.logger.log(`Scrolling complete after ${scrollAttempts} attempts`);
  }

  private async clickSeeMorePostsButton(driver: WebDriver): Promise<void> {
    const buttonSelectors = [
      By.xpath("//a[contains(text(), 'See More') or contains(text(), 'Show more') or contains(text(), 'Ver mais')]"),
      By.xpath("//div[contains(text(), 'See More') or contains(text(), 'Show more') or contains(text(), 'Ver mais')]"),
      By.css('[data-sigil="m-see-more"]'),
    ];

    for (const selector of buttonSelectors) {
      try {
        const buttons = await driver.findElements(selector);
        if (buttons.length > 0) {
          await buttons[0].click();
          this.logger.log('Clicked "See More Posts" button');
          await driver.sleep(1500);
          return;
        }
      } catch (error) {
        // Button not found or not clickable, continue
      }
    }
  }

  private async expandAllPosts(driver: WebDriver): Promise<void> {
    this.logger.log('Expanding truncated posts...');

    const seeMoreSelectors = [
      By.xpath("//a[contains(text(), 'See more') or contains(text(), 'See More')]"),
      By.xpath("//div[@role='button' and contains(text(), 'See more')]"),
    ];

    for (const selector of seeMoreSelectors) {
      try {
        const buttons = await driver.findElements(selector);
        this.logger.log(`Found ${buttons.length} "See more" buttons`);

        // Click up to 20 buttons to avoid infinite loops
        const buttonsToClick = Math.min(buttons.length, 20);
        for (let i = 0; i < buttonsToClick; i++) {
          try {
            await buttons[i].click();
            await driver.sleep(300); // Small delay between clicks
          } catch (error) {
            // Button might be stale or not clickable, skip
          }
        }
      } catch (error) {
        // No buttons found with this selector
      }
    }
  }

  private async extractPosts(
    driver: WebDriver,
    maxPosts: number,
    includeComments: boolean,
    maxCommentsPerPost: number,
  ): Promise<GroupPost[]> {
    const posts: GroupPost[] = [];

    try {
      // Debug: Capture page source if needed
      if (process.env.DEBUG === 'true') {
        const pageSource = await driver.getPageSource();
        this.logger.debug(`Page source length: ${pageSource.length} characters`);
        // Save to file for analysis if needed
        require('fs').writeFileSync('debug-page.html', pageSource);
      }

      // Updated selectors based on current Facebook structure
      const postSelectors = [
        // Try to find posts by their container structure
        By.xpath('//div[@role="feed"]//div[.//h2 and .//div[@dir="auto"]]'),
        By.xpath('//div[.//h2[.//a] and .//div[@dir="auto"]]'),
        By.xpath('//div[contains(@class, "x1ja2u2z") and .//div[@dir="auto"]]'),
        // Fallback selectors
        By.css('div[role="article"]'),
        By.css('div[data-pagelet*="FeedUnit"]'),
        By.css('article'),
        By.css('div.userContentWrapper'), // Desktop Facebook
        By.css('div.story_body_container'), // Mobile Facebook legacy
        By.xpath('//div[@data-ft and contains(@data-ft, "top_level_post")]'),
      ];

      let postElements: WebElement[] = [];

      // Try each selector until we find posts
      for (const selector of postSelectors) {
        try {
          postElements = await driver.findElements(selector);
          if (postElements.length > 0) {
            this.logger.log(`Found ${postElements.length} potential posts using selector: ${selector}`);

            // Validate that these are actually posts
            const validPosts: WebElement[] = [];
            for (const element of postElements) {
              const hasText = await this.elementHasContent(element);
              if (hasText) {
                validPosts.push(element);
              }
            }

            if (validPosts.length > 0) {
              postElements = validPosts;
              this.logger.log(`Validated ${postElements.length} actual posts`);
              break;
            }
          }
        } catch (error) {
          this.logger.debug(`Selector failed: ${selector}`);
          continue;
        }
      }

      if (postElements.length === 0) {
        this.logger.warn('No posts found with any selector');
        // Try alternative approach - find all elements with user content
        postElements = await this.findPostsByContent(driver);

        if (postElements.length === 0) {
          this.logger.error('Failed to find any posts. Saving debug information...');
          await this.saveDebugInfo(driver);
          return posts;
        }
      }

      // Limit to maxPosts
      const postsToProcess = Math.min(postElements.length, maxPosts);
      this.logger.log(`Processing ${postsToProcess} posts...`);

      for (let i = 0; i < postsToProcess; i++) {
        try {
          const post = await this.extractPostData(
            driver,
            postElements[i],
            includeComments,
            maxCommentsPerPost,
          );
          if (post) {
            posts.push(post);
            this.logger.log(`Extracted post ${i + 1}/${postsToProcess}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to extract post ${i + 1}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error extracting posts: ${error.message}`);
    }

    return posts;
  }

  private async extractPostData(
    driver: WebDriver,
    postElement: WebElement,
    includeComments: boolean,
    maxCommentsPerPost: number,
  ): Promise<GroupPost | null> {
    try {
      // Extract post text
      const text = await this.extractPostText(postElement);

      // Extract author information
      const { authorName, authorUrl } = await this.extractAuthorInfo(postElement);

      // Extract post URL
      const postUrl = await this.extractPostUrl(postElement);

      // Extract timestamp
      const timestamp = await this.extractTimestamp(postElement);

      // Extract engagement metrics
      const likesCount = await this.extractLikesCount(postElement);
      const commentsCount = await this.extractCommentsCount(postElement);
      const sharesCount = await this.extractSharesCount(postElement);

      // Extract images
      const images = await this.extractImages(postElement);

      // Extract marketplace-specific fields (price, location, title)
      const { price, location, title } = await this.extractMarketplaceData(postElement);

      // Extract comments if requested
      let comments: Comment[] = [];
      if (includeComments && commentsCount > 0) {
        comments = await this.extractComments(driver, postElement, maxCommentsPerPost);
      }

      return {
        text,
        author_name: authorName,
        author_url: authorUrl,
        url: postUrl,
        timestamp,
        likes_count: likesCount,
        comments_count: commentsCount,
        shares_count: sharesCount,
        images,
        comments,
        ...(title && { title }),
        ...(price && { price }),
        ...(location && { location }),
      };
    } catch (error) {
      this.logger.warn(`Error extracting post data: ${error.message}`);
      return null;
    }
  }

  private async extractPostText(postElement: WebElement): Promise<string> {
    try {
      const textSelectors = [
        By.css('div[dir="auto"]'), // Primary selector for Facebook content
        By.xpath('.//div[@dir="auto"]'), // Relative xpath
        By.css('div[data-ad-preview="message"]'),
        By.css('div.userContent'),
        By.css('div[data-sigil="m-feed-voice-subtitle"]'),
        By.css('div.story_body_container'),
        By.css('p'),
        By.xpath('.//span[contains(@class, "x193iq5w")]'), // Text spans
      ];

      let allTexts: string[] = [];

      for (const selector of textSelectors) {
        try {
          const elements = await postElement.findElements(selector);
          for (const element of elements) {
            try {
              const text = await element.getText();
              if (text && text.trim().length > 0) {
                // Filter out common UI text
                if (!this.isUIText(text)) {
                  allTexts.push(text.trim());
                }
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Remove duplicates and join
      const uniqueTexts = [...new Set(allTexts)];
      if (uniqueTexts.length > 0) {
        return uniqueTexts.join(' ').trim();
      }

      // Fallback: get all text from post
      const text = await postElement.getText();
      return this.cleanPostText(text);
    } catch (error) {
      return '';
    }
  }

  private async extractAuthorInfo(postElement: WebElement): Promise<{ authorName: string | null; authorUrl: string | null }> {
    try {
      const authorSelectors = [
        By.css('h2 a'), // Current Facebook structure uses h2 for author names
        By.xpath('.//h2//a'),
        By.css('h3 a'), // Fallback
        By.css('strong a'),
        By.xpath('.//strong//a'),
        By.css('a[href*="/groups/"][href*="/user/"]'),
        By.css('span.xt0psk2 a'), // Specific class pattern
        By.css('a[data-sigil="feed-ufi-actor"]'),
      ];

      for (const selector of authorSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const authorName = await element.getText();
          const authorUrl = await element.getAttribute('href');

          // Validate it's actually an author name (not a group name or other link)
          if (authorName && authorName.trim().length > 0 && !this.isUIText(authorName)) {
            return {
              authorName: authorName.trim(),
              authorUrl: authorUrl ? this.normalizeUrl(authorUrl) : null,
            };
          }
        } catch (error) {
          continue;
        }
      }

      // Try alternative approach - look for profile links
      try {
        const profileLinks = await postElement.findElements(By.xpath('.//a[contains(@href, "/user/") or contains(@href, "/profile.php")]'));
        if (profileLinks.length > 0) {
          const authorName = await profileLinks[0].getText();
          const authorUrl = await profileLinks[0].getAttribute('href');
          if (authorName && !this.isUIText(authorName)) {
            return {
              authorName: authorName.trim(),
              authorUrl: authorUrl ? this.normalizeUrl(authorUrl) : null,
            };
          }
        }
      } catch (error) {
        // Continue to fallback
      }
    } catch (error) {
      this.logger.warn(`Could not extract author info: ${error.message}`);
    }

    return { authorName: null, authorUrl: null };
  }

  private async extractPostUrl(postElement: WebElement): Promise<string | null> {
    try {
      const urlSelectors = [
        By.css('a[href*="/posts/"]'),
        By.css('a[href*="/permalink/"]'),
        By.css('abbr a'),
      ];

      for (const selector of urlSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const url = await element.getAttribute('href');
          if (url) {
            return this.normalizeUrl(url);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn(`Could not extract post URL: ${error.message}`);
    }

    return null;
  }

  private async extractTimestamp(postElement: WebElement): Promise<Date | null> {
    try {
      const timestampSelectors = [
        By.css('abbr'),
        By.css('time'),
        By.css('[data-sigil="m-feed-voice-subtitle"] abbr'),
      ];

      for (const selector of timestampSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const timestampText = await element.getText();

          // Try to parse relative time (e.g., "2h", "1d", "3 hrs ago")
          const date = this.parseRelativeTime(timestampText);
          if (date) {
            return date;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn(`Could not extract timestamp: ${error.message}`);
    }

    return null;
  }

  private async extractLikesCount(postElement: WebElement): Promise<number> {
    try {
      const likeSelectors = [
        By.xpath(".//a[contains(@href, 'ufi/reaction') or contains(text(), 'Like')]"),
        By.css('[data-sigil="reactions-sentence"]'),
      ];

      for (const selector of likeSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const text = await element.getText();
          const match = text.match(/(\d+[\d,]*)/);
          if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // No likes or couldn't extract
    }

    return 0;
  }

  private async extractCommentsCount(postElement: WebElement): Promise<number> {
    try {
      const commentSelectors = [
        By.xpath(".//a[contains(text(), 'Comment') or contains(text(), 'comment')]"),
        By.css('[data-sigil="comments-token"]'),
      ];

      for (const selector of commentSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const text = await element.getText();
          const match = text.match(/(\d+[\d,]*)/);
          if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // No comments or couldn't extract
    }

    return 0;
  }

  private async extractSharesCount(postElement: WebElement): Promise<number> {
    try {
      const shareSelectors = [
        By.xpath(".//a[contains(text(), 'Share') or contains(text(), 'share')]"),
        By.css('[data-sigil="share-chevron-title"]'),
      ];

      for (const selector of shareSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const text = await element.getText();
          const match = text.match(/(\d+[\d,]*)/);
          if (match) {
            return parseInt(match[1].replace(/,/g, ''), 10);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // No shares or couldn't extract
    }

    return 0;
  }

  private async extractImages(postElement: WebElement): Promise<string[]> {
    const images: string[] = [];

    try {
      const imageElements = await postElement.findElements(By.css('img'));

      for (const imgElement of imageElements) {
        try {
          const src = await imgElement.getAttribute('src');
          // Filter out small icons, profile pictures, etc.
          if (src && !src.includes('emoji') && !src.includes('static') && !src.includes('rsrc.php')) {
            images.push(src);
          }
        } catch (error) {
          // Skip this image
        }
      }
    } catch (error) {
      this.logger.warn(`Could not extract images: ${error.message}`);
    }

    return images;
  }

  private async extractMarketplaceData(postElement: WebElement): Promise<{ price: string | null; location: string | null; title: string | null }> {
    let price: string | null = null;
    let location: string | null = null;
    let title: string | null = null;

    try {
      // Try to find price (typically has currency symbol)
      const priceSelectors = [
        By.xpath(".//*[contains(text(), '$') or contains(text(), '€') or contains(text(), '£') or contains(text(), 'R$')]"),
      ];

      for (const selector of priceSelectors) {
        try {
          const element = await postElement.findElement(selector);
          const text = await element.getText();
          const priceMatch = text.match(/[$€£R$][\d,\.]+/);
          if (priceMatch) {
            price = priceMatch[0];
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Try to find location
      const locationSelectors = [
        By.css('[data-sigil="location"]'),
        By.xpath(".//*[contains(@aria-label, 'location') or contains(@aria-label, 'Location')]"),
      ];

      for (const selector of locationSelectors) {
        try {
          const element = await postElement.findElement(selector);
          location = await element.getText();
          if (location) {
            location = location.trim();
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Try to find listing title (marketplace posts often have a bold title)
      const titleSelectors = [
        By.css('strong'),
        By.css('h4'),
      ];

      for (const selector of titleSelectors) {
        try {
          const element = await postElement.findElement(selector);
          title = await element.getText();
          if (title && title.trim().length > 0 && title.length < 200) {
            title = title.trim();
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // Marketplace data not found (normal for regular posts)
    }

    return { price, location, title };
  }

  private async extractComments(
    driver: WebDriver,
    postElement: WebElement,
    maxComments: number,
  ): Promise<Comment[]> {
    const comments: Comment[] = [];

    try {
      // Try to expand comments section (may need driver for scrolling)
      await this.expandCommentsSection(postElement, driver);

      // Updated comment selectors for current Facebook structure
      const commentSelectors = [
        By.xpath('.//div[@role="article"]'), // Comments are mini-articles
        By.css('div[aria-label*="Comment"]'),
        By.css('div[data-sigil="comment"]'),
        By.css('div[data-ft*="comment"]'),
        By.xpath('.//ul//div[contains(@class, "x1ja2u2z")]//div[@dir="auto"]/ancestor::div[2]'),
      ];

      let commentElements: WebElement[] = [];

      for (const selector of commentSelectors) {
        try {
          commentElements = await postElement.findElements(selector);
          if (commentElements.length > 0) {
            this.logger.log(`Found ${commentElements.length} comments with selector: ${selector}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Extract comment data
      const commentsToProcess = Math.min(commentElements.length, maxComments);

      for (let i = 0; i < commentsToProcess; i++) {
        try {
          const comment = await this.extractCommentData(commentElements[i]);
          if (comment) {
            comments.push(comment);
          }
        } catch (error) {
          this.logger.warn(`Failed to extract comment ${i + 1}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Error extracting comments: ${error.message}`);
    }

    return comments;
  }

  private async expandCommentsSection(postElement: WebElement, driver: WebDriver): Promise<void> {
    try {
      const expandSelectors = [
        By.xpath(".//a[contains(text(), 'View more comments') or contains(text(), 'See more comments')]"),
        By.xpath(".//a[contains(text(), 'View previous comments')]"),
        By.xpath(".//div[@role='button' and contains(text(), 'View')]"),
        By.css('[aria-label*="View more comments"]'),
      ];

      for (const selector of expandSelectors) {
        try {
          const buttons = await postElement.findElements(selector);
          // Click first 3 "load more" buttons
          for (let i = 0; i < Math.min(buttons.length, 3); i++) {
            try {
              // Scroll to button if needed
              await driver.executeScript('arguments[0].scrollIntoView(true);', buttons[i]);
              await buttons[i].click();
              await driver.sleep(500); // Use driver.sleep instead of setTimeout
            } catch (error) {
              // Button not clickable
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // No expand button found
    }
  }

  private async extractCommentData(commentElement: WebElement): Promise<Comment | null> {
    try {
      // Extract comment text
      let text = '';
      try {
        const textElement = await commentElement.findElement(By.css('div[dir="auto"]'));
        text = await textElement.getText();
      } catch (error) {
        text = await commentElement.getText();
      }

      // Extract author info
      let authorName: string | null = null;
      let authorUrl: string | null = null;
      try {
        const authorElement = await commentElement.findElement(By.css('a'));
        authorName = await authorElement.getText();
        authorUrl = await authorElement.getAttribute('href');
        authorUrl = authorUrl ? this.normalizeUrl(authorUrl) : null;
      } catch (error) {
        // Could not extract author
      }

      // Extract likes count
      let likesCount = 0;
      try {
        const likeElement = await commentElement.findElement(By.xpath(".//a[contains(text(), 'Like')]"));
        const likeText = await likeElement.getText();
        const match = likeText.match(/(\d+)/);
        if (match) {
          likesCount = parseInt(match[1], 10);
        }
      } catch (error) {
        // No likes
      }

      // Extract timestamp
      let timestamp: Date | null = null;
      try {
        const timeElement = await commentElement.findElement(By.css('abbr'));
        const timeText = await timeElement.getText();
        timestamp = this.parseRelativeTime(timeText);
      } catch (error) {
        // No timestamp
      }

      return {
        author_name: authorName,
        author_url: authorUrl,
        text: text.trim(),
        likes_count: likesCount,
        timestamp,
      };
    } catch (error) {
      return null;
    }
  }

  private parseRelativeTime(timeString: string): Date | null {
    try {
      const now = new Date();
      const lowerTime = timeString.toLowerCase();

      // Match patterns like "2h", "3d", "1w", "5 mins", "Just now"
      if (lowerTime.includes('just now') || lowerTime.includes('agora')) {
        return now;
      }

      const minuteMatch = lowerTime.match(/(\d+)\s*(min|minute|m)/);
      if (minuteMatch) {
        now.setMinutes(now.getMinutes() - parseInt(minuteMatch[1]));
        return now;
      }

      const hourMatch = lowerTime.match(/(\d+)\s*(h|hour|hr)/);
      if (hourMatch) {
        now.setHours(now.getHours() - parseInt(hourMatch[1]));
        return now;
      }

      const dayMatch = lowerTime.match(/(\d+)\s*(d|day)/);
      if (dayMatch) {
        now.setDate(now.getDate() - parseInt(dayMatch[1]));
        return now;
      }

      const weekMatch = lowerTime.match(/(\d+)\s*(w|week)/);
      if (weekMatch) {
        now.setDate(now.getDate() - parseInt(weekMatch[1]) * 7);
        return now;
      }

      const monthMatch = lowerTime.match(/(\d+)\s*(mo|month)/);
      if (monthMatch) {
        now.setMonth(now.getMonth() - parseInt(monthMatch[1]));
        return now;
      }

      const yearMatch = lowerTime.match(/(\d+)\s*(y|year)/);
      if (yearMatch) {
        now.setFullYear(now.getFullYear() - parseInt(yearMatch[1]));
        return now;
      }
    } catch (error) {
      this.logger.warn(`Failed to parse time: ${timeString}`);
    }

    return null;
  }

  private normalizeUrl(url: string): string {
    // Remove tracking parameters and normalize Facebook URLs
    try {
      const urlObj = new URL(url);
      // Keep only the pathname and convert m.facebook to www.facebook
      if (urlObj.hostname.includes('m.facebook')) {
        urlObj.hostname = 'www.facebook.com';
      }
      return urlObj.origin + urlObj.pathname;
    } catch (error) {
      return url;
    }
  }

  // Helper method to wait for page load
  private async waitForPageLoad(driver: WebDriver): Promise<void> {
    try {
      // Wait for any of these indicators that the page has loaded
      const loadIndicators = [
        By.css('div[dir="auto"]'),
        By.css('h2'),
        By.css('article'),
        By.css('div[role="feed"]'),
      ];

      for (const indicator of loadIndicators) {
        try {
          await driver.wait(until.elementLocated(indicator), 10000);
          this.logger.log('Page load indicator found');
          return;
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn('Page load wait timeout - continuing anyway');
    }
  }

  // Helper method to check if element has actual content
  private async elementHasContent(element: WebElement): Promise<boolean> {
    try {
      const text = await element.getText();
      // Check if element has meaningful text (not just UI elements)
      return !!(text && text.trim().length > 20 && !this.isUIText(text));
    } catch (error) {
      return false;
    }
  }

  // Helper method to find posts by content patterns
  private async findPostsByContent(driver: WebDriver): Promise<WebElement[]> {
    try {
      this.logger.log('Attempting to find posts by content patterns...');

      // Find all elements with user-generated content
      const contentElements = await driver.findElements(By.css('div[dir="auto"]'));
      const postElements: WebElement[] = [];
      const processedParents = new Set<string>();

      for (const contentEl of contentElements) {
        try {
          // Find the parent container that likely represents a post
          const parent = await contentEl.findElement(By.xpath('./ancestor::div[contains(@class, "x1ja2u2z") or contains(@class, "x1lliihq")]'));
          const parentId = await parent.getAttribute('id') || await parent.getAttribute('class');

          // Avoid duplicates
          if (parentId && !processedParents.has(parentId)) {
            processedParents.add(parentId);
            const hasAuthor = await this.elementHasAuthor(parent);
            if (hasAuthor) {
              postElements.push(parent);
            }
          }
        } catch (error) {
          continue;
        }
      }

      this.logger.log(`Found ${postElements.length} posts by content patterns`);
      return postElements;
    } catch (error) {
      this.logger.error(`Error finding posts by content: ${error.message}`);
      return [];
    }
  }

  // Helper to check if element has author information
  private async elementHasAuthor(element: WebElement): Promise<boolean> {
    try {
      // Check for h2 or h3 tags that typically contain author names
      const authorElements = await element.findElements(By.css('h2, h3'));
      return authorElements.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Helper to identify UI text vs content text
  private isUIText(text: string): boolean {
    const uiPatterns = [
      'Like', 'Comment', 'Share', 'J\'aime', 'Commenter', 'Partager',
      'See More', 'See Less', 'En voir plus', 'En voir moins',
      'Write a comment', 'Écrivez un commentaire',
      'View more comments', 'View previous comments',
      'Reply', 'Répondre', 'React', 'Réagir'
    ];

    const lowerText = text.toLowerCase().trim();
    return uiPatterns.some(pattern => lowerText === pattern.toLowerCase() || lowerText.startsWith(pattern.toLowerCase()));
  }

  // Helper to clean post text
  private cleanPostText(text: string): string {
    // Remove excessive whitespace and UI elements
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !this.isUIText(line));

    return lines.join(' ').trim();
  }

  // Helper to save debug information
  private async saveDebugInfo(driver: WebDriver): Promise<void> {
    try {
      const pageSource = await driver.getPageSource();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `debug-facebook-${timestamp}.html`;

      require('fs').writeFileSync(filename, pageSource);
      this.logger.log(`Debug HTML saved to ${filename}`);

      // Also log current URL and page title
      const currentUrl = await driver.getCurrentUrl();
      const pageTitle = await driver.getTitle();
      this.logger.log(`Current URL: ${currentUrl}`);
      this.logger.log(`Page Title: ${pageTitle}`);

      // Try to log any visible error messages
      try {
        const errorElements = await driver.findElements(By.xpath('//div[contains(text(), "error") or contains(text(), "Error")]'));
        for (const errorEl of errorElements) {
          const errorText = await errorEl.getText();
          this.logger.error(`Possible error on page: ${errorText}`);
        }
      } catch (error) {
        // No error elements found
      }
    } catch (error) {
      this.logger.error(`Failed to save debug info: ${error.message}`);
    }
  }
}
