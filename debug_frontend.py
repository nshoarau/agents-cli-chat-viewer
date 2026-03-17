from playwright.sync_api import sync_playwright
import sys

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        print("Navigating to http://localhost:5173...")
        try:
            page.goto("http://localhost:5173", timeout=30000)
            print("Waiting for networkidle...")
            page.wait_for_load_state("networkidle")
            
            # Take a screenshot
            page.screenshot(path="frontend_debug.png")
            print("Screenshot saved to frontend_debug.png")
            
            # Check for the dashboard title or any relevant content
            title = page.title()
            print(f"Page title: {title}")
            
            # Print some of the page content to see what's rendered
            content = page.content()
            if "Agents CLI Chat Viewer" in content:
                print("Found 'Agents CLI Chat Viewer' in page content.")
            else:
                print("Could NOT find 'Agents CLI Chat Viewer' in page content.")
                print("Body content preview:")
                body_text = page.inner_text("body")
                print(body_text[:500])

        except Exception as e:
            print(f"Error during navigation: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
