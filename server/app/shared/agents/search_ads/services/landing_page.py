from __future__ import annotations

from typing import Any
from urllib.parse import urljoin, urlparse

import httpx


class LandingPageService:
    def __init__(self) -> None:
        self.default_headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    async def resolve_landing_url(
        self,
        url: str,
        proxy: str | dict[str, str] | None = None,
        timeout: float = 15.0,
    ) -> dict[str, Any]:
        original_url = (url or "").strip()
        result: dict[str, Any] = {
            "original_url": original_url or None,
            "final_url": None,
            "domain": None,
            "redirect_chain": [],
            "status": "pending",
            "error": None,
            "final_status_code": None,
        }

        if not original_url:
            result.update({"status": "skipped", "error": "Missing target_url"})
            return result

        if not original_url.startswith(("http://", "https://")):
            original_url = f"https://{original_url}"
            result["original_url"] = original_url

        try:
            try:
                import certifi as _certifi

                verify: Any = _certifi.where()
            except Exception:
                verify = False

            client_kwargs: dict[str, Any] = {
                "timeout": httpx.Timeout(timeout, connect=5.0),
                "headers": self.default_headers,
                "verify": verify,
            }

            proxy_url = _build_proxy_url(proxy)
            if proxy_url:
                client_kwargs["proxy"] = proxy_url

            async with httpx.AsyncClient(**client_kwargs) as client:
                await self._trace_redirects(client, original_url, result)

        except httpx.TimeoutException as exc:
            _mark_partial_or_failed(result, original_url, f"Timeout ({timeout}s): {exc}")
        except httpx.ConnectError as exc:
            _mark_partial_or_failed(result, original_url, f"Connection error: {exc}")
        except httpx.DecodingError:
            _mark_partial_or_failed(result, original_url, None)
        except httpx.RequestError as exc:
            _mark_partial_or_failed(result, original_url, f"Request error ({type(exc).__name__}): {exc}")
        except Exception as exc:
            _mark_partial_or_failed(result, original_url, f"Unexpected error ({type(exc).__name__}): {exc}")

        return result

    async def _trace_redirects(
        self,
        client: httpx.AsyncClient,
        original_url: str,
        result: dict[str, Any],
        *,
        max_redirects: int = 15,
    ) -> None:
        current_url = original_url
        redirect_chain: list[str] = result["redirect_chain"]

        for _ in range(max_redirects):
            if current_url not in redirect_chain:
                redirect_chain.append(current_url)

            response = await client.get(current_url, follow_redirects=False)
            result["final_status_code"] = response.status_code

            if not response.is_redirect:
                final_url = str(response.url)
                if final_url not in redirect_chain:
                    redirect_chain.append(final_url)
                result["final_url"] = final_url
                result["domain"] = urlparse(final_url).netloc.lower()
                result["status"] = "success"
                return

            location = response.headers.get("location")
            if not location:
                result["final_url"] = str(response.url)
                result["domain"] = urlparse(str(response.url)).netloc.lower()
                result["status"] = "partial"
                result["error"] = "Redirect response missing Location header"
                return

            current_url = urljoin(str(response.url), location)

        result["status"] = "failed"
        result["error"] = "Too many redirects"


def _build_proxy_url(proxy: str | dict[str, str] | None) -> str | None:
    if not proxy:
        return None
    if isinstance(proxy, str):
        return proxy
    if not proxy.get("enabled"):
        return None

    server = proxy.get("server", "")
    if not server:
        return None

    username = proxy.get("username")
    password = proxy.get("password")
    if not username or not password:
        return server

    parsed = urlparse(server)
    return parsed._replace(netloc=f"{username}:{password}@{parsed.netloc}").geturl()


def _mark_partial_or_failed(result: dict[str, Any], original_url: str, error: str | None) -> None:
    redirect_chain = result.get("redirect_chain") or []
    if not redirect_chain:
        redirect_chain = [original_url]
        result["redirect_chain"] = redirect_chain

    if len(redirect_chain) > 1:
        final_url = redirect_chain[-1]
        result["status"] = "partial"
        result["final_url"] = final_url
        result["domain"] = urlparse(final_url).netloc.lower()
    else:
        result["status"] = "failed"

    result["error"] = error
