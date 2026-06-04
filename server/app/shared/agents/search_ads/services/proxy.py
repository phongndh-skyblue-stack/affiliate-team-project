# app/shared/services/proxy_service.py

class ProxyService:
    async def get_proxy_for_location(self, location: str):
        if location.lower() in ["vietnam", "vn", "việt nam"]:
            return {
                "enabled": True,
                "country": "Vietnam",
                "server": "http://your-vn-proxy:port",
                "username": "username",
                "password": "password",
            }

        if location.lower() in ["united states", "us", "usa"]:
            return {
                "enabled": True,
                "country": "United States",
                "server": "http://your-us-proxy:port",
                "username": "username",
                "password": "password",
            }

        return {
            "enabled": False,
            "country": location,
        }