# app/shared/services/browser_service.py
# Dùng patchright thay playwright — Chromium đã được patch binary-level,
# không cần playwright-stealth hay disable-blink-features.
from patchright.async_api import async_playwright


class BrowserService:
    async def create_context(
        self,
        proxy: dict | None = None,
        device: str = "desktop",
        locale: str = "vi-VN",
        record_video_dir: str | None = None,
    ):
        playwright = await async_playwright().start()

        launch_args = {
            "headless": True,
            "args": [
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--window-size=1366,768",
            ],
        }

        browser = await playwright.chromium.launch(**launch_args)

        context_options = {
            "locale": locale,
            "viewport": {"width": 1366, "height": 768},
            "user_agent": self.get_user_agent(device),
            "extra_http_headers": {
                "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            },
        }

        if record_video_dir:
            context_options["record_video_dir"] = record_video_dir
            context_options["record_video_size"] = {"width": 1366, "height": 768}

        if proxy and proxy.get("enabled") and proxy.get("server"):
            context_options["proxy"] = {
                "server": proxy["server"],
                "username": proxy.get("username"),
                "password": proxy.get("password"),
            }

        context = await browser.new_context(**context_options)
        return playwright, browser, context

    def get_user_agent(self, device: str):
        if device == "mobile":
            return (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                "Version/17.0 Mobile/15E148 Safari/604.1"
            )

        return (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
