import asyncio
import logging
import requests
import json
import base64
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Any, Set, Optional
from playwright.async_api import async_playwright
import trafilatura

logger = logging.getLogger(__name__)

class EnhancedWebScraper:
    def __init__(self):
        self.scraped_sites = {}
        self.site_structures = {}
        
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and not a file download"""
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return False
            file_extensions = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.exe', '.dmg'}
            if any(url.lower().endswith(ext) for ext in file_extensions):
                return False
            return True
        except Exception:
            return False
    
    def _is_api_endpoint(self, url: str) -> bool:
        api_indicators = ['/api/', '.json', '/v1/', '/v2/', '/graphql', '/rest/']
        return any(indicator in url.lower() for indicator in api_indicators)
    
    def _is_image_url(self, url: str) -> bool:

        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'}
        return any(url.lower().endswith(ext) for ext in image_extensions)
    
    def _extract_links(self, html_content: str, base_url: str) -> Dict[str, List[str]]:
        """Extract different types of links from HTML content"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            links = {'internal': [], 'external': [], 'api': [], 'images': []}
            base_domain = urlparse(base_url).netloc
            
            for link in soup.find_all('a', href=True):
                href = link['href']
                absolute_url = urljoin(base_url, href)
                
                if self._is_valid_url(absolute_url):
                    link_domain = urlparse(absolute_url).netloc
                    
                    if self._is_api_endpoint(absolute_url):
                        links['api'].append(absolute_url)
                    elif base_domain == link_domain:
                        links['internal'].append(absolute_url)
                    else:
                        links['external'].append(absolute_url)
            
            for img in soup.find_all('img', src=True):
                src = img['src']
                absolute_url = urljoin(base_url, src)
                if self._is_image_url(absolute_url):
                    links['images'].append(absolute_url)
            
            for category in links:
                links[category] = list(set(links[category]))
            
            return links
        except Exception as e:
            logger.error(f"Error extracting links: {str(e)}")
            return {'internal': [], 'external': [], 'api': [], 'images': []}
    
    async def _scrape_api_endpoint(self, url: str) -> Dict[str, Any]:
        """Scrape API endpoint and handle JSON data"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '').lower()
            
            if 'application/json' in content_type:
                data = response.json()
                content = f"API Endpoint: {url}\nContent Type: JSON\nData: {json.dumps(data, indent=2)}"
                
                return {
                    'url': url,
                    'title': f"API: {urlparse(url).path}",
                    'content': content,
                    'links': {'internal': [], 'external': [], 'api': [], 'images': []},
                    'content_type': 'json',
                    'raw_data': data,
                    'success': True
                }
            else:
                content = f"API Endpoint: {url}\nContent Type: {content_type}\nContent: {response.text}"
                return {
                    'url': url,
                    'title': f"API: {urlparse(url).path}",
                    'content': content,
                    'links': {'internal': [], 'external': [], 'api': [], 'images': []},
                    'content_type': 'text',
                    'success': True
                }
                
        except Exception as e:
            logger.error(f"Error scraping API endpoint {url}: {str(e)}")
            return {
                'url': url,
                'title': '',
                'content': f"Failed to access API endpoint: {str(e)}",
                'links': {'internal': [], 'external': [], 'api': [], 'images': []},
                'content_type': 'error',
                'success': False,
                'error': str(e)
            }
    
    async def _scrape_image(self, url: str) -> Dict[str, Any]:
        """Scrape image and extract metadata"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '')
            content_length = response.headers.get('content-length', 'Unknown')
            image_data = base64.b64encode(response.content).decode('utf-8')
            
            content = f"Image URL: {url}\nContent Type: {content_type}\nSize: {content_length} bytes\nFilename: {urlparse(url).path.split('/')[-1]}"
            
            return {
                'url': url,
                'title': f"Image: {urlparse(url).path.split('/')[-1]}",
                'content': content,
                'links': {'internal': [], 'external': [], 'api': [], 'images': []},
                'content_type': 'image',
                'image_data': image_data,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Error scraping image {url}: {str(e)}")
            return {
                'url': url,
                'title': '',
                'content': f"Failed to access image: {str(e)}",
                'links': {'internal': [], 'external': [], 'api': [], 'images': []},
                'content_type': 'error',
                'success': False,
                'error': str(e)
            }
    
    async def _scrape_with_playwright(self, url: str) -> Dict[str, Any]:
        """Scrape dynamic content using Playwright"""
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page()
                
                await page.goto(url, wait_until="networkidle")
                content = await page.content()
                title = await page.title()
                
                await browser.close()
                
                main_content = trafilatura.extract(content) or ""
                links = self._extract_links(content, url)
                
                return {
                    'url': url,
                    'title': title,
                    'content': main_content,
                    'links': links,
                    'content_type': 'text',
                    'success': True
                }
        except Exception as e:
            # Suppress Playwright error output in terminal
            logger.debug(f"Playwright error for {url}: {str(e)}")
            return None
    
    def _scrape_with_requests(self, url: str) -> Dict[str, Any]:
        """Scrape static content using requests"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
            title = soup.title.string if soup.title else ""
            
            main_content = trafilatura.extract(html_content) or ""
            links = self._extract_links(html_content, url)
            
            return {
                'url': url,
                'title': title,
                'content': main_content,
                'links': links,
                'content_type': 'text',
                'success': True
            }
        except Exception as e:
            logger.error(f"Requests error for {url}: {str(e)}")
            return None

    async def _scrape_single_page(self, url: str) -> Dict[str, Any]:
        """
        Scrape a single page and determine the method to use based on the URL type.
        Chooses between Playwright for dynamic content, requests for static content,
        or specific handlers for API endpoints and images.
        """
        logger.info(f"Scraping: {url}")
        
        if self._is_api_endpoint(url):
            return await self._scrape_api_endpoint(url)
        elif self._is_image_url(url):
            return await self._scrape_image(url)
        
        try:
            result = await self._scrape_with_playwright(url)
            if result and result.get('content'):
                return result
        except Exception as e:
            logger.warning(f"Playwright failed for {url}: {str(e)}")
        
        try:
            result = self._scrape_with_requests(url)
            if result and result.get('content'):
                return result
        except Exception as e:
            logger.warning(f"Requests failed for {url}: {str(e)}")
        
        return {
            'url': url,
            'title': '',
            'content': '',
            'links': {'internal': [], 'external': [], 'api': [], 'images': []},
            'content_type': 'text',
            'success': False,
            'error': 'Failed to scrape with both methods'
        }

    async def scrape_website(self, start_url: str, max_depth: int = 2) -> Dict[str, Any]:
        """
        Scrape website with enhanced structure analysis.
        This function is used to scrape a website starting from a given URL, 
        it manages the depth of scraping and collects various statistics about the site structure, 
        including internal and external links, API endpoints, images, and content types.
        It uses a breadth-first search approach to explore the site, ensuring that it does not exceed the max depth.
        """
        scraped_pages = []
        visited_urls = set()
        urls_to_scrape = [(start_url, 0)]
        
        site_structure = {
            'domain': urlparse(start_url).netloc,
            'start_url': start_url,
            'total_pages': 0,
            'total_internal_links': 0,
            'total_external_links': 0,
            'total_api_endpoints': 0,
            'total_images': 0,
            'content_types': set(),
            'external_domains': set(),
            'api_endpoints': [],
            'image_urls': [],
            'depth_distribution': {},
            'sitemap': []
        }
        
        while urls_to_scrape:
            current_url, depth = urls_to_scrape.pop(0)
            
            if current_url in visited_urls or depth > max_depth:
                continue
            
            visited_urls.add(current_url)
            logger.info(f"Scraping {current_url} at depth {depth}")
            
            page_data = await self._scrape_single_page(current_url)
            page_data['depth'] = depth
            scraped_pages.append(page_data)
            
            content_type = page_data.get('content_type', 'text')
            site_structure['content_types'].add(content_type)
            site_structure['total_pages'] += 1
            
            if depth not in site_structure['depth_distribution']:
                site_structure['depth_distribution'][depth] = 0
            site_structure['depth_distribution'][depth] += 1
            
            site_structure['sitemap'].append({
                'url': current_url,
                'title': page_data.get('title', ''),
                'depth': depth,
                'content_type': content_type,
                'success': page_data.get('success', False)
            })
            
            if page_data.get('success', False) and depth < max_depth:
                links = page_data.get('links', {})
                
                for link in links.get('internal', []):
                    if link not in visited_urls:
                        urls_to_scrape.append((link, depth + 1))
                
                site_structure['total_internal_links'] += len(links.get('internal', []))
                site_structure['total_external_links'] += len(links.get('external', []))
                site_structure['total_api_endpoints'] += len(links.get('api', []))
                site_structure['total_images'] += len(links.get('images', []))
                
                for ext_link in links.get('external', []):
                    domain = urlparse(ext_link).netloc
                    site_structure['external_domains'].add(domain)
                
                site_structure['api_endpoints'].extend(links.get('api', []))
                site_structure['image_urls'].extend(links.get('images', []))
            
            await asyncio.sleep(0.5)
        
        site_structure['content_types'] = list(site_structure['content_types'])
        site_structure['external_domains'] = list(site_structure['external_domains'])
        
        domain = urlparse(start_url).netloc
        self.scraped_sites[domain] = {
            'pages': scraped_pages,
            'structure': site_structure,
            'scraped_at': asyncio.get_event_loop().time()
        }
        
        logger.info(f"Scraping completed. Total pages: {len(scraped_pages)}")
        
        return {
            'pages': scraped_pages,
            'structure': site_structure,
            'success': True
        }

    def get_all_scraped_sites(self) -> Dict[str, Any]:
        """
        Get information about all scraped sites, including the total number of sites, the number of pages scraped for each site,
        the structure of each site, and the time when each site was last scraped. Returns a dictionary containing this information.
        """
        return {
            'total_sites': len(self.scraped_sites),
            'sites': {domain: {
                'total_pages': len(data['pages']),
                'structure': data['structure'],
                'scraped_at': data['scraped_at']
            } for domain, data in self.scraped_sites.items()}
        }

    def get_aggregated_content(self) -> List[Dict[str, Any]]:
        """
        Get content from all scraped sites aggregated together. It collects content from each page across all sites.
        """
        all_pages = []
        for domain, data in self.scraped_sites.items():
            for page in data['pages']:
                page_copy = page.copy()
                page_copy['source_domain'] = domain
                all_pages.append(page_copy)
        return all_pages

    def remove_site(self, domain: str):
        """Remove a site from scraped_sites by domain key."""
        logger.info(f"remove_site called with domain: {domain}")
        logger.info(f"Current scraped_sites keys: {list(self.scraped_sites.keys())}")
        if domain in self.scraped_sites:
            del self.scraped_sites[domain]
            logger.info(f"Site '{domain}' removed from scraped_sites.")
        else:
            logger.warning(f"Site '{domain}' not found in scraped_sites.")