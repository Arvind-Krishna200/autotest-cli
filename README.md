# autotest-cli 🤖

> Zero-config automated web app testing CLI — login, navigation, API monitoring, and security checks in one command.

![npm version](https://img.shields.io/npm/v/autotest-cli)
![license](https://img.shields.io/npm/l/autotest-cli)
![node](https://img.shields.io/node/v/autotest-cli)

---

## What is it?

`autotest-cli` automatically tests your web app by:

- 🔐 Logging in with your credentials
- 🧭 Clicking every navigation item
- 📡 Monitoring all API calls (XHR/fetch)
- 🖼️ Detecting broken images
- ⚠️ Capturing JavaScript console errors
- 🛡️ Blocking dangerous clicks (delete, reset, logout)
- 🌐 Detecting external redirects

No config files. No test scripts. Just point it at your app.

---

## Install

```bash
npm install -g autotest-cli


## Usage

​```bash
# Basic — no login
autotest run https://yourapp.com

# With login
autotest run https://yourapp.com -u admin -p password

# Quick mode — main nav only (~25s)
autotest run https://yourapp.com -u admin -p password --quick

# Deep mode — main + sub navigation (~90s)
autotest run https://yourapp.com -u admin -p password --deep

# Show only failures
autotest run https://yourapp.com -u admin -p password --deep --only-failures
​```

## Browser Support

| Browser | Flag | Engine |
|---------|------|--------|
| Chrome (default) | `--browser chrome` | Chromium |
| Firefox | `--browser firefox` | Gecko |
| Safari | `--browser safari` | WebKit |

First time setup:
​```bash
npx playwright install
​```