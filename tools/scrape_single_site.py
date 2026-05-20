#!/usr/bin/env python3
"""
Website scraping tool for the WAT framework.
Usage: tools/scrape_single_site.py --url <URL> --output_format <json|csv> --selectors <CSS selectors>
"""

import argparse
import json
import csv
import time
import sys
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


def scrape_website(url, selectors):
    """Scrape data from a website using CSS selectors."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        return {"error": f"Failed to fetch URL: {e}"}

    soup = BeautifulSoup(response.content, 'html.parser')
    data = {}

    for name, selector in selectors.items():
        elements = soup.select(selector)
        data[name] = [elem.get_text(strip=True) for elem in elements]

    return data


def save_output(data, output_format, base_name):
    """Save scraped data to file in specified format."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{base_name}_{timestamp}.{output_format}"
    filepath = f".tmp/{filename}"

    if output_format == "json":
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    elif output_format == "csv":
        if data:
            # Flatten data for CSV
            fieldnames = list(data.keys())
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                # Write rows
                max_len = max(len(v) for v in data.values()) if data else 0
                for i in range(max_len):
                    row = {k: v[i] if i < len(v) else '' for k, v in data.items()}
                    writer.writerow(row)
    else:
        return None, f"Unsupported output format: {output_format}"

    return filepath, None


def main():
    parser = argparse.ArgumentParser(description="Scrape a single website.")
    parser.add_argument("--url", required=True, help="URL of the website to scrape")
    parser.add_argument("--output_format", choices=["json", "csv"], default="json", help="Output format")
    parser.add_argument("--selectors", nargs="+", help="CSS selectors in format name=selector")
    parser.add_argument("--base_name", default="scrape_data", help="Base filename for output")

    args = parser.parse_args()

    # Parse selectors into dict
    selectors = {}
    if args.selectors:
        for selector in args.selectors:
            if '=' in selector:
                name, sel = selector.split('=', 1)
                selectors[name.strip()] = sel.strip()
            else:
                # If no name, use index
                selectors[f"selector{len(selectors)}"] = selector

    if not selectors:
        print("No selectors provided. Use --selectors name=selector", file=sys.stderr)
        sys.exit(1)

    # Validate URL
    parsed = urlparse(args.url)
    if not parsed.scheme or not parsed.netloc:
        print("Invalid URL format", file=sys.stderr)
        sys.exit(1)

    # Scrape
    data = scrape_website(args.url, selectors)

    # Save output
    filepath, error = save_output(data, args.output_format, args.base_name)
    if error:
        print(error, file=sys.stderr)
        sys.exit(1)

    print(f"Data saved to {filepath}")
    return 0


if __name__ == "__main__":
    sys.exit(main())