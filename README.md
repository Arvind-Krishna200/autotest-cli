# dosmoketest

Zero-config automated web testing CLI. Point it at any URL — it finds
every clickable element, tests them all, and reports real issues.

No config files. No test scripts. Just run it.

## Install

npm install -g dosmoketest

## Usage

dosmoketest run https://yourapp.com

## Options

### Scan Mode
--basic       Fast scan: buttons, nav, forms only (default, ~15s)
--thorough    Full scan: all interactive elements (~30s)

### Crawl
--crawl       Follow navigations and test every page found
--depth <n>   How deep to crawl (default: 2)

### Output
--flat        Show full numbered interaction flow
--live        Print each click as it happens

### Auth
--login       Open browser to log in before testing

### Browser
--browser     for now chrome  | firefox & safari yet to add 

### Export
--export      Save report to results/ folder
--json        Save JSON report to results/ folder

## Config file (optional)
--config config.json 

{
  "blocklist": ["logout", "delete", "#danger-btn"],
  "clicklist": []
}

## Examples

# Quick smoke test
dosmoketest run https://myapp.com

# Full QA with crawl
dosmoketest run https://myapp.com --thorough --crawl

# Test behind login
dosmoketest run https://myapp.com --login --thorough --crawl

# CI pipeline
dosmoketest run https://myapp.com --json


## Cloud Dashboard (Coming Soon)
