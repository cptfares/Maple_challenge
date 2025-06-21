import asyncio
import logging
import requests
from typing import List, Dict, Any, Set
from urllib.parse import urljoin, urlparse
import trafilatura
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class WebScraper:
    def __init__(self):
        self.visited_urls: Set[str] = set()
        
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and not a file download"""
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return False
            
            # Skip common file extensions
            skip_extensions = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.tar', '.gz'}
            if any(url.lower().endswith(ext) for ext in skip_extensions):
                return False
                
            return True
        except:
            return False
    
    def _extract_links(self, html_content: str, base_url: str) -> List[str]:
        """Extract all valid links from HTML content"""
        soup = BeautifulSoup(html_content, 'html.parser')
        links = []
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(base_url, href)
            
            # Only include links from the same domain
            base_domain = urlparse(base_url).netloc
            link_domain = urlparse(full_url).netloc
            
            if link_domain == base_domain and self._is_valid_url(full_url):
                links.append(full_url)
        
        return list(set(links))  # Remove duplicates
    
    async def _scrape_with_playwright(self, url: str) -> Dict[str, Any]:
        """Scrape dynamic content using Playwright"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Set user agent to avoid blocking
                await page.set_extra_http_headers({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                
                await page.goto(url, wait_until='networkidle', timeout=30000)
                html_content = await page.content()
                await browser.close()
                
                # Extract clean text using trafilatura
                text = trafilatura.extract(html_content)
                
                return {
                    'url': url,
                    'content': text or '',
                    'html': html_content,
                    'success': True
                }
                
        except Exception as e:
            logger.warning(f"Playwright failed for {url}: {str(e)}")
            return {'url': url, 'content': '', 'html': '', 'success': False}
    
    def _scrape_with_requests(self, url: str) -> Dict[str, Any]:
        """Scrape static content using requests and BeautifulSoup"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Extract clean text using trafilatura
            text = trafilatura.extract(response.text)
            
            return {
                'url': url,
                'content': text or '',
                'html': response.text,
                'success': True
            }
            
        except Exception as e:
            logger.warning(f"Requests failed for {url}: {str(e)}")
            return {'url': url, 'content': '', 'html': '', 'success': False}
    
    async def _scrape_single_page(self, url: str) -> Dict[str, Any]:
        """Scrape a single page, trying Playwright first, then requests"""
        logger.info(f"Scraping: {url}")
        
        # Try Playwright first for dynamic content
        result = await self._scrape_with_playwright(url)
        
        # If Playwright fails or returns empty content, try requests
        if not result['success'] or not result['content'].strip():
            logger.info(f"Playwright failed for {url}, trying requests...")
            result = self._scrape_with_requests(url)
        
        return result
    
    async def scrape_website(self, start_url: str, max_depth: int = 2) -> List[Dict[str, Any]]:
        """
        Scrape a website starting from the given URL up to the specified depth.
        
        Args:
            start_url: The starting URL to scrape
            max_depth: Maximum crawl depth (default: 2)
            
        Returns:
            List of dictionaries containing scraped content
        """
        if not self._is_valid_url(start_url):
            raise ValueError(f"Invalid URL: {start_url}")
        
        self.visited_urls.clear()
        scraped_data = []
        urls_to_visit = [(start_url, 0)]  # (url, depth)
        
        while urls_to_visit:
            current_url, depth = urls_to_visit.pop(0)
            
            # Skip if already visited or depth exceeded
            if current_url in self.visited_urls or depth > max_depth:
                continue
            
            self.visited_urls.add(current_url)
            
            # Scrape the current page
            page_data = await self._scrape_single_page(current_url)
            
            if page_data['success'] and page_data['content'].strip():
                scraped_data.append(page_data)
                logger.info(f"Successfully scraped {current_url} (depth: {depth})")
                
                # Extract links for next depth level if we haven't reached max depth
                if depth < max_depth:
                    try:
                        links = self._extract_links(page_data['html'], current_url)
                        for link in links[:10]:  # Limit to 10 links per page to avoid explosion
                            if link not in self.visited_urls:
                                urls_to_visit.append((link, depth + 1))
                    except Exception as e:
                        logger.warning(f"Failed to extract links from {current_url}: {str(e)}")
            else:
                logger.warning(f"Failed to scrape meaningful content from {current_url}")
            
            # Add small delay to be respectful to the server
            await asyncio.sleep(0.5)
        
        logger.info(f"Scraping completed. Total pages scraped: {len(scraped_data)}")
        return scraped_data
