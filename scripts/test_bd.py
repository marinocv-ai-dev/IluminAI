import json
import urllib.request
from pathlib import Path

def parse_sse_or_json(raw: str):
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            return json.loads(line[5:].strip())
    return json.loads(raw)

def test():
    lines = Path('atlas/.env.local').read_text(encoding='utf-8').splitlines()
    token = [l.split('=',1)[1].strip().strip('\'"') for l in lines if l.startswith('BRIGHT_DATA_API_TOKEN')][0]
    base_url = f"https://mcp.brightdata.com/mcp?token={token}&tools=search_engine,scrape_as_markdown"
    
    # 1. Initialize
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"}
        }
    }
    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        session_id = resp.headers.get("Mcp-Session-Id")
        
    # 2. tools/call search_engine
    payload_call = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "search_engine",
            "arguments": {
                "query": "CACNA1E foundation families"
            }
        }
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
        
    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload_call).encode("utf-8"),
        headers=headers
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = resp.read().decode("utf-8")
        parsed = parse_sse_or_json(raw)
        print("Call result:", str(parsed)[:300])

if __name__ == "__main__":
    test()
