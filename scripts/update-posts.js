#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADITYA_RSS_URL = 'https://adityaaswani.substack.com/feed';
const GENTLE_VELOCITY_RSS_URL = 'https://gentlevelocity.substack.com/feed';

async function fetchRSSPosts(rssUrl, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Add small delay between retries
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 * i));
      }

      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Blog RSS Fetcher/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlData = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });

      const result = parser.parse(xmlData);
      const items = result.rss?.channel?.item || [];

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No posts found in RSS feed');
      }

      return items.slice(0, 3).map(item => ({
        title: item.title || 'Untitled Post',
        link: item.link || item.guid || '',
        date: new Date(item.pubDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        description: (item.description || 'Click to read more...')
          .replace(/<[^>]*>/g, '') // Strip HTML tags
          .substring(0, 120)
          .trim()
      }));
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Error fetching RSS feed ${rssUrl} after ${retries} attempts:`, error);
        return null;
      }
      console.log(`Attempt ${i + 1} failed for ${rssUrl}, retrying...`);
    }
  }
  return null;
}

async function updateWritingSection() {
  try {
    console.log('Fetching RSS feeds...');

    // Fetch feeds sequentially to avoid rate limiting
    const adityaPosts = await fetchRSSPosts(ADITYA_RSS_URL);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    const gentleVelocityPosts = await fetchRSSPosts(GENTLE_VELOCITY_RSS_URL);

    if (!adityaPosts || !gentleVelocityPosts) {
      console.log('Failed to fetch one or more RSS feeds, skipping update');
      return;
    }
    
    const componentPath = path.join(__dirname, '..', 'src', 'components', 'WritingSection.astro');
    const componentContent = await fs.readFile(componentPath, 'utf-8');
    
    // Create the new static posts arrays
    const adityaPostsCode = `const adityaPosts: BlogPost[] = [
${adityaPosts.map(post => `  {
    title: "${post.title.replace(/"/g, '\\"')}",
    date: "${post.date}",
    link: "${post.link}",
    description: "${post.description.replace(/"/g, '\\"')}"
  }`).join(',\n')}
];`;

    const gentleVelocityPostsCode = `const gentleVelocityPosts: BlogPost[] = [
${gentleVelocityPosts.map(post => `  {
    title: "${post.title.replace(/"/g, '\\"')}",
    date: "${post.date}",
    link: "${post.link}",
    description: "${post.description.replace(/"/g, '\\"')}"
  }`).join(',\n')}
];`;
    
    // Replace the existing post arrays
    let updatedContent = componentContent.replace(
      /\/\/ Aditya's latest posts from Substack API\nconst adityaPosts: BlogPost\[\] = \[[\s\S]*?\];/,
      `// Aditya's latest posts from RSS feed\n${adityaPostsCode}`
    );

    updatedContent = updatedContent.replace(
      /\/\/ Gentle Velocity latest posts from Substack API\nconst gentleVelocityPosts: BlogPost\[\] = \[[\s\S]*?\];/,
      `// Gentle Velocity latest posts from RSS feed\n${gentleVelocityPostsCode}`
    );

    // Add update timestamp comment
    const timestamp = new Date().toISOString();
    updatedContent = updatedContent.replace(
      /\/\/ Static post data from Substack feeds \(auto-updated: .*?\)/,
      `// Static post data from RSS feeds (auto-updated: ${timestamp})`
    );
    
    await fs.writeFile(componentPath, updatedContent, 'utf-8');
    
    console.log('Successfully updated WritingSection.astro with latest posts');
    console.log(`Aditya posts: ${adityaPosts.length}`);
    console.log(`Gentle Velocity posts: ${gentleVelocityPosts.length}`);
    
    return true;
  } catch (error) {
    console.error('Error updating writing section:', error);
    return false;
  }
}

// Run the update
updateWritingSection().then(success => {
  process.exit(success ? 0 : 1);
});