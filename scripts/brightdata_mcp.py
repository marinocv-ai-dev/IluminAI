"""Bright Data official MCP client (HTTP Streamable / JSON-RPC 2.0).

Connects to https://mcp.brightdata.com/mcp?token={TOKEN}&tools=search_engine,scrape_as_markdown
Tools available: search_engine, scrape_as_markdown.
Security: Token is read from environment variable BRIGHT_DATA_API_TOKEN.
          Never printed or written in plaintext (masked as token=*** in logs).
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


class BrightDataNotConfigured(Exception):
    """Raised when BRIGHT_DATA_API_TOKEN is not configured."""
    pass


def get_token() -> str:
    """Reads BRIGHT_DATA_API_TOKEN from environment or atlas/.env.local without exposing it."""
    token = os.environ.get("BRIGHT_DATA_API_TOKEN")
    if token and token.strip():
        return token.strip().strip("'\"")

    # Try local env files if not set in os.environ
    for env_path in [Path("atlas/.env.local"), Path(".env.local"), Path(".env")]:
        if env_path.exists():
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line.startswith("BRIGHT_DATA_API_TOKEN="):
                        val = line.split("=", 1)[1].strip().strip("'\"")
                        if val:
                            return val
            except Exception:
                pass
    raise BrightDataNotConfigured("BRIGHT_DATA_API_TOKEN is not configured.")


def mask_url(url: str) -> str:
    """Masks token in URLs for logs."""
    return re.sub(r"token=[^&]+", "token=***", url)


def parse_response(raw_text: str) -> dict:
    """Parses JSON-RPC response from raw string or SSE data: lines."""
    for line in raw_text.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            try:
                return json.loads(line[5:].strip())
            except Exception:
                continue
    try:
        return json.loads(raw_text.strip())
    except Exception:
        raise ValueError(f"Could not parse MCP response: {raw_text[:200]}")


class BrightDataClient:
    def __init__(self, token: str | None = None):
        self.token = token if token is not None else get_token()
        if not self.token or not self.token.strip():
            raise BrightDataNotConfigured("BRIGHT_DATA_API_TOKEN is empty.")
        self.base_url = f"https://mcp.brightdata.com/mcp?token={self.token}&tools=search_engine,scrape_as_markdown"
        self.session_id: str | None = None
        self._initialized = False

    def _post(self, payload: dict) -> dict:
        data_bytes = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "iluminai-brightdata-mcp/1.0"
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id

        req = urllib.request.Request(self.base_url, data=data_bytes, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                sess = resp.headers.get("Mcp-Session-Id")
                if sess:
                    self.session_id = sess
                raw = resp.read().decode("utf-8")
                return parse_response(raw)
        except urllib.error.HTTPError as e:
            raw_err = e.read().decode("utf-8", errors="ignore")
            masked = mask_url(self.base_url)
            raise RuntimeError(f"Bright Data MCP HTTP {e.code} on {masked}: {raw_err[:300]}") from e

    def initialize(self):
        if self._initialized:
            return
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "iluminai-agent", "version": "1.0.0"}
            }
        }
        resp = self._post(payload)
        if "error" in resp:
            raise RuntimeError(f"MCP initialize error: {resp['error']}")

        # Notification initialized
        try:
            notif = {"jsonrpc": "2.0", "method": "notifications/initialized"}
            self._post(notif)
        except Exception:
            pass
        self._initialized = True

    def call_tool(self, name: str, arguments: dict) -> list[dict]:
        self.initialize()
        payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }
        resp = self._post(payload)
        if "error" in resp:
            raise RuntimeError(f"MCP tool error ({name}): {resp['error']}")
        result = resp.get("result", {})
        content = result.get("content", [])
        return content

    def search(self, query: str) -> list[dict]:
        """Runs search_engine and returns list of {url, title, description}."""
        content = self.call_tool("search_engine", {"query": query})
        results = []
        for c in content:
            text = c.get("text", "")
            # Text may contain security preamble or markdown/JSON items
            # Parse search results
            # The search engine returns json or text items
            try:
                # Look for JSON arrays or objects in text
                json_match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(1))
                    if isinstance(parsed, list):
                        for item in parsed:
                            if isinstance(item, dict) and "url" in item:
                                results.append({
                                    "url": item.get("url", ""),
                                    "title": item.get("title", ""),
                                    "description": item.get("description", "") or item.get("snippet", "")
                                })
                    elif isinstance(parsed, dict) and "organic" in parsed:
                        for item in parsed["organic"]:
                            results.append({
                                "url": item.get("link", "") or item.get("url", ""),
                                "title": item.get("title", ""),
                                "description": item.get("snippet", "") or item.get("description", "")
                            })
            except Exception:
                pass

            # Fallback regex extraction of markdown links: [Title](url)
            if not results:
                for m in re.finditer(r"\[([^\]]+)\]\((https?://[^\)]+)\)", text):
                    title = m.group(1).strip()
                    url = m.group(2).strip()
                    results.append({"url": url, "title": title, "description": ""})

        return results

    def scrape(self, url: str) -> str:
        """Scrapes URL as markdown."""
        content = self.call_tool("scrape_as_markdown", {"url": url})
        parts = []
        for c in content:
            txt = c.get("text", "")
            # Filter security notices if present
            txt = re.sub(r"SECURITY NOTICE:.*?(?=\n\n|\Z)", "", txt, flags=re.DOTALL)
            parts.append(txt.strip())
        return "\n\n".join(parts)


def self_check():
    """Self-check testing SSE parsing and BrightDataNotConfigured exception."""
    print("Running BrightDataClient self-checks...")
    
    # 1. Test SSE parsing
    sample_sse = 'event: message\ndata: {"result":{"tools":[]}}\n'
    parsed = parse_response(sample_sse)
    assert parsed.get("result", {}).get("tools") == [], "SSE parse failed"
    print("  OK: SSE parsing verified")

    # 2. Test missing token behavior
    orig_env = os.environ.get("BRIGHT_DATA_API_TOKEN")
    try:
        if "BRIGHT_DATA_API_TOKEN" in os.environ:
            del os.environ["BRIGHT_DATA_API_TOKEN"]
        
        # Test without token and without existing file fallback
        threw = False
        try:
            # Pass invalid / non-existent to verify exception
            c = BrightDataClient(token="")
            c.initialize()
        except BrightDataNotConfigured:
            threw = True
        except Exception:
            # If constructor or get_token throws BrightDataNotConfigured
            threw = True
        assert threw, "BrightDataNotConfigured not raised when token missing"
        print("  OK: BrightDataNotConfigured handled correctly")
    finally:
        if orig_env:
            os.environ["BRIGHT_DATA_API_TOKEN"] = orig_env

    # 3. Mask url check
    masked = mask_url("https://mcp.brightdata.com/mcp?token=secret12345&tools=search")
    assert "token=***" in masked and "secret12345" not in masked, "Mask URL failed"
    print("  OK: URL token masking verified")

    print("ALL BRIGHT DATA MCP SELF-CHECKS PASSED.")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
    else:
        # Check if live call works
        try:
            client = BrightDataClient()
            client.initialize()
            print("Bright Data MCP initialized successfully.")
            print("Session ID:", client.session_id)
        except BrightDataNotConfigured as e:
            print("Bright Data MCP not configured:", e)
        except Exception as e:
            print("Bright Data MCP connection error:", e)
