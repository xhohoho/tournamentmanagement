# Example Workflow: Website Scraping

## Objective
Scrape data from a website and save it to a structured format.

## Required Inputs
- `url`: URL of the website to scrape
- `output_format`: Format for the output (json, csv, etc.)
- `selectors`: CSS selectors for extracting data

## Tools to Use
- `tools/scrape_single_site.py`: Python script for website scraping

## Expected Outputs
- Data saved in `.tmp/` directory with timestamp
- Success/failure report

## Process
1. Validate URL format
2. Check if website is accessible
3. Extract data using provided selectors
4. Convert to requested format
5. Save to `.tmp/` with timestamp

## Edge Cases
- Rate limiting: Implement retry with exponential backoff
- Website structure changes: Log error and continue with next item
- Authentication required: Handle login flow if credentials available

## Notes
- Rate limits: 10 requests per minute
- Timeout: 30 seconds per request
- User agents: Rotate between common browsers