#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADITYA_SUBSTACK = 'adityaaswani';
const GENTLE_VELOCITY_SUBSTACK = 'gentlevelocity';

async function fetchSubstackPosts(substackName, retries = 3) {
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

      const response = await fetch(`https://${substackName}.substack.com/api/v1/archive`, {
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': `https://${substackName}.substack.com/`,
          'DNT': '1',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No posts found in API response');
    }

    return data.slice(0, 3).map(post => ({
      title: post.title || 'Untitled Post',
      link: post.canonical_url || `https://${substackName}.substack.com`,
      date: new Date(post.post_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      description: (post.subtitle || 'Click to read more...').substring(0, 120).trim()
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
    console.log('Fetching Substack posts...');

    // Fetch feeds sequentially to avoid rate limiting
    const adityaPosts = await fetchSubstackPosts(ADITYA_SUBSTACK);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    const gentleVelocityPosts = await fetchSubstackPosts(GENTLE_VELOCITY_SUBSTACK);
    
    if (!adityaPosts || !gentleVelocityPosts) {
      console.log('Failed to fetch one or more Substack feeds, skipping update');
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
      `// Aditya's latest posts from Substack API\n${adityaPostsCode}`
    );

    updatedContent = updatedContent.replace(
      /\/\/ Gentle Velocity latest posts from RSS feed\nconst gentleVelocityPosts: BlogPost\[\] = \[[\s\S]*?\];/,
      `// Gentle Velocity latest posts from Substack API\n${gentleVelocityPostsCode}`
    );

    // Add update timestamp comment
    const timestamp = new Date().toISOString();
    updatedContent = updatedContent.replace(
      /\/\/ Static post data from Substack feeds \(updated manually\)/,
      `// Static post data from Substack API (auto-updated: ${timestamp})`
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