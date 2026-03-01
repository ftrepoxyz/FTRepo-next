#!/usr/bin/env python3
"""
Standalone JSON feed generator for FTRepo.
Generates all 4 JSON formats (AltStore, ESign, Scarlet, Feather) from GitHub Releases.
Runs independently of the main system as a backup via GitHub Actions.
"""

import json
import os
import re
import sys
from datetime import datetime

import requests
import yaml


def load_config():
    """Load source metadata from .github/config.yml."""
    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yml")
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def get_releases(token, repo):
    """Fetch all releases from the GitHub repository."""
    headers = {"Authorization": f"token {token}"} if token else {}
    releases = []
    page = 1

    while True:
        url = f"https://api.github.com/repos/{repo}/releases?page={page}&per_page=100"
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        releases.extend(data)
        page += 1

    return releases


def parse_release(release):
    """Extract app metadata from a release."""
    tag = release.get("tag_name", "")
    name = release.get("name", tag)
    body = release.get("body", "")
    created = release.get("created_at", "")

    # Try to extract bundle ID and version from tag (format: bundleid-version-timestamp)
    parts = tag.rsplit("-", 2)
    if len(parts) >= 2:
        bundle_id = parts[0]
        version = parts[1] if len(parts) >= 2 else "1.0"
    else:
        bundle_id = tag
        version = "1.0"

    # Get IPA asset
    assets = release.get("assets", [])
    ipa_asset = None
    for asset in assets:
        if asset["name"].lower().endswith(".ipa"):
            ipa_asset = asset
            break

    if not ipa_asset:
        return None

    # Extract app name from release name or body
    app_name = name.split(" v")[0] if " v" in name else name

    # Check for tweaked indicator
    is_tweaked = "tweak" in body.lower() or "tweak" in name.lower()

    return {
        "bundle_id": bundle_id,
        "app_name": app_name,
        "version": version,
        "size": ipa_asset.get("size", 0),
        "download_url": ipa_asset.get("browser_download_url", ""),
        "date": created[:10] if created else datetime.now().strftime("%Y-%m-%d"),
        "description": body or f"{app_name} v{version}",
        "is_tweaked": is_tweaked,
    }


def group_by_bundle(apps):
    """Group apps by bundle ID, sorted by date descending."""
    groups = {}
    for app in apps:
        bid = app["bundle_id"]
        if bid not in groups:
            groups[bid] = []
        groups[bid].append(app)

    for bid in groups:
        groups[bid].sort(key=lambda a: a["date"], reverse=True)

    return groups


def generate_altstore(apps, config, max_versions=5):
    """Generate AltStore-format JSON."""
    source = config.get("source", {})
    grouped = group_by_bundle(apps)

    store_apps = []
    for _bid, versions in grouped.items():
        latest = versions[0]
        store_apps.append({
            "name": latest["app_name"],
            "bundleIdentifier": latest["bundle_id"],
            "developerName": "Unknown Developer",
            "subtitle": "Tweaked" if latest["is_tweaked"] else "",
            "localizedDescription": latest["description"],
            "iconURL": "",
            "tintColor": source.get("tintColor", "#5C7AEA"),
            "screenshotURLs": [],
            "versions": [
                {
                    "version": v["version"],
                    "date": v["date"],
                    "size": v["size"],
                    "downloadURL": v["download_url"],
                    "localizedDescription": v["description"],
                }
                for v in versions[:max_versions]
            ],
            "appPermissions": {"entitlements": [], "privacy": []},
        })

    return {
        "name": source.get("name", "FTRepo"),
        "subtitle": source.get("subtitle", "iOS App Repository"),
        "description": source.get("description", ""),
        "iconURL": source.get("iconURL", ""),
        "headerURL": source.get("headerURL", ""),
        "website": source.get("website", ""),
        "tintColor": source.get("tintColor", "#5C7AEA"),
        "featuredApps": source.get("featuredApps", []),
        "apps": store_apps,
        "news": config.get("news", []),
    }


def generate_esign(apps, config):
    """Generate ESign-format JSON."""
    source = config.get("source", {})
    latest_per_bundle = {}
    for app in apps:
        bid = app["bundle_id"]
        if bid not in latest_per_bundle or app["date"] > latest_per_bundle[bid]["date"]:
            latest_per_bundle[bid] = app

    esign_apps = []
    for app in latest_per_bundle.values():
        esign_apps.append({
            "name": app["app_name"],
            "version": app["version"],
            "versionDate": app["date"],
            "size": app["size"],
            "down": app["download_url"],
            "developerName": "Unknown Developer",
            "bundleIdentifier": app["bundle_id"],
            "iconURL": "",
            "localizedDescription": app["description"],
            "screenshotURLs": [],
            "tintColor": source.get("tintColor", "#5C7AEA"),
        })

    return {
        "name": source.get("name", "FTRepo"),
        "identifier": f"com.ftrepo.{source.get('name', 'ftrepo').lower().replace(' ', '')}",
        "apps": esign_apps,
    }


def hex_to_rgb_floats(hex_color):
    """Convert hex color to RGB floats (0-1) for Scarlet."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return {"red": round(r, 3), "green": round(g, 3), "blue": round(b, 3)}


def generate_scarlet(apps, config):
    """Generate Scarlet-format JSON."""
    source = config.get("source", {})
    rgb = hex_to_rgb_floats(source.get("tintColor", "#5C7AEA"))

    latest_per_bundle = {}
    for app in apps:
        bid = app["bundle_id"]
        if bid not in latest_per_bundle or app["date"] > latest_per_bundle[bid]["date"]:
            latest_per_bundle[bid] = app

    scarlet_apps = []
    for app in latest_per_bundle.values():
        scarlet_apps.append({
            "name": app["app_name"],
            "version": app["version"],
            "down": app["download_url"],
            "category": "Tweaked" if app["is_tweaked"] else "Other",
            "bundleID": app["bundle_id"],
            "icon": "",
            "description": app["description"],
            "developer": "Unknown Developer",
            "screenshots": [],
            "accentColor": {"light": rgb},
        })

    return {
        "META": {
            "repoName": source.get("name", "FTRepo"),
            "repoIcon": source.get("iconURL", ""),
        },
        "data": scarlet_apps,
    }


def main():
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")

    if not repo:
        print("Error: GITHUB_REPOSITORY not set", file=sys.stderr)
        sys.exit(1)

    print(f"Generating JSON feeds for {repo}...")

    config = load_config()
    releases = get_releases(token, repo)
    print(f"Found {len(releases)} releases")

    apps = []
    for release in releases:
        parsed = parse_release(release)
        if parsed:
            apps.append(parsed)

    print(f"Parsed {len(apps)} apps with IPA assets")

    max_versions = 5

    # Generate all formats
    altstore = generate_altstore(apps, config, max_versions)
    esign = generate_esign(apps, config)
    scarlet = generate_scarlet(apps, config)
    feather = altstore  # Feather uses AltStore format

    # Write files
    for filename, data in [
        ("store.json", altstore),
        ("esign.json", esign),
        ("scarlet.json", scarlet),
        ("feather.json", feather),
    ]:
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  Written {filename}")

    print("Done!")


if __name__ == "__main__":
    main()
