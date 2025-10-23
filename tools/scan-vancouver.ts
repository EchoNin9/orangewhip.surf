#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import Parser from 'rss-parser';
import ICAL from 'ical.js';

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

// Set timezone to Vancouver
const VANCOUVER_TZ = 'America/Vancouver';

interface Event {
  title: string;
  date: string;
  venue?: string;
  url?: string;
  source?: string;
}

interface Source {
  name: string;
  type: 'rss' | 'ics';
  url: string;
  enabled: boolean;
  notes?: string;
}

interface SourcesConfig {
  sources: Source[];
}

async function fetchWithTimeout(url: string, timeout = 5000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Orange Whip Vancouver Bot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseRSS(url: string, sourceName: string): Promise<Event[]> {
  try {
    console.log(`Fetching RSS feed: ${sourceName}`);
    const feedData = await fetchWithTimeout(url);
    const parser = new Parser();
    const feed = await parser.parseString(feedData);

    const events: Event[] = [];

    for (const item of feed.items) {
      if (!item.title || !item.pubDate) continue;

      // Try to extract venue from title or description
      let venue = '';
      if (item.title.includes(' - ')) {
        const parts = item.title.split(' - ');
        venue = parts[parts.length - 1];
      }

      events.push({
        title: item.title,
        date: item.pubDate,
        venue: venue || undefined,
        url: item.link || undefined,
        source: sourceName
      });
    }

    console.log(`Parsed ${events.length} events from ${sourceName}`);
    return events;
  } catch (error) {
    console.error(`Error parsing RSS feed ${sourceName}:`, error);
    return [];
  }
}

async function parseICS(url: string, sourceName: string): Promise<Event[]> {
  try {
    console.log(`Fetching ICS feed: ${sourceName}`);
    const icsData = await fetchWithTimeout(url);
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const events = comp.getAllSubcomponents('vevent');

    const parsedEvents: Event[] = [];

    for (const event of events) {
      const vevent = new ICAL.Event(event);
      const summary = vevent.summary;
      const startDate = vevent.startDate;

      if (!summary || !startDate) continue;

      // Try to extract venue from summary
      let venue = '';
      if (summary.includes(' - ')) {
        const parts = summary.split(' - ');
        venue = parts[parts.length - 1];
      }

      parsedEvents.push({
        title: summary,
        date: startDate.toJSDate().toISOString(),
        venue: venue || undefined,
        url: vevent.url || undefined,
        source: sourceName
      });
    }

    console.log(`Parsed ${parsedEvents.length} events from ${sourceName}`);
    return parsedEvents;
  } catch (error) {
    console.error(`Error parsing ICS feed ${sourceName}:`, error);
    return [];
  }
}

function filterVancouverEvents(events: Event[]): Event[] {
  return events.filter(event => {
    const title = event.title.toLowerCase();
    const venue = event.venue?.toLowerCase() || '';
    
    // Check if event is in Vancouver
    const vancouverKeywords = ['vancouver', 'van', 'bc', 'british columbia'];
    const hasVancouverKeyword = vancouverKeywords.some(keyword => 
      title.includes(keyword) || venue.includes(keyword)
    );

    // Check if it's a music-related event
    const musicKeywords = ['concert', 'show', 'music', 'band', 'live', 'performance', 'gig'];
    const hasMusicKeyword = musicKeywords.some(keyword => 
      title.includes(keyword) || venue.includes(keyword)
    );

    return hasVancouverKeyword || hasMusicKeyword;
  });
}

function deduplicateEvents(events: Event[]): Event[] {
  const seen = new Set<string>();
  
  return events.filter(event => {
    const key = `${event.title}-${event.date}-${event.venue || ''}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function categorizeEvents(events: Event[]): { today: Event[]; thisWeek: Event[]; next: Event[] } {
  const now = dayjs().tz(VANCOUVER_TZ);
  const today = now.format('YYYY-MM-DD');
  const startOfWeek = now.startOf('week').format('YYYY-MM-DD');
  const endOfWeek = now.endOf('week').format('YYYY-MM-DD');

  const categorized = {
    today: [] as Event[],
    thisWeek: [] as Event[],
    next: [] as Event[]
  };

  for (const event of events) {
    const eventDate = dayjs(event.date).tz(VANCOUVER_TZ);
    const eventDateStr = eventDate.format('YYYY-MM-DD');

    if (eventDateStr === today) {
      categorized.today.push(event);
    } else if (eventDateStr >= startOfWeek && eventDateStr <= endOfWeek) {
      categorized.thisWeek.push(event);
    } else if (eventDate.isAfter(now) && eventDate.isBefore(now.add(30, 'days'))) {
      categorized.next.push(event);
    }
  }

  // Sort events by date
  categorized.today.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  categorized.thisWeek.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  categorized.next.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return categorized;
}

function generateMarkdown(date: string, events: { today: Event[]; thisWeek: Event[]; next: Event[] }): string {
  const formattedDate = dayjs(date).tz(VANCOUVER_TZ).format('MMMM D, YYYY');
  
  let markdown = `# Vancouver Show Roundup - ${formattedDate}\n\n`;

  if (events.today.length > 0) {
    markdown += `## Today\n\n`;
    for (const event of events.today) {
      const eventTime = dayjs(event.date).tz(VANCOUVER_TZ).format('h:mm A');
      const venue = event.venue ? ` — ${event.venue}` : '';
      const url = event.url ? ` ([${event.title}](${event.url}))` : `**${event.title}**`;
      markdown += `- ${url}${venue} — ${eventTime}\n`;
    }
    markdown += '\n';
  }

  if (events.thisWeek.length > 0) {
    markdown += `## This Week\n\n`;
    for (const event of events.thisWeek) {
      const eventDate = dayjs(event.date).tz(VANCOUVER_TZ).format('MMM D');
      const eventTime = dayjs(event.date).tz(VANCOUVER_TZ).format('h:mm A');
      const venue = event.venue ? ` — ${event.venue}` : '';
      const url = event.url ? ` ([${event.title}](${event.url}))` : `**${event.title}**`;
      markdown += `- ${url}${venue} — ${eventDate} ${eventTime}\n`;
    }
    markdown += '\n';
  }

  if (events.next.length > 0) {
    markdown += `## Next\n\n`;
    for (const event of events.next) {
      const eventDate = dayjs(event.date).tz(VANCOUVER_TZ).format('MMM D');
      const eventTime = dayjs(event.date).tz(VANCOUVER_TZ).format('h:mm A');
      const venue = event.venue ? ` — ${event.venue}` : '';
      const url = event.url ? ` ([${event.title}](${event.url}))` : `**${event.title}**`;
      markdown += `- ${url}${venue} — ${eventDate} ${eventTime}\n`;
    }
  }

  if (events.today.length === 0 && events.thisWeek.length === 0 && events.next.length === 0) {
    markdown += `No Vancouver events found for ${formattedDate}.\n`;
  }

  return markdown;
}

async function main() {
  try {
    console.log('Starting Vancouver event scan...');

    // Load sources configuration
    const sourcesPath = join(process.cwd(), 'tools', 'sources.json');
    const sourcesConfig: SourcesConfig = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    
    const enabledSources = sourcesConfig.sources.filter(source => source.enabled);
    console.log(`Found ${enabledSources.length} enabled sources`);

    if (enabledSources.length === 0) {
      console.log('No enabled sources found. Please enable sources in tools/sources.json');
      // Still create an empty daily file
      const today = dayjs().tz(VANCOUVER_TZ).format('YYYY-MM-DD');
      const emptyEvents = { today: [], thisWeek: [], next: [] };
      const markdown = generateMarkdown(today, emptyEvents);
      
      const dailyPath = join(process.cwd(), 'src', 'content', 'daily', `${today}.md`);
      const frontmatter = `---\ndate: ${today}\ntoday: []\nthisWeek: []\nnext: []\n---\n\n`;
      
      writeFileSync(dailyPath, frontmatter + markdown);
      console.log(`Created empty daily file: ${dailyPath}`);
      return;
    }

    // Fetch events from all enabled sources
    const allEvents: Event[] = [];
    
    for (const source of enabledSources) {
      let events: Event[] = [];
      
      if (source.type === 'rss') {
        events = await parseRSS(source.url, source.name);
      } else if (source.type === 'ics') {
        events = await parseICS(source.url, source.name);
      }
      
      allEvents.push(...events);
    }

    console.log(`Total events fetched: ${allEvents.length}`);

    // Filter and process events
    const vancouverEvents = filterVancouverEvents(allEvents);
    console.log(`Vancouver events after filtering: ${vancouverEvents.length}`);

    const uniqueEvents = deduplicateEvents(vancouverEvents);
    console.log(`Unique events after deduplication: ${uniqueEvents.length}`);

    const categorizedEvents = categorizeEvents(uniqueEvents);
    console.log(`Categorized events - Today: ${categorizedEvents.today.length}, This Week: ${categorizedEvents.thisWeek.length}, Next: ${categorizedEvents.next.length}`);

    // Generate today's date
    const today = dayjs().tz(VANCOUVER_TZ).format('YYYY-MM-DD');
    
    // Generate markdown content
    const markdown = generateMarkdown(today, categorizedEvents);
    
    // Create frontmatter
    const frontmatter = `---
date: ${today}
today: ${JSON.stringify(categorizedEvents.today)}
thisWeek: ${JSON.stringify(categorizedEvents.thisWeek)}
next: ${JSON.stringify(categorizedEvents.next)}
---

`;

    // Write to daily file
    const dailyPath = join(process.cwd(), 'src', 'content', 'daily', `${today}.md`);
    writeFileSync(dailyPath, frontmatter + markdown);
    
    console.log(`Successfully created daily file: ${dailyPath}`);
    console.log(`Events found - Today: ${categorizedEvents.today.length}, This Week: ${categorizedEvents.thisWeek.length}, Next: ${categorizedEvents.next.length}`);

  } catch (error) {
    console.error('Error in Vancouver scan:', error);
    process.exit(1);
  }
}

// Run the script
main();
