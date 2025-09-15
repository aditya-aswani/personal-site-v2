#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADITYA_SUBSTACK = 'adityaaswani';
const GENTLE_VELOCITY_SUBSTACK = 'gentlevelocity';

async function fetchRSSFeed(substackName, retries = 3) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ];

  for (let i = 0; i < retries; i++) {
    try {
      // Add small delay between retries
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 * i));
      }

      const response = await fetch(`https://${substackName}.substack.com/feed`, {
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://google.com/',
          'DNT': '1',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    if (!text || text.length < 100) {
      throw new Error('Empty or invalid RSS response');
    }
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true
    });
    
    const result = parser.parse(text);
    const items = result.rss?.channel?.item;
    
    if (!items) {
      throw new Error('No RSS items found');
    }
    
    const itemsArray = Array.isArray(items) ? items : [items];
    
      return itemsArray.slice(0, 3).map(item => ({
        title: item.title || 'Untitled Post',
        link: item.link || `https://${substackName}.substack.com`,
        date: new Date(item.pubDate).toLocaleDateString('en-US', { 
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        description: item.description?.replace(/<[^>]*>/g, '').substring(0, 120).trim() || 'Click to read more...'
      }));
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Error fetching ${substackName} posts after ${retries} attempts:`, error);
        return null;
      }
      console.log(`Attempt ${i + 1} failed for ${substackName}, retrying...`);
    }
  }
  return null;
}

async function updateWritingSection() {
  try {
    console.log('Fetching RSS feeds...');
    
    // Fetch feeds sequentially to avoid rate limiting
    const adityaPosts = await fetchRSSFeed(ADITYA_SUBSTACK);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    const gentleVelocityPosts = await fetchRSSFeed(GENTLE_VELOCITY_SUBSTACK);
    
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
      /\/\/ Aditya's latest posts from RSS feed\nconst adityaPosts: BlogPost\[\] = \[[\s\S]*?\];/,
      `// Aditya's latest posts from RSS feed\n${adityaPostsCode}`
    );
    
    updatedContent = updatedContent.replace(
      /\/\/ Gentle Velocity latest posts from RSS feed\nconst gentleVelocityPosts: BlogPost\[\] = \[[\s\S]*?\];/,
      `// Gentle Velocity latest posts from RSS feed\n${gentleVelocityPostsCode}`
    );
    
    // Add update timestamp comment
    const timestamp = new Date().toISOString();
    updatedContent = updatedContent.replace(
      /\/\/ Static post data from Substack feeds \(updated manually\)/,
      `// Static post data from Substack feeds (auto-updated: ${timestamp})`
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